-- Paquetes de desayuno y corte de caja real.
-- Ejecutar después de 006_product_image_coherence.sql.

with package_updates(slug, description, options) as (
  values
    ('chilaquiles-sencillos', 'Totopos con crema y cebolla. Paquete con fruta y café.', '["Salsa verde","Salsa roja","Salsa suiza","Queso fresco","Manchego gratinado"]'::jsonb),
    ('huevos-al-gusto', 'Dos huevos con frijoles refritos. Paquete con fruta y café.', '["Revueltos","Estrellados","A la mexicana"]'::jsonb),
    ('chilaquiles-huevo', 'Chilaquiles con un huevo al gusto. Paquete con fruta y café.', '["Salsa verde","Salsa roja","Salsa suiza","Queso fresco","Manchego gratinado"]'::jsonb),
    ('molletes', 'Pan con frijoles, tocino y chorizo. Paquete con fruta y café.', '["Queso fresco","Manchego gratinado"]'::jsonb),
    ('enchiladas-verdes', 'Tres piezas rellenas de pollo. Paquete con fruta y café.', '["Salsa verde","Salsa roja","Salsa suiza","Queso fresco","Manchego gratinado"]'::jsonb),
    ('enfrijoladas', 'Rellenas de pollo, cubiertas con frijol y chorizo. Incluye fruta y café.', '["Queso fresco","Manchego gratinado"]'::jsonb),
    ('chilaquiles-carne', 'Chilaquiles con carne asada. Paquete con fruta y café.', '["Salsa verde","Salsa roja","Salsa suiza","Queso fresco","Manchego gratinado"]'::jsonb),
    ('chilaquiles-pechuga', 'Chilaquiles con pechuga empanizada. Paquete con fruta y café.', '["Salsa verde","Salsa roja","Salsa suiza","Queso fresco","Manchego gratinado"]'::jsonb),
    ('enchiladas-suizas', 'Rellenas de pollo y gratinadas con manchego. Incluye fruta y café.', '[]'::jsonb),
    ('enmoladas', 'Cuatro enchiladas rellenas de pollo y bañadas en mole. Incluye fruta y café.', '[]'::jsonb),
    ('chilaquiles-suizos', 'Con pechuga, salsa suiza y manchego gratinado. Incluye fruta y café.', '[]'::jsonb),
    ('chilaquiles-divorciados', 'Dos huevos con salsa verde y roja. Paquete con fruta y café.', '["Revueltos","Estrellados","A la mexicana","Queso fresco","Manchego gratinado"]'::jsonb),
    ('omelette-champinones', 'Relleno de queso y jamón con frijoles. Paquete con fruta y café.', '["Queso fresco","Manchego gratinado"]'::jsonb)
)
update public.products as product
set
  description = package_updates.description,
  options = package_updates.options,
  updated_at = now()
from package_updates
where product.restaurant_id = '00000000-0000-0000-0000-000000000001'
  and product.slug = package_updates.slug;

insert into public.products (
  restaurant_id,
  category_id,
  slug,
  name,
  description,
  price,
  image_url,
  active,
  sold_out,
  popular,
  is_new,
  options
)
select
  '00000000-0000-0000-0000-000000000001',
  c.id,
  'molletes-champinones',
  'Molletes de champiñones',
  'Pan con frijoles y champiñones salteados. Paquete con fruta y café.',
  80,
  '/menu/imperio/molletes.jpg',
  true,
  false,
  false,
  true,
  '["Queso fresco","Manchego gratinado"]'::jsonb
from public.categories c
where c.restaurant_id = '00000000-0000-0000-0000-000000000001'
  and c.name = 'Desayunos'
on conflict (restaurant_id, slug) do update set
  category_id = excluded.category_id,
  name = excluded.name,
  description = excluded.description,
  price = excluded.price,
  image_url = excluded.image_url,
  active = true,
  sold_out = false,
  is_new = true,
  options = excluded.options,
  updated_at = now();

