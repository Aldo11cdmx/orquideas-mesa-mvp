-- Menú único para mesas y administración, métodos de pago y sincronización.

alter table public.products
  add column if not exists package_includes jsonb not null default '[]'::jsonb,
  add column if not exists option_groups jsonb not null default '[]'::jsonb,
  add column if not exists available_from time,
  add column if not exists available_until time;

alter table public.orders
  add column if not exists payment_method text;

alter table public.orders
  drop constraint if exists orders_payment_method_check;
alter table public.orders
  add constraint orders_payment_method_check
  check (payment_method is null or payment_method in ('cash', 'card'));

update public.products
set
  price = case slug
    when 'chilaquiles-sencillos' then 50
    when 'chilaquiles-huevo' then 60
    when 'enfrijoladas' then 90
    when 'agua-fruta' then 35
    else price
  end,
  name = case slug
    when 'coca-cola' then 'Coca-Cola 500 ml'
    else name
  end,
  description = case slug
    when 'coca-cola' then 'Refresco frío en presentación de 500 ml.'
    when 'agua-fruta' then 'Un litro de agua fresca con el sabor disponible del día.'
    when 'malteada' then 'Cremosa malteada fría. Disponible en cinco sabores.'
    else description
  end,
  image_url = case slug
    when 'enchiladas-verdes' then '/menu/imperio/enchiladas-verdes.jpg'
    when 'chilaquiles-carne' then '/menu/imperio/chilaquiles-carne.jpg'
    when 'chilaquiles-suizos' then '/menu/imperio/chilaquiles-sencillos.jpg'
    when 'chilaquiles-divorciados' then '/menu/imperio/chilaquiles-divorciados.jpg'
    when 'desayuno-combinado' then '/menu/imperio/desayuno-combinado.jpg'
    when 'licuado' then '/menu/imperio/licuado.jpg'
    when 'pechuga-plancha' then '/menu/imperio/pechuga-plancha.jpg'
    when 'arrachera-desayuno' then '/menu/imperio/arrachera-actual.jpg'
    when 'arrachera-comida' then '/menu/imperio/arrachera-actual.jpg'
    else image_url
  end,
  options = case slug
    when 'malteada' then '["Fresa","Chocolate","Vainilla","Café","Cajeta"]'::jsonb
    else options
  end,
  available_from = case
    when slug in (
      'pechuga-empanizada', 'pechuga-plancha', 'milanesa-res',
      'pechuga-rellena', 'filete-pescado', 'enchiladas-suizas-comida',
      'arrachera-comida', 'enchiladas-mole-comida'
    ) then '13:00'::time
    else '09:00'::time
  end,
  available_until = '21:00'::time,
  updated_at = now()
where restaurant_id = '00000000-0000-0000-0000-000000000001';

update public.products
set package_includes = '["Fruta de temporada","Café de la casa"]'::jsonb
where restaurant_id = '00000000-0000-0000-0000-000000000001'
  and slug in (
    'chilaquiles-sencillos', 'huevos-al-gusto', 'chilaquiles-huevo',
    'molletes', 'enchiladas-verdes', 'enfrijoladas', 'chilaquiles-carne',
    'chilaquiles-pechuga', 'enchiladas-suizas', 'enmoladas',
    'chilaquiles-suizos', 'chilaquiles-divorciados', 'omelette-champinones'
  );

update public.products
set option_groups = case slug
  when 'huevos-al-gusto' then
    '[{"id":"huevos","label":"¿Cómo quieres tus huevos?","choices":["Revueltos","Estrellados","A la mexicana"],"required":true}]'::jsonb
  when 'chilaquiles-huevo' then
    '[{"id":"huevos","label":"¿Cómo quieres tu huevo?","choices":["Revuelto","Estrellado","A la mexicana"],"required":true}]'::jsonb
  when 'chilaquiles-divorciados' then
    '[{"id":"huevos","label":"¿Cómo quieres tus huevos?","choices":["Revueltos","Estrellados","A la mexicana"],"required":true}]'::jsonb
  when 'omelette-champinones' then
    '[
      {"id":"salsa","label":"Elige tu salsa","choices":["Salsa verde","Salsa roja","Salsa suiza"],"required":true},
      {"id":"queso","label":"Elige el terminado","choices":["Queso fresco","Manchego gratinado"],"required":true}
    ]'::jsonb
  else '[]'::jsonb
end
where restaurant_id = '00000000-0000-0000-0000-000000000001';

insert into public.products (
  restaurant_id, category_id, slug, name, description, price, image_url,
  active, sold_out, popular, is_new, options, package_includes,
  option_groups, available_from, available_until
)
select
  '00000000-0000-0000-0000-000000000001',
  c.id,
  seed.slug,
  seed.name,
  seed.description,
  seed.price,
  seed.image_url,
  true,
  false,
  false,
  seed.is_new,
  '[]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  '09:00'::time,
  '21:00'::time
