-- 028 — Sesiones compartidas por mesa, extras para carta, sustitutos y cierre de cuenta.
--
-- Esta migración es INCREMENTAL y NO DESTRUCTIVA:
-- - Crea la tabla table_sessions sin borrar datos existentes.
-- - Agrega columnas nullable a tablas existentes (orders, products, order_items).
-- - Reemplaza place_order y order_as_json para soportar session_id y extras con precio.
-- - Los pedidos históricos sin session_id permanecen intactos.
-- - Es idempotente: usa IF NOT EXISTS / IS DISTINCT FROM donde aplica.

-- ============================================================================
-- 1. Tabla de sesiones de mesa
-- ============================================================================
create table if not exists public.table_sessions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  table_id uuid not null references public.tables(id) on delete cascade,
  status text not null default 'active'
    check (status in ('active', 'closing', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Índice único parcial: una mesa no puede tener más de una sesión "active".
create unique index if not exists idx_table_sessions_unique_active
  on public.table_sessions (restaurant_id, table_id)
  where status = 'active';

-- Índices de rendimiento
create index if not exists idx_table_sessions_restaurant_status
  on public.table_sessions (restaurant_id, status, created_at desc);
create index if not exists idx_table_sessions_table
  on public.table_sessions (table_id, created_at desc);

alter table public.table_sessions enable row level security;
drop policy if exists "public active table_sessions" on public.table_sessions;
create policy "public active table_sessions" on public.table_sessions for select
  using (status = 'active');

-- ============================================================================
-- 2. Asociar órdenes a sesiones (columna nullable → pedidos históricos intactos)
-- ============================================================================
alter table public.orders
  add column if not exists session_id uuid references public.table_sessions(id);

create index if not exists idx_orders_session
  on public.orders (session_id, created_at desc);

-- ============================================================================
-- 3. Configuración de extras para productos a la carta
-- ============================================================================
-- Formato: [{"name":"Café","price":15,"active":true},{"name":"Fruta","price":10,"active":true}]
alter table public.products
  add column if not exists extras_config jsonb not null default '[]'::jsonb;

-- ============================================================================
-- 4. Sustitutos en order_items
-- ============================================================================
-- Formato: [{"group":"Guarnición","original":"Arroz","replacement":"Papas"}]
alter table public.order_items
  add column if not exists substitutes jsonb default null;

-- ============================================================================
-- 5. order_as_json: incluye sessionId y extras con precio en items
-- ============================================================================
create or replace function public.order_as_json(p_order_id uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', o.id,
    'folio', o.folio,
    'tableCode', t.code,
    'sessionId', o.session_id,
    'status', o.status,
    'paymentMethod', o.payment_method,
    'subtotal', o.subtotal,
    'total', o.total,
    'notes', o.notes,
    'createdAt', o.created_at,
    'updatedAt', o.updated_at,
    'accessToken', o.access_token,
    'source', 'supabase',
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'itemId', oi.id,
          'productId', coalesce(p.slug, oi.product_id::text),
          'name', oi.product_name,
          'unitPrice', oi.unit_price,
          'quantity', oi.quantity,
          'notes', oi.notes,
          'option', oi.selected_option,
          'extras', oi.extras,
          'substitutes', oi.substitutes,
          'image', coalesce(p.image_url, '/menu/imperio/chilaquiles-sencillos.jpg')
        )
        order by oi.id
      )
      from public.order_items oi
      left join public.products p on p.id = oi.product_id
      where oi.order_id = o.id
    ), '[]'::jsonb)
  )
  from public.orders o
  join public.tables t on t.id = o.table_id
  where o.id = p_order_id;
$$;

revoke all on function public.order_as_json(uuid) from public, anon, authenticated;