insert into public.menu_products (menu_id, product_id, sort_order)
select
  '00000000-0000-0000-0000-000000000101',
  p.id,
  145
from public.products p
where p.restaurant_id = '00000000-0000-0000-0000-000000000001'
  and p.slug = 'molletes-champinones'
on conflict (menu_id, product_id) do update
set sort_order = excluded.sort_order;

create or replace function public.admin_sales_report(
  p_pin text,
  p_from timestamptz,
  p_to timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant_id uuid;
  v_summary jsonb;
  v_top_products jsonb;
  v_daily_sales jsonb;
  v_orders jsonb;
begin
  select id into v_restaurant_id
  from public.restaurants
  where active
    and demo_pin_hash is not null
    and demo_pin_hash = extensions.crypt(p_pin, demo_pin_hash)
  limit 1;

  if v_restaurant_id is null then
    raise exception 'invalid_pin';
  end if;

  if p_from is null
    or p_to is null
    or p_to <= p_from
    or p_to - p_from > interval '370 days' then
    raise exception 'invalid_period';
  end if;

  select jsonb_build_object(
    'orderCount', count(*) filter (where status = 'delivered'),
    'grossSales', coalesce(sum(total) filter (where status = 'delivered'), 0),
    'itemsSold', coalesce((
      select sum(oi.quantity)
      from public.order_items oi
      join public.orders item_order on item_order.id = oi.order_id
      where item_order.restaurant_id = v_restaurant_id
        and item_order.status = 'delivered'
        and item_order.created_at >= p_from
        and item_order.created_at < p_to
    ), 0),
    'averageTicket', coalesce(avg(total) filter (where status = 'delivered'), 0),
    'pendingOrders', count(*) filter (
      where status not in ('delivered', 'cancelled')
    ),
    'pendingAmount', coalesce(sum(total) filter (
      where status not in ('delivered', 'cancelled')
    ), 0)
  )
  into v_summary
  from public.orders
  where restaurant_id = v_restaurant_id
    and created_at >= p_from
    and created_at < p_to;

  select coalesce(jsonb_agg(row_data order by (row_data->>'quantity')::integer desc), '[]'::jsonb)
  into v_top_products
  from (
    select jsonb_build_object(
      'name', oi.product_name,
      'quantity', sum(oi.quantity),
      'revenue', sum(oi.line_total)
    ) as row_data
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where o.restaurant_id = v_restaurant_id
      and o.status = 'delivered'
      and o.created_at >= p_from
      and o.created_at < p_to
    group by oi.product_name
    order by sum(oi.quantity) desc, sum(oi.line_total) desc
    limit 10
  ) ranked;

  select coalesce(jsonb_agg(row_data order by row_data->>'day'), '[]'::jsonb)
  into v_daily_sales
  from (
    select jsonb_build_object(
      'day', to_char(o.created_at at time zone 'America/Mexico_City', 'YYYY-MM-DD'),
      'orderCount', count(*),
      'total', sum(o.total)
    ) as row_data
    from public.orders o
    where o.restaurant_id = v_restaurant_id
      and o.status = 'delivered'
      and o.created_at >= p_from
      and o.created_at < p_to
    group by (o.created_at at time zone 'America/Mexico_City')::date
  ) daily;

  select coalesce(jsonb_agg(public.order_as_json(o.id) order by o.created_at desc), '[]'::jsonb)
  into v_orders
  from (
    select id, created_at
    from public.orders
    where restaurant_id = v_restaurant_id
      and status <> 'cancelled'
      and created_at >= p_from
      and created_at < p_to
    order by created_at desc
    limit 200
  ) o;

  return jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'summary', v_summary,
    'topProducts', v_top_products,
    'dailySales', v_daily_sales,
    'orders', v_orders
  );
end;
$$;

revoke all on function public.admin_sales_report(text, timestamptz, timestamptz)
from public;
grant execute on function public.admin_sales_report(text, timestamptz, timestamptz)
to anon, authenticated;
