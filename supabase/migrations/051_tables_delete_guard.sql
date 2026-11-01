-- 050 — Seguridad en la eliminación de mesas.
--
-- Problema: `DELETE /api/admin/tables` ejecutaba un `delete` crudo sin verificar
-- dependencias. Como `orders.table_id → tables.id` es NOT NULL sin ON DELETE,
-- la operación fallaba con un error de FK opaco en lugar de una respuesta clara,
-- y no había control de que una mesa con pedidos activos pudiera eliminarse.
--
-- Solución: RPC `delete_admin_table` que:
--   1. Valida PIN.
--   2. Bloquea la fila con `FOR UPDATE` para evitar carreras.
--   3. Cuenta dependencias (órdenes no canceladas, sesiones no cerradas).
--   4. Si hay dependencias → lanza `table_has_dependencies` (409 en la API).
--   5. Si no las hay → elimina de verdad.
--
-- Es idempotente e incremental: no toca el esquema existente.

create or replace function public.delete_admin_table(p_pin text, p_table_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant_id uuid;
  v_table_owner uuid;
  v_active_orders integer;
  v_open_sessions integer;
begin
  -- Autenticación por PIN (mismo patrón que save_admin_table)
  select id into v_restaurant_id
  from public.restaurants
  where active
    and demo_pin_hash is not null
    and demo_pin_hash = extensions.crypt(p_pin, demo_pin_hash)
  limit 1;

  if v_restaurant_id is null then
    raise exception 'invalid_pin';
  end if;

  -- Bloquear la fila para evitar eliminaciones concurrentes
  select t.id into v_table_owner
  from public.tables t
  where t.id = p_table_id
  for update;

  if v_table_owner is null then
    raise exception 'table_not_found';
  end if;

  -- La mesa debe pertenecer al restaurante autenticado
  if v_table_owner is null or exists (
    select 1 from public.tables t
    where t.id = p_table_id and t.restaurant_id <> v_restaurant_id
  ) then
    raise exception 'table_not_found';
  end if;

  -- Contar dependencias: órdenes no canceladas
  select count(*) into v_active_orders
  from public.orders o
  where o.table_id = p_table_id
    and o.status <> 'cancelled';

  -- Contar sesiones no cerradas
  select count(*) into v_open_sessions
  from public.table_sessions ts
  where ts.table_id = p_table_id
    and ts.status <> 'closed';

  if v_active_orders > 0 or v_open_sessions > 0 then
    raise exception 'table_has_dependencies'
      using errcode = 'P0001',
      detail = jsonb_build_object(
        'active_orders', v_active_orders,
        'open_sessions', v_open_sessions
      );
  end if;

  -- Sin dependencias: eliminación segura
  delete from public.tables t
  where t.id = p_table_id;

  return jsonb_build_object('ok', true, 'id', p_table_id);
end;
$$;

grant execute on function public.delete_admin_table(text, uuid) to anon, authenticated;