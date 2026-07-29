-- Keep persisted order items aligned with the product-specific imagery used by the app.
-- Safe to run more than once.

with image_updates(slug, image_url) as (
  values
    ('huevos-al-gusto', '/menu/imperio/huevos-al-gusto.jpg'),
    ('arrachera-desayuno', '/menu/imperio/arrachera.jpg'),
    ('omelette-champinones', '/menu/imperio/omelette-champinones.jpg'),
    ('taco-bistec-longaniza', '/menu/imperio/taco-bistec.jpg'),
    ('papas-francesa', '/menu/imperio/papas-francesas.jpg'),
    ('bisquet', '/menu/imperio/bisquet.jpg'),
    ('pan-frances', '/menu/imperio/pan-frances.jpg'),
    ('coca-cola', '/menu/imperio/refresco-cola.jpg'),
    ('licuado', '/menu/imperio/malteada-fresa.jpg'),
    ('cafe-leche', '/menu/imperio/cafe-leche.jpg'),
    ('malteada', '/menu/imperio/malteada-fresa.jpg'),
    ('jugo-verde', '/menu/imperio/jugo-verde.jpg'),
    ('agua-fruta', '/menu/imperio/agua-fruta.jpg'),
    ('pechuga-empanizada', '/menu/imperio/pollo-empanizado.jpg'),
    ('milanesa-res', '/menu/imperio/milanesa-res.jpg'),
    ('filete-pescado', '/menu/imperio/pescado-empanizado.jpg'),
    ('arrachera-comida', '/menu/imperio/arrachera.jpg')
)
update public.products as product
set
  image_url = image_updates.image_url,
  updated_at = now()
from image_updates
where product.restaurant_id = '00000000-0000-0000-0000-000000000001'
  and product.slug = image_updates.slug;
