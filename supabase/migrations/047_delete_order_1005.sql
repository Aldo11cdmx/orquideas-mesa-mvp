-- 047 - Borrar definitivamente el ticket O-1005
-- La orden O-1005 es muy antigua y la app solo permite "cancelar" (borrado suave),
-- no eliminarla de la lista. La borramos de forma definitiva.
-- order_items y order_events se borran en cascada (on delete cascade).
-- Seguro de ejecutar más de una vez (si ya no existe, no hace nada).

delete from public.orders
where folio = 'O-1005'
  and restaurant_id = '00000000-0000-0000-0000-000000000001';