from public.categories c
cross join (
  values
    (
      'enfrijoladas-carta',
      'Enfrijoladas a la carta',
      'Rellenas de pollo, cubiertas con frijol, crema, queso y chorizo.',
      90::numeric,
      '/menu/imperio/enfrijoladas.jpg',
      false
    ),
    (
      'salchipulpos-papas',
      'Salchipulpos con papas',
      'Salchichas doradas en forma de pulpo acompañadas de papas a la francesa.',
      65::numeric,
      '/menu/imperio/salchipulpos-papas.jpg',
      true
    )
) as seed(slug, name, description, price, image_url, is_new)
where c.restaurant_id = '00000000-0000-0000-0000-000000000001'
  and c.name = 'A la carta'
on conflict (restaurant_id, slug) do update set
  category_id = excluded.category_id,
  name = excluded.name,
  description = excluded.description,
  price = excluded.price,
  image_url = excluded.image_url,
  active = true,
  sold_out = false,
  is_new = excluded.is_new,
  available_from = excluded.available_from,
  available_until = excluded.available_until,
  updated_at = now();

update public.daily_menus
set
  service_date = (now() at time zone 'America/Mexico_City')::date,
  available_until = '21:00',
  updated_at = now()
where restaurant_id = '00000000-0000-0000-0000-000000000001'
  and active;

create or replace function public.product_as_json(p_product_id uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', p.slug,
    'name', p.name,
    'description', p.description,
    'price', p.price,
    'compareAt', p.compare_at_price,
    'category', coalesce(c.name, 'A la carta'),
    'image', coalesce(p.image_url, '/menu/imperio/chilaquiles-sencillos.jpg'),
    'popular', p.popular,
    'isNew', p.is_new,
    'soldOut', p.sold_out,
    'active', p.active,
    'options', p.options,
    'optionGroups', p.option_groups,
    'packageIncludes', p.package_includes,
    'availableFrom', case when p.available_from is null then null else to_char(p.available_from, 'HH24:MI') end,
    'availableUntil', case when p.available_until is null then null else to_char(p.available_until, 'HH24:MI') end
  ))
  from public.products p
  left join public.categories c on c.id = p.category_id
  where p.id = p_product_id;
$$;

create or replace function public.public_menu_products()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(public.product_as_json(p.id) order by c.sort_order, p.created_at, p.name),
    '[]'::jsonb
  )
  from public.products p
  left join public.categories c on c.id = p.category_id
  where p.restaurant_id = '00000000-0000-0000-0000-000000000001'
    and p.active;
$$;

