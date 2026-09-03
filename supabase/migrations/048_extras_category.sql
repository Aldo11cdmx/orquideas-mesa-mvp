-- 048 — Agregar categoría "Extras" con 4 productos de precios fijos ($5, $10, $15, $20).

-- 1. Crear categoría "Extras" si no existe
insert into public.categories (restaurant_id, name, sort_order, active)
values
  ('00000000-0000-0000-0000-000000000001', 'Extras', 60, true)
on conflict (restaurant_id, name) do update
  set sort_order = excluded.sort_order,
      active = true;

-- 2. Insertar productos "Extras" (id = slug = name = price como texto)
with product_seed(slug, name, price) as (
  values
    ('extra-5',  '$5',  5),
    ('extra-10', '$10', 10),
    ('extra-15', '$15', 15),
    ('extra-20', '$20', 20)
)
insert into public.products (
  restaurant_id, category_id, slug, name, description, price,
  image_url, active, sold_out, popular, is_new, options,
  option_groups, package_includes, extras_config
)
select
  '00000000-0000-0000-0000-000000000001',
  c.id,
  ps.slug,
  ps.name,
  '',
  ps.price,
  null,
  true,
  false,
  false,
  false,
  '[]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb
from product_seed ps
join public.categories c
  on c.restaurant_id = '00000000-0000-0000-0000-000000000001'
  and c.name = 'Extras'
on conflict (restaurant_id, slug) do update set
  name = excluded.name,
  description = excluded.description,
  price = excluded.price,
  image_url = excluded.image_url,
  active = true,
  sold_out = false,
  category_id = excluded.category_id,
  option_groups = excluded.option_groups,
  package_includes = excluded.package_includes,
  extras_config = excluded.extras_config,
  updated_at = now();