-- ============================================================================
-- 6. place_order: acepta p_session_id opcional y valida extras con precio para carta
-- ============================================================================
create or replace function public.place_order(
  p_table_code text,
  p_items jsonb,
  p_notes text,
  p_idempotency_key uuid,
  p_session_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant_id uuid;
  v_table_id uuid;
  v_order_id uuid;
  v_subtotal numeric(10,2);
  v_item_count integer;
begin
  -- Idempotencia: si ya existe el pedido, devolverlo.
  select id into v_order_id
  from public.orders
  where idempotency_key = p_idempotency_key;

  if v_order_id is not null then
    return public.order_as_json(v_order_id);
  end if;

  if jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) < 1
    or jsonb_array_length(p_items) > 30 then
    raise exception 'invalid_items';
  end if;

  select t.id, t.restaurant_id into v_table_id, v_restaurant_id
  from public.tables t
  join public.restaurants r on r.id = t.restaurant_id
  where t.code = upper(trim(p_table_code)) and t.active and r.active
  limit 1;
  if v_table_id is null then raise exception 'invalid_table'; end if;

  -- Validar session_id si se proporciona: debe pertenecer a esta mesa y estar activa.
  if p_session_id is not null then
    if not exists (
      select 1 from public.table_sessions ts
      where ts.id = p_session_id
        and ts.restaurant_id = v_restaurant_id
        and ts.table_id = v_table_id
        and ts.status = 'active'
    ) then
      raise exception 'invalid_session';
    end if;
  end if;

  -- Basic per-table rate limit.
  if (
    select count(*) from public.orders
    where table_id = v_table_id and created_at > now() - interval '1 minute'
  ) >= 8 then
    raise exception 'rate_limited';
  end if;

  -- Validate items and calculate subtotal including extras for both comida corrida and carta.
  -- IMPORTANTE: Los precios de extras se obtienen de la configuración oficial,
  -- NO del precio enviado por el cliente.
  with requested as (
    select
      x->>'productId' as slug,
      (x->>'quantity')::integer as quantity,
      x->'extras' as extras
    from jsonb_array_elements(p_items) x
  ), valid as (
    select
      r.slug,
      r.quantity,
      r.extras,
      p.price as base_price,
      case
        -- Comida corrida: extras desde daily_menus.courses.Extras
        when r.slug = 'comida-corrida'
          and r.extras is not null
          and jsonb_typeof(r.extras) = 'array'
          and jsonb_array_length(r.extras) > 0
        then p.price + coalesce((
          select sum(
            greatest(0, (official_extra->>'price')::numeric)
          )
          from jsonb_array_elements(r.extras) requested_extra
          cross join lateral (
            select jsonb_array_elements(
              coalesce(
                (select dm.courses->'Extras' from public.daily_menus dm
                 where dm.restaurant_id = v_restaurant_id and dm.active limit 1),
                '[]'::jsonb
              )
            ) as official_extra
            where official_extra->>'name' = requested_extra->>'name'
              and official_extra->>'active' <> 'false'
          ) official_match
        ), 0)
        -- Productos a la carta: extras desde products.extras_config
        when r.extras is not null
          and jsonb_typeof(r.extras) = 'array'
          and jsonb_array_length(r.extras) > 0
          and p.extras_config is not null
          and jsonb_typeof(p.extras_config) = 'array'
          and jsonb_array_length(p.extras_config) > 0
        then p.price + coalesce((
          select sum(
            greatest(0, (official_extra->>'price')::numeric)
          )
          from jsonb_array_elements(r.extras) requested_extra
          cross join lateral (
            select jsonb_array_elements(p.extras_config) as official_extra
            where official_extra->>'name' = requested_extra->>'name'
              and official_extra->>'active' <> 'false'
          ) official_match
        ), 0)
        else p.price
      end as unit_price
    from requested r
    join public.products p
      on p.restaurant_id = v_restaurant_id
      and p.slug = r.slug
      and p.active
      and not p.sold_out
    where r.quantity between 1 and 10
  )
  select count(*), coalesce(sum(quantity * unit_price), 0)
    into v_item_count, v_subtotal
  from valid;

  if v_item_count <> jsonb_array_length(p_items) then
    raise exception 'invalid_or_unavailable_product';
  end if;

  insert into public.orders (
    folio, restaurant_id, table_id, subtotal, total, notes, idempotency_key, status, session_id
  ) values (
    'O-' || lpad(nextval('public.order_folio_seq')::text, 4, '0'),
    v_restaurant_id,
    v_table_id,
    v_subtotal,
    v_subtotal,
    left(trim(coalesce(p_notes, '')), 250),
    p_idempotency_key,
    'accepted',
    p_session_id
  ) returning id into v_order_id;

  insert into public.order_items (
    order_id, product_id, product_name, unit_price, quantity, notes, selected_option, extras, substitutes
  )
  select
    v_order_id,
    p.id,
    p.name,
    case
      when x->>'productId' = 'comida-corrida'
        and x->'extras' is not null
        and jsonb_typeof(x->'extras') = 'array'
        and jsonb_array_length(x->'extras') > 0
      then p.price + coalesce((
        select sum(
          greatest(0, (official_extra->>'price')::numeric)
        )
        from jsonb_array_elements(x->'extras') requested_extra
        cross join lateral (
          select jsonb_array_elements(
            coalesce(
              (select dm.courses->'Extras' from public.daily_menus dm
               where dm.restaurant_id = v_restaurant_id and dm.active limit 1),
              '[]'::jsonb
            )
          ) as official_extra
          where official_extra->>'name' = requested_extra->>'name'
            and official_extra->>'active' <> 'false'
        ) official_match
      ), 0)
      when x->'extras' is not null
        and jsonb_typeof(x->'extras') = 'array'
        and jsonb_array_length(x->'extras') > 0
        and p.extras_config is not null
        and jsonb_typeof(p.extras_config) = 'array'
        and jsonb_array_length(p.extras_config) > 0
      then p.price + coalesce((
        select sum(
          greatest(0, (official_extra->>'price')::numeric)
        )
        from jsonb_array_elements(x->'extras') requested_extra
        cross join lateral (
          select jsonb_array_elements(p.extras_config) as official_extra
          where official_extra->>'name' = requested_extra->>'name'
            and official_extra->>'active' <> 'false'
        ) official_match
      ), 0)
      else p.price
    end as unit_price,
    (x->>'quantity')::integer,
    left(trim(coalesce(x->>'notes', '')), 250),
    nullif(left(trim(coalesce(x->>'option', '')), 80), ''),
    case
      when x->'extras' is not null
        and jsonb_typeof(x->'extras') = 'array'
        and jsonb_array_length(x->'extras') > 0
      then x->'extras'
      else null
    end as extras,
    x->'substitutes'
  from jsonb_array_elements(p_items) x
  join public.products p
    on p.restaurant_id = v_restaurant_id
    and p.slug = x->>'productId'
    and p.active
    and not p.sold_out;

  insert into public.order_events (order_id, to_status)
  values (v_order_id, 'accepted');

  return public.order_as_json(v_order_id);
