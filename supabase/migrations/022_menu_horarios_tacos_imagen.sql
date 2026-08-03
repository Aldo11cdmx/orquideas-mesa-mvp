-- 022 — Horarios extendidos, opciones de taco y verificación de imagen de chilaquiles suizos.
--
-- Esta migración es INCREMENTAL y se ejecuta DESPUÉS de 021.
-- Solo modifica los productos especificados.
-- NO toca pedidos, order_items, place_order, extras, realtime.
-- NO modifica migraciones 020 o 021.
-- Es idempotente: se puede ejecutar múltiples veces sin efectos secundarios.

-- ============================================================================
-- 1. Actualizar Taco: cambiar options a option_groups
-- ============================================================================
update public.products
set
  options = '["Bistec","Longaniza"]'::jsonb,
  option_groups = '[
    {"id":"carne","label":"Elige tu carne","choices":["Bistec","Longaniza"],"required":true}
  ]'::jsonb,
  updated_at = now()
where restaurant_id = '00000000-0000-0000-0000-000000000001'
  and slug = 'taco-bistec-longaniza';

-- ============================================================================
-- 2. Verificar/actualizar imagen de Chilaquiles suizos
-- ============================================================================
update public.products
set
  image_url = '/menu/imperio/chilaquiles-suizos.jpg',
  updated_at = now()
where restaurant_id = '00000000-0000-0000-0000-000000000001'
  and slug = 'chilaquiles-suizos'
  and (image_url is null or image_url = '' or image_url != '/menu/imperio/chilaquiles-suizos.jpg');

-- ============================================================================
-- 3. Asegurar que los productos con horario extendido tengan el horario base correcto
-- ============================================================================
-- Los productos de desayuno con horario extendido deben tener availableFrom = '09:00'
-- y availableUntil = '17:00' (la lógica de isProductAvailable se encarga del resto)
update public.products
set
  available_from = '09:00'::time,
  available_until = '17:00'::time,
  updated_at = now()
where restaurant_id = '00000000-0000-0000-0000-000000000001'
  and slug in (
    'chilaquiles-sencillos',
    'chilaquiles-huevo',
    'chilaquiles-carne',
    'chilaquiles-pechuga',
    'chilaquiles-divorciados',
    'chilaquiles-suizos',
    'enchiladas-verdes',
    'enchiladas-suizas',
    'enmoladas',
    'club-sandwich'
  );

-- ============================================================================
-- 4. Verificación (opcional, no modifica datos)
-- ============================================================================
-- Esta sección es solo para verificar que los productos quedaron correctos.
-- No modifica nada, solo consulta.
--
-- select 
--   slug, 
--   name, 
--   price, 
--   image_url,
--   options,
--   option_groups,
--   available_from,
--   available_until
-- from public.products
-- where restaurant_id = '00000000-0000-0000-0000-000000000001'
--   and slug in ('taco-bistec-longaniza', 'chilaquiles-suizos', 'chilaquiles-sencillos', 'enchiladas-verdes', 'club-sandwich');