-- Limita las elecciones de salsa y queso al omelette de champiñones.
-- Ejecutar después de 009_extend_service_hours.sql.

with option_updates(slug, options) as (
  values
    ('chilaquiles-sencillos', '[]'::jsonb),
    ('huevos-al-gusto', '["Revueltos","Estrellados","A la mexicana"]'::jsonb),
    ('chilaquiles-huevo', '["Revueltos","Estrellados","A la mexicana"]'::jsonb),
    ('molletes', '[]'::jsonb),
    ('enchiladas-verdes', '[]'::jsonb),
    ('enfrijoladas', '[]'::jsonb),
    ('chilaquiles-carne', '[]'::jsonb),
    ('chilaquiles-pechuga', '[]'::jsonb),
    ('chilaquiles-divorciados', '["Revueltos","Estrellados","A la mexicana"]'::jsonb),
    (
      'omelette-champinones',
      '["Salsa verde","Salsa roja","Salsa suiza","Queso fresco","Manchego gratinado"]'::jsonb
    )
)
update public.products as product
set
  options = option_updates.options,
  updated_at = now()
from option_updates
where product.restaurant_id = '00000000-0000-0000-0000-000000000001'
  and product.slug = option_updates.slug;