end;
$$;

grant execute on function public.place_order(text, jsonb, text, uuid, uuid) to anon, authenticated;

-- ============================================================================
-- 6b. product_as_json: incluir extrasConfig en la salida
-- ============================================================================
create or replace function public.product_as_json(p_product_id uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', p.slug,
    'name', p.name,
    'description', p.description,
    'price', p.price,
    'compareAt', p.compare_at_price,
    'category', coalesce(c.name, 'A la carta'),
    'image', coalesce(p.image_url, '/menu/imperio/chilaquiles-sencillos.jpg'),
    'popular', p.popular,
    'isNew', p.is_new,
    'soldOut', p.sold_out,
    'active', p.active,
    'options', p.options,
    'optionGroups', p.option_groups,
    'packageIncludes', p.package_includes,
    'extrasConfig', p.extras_config,
    'availableFrom', case when p.available_from is null then null else to_char(p.available_from, 'HH24:MI') end,
    'availableUntil', case when p.available_until is null then null else to_char(p.available_until, 'HH24:MI') end
  ))
  from public.products p
  left join public.categories c on c.id = p.category_id
  where p.id = p_product_id;
$$;

revoke all on function public.product_as_json(uuid) from public, anon, authenticated;

-- ============================================================================
-- 6c. save_admin_product: manejar extras_config en INSERT y UPDATE
-- ============================================================================
create or replace function public.save_admin_product(p_pin text, p_product jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant_id uuid;
  v_category_id uuid;
  v_product_id uuid;
  v_slug text;
begin
  select id into v_restaurant_id
  from public.restaurants
  where active
    and demo_pin_hash is not null
    and demo_pin_hash = extensions.crypt(p_pin, demo_pin_hash)
  limit 1;

  if v_restaurant_id is null then raise exception 'invalid_pin'; end if;

  v_slug := lower(regexp_replace(coalesce(p_product->>'id', ''), '[^a-zA-Z0-9-]+', '-', 'g'));
  if length(v_slug) < 1 or length(v_slug) > 80 then raise exception 'invalid_slug'; end if;

  select id into v_category_id
  from public.categories
  where restaurant_id = v_restaurant_id
    and name = p_product->>'category'
  limit 1;

  if v_category_id is null then
    insert into public.categories (restaurant_id, name, sort_order, active)
    values (
      v_restaurant_id,
      left(coalesce(nullif(p_product->>'category', ''), 'A la carta'), 80),
      999,
      true
    )
    returning id into v_category_id;
  end if;

  insert into public.products (
    restaurant_id, category_id, slug, name, description, price,
    compare_at_price, image_url, active, sold_out, popular, is_new,
    options, option_groups, package_includes, extras_config, available_from,
    available_until, updated_at
  )
  values (
    v_restaurant_id,
    v_category_id,
    v_slug,
    left(p_product->>'name', 120),
    left(coalesce(p_product->>'description', ''), 500),
    greatest(0, (p_product->>'price')::numeric),
    nullif(p_product->>'compareAt', '')::numeric,
    left(coalesce(nullif(p_product->>'image', ''), '/menu/imperio/chilaquiles-sencillos.jpg'), 500),
    coalesce((p_product->>'active')::boolean, true),
    coalesce((p_product->>'soldOut')::boolean, false),
    coalesce((p_product->>'popular')::boolean, false),
    coalesce((p_product->>'isNew')::boolean, false),
    coalesce(p_product->'options', '[]'::jsonb),
    coalesce(p_product->'optionGroups', '[]'::jsonb),
    coalesce(p_product->'packageIncludes', '[]'::jsonb),
    coalesce(p_product->'extrasConfig', '[]'::jsonb),
    nullif(p_product->>'availableFrom', '')::time,
    nullif(p_product->>'availableUntil', '')::time,
    now()
  )
  on conflict (restaurant_id, slug) do update set
    category_id = excluded.category_id,
    name = excluded.name,
    description = excluded.description,
    price = excluded.price,
    compare_at_price = excluded.compare_at_price,
    image_url = excluded.image_url,
    active = excluded.active,
    sold_out = excluded.sold_out,
    popular = excluded.popular,
    is_new = excluded.is_new,
    options = excluded.options,
    option_groups = excluded.option_groups,
    package_includes = excluded.package_includes,
    extras_config = excluded.extras_config,
    available_from = excluded.available_from,
    available_until = excluded.available_until,
    updated_at = now()
  returning id into v_product_id;

  return public.product_as_json(v_product_id);
end;
$$;

revoke all on function public.save_admin_product(text, jsonb) from public, anon, authenticated;
grant execute on function public.save_admin_product(text, jsonb) to anon, authenticated;

-- ============================================================================
-- 7. RPC: obtener o crear sesión de mesa (concurrency-safe)
-- ============================================================================
create or replace function public.get_or_create_table_session(p_table_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant_id uuid;
  v_table_id uuid;
  v_session_id uuid;
  v_session jsonb;
begin
  select t.id, t.restaurant_id into v_table_id, v_restaurant_id
  from public.tables t
  join public.restaurants r on r.id = t.restaurant_id
  where t.code = upper(trim(p_table_code)) and t.active and r.active
  limit 1;
  if v_table_id is null then
    raise exception 'invalid_table';
  end if;

  -- Intentar obtener la sesión activa existente.
  select id into v_session_id
  from public.table_sessions
  where restaurant_id = v_restaurant_id
    and table_id = v_table_id
    and status = 'active'
  limit 1;

  -- Si no existe, intentar crear. El índice único parcial garantiza que
  -- dos llamadas concurrentes no creen dos sesiones.
  if v_session_id is null then
    begin
      insert into public.table_sessions (restaurant_id, table_id, status)
      values (v_restaurant_id, v_table_id, 'active')
      returning id into v_session_id;
    exception when unique_violation then
      -- Otra conexión creó la sesión primero: recuperarla.
      select id into v_session_id
      from public.table_sessions
      where restaurant_id = v_restaurant_id
        and table_id = v_table_id
        and status = 'active'
      limit 1;
    end;
  end if;

  -- Devolver sesión con sus pedidos.
  select jsonb_build_object(
    'id', ts.id,
    'tableCode', t.code,
    'status', ts.status,
    'createdAt', ts.created_at,
    'updatedAt', ts.updated_at,
    'orders', coalesce((
      select jsonb_agg(public.order_as_json(o.id) order by o.created_at asc)
      from public.orders o
      where o.session_id = ts.id
    ), '[]'::jsonb)
  )
  into v_session
  from public.table_sessions ts
  join public.tables t on t.id = ts.table_id
  where ts.id = v_session_id;

  return v_session;
end;
$$;

grant execute on function public.get_or_create_table_session(text) to anon, authenticated;

-- ============================================================================
-- 8. RPC: obtener sesión activa por código de mesa (solo lectura)
-- ============================================================================
create or replace function public.get_table_session(p_table_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session jsonb;
begin
  select jsonb_build_object(
    'id', ts.id,
    'tableCode', t.code,
    'status', ts.status,
    'createdAt', ts.created_at,
    'updatedAt', ts.updated_at,
    'orders', coalesce((
      select jsonb_agg(public.order_as_json(o.id) order by o.created_at asc)
      from public.orders o
      where o.session_id = ts.id
    ), '[]'::jsonb)
  )
  into v_session
  from public.table_sessions ts
  join public.tables t on t.id = ts.table_id
  join public.restaurants r on r.id = t.restaurant_id
  where t.code = upper(trim(p_table_code))
    and r.active and t.active
    and ts.status = 'active'
  limit 1;

  return v_session;
end;
$$;

grant execute on function public.get_table_session(text) to anon, authenticated;

-- ============================================================================
-- 9. RPC: cerrar sesión de mesa (cambia a 'closed', crea nueva al volver a escanear)
-- ============================================================================
create or replace function public.close_table_session(p_session_id uuid, p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant_id uuid;
  v_session jsonb;
begin
  select id into v_restaurant_id
  from public.restaurants
  where active
    and demo_pin_hash is not null
    and demo_pin_hash = extensions.crypt(p_pin, demo_pin_hash)
  limit 1;
  if v_restaurant_id is null then
    raise exception 'invalid_pin';
  end if;

  select jsonb_build_object(
    'id', ts.id,
    'tableCode', t.code,
    'status', ts.status,
    'createdAt', ts.created_at,
    'updatedAt', ts.updated_at,
    'orders', coalesce((
      select jsonb_agg(public.order_as_json(o.id) order by o.created_at asc)
      from public.orders o
      where o.session_id = ts.id
    ), '[]'::jsonb)
  )
  into v_session
  from public.table_sessions ts
  join public.tables t on t.id = ts.table_id
  join public.restaurants r on r.id = t.restaurant_id
  where ts.id = p_session_id
    and r.id = v_restaurant_id
    and ts.status = 'active'
  limit 1
  for update;

  if v_session is null then
    return null;
  end if;

  update public.table_sessions
  set status = 'closed', updated_at = now()
  where id = (v_session->>'id')::uuid;

  -- Recargar el JSON con el nuevo estado.
  select jsonb_build_object(
    'id', ts.id,
    'tableCode', t.code,
    'status', ts.status,
    'createdAt', ts.created_at,
    'updatedAt', ts.updated_at,
    'orders', v_session->'orders'
  )
  into v_session
  from public.table_sessions ts
  join public.tables t on t.id = ts.table_id
  where ts.id = (v_session->>'id')::uuid;

  return v_session;
end;
$$;

grant execute on function public.close_table_session(uuid, text) to anon, authenticated;

-- ============================================================================
-- 10. RPC: cuenta de sesión (suma de pedidos activos)
-- ============================================================================
create or replace function public.session_account(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account jsonb;
begin
  select jsonb_build_object(
    'sessionId', ts.id,
    'tableCode', t.code,
    'status', ts.status,
    'orderCount', (select count(*) from public.orders o where o.session_id = ts.id),
    'total', coalesce((
      select sum(total) from public.orders o
      where o.session_id = ts.id
        and o.status not in ('cancelled')
    ), 0),
    'orders', coalesce((
      select jsonb_agg(public.order_as_json(o.id) order by o.created_at asc)
      from public.orders o
      where o.session_id = ts.id
    ), '[]'::jsonb)
  )
  into v_account
  from public.table_sessions ts
  join public.tables t on t.id = ts.table_id
  where ts.id = p_session_id;

  return v_account;
end;
$$;

grant execute on function public.session_account(uuid) to anon, authenticated;

-- ============================================================================
-- 11. kitchen_orders: incluir sessionId en cada orden (order_as_json ya lo devuelve)
-- ============================================================================
-- No es necesario modificar kitchen_orders: order_as_json ahora incluye sessionId.

-- ============================================================================
-- 12. RPC: obtener todas las sesiones activas (para el tablero de mesas)
-- ============================================================================
create or replace function public.get_active_sessions()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', ts.id,
      'tableCode', t.code,
      'status', ts.status,
      'createdAt', ts.created_at,
      'updatedAt', ts.updated_at,
      'orderCount', (
        select count(*) from public.orders o
        where o.session_id = ts.id
      ),
      'total', coalesce((
        select sum(o.total) from public.orders o
        where o.session_id = ts.id
          and o.status <> 'cancelled'
      ), 0)
    )
    order by t.code
  ), '[]'::jsonb)
  from public.table_sessions ts
  join public.tables t on t.id = ts.table_id
  where ts.status = 'active';
$$;

grant execute on function public.get_active_sessions() to anon, authenticated;
