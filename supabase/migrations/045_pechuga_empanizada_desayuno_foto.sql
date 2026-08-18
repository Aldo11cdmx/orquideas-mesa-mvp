-- 045 - Imagen de "Pechuga empanizada" (Desayunos) - foto propia
-- La pechuga empanizada del desayuno es un platillo distinto al de "Comidas a la carta",
-- así que lleva su propia foto (no la misma que la de carta).
-- Seguro de ejecutar más de una vez.

update public.products
set
  image_url = '/menu/imperio/pechuga-empanizada-desayuno.jpg',
  updated_at = now()
where restaurant_id = '00000000-0000-0000-0000-000000000001'
  and name = 'Pechuga empanizada';
