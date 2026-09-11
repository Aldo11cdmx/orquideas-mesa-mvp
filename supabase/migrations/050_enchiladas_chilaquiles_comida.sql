-- 050 — Agregar Enchiladas verdes ($85) y Chilaquiles suizos ($100) a "Comidas a la carta".
--
-- Ambos con las mismas opciones personalizables de la categoría:
--   - Primer tiempo: Consomé / Sopa
--   - Acompañamiento: Arroz / Pasta
--   - Agua: Agua de fruta / Agua simple
--   - Extras: Café $15, Fruta extra $10
-- Horario: 13:00-17:00 (comida corrida)

insert into public.products (
  restaurant_id, category_id, slug, name, description, price,
  image_url, active, sold_out, popular, is_new, options,
  option_groups, package_includes, extras_config,
  available_from, available_until
)
select
  '00000000-0000-0000-0000-000000000001',
  c.id,
  ps.slug,
  ps.name,
  ps.description,
  ps.price,
  ps.image,
  true,
  false,
  false,
  false,
  '[]'::jsonb,
  '[
    {"id":"primer-tiempo","label":"Primer tiempo","choices":["Consomé","Sopa"],"required":true},
    {"id":"acompanamiento","label":"Acompañamiento","choices":["Arroz","Pasta"],"required":true},
    {"id":"agua","label":"Agua","choices":["Agua de fruta","Agua simple"],"required":true}
  ]'::jsonb,
  '[]'::jsonb,
  '[{"name":"Café","price":15,"active":true},{"name":"Fruta extra","price":10,"active":true}]'::jsonb,
  '13:00'::time,
  '17:00'::time
from (
  values
    ('enchiladas-verdes-comida-2', 'Enchiladas verdes', 'Tres piezas rellenas de pollo.', 85, '/menu/imperio/enchiladas-verdes.jpg'),
    ('chilaquiles-suizos-comida', 'Chilaquiles suizos', 'Con fajitas de pechuga, queso manchego gratinado y bañados en nuestra salsa suiza.', 100, '/menu/imperio/chilaquiles-suizos.jpg')
) as ps(slug, name, description, price, image)
join public.categories c
  on c.restaurant_id = '00000000-0000-0000-0000-000000000001'
  and c.name = 'Comidas a la carta'
on conflict (restaurant_id, slug) do update set
  name = excluded.name,
  description = excluded.description,
  price = excluded.price,
  image_url = excluded.image_url,
  category_id = excluded.category_id,
  active = true,
  sold_out = false,
  option_groups = excluded.option_groups,
  package_includes = excluded.package_includes,
  extras_config = excluded.extras_config,
  available_from = excluded.available_from,
  available_until = excluded.available_until,
  updated_at = now();