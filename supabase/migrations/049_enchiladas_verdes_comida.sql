-- 049 — Agregar "Enchiladas verdes" a la categoría "Comidas a la carta".
--
-- Copia del producto de Desayunos:
--   - Misma imagen: /menu/imperio/enchiladas-verdes-nuevas.jpg
--   - Mismo precio: $70
--   - Descripción ajustada a 3 piezas (en lugar de 3 piezas del desayuno)
--   - Categoría: Comidas a la carta
--   - Horario: 13:00-17:00 (comida corrida)

insert into public.products (
  restaurant_id, category_id, slug, name, description, price,
  image_url, active, sold_out, popular, is_new, options,
  option_groups, package_includes, extras_config,
  available_from, available_until
)
select
  '00000000-0000-0000-0000-000000000001',
  c.id,
  'enchiladas-verdes-comida',
  'Enchiladas verdes',
  'Tres piezas rellenas de pollo.',
  70,
  '/menu/imperio/enchiladas-verdes-nuevas.jpg',
  true,
  false,
  false,
  false,
  '[]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  '13:00'::time,
  '17:00'::time
from public.categories c
where c.restaurant_id = '00000000-0000-0000-0000-000000000001'
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
