-- Borrado seguro de productos, horarios definitivos y fotografías proporcionadas.

update public.products
set
  image_url = case slug
    when 'waffles' then '/menu/imperio/waffles-nuevos.jpg'
    when 'hot-cakes' then '/menu/imperio/hot-cakes-nuevos.jpg'
    when 'enchiladas-verdes' then '/menu/imperio/enchiladas-verdes-nuevas.jpg'
    when 'huevos-al-gusto' then '/menu/imperio/huevos-al-gusto-nuevos.jpg'
    when 'bisquet' then '/menu/imperio/bisquet-nuevo.jpg'
    else image_url
  end,
  updated_at = now()
where restaurant_id = '00000000-0000-0000-0000-000000000001';

update public.products p
set
  available_from = '09:00',
  available_until = '13:00',
  updated_at = now()
from public.categories c
where p.category_id = c.id
  and p.restaurant_id = '00000000-0000-0000-0000-000000000001'
  and (c.name in ('Desayunos', 'Panes y más') or p.slug = 'desayuno-combinado');

update public.products p
set
  available_from = '09:00',
  available_until = '17:00',
  updated_at = now()
from public.categories c
where p.category_id = c.id
  and p.restaurant_id = '00000000-0000-0000-0000-000000000001'
  and c.name in ('A la carta', 'Bebidas')
  and p.slug <> 'desayuno-combinado';

update public.products p
set
  available_from = '13:00',
  available_until = '17:00',
  updated_at = now()
from public.categories c
where p.category_id = c.id
  and p.restaurant_id = '00000000-0000-0000-0000-000000000001'
  and c.name = 'Comidas a la carta';

update public.daily_menus
set
  available_from = '13:00',
  available_until = '17:00',
  service_date = (now() at time zone 'America/Mexico_City')::date,
  updated_at = now()
where restaurant_id = '00000000-0000-0000-0000-000000000001';

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
  where p.restaurant_id = v_restaurant_id
    and p.active;

  return v_result;
end;
$$;

create or replace function public.archive_admin_product(
  p_pin text,
  p_product_slug text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant_id uuid;
  v_updated integer;
begin
  select id into v_restaurant_id
  from public.restaurants
  where active
    and demo_pin_hash is not null
    and demo_pin_hash = extensions.crypt(p_pin, demo_pin_hash)
  limit 1;

  if v_restaurant_id is null then raise exception 'invalid_pin'; end if;

  update public.products
  set
    active = false,
    updated_at = now()
  where restaurant_id = v_restaurant_id
    and slug = p_product_slug
    and active;

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

revoke all on function public.admin_menu_products(text) from public;
revoke all on function public.archive_admin_product(text, text) from public;
grant execute on function public.admin_menu_products(text) to anon, authenticated;
grant execute on function public.archive_admin_product(text, text) to anon, authenticated;
