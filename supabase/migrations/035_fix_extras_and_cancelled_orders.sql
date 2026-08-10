-- 035_fix_extras_and_cancelled_orders.sql
--
-- Bug 1: Extras de desayuno no se sumaban ni aparecían
--   Causa: place_order buscaba extras en products.extras_config y
--   daily_menus.courses.Extras, pero los extras de desayuno vienen
--   de la tabla breakfast_extras (global). No se encontraban → no sumaban.
--   Fix: agregar lookup en breakfast_extras cuando el producto es
--   de categoría Desayunos.
--
-- Bug 3: Pedidos cancelados seguían sumándose a la cuenta de la mesa
--   Causa: get_table_session devolvía todas las órdenes sin filtrar
--   canceladas.
--   Fix: excluir órdenes con status = 'cancelled' de los totales
--   y de la lista de órdenes activas de la sesión.

-- ============================================================================
-- 1. Fix place_order: buscar extras también en breakfast_extras
-- ============================================================================
create or replace function public.place_order(
  p_table_code text,
  p_items jsonb,
  p_notes text,
  p_idempotency_key uuid,
  p_session_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant_id uuid;
  v_table_id uuid;
  v_order_id uuid;
  v_subtotal numeric(10,2);
  v_item_count integer;
begin
  -- Idempotency
  select id into v_order_id
  from public.orders
  where idempotency_key = p_idempotency_key;

  if v_order_id is not null then
    return public.order_as_json(v_order_id);
  end if;

  if jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) < 1
    or jsonb_array_length(p_items) > 30 then
    raise exception 'invalid_items';
  end if;

  select t.id, t.restaurant_id into v_table_id, v_restaurant_id
  from public.tables t
  join public.restaurants r on r.id = t.restaurant_id
  where t.code = upper(trim(p_table_code)) and t.active and r.active
  limit 1;
  if v_table_id is null then raise exception 'invalid_table'; end if;

  -- Validar session_id
  if p_session_id is not null then
    if not exists (
      select 1 from public.table_sessions ts
      where ts.id = p_session_id
        and ts.restaurant_id = v_restaurant_id
        and ts.table_id = v_table_id
        and ts.status = 'active'
    ) then
      raise exception 'invalid_session';
    end if;
  end if;

  -- Rate limit per table
  if (
    select count(*) from public.orders
    where table_id = v_table_id and created_at > now() - interval '1 minute'
  ) >= 8 then
    raise exception 'rate_limited';
  end if;

  -- Validar items y calcular unit_price
  create temporary table temp_validated_items (
    slug           text,
    quantity       integer,
    extras         jsonb,
    option_str     text,
    unit_price     numeric,
    product_id     uuid,
    product_name   text,
    original_item  jsonb
  ) on commit drop;

  insert into temp_validated_items (
    slug, quantity, extras, option_str, unit_price, product_id, product_name, original_item
  )
  with requested as (
    select
      x->>'productId' as slug,
      (x->>'quantity')::integer as quantity,
      x->'extras' as extras,
      nullif(x->>'optionPriceModifier', '')::numeric as client_option_modifier,
      nullif(left(trim(coalesce(x->>'option', '')), 80), '') as option_str,
      x as original_item
    from jsonb_array_elements(p_items) x
  ), validated as (
    select
      r.slug,
      r.quantity,
      r.extras,
      r.option_str,
      r.original_item,
      ----------------------------------------------------------------
      -- unit_price = base_price + extras_cost + option_modifier
      ----------------------------------------------------------------
      -- 1. Base price + extras cost
      case
        -- Comida corrida: extras desde daily_menus.courses.Extras
        when r.slug = 'comida-corrida'
          and r.extras is not null
          and jsonb_typeof(r.extras) = 'array'
          and jsonb_array_length(r.extras) > 0
        then p.price + coalesce((
          select sum(
            greatest(0, (official_extra->>'price')::numeric)
          )
          from jsonb_array_elements(r.extras) requested_extra
          cross join lateral (
            select jsonb_array_elements(
              coalesce(
                (select dm.courses->'Extras' from public.daily_menus dm
                 where dm.restaurant_id = v_restaurant_id and dm.active limit 1),
                '[]'::jsonb
              )
            ) as official_extra
            where official_extra->>'name' = requested_extra->>'name'
              and official_extra->>'active' <> 'false'
          ) official_match
        ), 0)

        -- Productos a la carta con extras_config
        when r.extras is not null
          and jsonb_typeof(r.extras) = 'array'
          and jsonb_array_length(r.extras) > 0
          and p.extras_config is not null
          and jsonb_typeof(p.extras_config) = 'array'
          and jsonb_array_length(p.extras_config) > 0
        then p.price + coalesce((
          select sum(
            greatest(0, (official_extra->>'price')::numeric)
          )
          from jsonb_array_elements(r.extras) requested_extra
          cross join lateral (
            select jsonb_array_elements(p.extras_config) as official_extra
            where official_extra->>'name' = requested_extra->>'name'
              and official_extra->>'active' <> 'false'
          ) official_match
        ), 0)

        -- NUEVO: Extras de desayuno desde breakfast_extras (global)
        -- Si el producto es de categoría Desayunos y tiene extras,
        -- buscar el precio en la tabla breakfast_extras
        when r.extras is not null
          and jsonb_typeof(r.extras) = 'array'
          and jsonb_array_length(r.extras) > 0
          and p.category = 'Desayunos'
        then p.price + coalesce((
          select sum(be.price)
          from jsonb_array_elements(r.extras) requested_extra
          join public.breakfast_extras be
            on be.name = requested_extra->>'name'
            and be.active = true
        ), 0)

        -- NUEVO: Sabores de bebidas desde drink_flavors
        -- Si el producto tiene extras que coinciden con drink_flavors,
        -- sumar el price_modifier
        when r.extras is not null
          and jsonb_typeof(r.extras) = 'array'
          and jsonb_array_length(r.extras) > 0
        then p.price + coalesce((
          select sum(df.price_modifier)
          from jsonb_array_elements(r.extras) requested_extra
          join public.drink_flavors df
            on df.name = requested_extra->>'name'
            and df.active = true
        ), 0)

        else p.price
      end
      +
      ----------------------------------------------------------------
      -- 2. Option price modifier (backend-authoritative)
      ----------------------------------------------------------------
      coalesce(
        case
          when p.option_groups is not null
            and jsonb_typeof(p.option_groups) = 'array'
            and jsonb_path_exists(p.option_groups, '$[*] ? (@.choicePrices != null)')
          then (
            (
              select og->'choicePrices'->>(ch.ch_idx - 1)::numeric
              from jsonb_array_elements(p.option_groups) og
              , jsonb_array_elements_text(
                  case when jsonb_typeof(og->'choices') = 'array'
                    then og->'choices'
                    else '[]'::jsonb
                  end
                ) with ordinality as ch(choice_val, ch_idx)
              where jsonb_typeof(og->'choicePrices') = 'array'
                and jsonb_array_length(og->'choices') = jsonb_array_length(og->'choicePrices')
                and r.option_str is not null
                and ch.choice_val = split_part(r.option_str, ': ', 2)
              limit 1
            )
            union all
            (
              select mod_val::numeric
              from jsonb_array_elements(p.option_groups) og
              cross join jsonb_array_elements_text(
                case when jsonb_typeof(og->'choicePrices') = 'array'
                  then og->'choicePrices'
                  else '[]'::jsonb
                end
              ) with ordinality as cp(mod_val, ord)
              where mod_val::numeric = r.client_option_modifier
              limit 1
            )
            limit 1
          )
          else null
        end,
        0
      )::numeric as unit_price,
      p.id as product_id,
      p.name as product_name
    from requested r
    join public.products p
      on p.restaurant_id = v_restaurant_id
        and p.slug = r.slug
        and p.active
        and not p.sold_out
    where r.quantity between 1 and 10
  )
  select slug, quantity, extras, option_str, unit_price, product_id, product_name, original_item
  from validated;

  -- Count check
  select count(*), coalesce(sum(quantity * unit_price), 0)
    into v_item_count, v_subtotal
  from temp_validated_items;

  if v_item_count <> jsonb_array_length(p_items) then
    raise exception 'invalid_or_unavailable_product';
  end if;

  -- Create order
  insert into public.orders (
    folio, restaurant_id, table_id, subtotal, total, notes, idempotency_key, status, session_id
  ) values (
    'O-' || lpad(nextval('public.order_folio_seq')::text, 4, '0'),
    v_restaurant_id,
    v_table_id,
    v_subtotal,
    v_subtotal,
    left(trim(coalesce(p_notes, '')), 250),
    p_idempotency_key,
    'accepted',
    p_session_id
  ) returning id into v_order_id;

  -- Insert items
  insert into public.order_items (
    order_id, product_id, product_name, unit_price, quantity, notes, selected_option, extras, substitutes
  )
  select
    v_order_id,
    product_id,
    product_name,
    unit_price,
    quantity,
    left(trim(coalesce(original_item->>'notes', '')), 250),
    option_str,
    case
      when extras is not null
        and jsonb_typeof(extras) = 'array'
        and jsonb_array_length(extras) > 0
      then extras
      else null
    end,
    original_item->'substitutes'
  from temp_validated_items;

  insert into public.order_events (order_id, to_status)
  values (v_order_id, 'accepted');

  return public.order_as_json(v_order_id);
