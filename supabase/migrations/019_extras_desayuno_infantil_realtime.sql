-- 019 — Extras en pedidos, desayuno infantil y realtime de productos/menú diario.
-- Seguro de ejecutar después de 018_repair_menu_utf8.sql.
-- NO borra datos existentes. NO hace DROP destructivos. NO cambia IDs.

-- ============================================================================
-- 1. Columna extras en order_items (almacena los extras seleccionados)
-- ============================================================================
alter table public.order_items
  add column if not exists extras jsonb default null;

-- ============================================================================
-- 2. Asegurar que licuado y malteada tengan las opciones correctas
-- ============================================================================
update public.products
set
  options = case slug
    when 'licuado' then '["Plátano","Fresa","Mamey"]'::jsonb
    when 'malteada' then '["Fresa","Chocolate","Vainilla","Café","Cajeta"]'::jsonb
    else options
  end,
  image_url = case slug
    when 'licuado' then '/menu/imperio/licuado.jpg'
    when 'malteada' then '/menu/imperio/malteada-fresa.jpg'
    when 'milanesa-res' then '/menu/imperio/milanesa-res.jpg'
    when 'filete-pescado' then '/menu/imperio/pescado-empanizado.jpg'
    when 'club-sandwich' then '/menu/imperio/club-sandwich.jpg'
    else image_url
  end,
  updated_at = now()
where restaurant_id = '00000000-0000-0000-0000-000000000001'
  and slug in ('licuado', 'malteada', 'milanesa-res', 'filete-pescado', 'club-sandwich');

-- ============================================================================
-- 3. Crear el producto "Desayuno infantil" (no existe aún)
-- ============================================================================
insert into public.products (
  restaurant_id, category_id, slug, name, description, price,
  image_url, active, sold_out, popular, is_new,
  options, option_groups, package_includes,
  available_from, available_until
)
select
  '00000000-0000-0000-0000-000000000001',
  c.id,
  'desayuno-infantil',
  'Desayuno infantil',
  'Desayuno especial para los pequeños. Incluye fruta y bebida.',
  50::numeric,
  '/menu/imperio/desayuno-infantil.jpg',
  true,
  false,
  false,
  false,
  '[]'::jsonb,
  '[
    {"id":"plato","label":"Elige el plato principal","choices":["Hot cakes","Huevos estrellados","Chilaquiles sencillos"],"required":true},
    {"id":"bebida","label":"Elige la bebida","choices":["Chocolate","Jugo","Leche"],"required":true}
  ]'::jsonb,
  '["Fruta de temporada","Bebida"]'::jsonb,
  '09:00'::time,
  '13:00'::time
from public.categories c
where c.restaurant_id = '00000000-0000-0000-0000-000000000001'
  and c.name = 'Desayunos'
on conflict (restaurant_id, slug) do update set
  name = excluded.name,
  description = excluded.description,
  price = excluded.price,
  image_url = excluded.image_url,
  active = true,
  option_groups = excluded.option_groups,
  package_includes = excluded.package_includes,
  available_from = excluded.available_from,
  available_until = excluded.available_until,
  updated_at = now();

-- Asegurar que el producto nuevo esté en el menú fijo
insert into public.menu_products (menu_id, product_id, sort_order)
select
  '00000000-0000-0000-0000-000000000101',
  p.id,
  coalesce((select max(sort_order) from public.menu_products where menu_id = '00000000-0000-0000-0000-000000000101'), 0) + 1
from public.products p
where p.restaurant_id = '00000000-0000-0000-0000-000000000001'
  and p.slug = 'desayuno-infantil'
  and p.active
on conflict (menu_id, product_id) do nothing;

