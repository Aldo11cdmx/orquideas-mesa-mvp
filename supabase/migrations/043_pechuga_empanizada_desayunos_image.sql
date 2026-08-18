-- 043 - Imagen de "Pechuga empanizada" (Desayunos)
-- La "Pechuga empanizada" creada desde el admin (categoría Desayunos) heredó una
-- imagen incorrecta. Le ponemos la misma foto que la de "Comidas a la carta".
-- Seguro de ejecutar más de una vez.

update public.products
set
  image_url = '/menu/imperio/pollo-empanizado.jpg',
  updated_at = now()
where restaurant_id = '00000000-0000-0000-0000-000000000001'
  and name = 'Pechuga empanizada'
  and category = 'Desayunos';