end;
$$;

revoke all on function public.place_order(text, jsonb, text, uuid, uuid) from public;
grant execute on function public.place_order(text, jsonb, text, uuid, uuid) to anon, authenticated;

-- ============================================================================
-- 2. Fix get_table_session: excluir órdenes canceladas
-- ============================================================================
create or replace function public.get_table_session(p_table_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session jsonb;
begin
  select jsonb_build_object(
    'id', ts.id,
    'tableCode', t.code,
    'status', ts.status,
    'createdAt', ts.created_at,
    'updatedAt', ts.updated_at,
    'orders', coalesce((
      select jsonb_agg(public.order_as_json(o.id) order by o.created_at asc)
      from public.orders o
      where o.session_id = ts.id
        and o.status != 'cancelled'
    ), '[]'::jsonb)
  )
  into v_session
  from public.table_sessions ts
  join public.tables t on t.id = ts.table_id
  join public.restaurants r on r.id = t.restaurant_id
  where t.code = upper(trim(p_table_code))
    and r.active and t.active
    and ts.status = 'active'
  limit 1;

  return v_session;
end;
$$;

revoke all on function public.get_table_session(text) from public, anon, authenticated;
grant execute on function public.get_table_session(text) to anon, authenticated;

-- ============================================================================
-- 3. Fix kitchen_orders: excluir órdenes canceladas del conteo de mesas activas
--    (ya las excluye en el WHERE, pero aseguramos que no aparezcan en el total)
-- ============================================================================
-- Nota: kitchen_orders ya filtra status not in ('delivered','cancelled')
-- así que esto no necesita cambios.
