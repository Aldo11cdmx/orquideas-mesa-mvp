-- 046 - Imagen de "Pechuga rellena" (Desayunos)
-- La "Pechuga rellena" creada desde el admin (Desayunos) tenía una imagen
-- incorrecta. Le ponemos su foto.
-- Seguro de ejecutar más de una vez.

update public.products
set
  image_url = '/menu/imperio/pechuga-rellena-desayuno.jpg',
  updated_at = now()
where restaurant_id = '00000000-0000-0000-0000-000000000001'
  and name = 'Pechuga rellena';
