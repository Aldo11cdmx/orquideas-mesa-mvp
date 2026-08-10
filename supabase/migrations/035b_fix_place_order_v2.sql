-- 035b_fix_place_order_v2.sql
--
-- Fix: la versión anterior de 035 podía fallar porque:
-- 1. El CASE WHEN de drink_flavors era muy amplio y se ejecutaba
--    para productos que no son bebidas
-- 2. Los JOIN con breakfast_extras y drink_flavors eran INNER JOIN
--    que podían excluir extras válidos
--
-- Esta versión usa LEFT JOIN y prioriza las fuentes correctamente.

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

  if (
    select count(*) from public.orders
    where table_id = v_table_id and created_at > now() - interval '1 minute'
  ) >= 8 then
    raise exception 'rate_limited';
  end if;

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
      p.price
      +
      ----------------------------------------------------------------
      -- EXTRAS COST: busca en múltiples fuentes con LEFT JOIN
      -- Prioridad: extras_config > breakfast_extras > drink_flavors
      -- Cada extra se busca en la primera fuente que lo tenga.
      ----------------------------------------------------------------
      coalesce((
        select sum(extra_cost)
        from jsonb_array_elements(
          case
            when r.extras is not null
              and jsonb_typeof(r.extras) = 'array'
              and jsonb_array_length(r.extras) > 0
            then r.extras
            else '[]'::jsonb
          end
        ) as req_extra
        cross join lateral (
          -- 1. Buscar en extras_config del producto
          select greatest(0, (ec->>'price')::numeric) as extra_cost
          from jsonb_array_elements(
            case
              when p.extras_config is not null
                and jsonb_typeof(p.extras_config) = 'array'
              then p.extras_config
              else '[]'::jsonb
            end
          ) ec
          where ec->>'name' = req_extra->>'name'
            and ec->>'active' <> 'false'
          limit 1
        ) ec_match
        union all
        -- 2. Si no está en extras_config, buscar en breakfast_extras
        select be.price as extra_cost
        from public.breakfast_extras be
        where be.name = req_extra->>'name'
          and be.active = true
          and not exists (
            select 1 from jsonb_array_elements(
              case
                when p.extras_config is not null
                  and jsonb_typeof(p.extras_config) = 'array'
                then p.extras_config
                else '[]'::jsonb
              end
            ) ec
            where ec->>'name' = req_extra->>'name'
              and ec->>'active' <> 'false'
          )
          and p.category = 'Desayunos'
        union all
        -- 3. Si no está en ningún otro lado, buscar en drink_flavors
        select df.price_modifier as extra_cost
        from public.drink_flavors df
        where df.name = req_extra->>'name'
          and df.active = true
          and not exists (
            select 1 from jsonb_array_elements(
              case
                when p.extras_config is not null
                  and jsonb_typeof(p.extras_config) = 'array'
                then p.extras_config
                else '[]'::jsonb
              end
            ) ec
            where ec->>'name' = req_extra->>'name'
              and ec->>'active' <> 'false'
          )
          and not exists (
            select 1 from public.breakfast_extras be2
            where be2.name = req_extra->>'name'
              and be2.active = true
          )
      ), 0)
      +
      ----------------------------------------------------------------
      -- OPTION MODIFIER (backend-authoritative)
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

  select count(*), coalesce(sum(quantity * unit_price), 0)
    into v_item_count, v_subtotal
  from temp_validated_items;

  if v_item_count <> jsonb_array_length(p_items) then
    raise exception 'invalid_or_unavailable_product';
  end if;

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