-- ============================================================================
-- 4. Actualizar place_order para soportar extras en comida corrida
-- ============================================================================
create or replace function public.place_order(
  p_table_code text,
  p_items jsonb,
  p_notes text,
  p_idempotency_key uuid
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

  -- Basic per-table rate limit.
  if (
    select count(*) from public.orders
    where table_id = v_table_id and created_at > now() - interval '1 minute'
  ) >= 8 then
    raise exception 'rate_limited';
  end if;

  -- Validate items and calculate subtotal including extras for comida corrida.
  -- IMPORTANTE: Los precios de extras se obtienen de la configuración oficial
  -- en daily_menus.courses->'Extras', NO del precio enviado por el cliente.
  with requested as (
    select
      x->>'productId' as slug,
      (x->>'quantity')::integer as quantity,
      x->'extras' as extras
    from jsonb_array_elements(p_items) x
  ), valid as (
    select
      r.slug,
      r.quantity,
      r.extras,
      p.price as base_price,
      case
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
                (select dm.courses->'Extras' from public.daily_menus dm where dm.restaurant_id = v_restaurant_id and dm.active limit 1),
                '[]'::jsonb
              )
            ) as official_extra
            where official_extra->>'name' = requested_extra->>'name'
              and official_extra->>'active' <> 'false'
          ) official_match
        ), 0)
        else p.price
      end as unit_price
    from requested r
    join public.products p
      on p.restaurant_id = v_restaurant_id
      and p.slug = r.slug
      and p.active
      and not p.sold_out
    where r.quantity between 1 and 10
  )
  select count(*), coalesce(sum(quantity * unit_price), 0)
    into v_item_count, v_subtotal
  from valid;

  if v_item_count <> jsonb_array_length(p_items) then
    raise exception 'invalid_or_unavailable_product';
  end if;

  insert into public.orders (
    folio, restaurant_id, table_id, subtotal, total, notes, idempotency_key
  ) values (
    'O-' || lpad(nextval('public.order_folio_seq')::text, 4, '0'),
    v_restaurant_id,
    v_table_id,
    v_subtotal,
    v_subtotal,
    left(trim(coalesce(p_notes, '')), 250),
    p_idempotency_key
  ) returning id into v_order_id;

  insert into public.order_items (
    order_id, product_id, product_name, unit_price, quantity, notes, selected_option, extras
  )
  select
    v_order_id,
    p.id,
    p.name,
    case
      when x->>'productId' = 'comida-corrida'
        and x->'extras' is not null
        and jsonb_typeof(x->'extras') = 'array'
        and jsonb_array_length(x->'extras') > 0
      then p.price + coalesce((
        select sum(
          greatest(0, (official_extra->>'price')::numeric)
        )
        from jsonb_array_elements(x->'extras') requested_extra
        cross join lateral (
          select jsonb_array_elements(
            coalesce(
              (select dm.courses->'Extras' from public.daily_menus dm where dm.restaurant_id = v_restaurant_id and dm.active limit 1),
              '[]'::jsonb
            )
          ) as official_extra
          where official_extra->>'name' = requested_extra->>'name'
            and official_extra->>'active' <> 'false'
        ) official_match
      ), 0)
      else p.price
    end as unit_price,
    (x->>'quantity')::integer,
    left(trim(coalesce(x->>'notes', '')), 250),
    nullif(left(trim(coalesce(x->>'option', '')), 80), ''),
    case
      when x->'extras' is not null
        and jsonb_typeof(x->'extras') = 'array'
        and jsonb_array_length(x->'extras') > 0
      then x->'extras'
      else null
    end as extras
  from jsonb_array_elements(p_items) x
  join public.products p
    on p.restaurant_id = v_restaurant_id
    and p.slug = x->>'productId'
    and p.active
    and not p.sold_out;

  insert into public.order_events (order_id, to_status)
  values (v_order_id, 'sent');

  return public.order_as_json(v_order_id);
end;
$$;

revoke all on function public.place_order(text, jsonb, text, uuid) from public;
grant execute on function public.place_order(text, jsonb, text, uuid) to anon, authenticated;

-- ============================================================================
-- 5. Actualizar order_as_json para devolver extras en los items
-- ============================================================================
create or replace function public.order_as_json(p_order_id uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', o.id,
    'folio', o.folio,
    'tableCode', t.code,
    'status', o.status,
    'paymentMethod', o.payment_method,
    'subtotal', o.subtotal,
    'total', o.total,
    'notes', o.notes,
    'createdAt', o.created_at,
    'updatedAt', o.updated_at,
    'accessToken', o.access_token,
    'source', 'supabase',
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'itemId', oi.id,
          'productId', coalesce(p.slug, oi.product_id::text),
          'name', oi.product_name,
          'unitPrice', oi.unit_price,
          'quantity', oi.quantity,
          'notes', oi.notes,
          'option', oi.selected_option,
          'extras', oi.extras,
          'image', coalesce(p.image_url, '/menu/imperio/chilaquiles-sencillos.jpg')
        )
        order by oi.id
      )
      from public.order_items oi
      left join public.products p on p.id = oi.product_id
      where oi.order_id = o.id
    ), '[]'::jsonb)
  )
  from public.orders o
  join public.tables t on t.id = o.table_id
  where o.id = p_order_id;
$$;

revoke all on function public.order_as_json(uuid) from public, anon, authenticated;

-- ============================================================================
-- 6. Realtime: publicar cambios en products y daily_menus
-- ============================================================================
do $$
begin
  alter publication supabase_realtime add table public.products;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.daily_menus;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.order_items;
exception when duplicate_object then null;
end $$;