create or replace function public.admin_menu_products(p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant_id uuid;
  v_result jsonb;
begin
  select id into v_restaurant_id
  from public.restaurants
  where active
    and demo_pin_hash is not null
    and demo_pin_hash = extensions.crypt(p_pin, demo_pin_hash)
  limit 1;

  if v_restaurant_id is null then raise exception 'invalid_pin'; end if;

  select coalesce(
    jsonb_agg(public.product_as_json(p.id) order by c.sort_order, p.created_at, p.name),
    '[]'::jsonb
  )
  into v_result
  from public.products p
  left join public.categories c on c.id = p.category_id
  where p.restaurant_id = v_restaurant_id;

  return v_result;
end;
$$;

create or replace function public.save_admin_product(p_pin text, p_product jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant_id uuid;
  v_category_id uuid;
  v_product_id uuid;
  v_slug text;
begin
  select id into v_restaurant_id
  from public.restaurants
  where active
    and demo_pin_hash is not null
    and demo_pin_hash = extensions.crypt(p_pin, demo_pin_hash)
  limit 1;

  if v_restaurant_id is null then raise exception 'invalid_pin'; end if;

  v_slug := lower(regexp_replace(coalesce(p_product->>'id', ''), '[^a-zA-Z0-9-]+', '-', 'g'));
  if length(v_slug) < 1 or length(v_slug) > 80 then raise exception 'invalid_slug'; end if;

  select id into v_category_id
  from public.categories
  where restaurant_id = v_restaurant_id
    and name = p_product->>'category'
  limit 1;

  if v_category_id is null then
    insert into public.categories (restaurant_id, name, sort_order, active)
    values (
      v_restaurant_id,
      left(coalesce(nullif(p_product->>'category', ''), 'A la carta'), 80),
      999,
      true
    )
    returning id into v_category_id;
  end if;

  insert into public.products (
    restaurant_id, category_id, slug, name, description, price,
    compare_at_price, image_url, active, sold_out, popular, is_new,
    options, option_groups, package_includes, available_from,
    available_until, updated_at
  )
  values (
    v_restaurant_id,
    v_category_id,
    v_slug,
    left(p_product->>'name', 120),
    left(coalesce(p_product->>'description', ''), 500),
    greatest(0, (p_product->>'price')::numeric),
    nullif(p_product->>'compareAt', '')::numeric,
    left(coalesce(nullif(p_product->>'image', ''), '/menu/imperio/chilaquiles-sencillos.jpg'), 500),
    coalesce((p_product->>'active')::boolean, true),
    coalesce((p_product->>'soldOut')::boolean, false),
    coalesce((p_product->>'popular')::boolean, false),
    coalesce((p_product->>'isNew')::boolean, false),
    coalesce(p_product->'options', '[]'::jsonb),
    coalesce(p_product->'optionGroups', '[]'::jsonb),
    coalesce(p_product->'packageIncludes', '[]'::jsonb),
    nullif(p_product->>'availableFrom', '')::time,
    nullif(p_product->>'availableUntil', '')::time,
    now()
  )
  on conflict (restaurant_id, slug) do update set
    category_id = excluded.category_id,
    name = excluded.name,
    description = excluded.description,
    price = excluded.price,
    compare_at_price = excluded.compare_at_price,
    image_url = excluded.image_url,
    active = excluded.active,
    sold_out = excluded.sold_out,
    popular = excluded.popular,
    is_new = excluded.is_new,
    options = excluded.options,
    option_groups = excluded.option_groups,
    package_includes = excluded.package_includes,
    available_from = excluded.available_from,
    available_until = excluded.available_until,
    updated_at = now()
  returning id into v_product_id;

  return public.product_as_json(v_product_id);
end;
$$;

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

create or replace function public.complete_order(
  p_order_id uuid,
  p_payment_method text,
  p_pin text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant_id uuid;
  v_status text;
begin
  select id into v_restaurant_id
  from public.restaurants
  where active
    and demo_pin_hash is not null
    and demo_pin_hash = extensions.crypt(p_pin, demo_pin_hash)
  limit 1;

  if v_restaurant_id is null then raise exception 'invalid_pin'; end if;
  if p_payment_method not in ('cash', 'card') then raise exception 'invalid_payment_method'; end if;

  select status into v_status
  from public.orders
  where id = p_order_id
    and restaurant_id = v_restaurant_id
  for update;

  if v_status is null then raise exception 'order_not_found'; end if;
  if v_status <> 'ready' then raise exception 'invalid_transition'; end if;

  update public.orders
  set
    status = 'delivered',
    payment_method = p_payment_method,
    updated_at = now()
  where id = p_order_id;

  insert into public.order_events (order_id, from_status, to_status)
  values (p_order_id, 'ready', 'delivered');

  return public.order_as_json(p_order_id);
end;
$$;

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

  if v_restaurant_id is null then raise exception 'invalid_pin'; end if;
  if p_from is null or p_to is null or p_to <= p_from
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
    'pendingOrders', count(*) filter (where status not in ('delivered', 'cancelled')),
    'pendingAmount', coalesce(sum(total) filter (where status not in ('delivered', 'cancelled')), 0),
    'cashSales', coalesce(sum(total) filter (where status = 'delivered' and payment_method = 'cash'), 0),
    'cashOrders', count(*) filter (where status = 'delivered' and payment_method = 'cash'),
    'cardSales', coalesce(sum(total) filter (where status = 'delivered' and payment_method = 'card'), 0),
    'cardOrders', count(*) filter (where status = 'delivered' and payment_method = 'card'),
    'unassignedSales', coalesce(sum(total) filter (where status = 'delivered' and payment_method is null), 0),
    'unassignedOrders', count(*) filter (where status = 'delivered' and payment_method is null)
  )
  into v_summary
  from public.orders
  where restaurant_id = v_restaurant_id
    and created_at >= p_from
    and created_at < p_to;

  select coalesce(
    jsonb_agg(row_data order by (row_data->>'quantity')::integer desc),
    '[]'::jsonb
  )
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

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'day', daily.day,
        'orderCount', daily.order_count,
        'total', daily.total
      )
      order by daily.day
    ),
    '[]'::jsonb
  )
  into v_daily_sales
  from (
    select
      (o.created_at at time zone 'America/Mexico_City')::date as day,
      count(*) as order_count,
      sum(o.total) as total
    from public.orders o
    where o.restaurant_id = v_restaurant_id
      and o.status = 'delivered'
      and o.created_at >= p_from
      and o.created_at < p_to
    group by (o.created_at at time zone 'America/Mexico_City')::date
  ) daily;

  select coalesce(
    jsonb_agg(public.order_as_json(recent.id) order by recent.created_at desc),
    '[]'::jsonb
  )
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
  ) recent;

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

revoke all on function public.product_as_json(uuid) from public, anon, authenticated;
revoke all on function public.public_menu_products() from public;
revoke all on function public.admin_menu_products(text) from public;
revoke all on function public.save_admin_product(text, jsonb) from public;
revoke all on function public.order_as_json(uuid) from public, anon, authenticated;
revoke all on function public.complete_order(uuid, text, text) from public;
revoke all on function public.admin_sales_report(text, timestamptz, timestamptz) from public;

grant execute on function public.public_menu_products() to anon, authenticated;
grant execute on function public.admin_menu_products(text) to anon, authenticated;
grant execute on function public.save_admin_product(text, jsonb) to anon, authenticated;
grant execute on function public.complete_order(uuid, text, text) to anon, authenticated;
grant execute on function public.admin_sales_report(text, timestamptz, timestamptz)
to anon, authenticated;

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
