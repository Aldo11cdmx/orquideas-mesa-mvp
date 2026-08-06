-- 031 — Sistema profesional de mesas: metadata, estados y RPCs.
--
-- Esta migración es INCREMENTAL, NO DESTRUCTIVA e IDEMPOTENTE:
-- - Extiende la tabla existente `tables` (NO crea una tabla nueva, evitando
--   duplicación y manteniendo la FK existente de orders.table_id → tables.id)
-- - Agrega columnas: name, capacity, updated_at
-- - Los pedidos históricos y datos existentes permanecen intactos
-- - Usa `select id from public.restaurants where active limit 1` en lugar de
--   UUID hardcodeado (robustez ante cambios en el restaurante seed)
-- - Los RPCs siguen el mismo patrón de autenticación por PIN que save_admin_product
-- - Compatibilidad con migrations 001-030: FKs intactas, place_order preserved
--
-- IMPORTANT: No se toca el sistema QR existente.
-- El QR actual funciona por código de mesa (/mesa/[codigo]) y está impreso.
-- No se agrega qr_token, ni se cambia la URL de QR, ni se crea /menu.
-- Los QR impresos seguirán funcionando sin cambios.
--
-- Funciones creadas:
-- - admin_tables(p_pin)         → lista mesas con estado y pedidos activos
-- - save_admin_table(p_pin, p_table) → crear/actualizar mesa
--
-- Estados de mesa (computados, no almacenados):
--   free:            sin pedidos pendientes ni sesión activa
--   occupied:        pedidos con status en (sent, accepted, preparing, ready)
--   pending_payment: pedidos entregados pero sesión activa (no cerrada)

-- ============================================================================
-- 1. Extensión de la tabla `tables`
--    Se reutiliza la tabla existente para mantener compatibilidad con
--    orders.table_id → tables.id (FK existente desde migration 001)
--    NO se agrega qr_token: el sistema QR actual usa códigos de mesa (/mesa/A1)
--    y los QR físicos ya están impresos.
-- ============================================================================

-- 1a. name (texto opcional, default vacío)
alter table public.tables
  add column if not exists name text not null default '';

-- 1b. capacity (entero no negativo, default 0)
alter table public.tables
  add column if not exists capacity integer not null default 0 check (capacity >= 0);

-- 1c. updated_at (timestamp, default now())
alter table public.tables
  add column if not exists updated_at timestamptz not null default now();

-- Índice único que respalda ON CONFLICT (restaurant_id, code) en save_admin_table
-- NOTA: migration 001 ya define `unique (restaurant_id, code)` como constraint,
--       que crea un índice implícito. Este índice explícito usa IF NOT EXISTS
--       para ser idempotente y no romper instalaciones existentes.
create unique index if not exists idx_tables_restaurant_code
  on public.tables (restaurant_id, code);

-- Índice compuesto para consultas de admin (mesas activas por restaurante)
create index if not exists idx_tables_restaurant_active
  on public.tables (restaurant_id, active, code);

-- Trigger: actualizar updated_at en cada modificación
create or replace function public._trg_update_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_tables_updated_at on public.tables;
create trigger trg_tables_updated_at
  before update on public.tables
  for each row execute function public._trg_update_timestamp();

