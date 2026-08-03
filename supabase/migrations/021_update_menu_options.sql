-- 021 — Actualizar opciones de Licuado, Malteada y Desayuno infantil en Supabase.
--
-- Esta migración es INCREMENTAL y se ejecuta DESPUÉS de 020.
-- Solo modifica los productos especificados.
-- NO toca pedidos, order_items, place_order, extras, realtime, chilaquiles suizos.
-- Es idempotente: se puede ejecutar múltiples veces sin efectos secundarios.

-- ============================================================================
-- 1. Actualizar Licuado: opciones de sabor como option_groups
-- ============================================================================
update public.products
set
  description = 'Preparado con leche y fruta.',
  options = '["Plátano","Fresa","Mamey"]'::jsonb,
  option_groups = '[
    {"id":"sabor","label":"Elige tu sabor","choices":["Plátano","Fresa","Mamey"],"required":true}
  ]'::jsonb,
  updated_at = now()
where restaurant_id = '00000000-0000-0000-0000-000000000001'
  and slug = 'licuado';

-- ============================================================================
-- 2. Actualizar Malteada: opciones de sabor como option_groups (sin Café, con Nescafé)
-- ============================================================================
update public.products
set
  description = 'Cremosa malteada fría.',
  options = '["Fresa","Vainilla","Chocolate","Cajeta","Nescafé"]'::jsonb,
  option_groups = '[
    {"id":"sabor","label":"Elige tu sabor","choices":["Fresa","Vainilla","Chocolate","Cajeta","Nescafé"],"required":true}
  ]'::jsonb,
  updated_at = now()
where restaurant_id = '00000000-0000-0000-0000-000000000001'
  and slug = 'malteada';

-- ============================================================================
-- 3. Actualizar Desayuno infantil: precio $75, descripción y opción de licuado
-- ============================================================================
update public.products
set
  description = '5 mini hot cakes, licuado a elegir y una porción de fruta.',
  price = 75::numeric,
  options = '["Plátano","Fresa","Mamey"]'::jsonb,
  option_groups = '[
    {"id":"licuado","label":"Elige tu licuado","choices":["Plátano","Fresa","Mamey"],"required":true}
  ]'::jsonb,
  package_includes = '["Fruta de temporada"]'::jsonb,
  updated_at = now()
where restaurant_id = '00000000-0000-0000-0000-000000000001'
  and slug = 'desayuno-infantil';

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
--   description,
--   options,
--   option_groups,
--   package_includes
-- from public.products
-- where restaurant_id = '00000000-0000-0000-0000-000000000001'
--   and slug in ('licuado', 'malteada', 'desayuno-infantil');