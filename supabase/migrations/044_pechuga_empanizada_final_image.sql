-- 044 - Imagen definitiva de "Pechuga empanizada" (evita caché)
-- Cambia el archivo por un nombre nuevo para que los navegadores carguen la foto
-- actualizada (la URL anterior podía quedar cacheada en el dispositivo).
-- Aplica a las dos pechugas empanizadas:
--   · "Pechuga empanizada" (Desayunos, creada desde el admin)
--   · "Pechuga de pollo empanizada" (Comidas a la carta, del código)
-- Seguro de ejecutar más de una vez.

update public.products
set
  image_url = '/menu/imperio/pechuga-empanizada.jpg',
  updated_at = now()
where restaurant_id = '00000000-0000-0000-0000-000000000001'
  and (name = 'Pechuga empanizada' or slug = 'pechuga-empanizada');