-- ============================================================================
-- 2. RPC: listar mesas con estado y pedidos
--    Estado: free, occupied, pending_payment
--    - free: sin pedidos pendientes y sin sesión activa con pedidos entregados
--    - occupied: tiene pedidos con status en (sent, accepted, preparing, ready)
--    - pending_payment: pedidos entregados pero sesión activa (no cerrada)
--    Patrón de autenticación: mismo que save_admin_product (migration 028)
-- ============================================================================
create or replace function public.admin_tables(p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant_id uuid;
begin
  -- Autenticación por PIN (misma lógica que save_admin_product en 028)
  select id into v_restaurant_id
  from public.restaurants
  where active
    and demo_pin_hash is not null
    and demo_pin_hash = extensions.crypt(p_pin, demo_pin_hash)
  limit 1;

  if v_restaurant_id is null then raise exception 'invalid_pin'; end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id',         t.id,
        'code',       t.code,
        'name',       t.name,
        'capacity',   t.capacity,
        'active',     t.active,
        'createdAt',  t.created_at,
        'updatedAt',  t.updated_at,
        'status',     case
          when exists (
            select 1 from public.orders o
            where o.table_id = t.id
              and o.status in ('sent','accepted','preparing','ready')
          ) then 'occupied'
          when exists (
            select 1 from public.orders o
            where o.session_id in (
              select id from public.table_sessions ts
              where ts.table_id = t.id and ts.status = 'active'
            )
            and o.status = 'delivered'
          ) then 'pending_payment'
          else 'free'
        end,
        'orderCount', (
          select count(*) from public.orders o
          where o.table_id = t.id
            and o.status in ('sent','accepted','preparing','ready')
        ),
        'tableTotal', coalesce((
          select sum(o.total) from public.orders o
          where o.table_id = t.id
            and o.status in ('sent','accepted','preparing','ready')
        ), 0)
      )
      order by t.code
    )
    from public.tables t
    where t.restaurant_id = v_restaurant_id
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.admin_tables(text) to anon, authenticated;

-- ============================================================================
-- 3. RPC: crear/actualizar mesa
--    Recibe JSON: { id?, code, name?, capacity?, active? }
--    Si id está presente → UPDATE; si no → INSERT con ON CONFLICT(restaurant_id, code)
--    Patrón de autenticación: mismo que save_admin_product (migration 028)
-- ============================================================================
create or replace function public.save_admin_table(p_pin text, p_table jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant_id uuid;
  v_table_id uuid;
  v_code text;
  v_name text;
  v_capacity integer;
  v_active boolean;
begin
  -- Autenticación
  select id into v_restaurant_id
  from public.restaurants
  where active
    and demo_pin_hash is not null
    and demo_pin_hash = extensions.crypt(p_pin, demo_pin_hash)
  limit 1;
  if v_restaurant_id is null then raise exception 'invalid_pin'; end if;

  -- Validar y normalizar campos
  v_code := upper(trim(coalesce(p_table->>'code', '')));
  if length(v_code) > 3 or v_code !~ '^[A-Z][0-9]{1,2}$' then
    raise exception 'invalid_table_code';
  end if;

  v_name := left(coalesce(nullif(p_table->>'name', ''), ''), 80);

  -- Cast de capacity con fallback: si el cliente envía un string no numérico,
  -- se usa 0 en lugar de abortar la transacción.
  begin
    v_capacity := greatest(0, coalesce((p_table->>'capacity')::integer, 0));
  exception
    when invalid_text_representation then
      v_capacity := 0;
  end;

  v_active := coalesce(nullif(p_table->>'active', '')::boolean, true);

  -- Insert o update (dependiendo de si se pasa id)
  if p_table ? 'id' and p_table->>'id' is not null and p_table->>'id' <> '' then
    update public.tables
    set code = v_code,
        name = v_name,
        capacity = v_capacity,
        active = v_active,
        updated_at = now()
    where id = (p_table->>'id')::uuid
      and restaurant_id = v_restaurant_id
    returning id into v_table_id;

    if v_table_id is null then raise exception 'table_not_found'; end if;
  else
    insert into public.tables (restaurant_id, code, name, capacity, active)
    values (v_restaurant_id, v_code, v_name, v_capacity, v_active)
    on conflict (restaurant_id, code) do update set
      name = excluded.name,
      capacity = excluded.capacity,
      active = excluded.active,
      updated_at = now()
    returning id into v_table_id;
  end if;

  -- Devolver mesa actualizada
  return jsonb_build_object(
    'id',         t.id,
    'code',       t.code,
    'name',       t.name,
    'capacity',   t.capacity,
    'active',     t.active,
    'createdAt',  t.created_at,
    'updatedAt',  t.updated_at
  )
  from public.tables t
  where t.id = v_table_id;
end;
$$;

grant execute on function public.save_admin_table(text, jsonb) to anon, authenticated;
