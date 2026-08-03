-- 020 — Corrección incremental: Chilaquiles suizos como producto independiente
-- y Desayuno infantil sin Chilaquiles suizos en sus opciones.
-- 
-- Esta migración es INCREMENTAL y se ejecuta DESPUÉS de 019.
-- Solo modifica los dos productos especificados.
-- NO toca pedidos, order_items, place_order, extras, realtime, licuados ni malteadas.
-- Es idempotente: se puede ejecutar múltiples veces sin efectos secundarios.

-- ============================================================================
-- 1. Asegurar/crear producto independiente: Chilaquiles suizos
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
  'chilaquiles-suizos',
  'Chilaquiles suizos',
  'Servidos con fajitas de pechuga, queso manchego gratinado y bañados en nuestra salsa suiza.',
  90::numeric,
  '/menu/imperio/chilaquiles-suizos.jpg',
  true,
  false,
  true,
  false,
  '[]'::jsonb,
  '[]'::jsonb,
  '["Fruta de temporada","Café de la casa"]'::jsonb,
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
  sold_out = false,
  popular = true,
  is_new = false,
  options = excluded.options,
  option_groups = excluded.option_groups,
  package_includes = excluded.package_includes,
  available_from = excluded.available_from,
  available_until = excluded.available_until,
  updated_at = now();

-- ============================================================================
-- 2. Asegurar/actualizar producto: Desayuno infantil (SIN Chilaquiles suizos)
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
  sold_out = false,
  popular = excluded.popular,
  is_new = false,
  options = excluded.options,
  option_groups = excluded.option_groups,
  package_includes = excluded.package_includes,
  available_from = excluded.available_from,
  available_until = excluded.available_until,
  updated_at = now();

-- ============================================================================
-- 3. Asegurar que ambos productos estén en el menú fijo
-- ============================================================================
insert into public.menu_products (menu_id, product_id, sort_order)
select
  '00000000-0000-0000-0000-000000000101',
  p.id,
  coalesce((select max(sort_order) from public.menu_products where menu_id = '00000000-0000-0000-0000-000000000101'), 0) + row_number() over (order by p.slug)
from public.products p
where p.restaurant_id = '00000000-0000-0000-0000-000000000001'
  and p.slug in ('chilaquiles-suizos', 'desayuno-infantil')
  and p.active
on conflict (menu_id, product_id) do nothing;

-- ============================================================================
-- 4. Verificación (opcional, no modifica datos)
-- ============================================================================
-- Esta sección es solo para verificar que los productos quedaron correctos.
-- No modifica nada, solo consulta.
--
-- select 
--   slug, 
--   name, 
--   price, 
--   active,
--   option_groups
-- from public.products
-- where restaurant_id = '00000000-0000-0000-0000-000000000001'
--   and slug in ('chilaquiles-suizos', 'desayuno-infantil');