-- 042 - Imagen de "Tacos dorados de pollo"
-- Reemplaza la ruta rota '/menu/imperio/tacos dorados' (con espacio y sin extensión)
-- por el archivo real agregado al repositorio.
-- Seguro de ejecutar más de una vez.

update public.products
set
  image_url = '/menu/imperio/tacos-dorados.png',
  updated_at = now()
where restaurant_id = '00000000-0000-0000-0000-000000000001'
  and name = 'Tacos dorados de pollo';
