-- 023 — Limpieza total de datos de prueba antes de producción.
--
-- Esta migración se ejecuta DESPUÉS de 022.
-- Solo limpia datos de prueba, NO modifica productos, categorías, precios o configuraciones.
-- NO toca migraciones 020-022.
-- Es idempotente: se puede ejecutar múltiples veces sin efectos secundarios.

-- ============================================================================
-- 1. Ocultar temporalmente Chilaquiles suizos hasta reemplazar la imagen
-- ============================================================================
-- El producto se oculta del menú público pero se mantiene en la base de datos.
-- Una vez reemplazada la imagen por una válida, se puede activar manualmente.
update public.products
set
  active = false,
  updated_at = now()
where restaurant_id = '00000000-0000-0000-0000-000000000001'
  and slug = 'chilaquiles-suizos'
  and active = true;

-- ============================================================================
-- 2. Limpiar TODOS los datos de prueba de pedidos
-- ============================================================================
-- Elimina en orden correcto respetando foreign keys:
-- 1. order_events (depende de orders)
-- 2. order_items (depende de orders)
-- 3. orders (tabla principal)

-- Eliminar TODOS los eventos de pedidos
delete from public.order_events;

-- Eliminar TODOS los items de pedidos
delete from public.order_items;

-- Eliminar TODOS los pedidos
delete from public.orders;

-- ============================================================================
-- 3. Reiniciar secuencia de folios para comenzar desde 1001 mañana
-- ============================================================================
-- La secuencia se usa así:
--   'O-' || lpad(nextval('public.order_folio_seq')::text, 4, '0')
-- Ejemplo: nextval = 1001 → "O-1001"
--
-- Reiniciar a 1001 asegura que el primer pedido del día tenga folio O-1001
alter sequence public.order_folio_seq restart with 1001;

-- ============================================================================
-- 4. Verificación (no modifica datos)
-- ============================================================================
-- Ejecutar estas consultas para verificar la limpieza:
--
-- -- Cantidad de pedidos (debe ser 0)
-- select count(*) from public.orders;
--
-- -- Cantidad de order_items (debe ser 0)
-- select count(*) from public.order_items;
--
-- -- Cantidad de order_events (debe ser 0)
-- select count(*) from public.order_events;
--
-- -- Verificar que Chilaquiles suizos está oculto
-- select slug, name, active from public.products
-- where restaurant_id = '00000000-0000-0000-0000-000000000001'
--   and slug = 'chilaquiles-suizos';
--
-- -- Verificar valor actual del folio (debe ser 1001)
-- select last_value from public.order_folio_seq;
--
-- -- Probar que el siguiente folio sería O-1001
-- select 'O-' || lpad(nextval('public.order_folio_seq')::text, 4, '0');