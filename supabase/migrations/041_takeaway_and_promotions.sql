-- ============================================================================
-- 041: Pedido para llevar (nombre del cliente) + Módulo de Promociones
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. LLEVAR: nombre del cliente en orders (para llamarlo en mostrador)
--    - place_order NO cambia: el nombre se guarda con UPDATE vía service_role
--    - order_as_json lo expone al cliente y a la comanda (kitchen_orders)
-- ----------------------------------------------------------------------------
alter table public.orders add column if not exists customer_name text;

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
    'customerName', o.customer_name,
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

revoke all on function public.order_as_json(uuid) from public;
grant execute on function public.order_as_json(uuid) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2. Promociones
--    - Admin (service_role) hace CRUD directo con gate de PIN
--    - El menú público consume public_promotions() (solo activas)
-- ----------------------------------------------------------------------------
create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 120),
  discount_type text not null check (discount_type in ('percent', 'fixed')),
  discount_value numeric(10,2) not null check (discount_value > 0),
  target_product_id uuid references public.products(id) on delete cascade,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists promotions_restaurant_active_idx
  on public.promotions(restaurant_id, is_active);
create index if not exists promotions_product_idx
  on public.promotions(target_product_id);

alter table public.promotions enable row level security;

-- Promociones activas para el menú público (single-tenant: restaurante demo)
create or replace function public.public_promotions()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', pr.id,
      'title', pr.title,
      'discountType', pr.discount_type,
      'discountValue', pr.discount_value,
      'productId', pr.target_product_id,
      'productSlug', p.slug,
      'isActive', pr.is_active
    ) order by pr.created_at desc
  ), '[]'::jsonb)
  from public.promotions pr
  left join public.products p on p.id = pr.target_product_id
  where pr.restaurant_id = '00000000-0000-0000-0000-000000000001'
    and pr.is_active;
$$;

revoke all on function public.public_promotions() from public;
grant execute on function public.public_promotions() to anon, authenticated;
