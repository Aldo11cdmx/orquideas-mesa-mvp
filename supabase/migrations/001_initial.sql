-- Orquídeas table-ordering MVP
-- Run once in Supabase SQL Editor. The demo PIN is 2026; change it before real use.

create extension if not exists pgcrypto;

create table if not exists public.restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  address text,
  timezone text not null default 'America/Mexico_City',
  demo_pin_hash text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tables (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  code text not null check (code ~ '^[A-Z][0-9]{1,2}$'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (restaurant_id, code)
);

create table if not exists public.menus (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('fixed', 'daily')),
  active boolean not null default true,
  available_from time,
  available_until time,
  available_date date,
  demo_data boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  unique (restaurant_id, name)
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  slug text not null,
  name text not null,
  description text not null default '',
  price numeric(10,2) not null check (price >= 0),
  compare_at_price numeric(10,2) check (compare_at_price is null or compare_at_price >= price),
  image_url text,
  active boolean not null default true,
  sold_out boolean not null default false,
  popular boolean not null default false,
  is_new boolean not null default false,
  options jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, slug)
);

create table if not exists public.menu_products (
  menu_id uuid not null references public.menus(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  sort_order integer not null default 0,
  active boolean not null default true,
  primary key (menu_id, product_id)
);

create sequence if not exists public.order_folio_seq start 1001;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  folio text not null unique,
  restaurant_id uuid not null references public.restaurants(id),
  table_id uuid not null references public.tables(id),
  status text not null default 'sent'
    check (status in ('sent','accepted','preparing','ready','delivered','cancelled')),
  subtotal numeric(10,2) not null check (subtotal >= 0),
  total numeric(10,2) not null check (total >= 0),
  notes text not null default '' check (length(notes) <= 250),
  idempotency_key uuid not null unique,
  access_token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id),
  product_name text not null,
  unit_price numeric(10,2) not null check (unit_price >= 0),
  quantity integer not null check (quantity between 1 and 10),
  notes text not null default '' check (length(notes) <= 250),
  selected_option text check (length(selected_option) <= 80),
  line_total numeric(10,2) generated always as (unit_price * quantity) stored
);

create table if not exists public.order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  from_status text,
  to_status text not null,
  actor_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.staff_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  role text not null check (role in ('kitchen', 'admin')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_tables_restaurant_active
  on public.tables (restaurant_id, active);
create index if not exists idx_products_restaurant_active
  on public.products (restaurant_id, active, sold_out);
create index if not exists idx_orders_restaurant_status_created
  on public.orders (restaurant_id, status, created_at);
create index if not exists idx_orders_table_created
  on public.orders (table_id, created_at desc);
create index if not exists idx_order_items_order
  on public.order_items (order_id);
create index if not exists idx_order_events_order_created
  on public.order_events (order_id, created_at);

alter table public.restaurants enable row level security;
alter table public.tables enable row level security;
alter table public.menus enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.menu_products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_events enable row level security;
alter table public.staff_users enable row level security;

-- Public menu data only. Orders remain inaccessible through direct table queries.
drop policy if exists "public active restaurants" on public.restaurants;
create policy "public active restaurants" on public.restaurants for select
  using (active);
drop policy if exists "public active tables" on public.tables;
create policy "public active tables" on public.tables for select
  using (active);
drop policy if exists "public active menus" on public.menus;
create policy "public active menus" on public.menus for select
  using (active);
drop policy if exists "public active categories" on public.categories;
create policy "public active categories" on public.categories for select
  using (active);
drop policy if exists "public active products" on public.products;
create policy "public active products" on public.products for select
  using (active);
drop policy if exists "public active menu products" on public.menu_products;
create policy "public active menu products" on public.menu_products for select
  using (active);

-- Authenticated staff policies are ready for replacing the demo PIN flow.
drop policy if exists "staff sees own profile" on public.staff_users;
create policy "staff sees own profile" on public.staff_users for select
  using (user_id = auth.uid() and active);
drop policy if exists "staff sees restaurant orders" on public.orders;
create policy "staff sees restaurant orders" on public.orders for select to authenticated
  using (
    exists (
      select 1 from public.staff_users s
      where s.user_id = auth.uid()
        and s.restaurant_id = orders.restaurant_id
        and s.active
    )
  );

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
    'status', o.status,
    'notes', o.notes,
    'subtotal', o.subtotal,
    'total', o.total,
    'createdAt', o.created_at,
    'updatedAt', o.updated_at,
    'accessToken', o.access_token,
    'source', 'supabase',
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'productId', coalesce(p.slug, oi.product_id::text),
          'name', oi.product_name,
          'unitPrice', oi.unit_price,
          'quantity', oi.quantity,
          'notes', oi.notes,
          'option', oi.selected_option,
          'image', coalesce(p.image_url, '/menu/texas.png')
        ) order by oi.id
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

create or replace function public.place_order(
  p_table_code text,
  p_items jsonb,
  p_notes text,
  p_idempotency_key uuid
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

  -- Basic per-table rate limit.
  if (
    select count(*) from public.orders
    where table_id = v_table_id and created_at > now() - interval '1 minute'
  ) >= 8 then
    raise exception 'rate_limited';
  end if;

  with requested as (
    select
      x->>'productId' as slug,
      (x->>'quantity')::integer as quantity
    from jsonb_array_elements(p_items) x
  ), valid as (
    select r.slug, r.quantity, p.price
    from requested r
    join public.products p
      on p.restaurant_id = v_restaurant_id
      and p.slug = r.slug
      and p.active
      and not p.sold_out
    where r.quantity between 1 and 10
  )
  select count(*), coalesce(sum(quantity * price), 0)
    into v_item_count, v_subtotal
  from valid;

  if v_item_count <> jsonb_array_length(p_items) then
    raise exception 'invalid_or_unavailable_product';
  end if;

  insert into public.orders (
    folio, restaurant_id, table_id, subtotal, total, notes, idempotency_key
  ) values (
    'O-' || lpad(nextval('public.order_folio_seq')::text, 4, '0'),
    v_restaurant_id,
    v_table_id,
    v_subtotal,
    v_subtotal,
    left(trim(coalesce(p_notes, '')), 250),
    p_idempotency_key
  ) returning id into v_order_id;

  insert into public.order_items (
    order_id, product_id, product_name, unit_price, quantity, notes, selected_option
  )
  select
    v_order_id,
    p.id,
    p.name,
    p.price,
    (x->>'quantity')::integer,
    left(trim(coalesce(x->>'notes', '')), 250),
    nullif(left(trim(coalesce(x->>'option', '')), 80), '')
  from jsonb_array_elements(p_items) x
  join public.products p
    on p.restaurant_id = v_restaurant_id
    and p.slug = x->>'productId'
    and p.active
    and not p.sold_out;

  insert into public.order_events (order_id, to_status)
  values (v_order_id, 'sent');

  return public.order_as_json(v_order_id);
end;
$$;

create or replace function public.get_order_status(
  p_order_id uuid,
  p_access_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.orders
    where id = p_order_id and access_token::text = p_access_token
  ) then
    return null;
  end if;
  return public.order_as_json(p_order_id);
end;
$$;

create or replace function public.kitchen_orders(p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant_id uuid;
begin
  select id into v_restaurant_id
  from public.restaurants
  where active and demo_pin_hash is not null and demo_pin_hash = crypt(p_pin, demo_pin_hash)
  limit 1;
  if v_restaurant_id is null then raise exception 'invalid_pin'; end if;

  return coalesce((
    select jsonb_agg(public.order_as_json(o.id) order by o.created_at asc)
    from public.orders o
    where o.restaurant_id = v_restaurant_id
      and o.created_at > now() - interval '24 hours'
  ), '[]'::jsonb);
end;
$$;

create or replace function public.update_order_status(
  p_order_id uuid,
  p_status text,
  p_pin text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant_id uuid;
  v_from text;
begin
  select id into v_restaurant_id
  from public.restaurants
  where active and demo_pin_hash is not null and demo_pin_hash = crypt(p_pin, demo_pin_hash)
  limit 1;
  if v_restaurant_id is null then raise exception 'invalid_pin'; end if;

  select status into v_from
  from public.orders
  where id = p_order_id and restaurant_id = v_restaurant_id
  for update;
  if v_from is null then raise exception 'order_not_found'; end if;

  if not (
    (v_from = 'sent' and p_status in ('accepted','cancelled'))
    or (v_from = 'accepted' and p_status in ('preparing','cancelled'))
    or (v_from = 'preparing' and p_status in ('ready','cancelled'))
    or (v_from = 'ready' and p_status in ('delivered','cancelled'))
  ) then
    raise exception 'invalid_transition';
  end if;

  update public.orders
  set status = p_status, updated_at = now()
  where id = p_order_id;

  insert into public.order_events (order_id, from_status, to_status)
  values (p_order_id, v_from, p_status);

  return public.order_as_json(p_order_id);
end;
$$;

grant execute on function public.place_order(text, jsonb, text, uuid) to anon, authenticated;
grant execute on function public.get_order_status(uuid, text) to anon, authenticated;
grant execute on function public.kitchen_orders(text) to anon, authenticated;
grant execute on function public.update_order_status(uuid, text, text) to anon, authenticated;

-- Seed one restaurant and the six initial tables.
insert into public.restaurants (id, name, slug, address, demo_pin_hash)
values (
  '00000000-0000-0000-0000-000000000001',
  'Orquídeas (nombre provisional)',
  'orquideas',
  'Av. Orquídeas, Hacienda Coacalco, Estado de México',
  crypt('2026', gen_salt('bf'))
)
on conflict (id) do update set
  demo_pin_hash = excluded.demo_pin_hash,
  updated_at = now();

insert into public.tables (restaurant_id, code)
select '00000000-0000-0000-0000-000000000001', code
from unnest(array['A1','A2','A3','B1','B2','B3']) code
on conflict (restaurant_id, code) do nothing;

insert into public.menus (id, restaurant_id, name, kind, active, demo_data)
values
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000001', 'Menú fijo', 'fixed', true, false),
  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000001', 'Comida corrida', 'daily', true, true)
on conflict (id) do nothing;

insert into public.categories (restaurant_id, name, sort_order)
values
  ('00000000-0000-0000-0000-000000000001','Mega hamburguesas',10),
  ('00000000-0000-0000-0000-000000000001','Para compartir',20),
  ('00000000-0000-0000-0000-000000000001','Antojitos mexicanos',30),
  ('00000000-0000-0000-0000-000000000001','Mega burros',40),
  ('00000000-0000-0000-0000-000000000001','Combos',50)
on conflict (restaurant_id, name) do nothing;

with product_seed(slug, name, description, price, compare_at, category, image, popular, is_new, options) as (
  values
  ('texas','Hamburguesa Texas Burger','Pan artesanal, jamón, tocino, aros de cebolla, quesos y BBQ.',75,120,'Mega hamburguesas','/menu/texas.png',true,false,'[]'::jsonb),
  ('sencilla','Hamburguesa Sencilla','200 g de carne preparada, queso, vegetales y papas.',110,null,'Mega hamburguesas','/menu/texas.png',false,false,'[]'::jsonb),
  ('noctec','Hamburguesa Noctec Burger','Chorizo, jamón y quesos, acompañada de papas.',125,null,'Mega hamburguesas','/menu/texas.png',false,true,'[]'::jsonb),
  ('hawaiana','Hamburguesa Hawaiana','Jamón, piña y quesos.',125,null,'Mega hamburguesas','/menu/texas.png',false,false,'[]'::jsonb),
  ('suiza','Hamburguesa Suiza','Jamón, quesillo y queso amarillo.',125,null,'Mega hamburguesas','/menu/texas.png',false,false,'[]'::jsonb),
  ('bufalo-burger','Búfalo Chicken Burger','Pechuga rebozada y salsa búfalo.',125,null,'Mega hamburguesas','/menu/boneless.png',false,false,'[]'::jsonb),
  ('hongo','Hongo Burger','Carne, champiñones, queso y vegetales.',130,null,'Mega hamburguesas','/menu/texas.png',false,false,'[]'::jsonb),
  ('monster','Monster Burger','Doble carne, jamón, tocino y quesos.',175,null,'Mega hamburguesas','/menu/texas.png',true,false,'[]'::jsonb),
  ('chipotle','Chipotle Burger','Queso crema y aderezo chipotle.',130,null,'Mega hamburguesas','/menu/texas.png',false,false,'[]'::jsonb),
  ('boneless','Boneless','Crujientes trozos de pollo con salsa a elegir.',67.5,110,'Para compartir','/menu/boneless.png',true,false,'["Clásica","BBQ tradicional","Ajo parmesano","Búfalo","Tamarindo jalapeño","Crema chipotle"]'::jsonb),
  ('alitas','Alitas','Fritas, bañadas con salsa y acompañadas de papas.',67.5,110,'Para compartir','/menu/alitas.png',true,false,'["Clásica","BBQ tradicional","Ajo parmesano","Tamarindo jalapeño","Crema chipotle"]'::jsonb),
  ('ensalada-imperial','Ensalada Imperial','Pechuga rebozada con vegetales, piña y queso.',100,null,'Para compartir','/menu/ensalada.png',false,false,'[]'::jsonb),
  ('nachos','Nachos Chilli','Carne, chorizo y frijoles al chipotle.',85,null,'Para compartir','/menu/nachos.png',false,false,'[]'::jsonb),
  ('poutine','Poutine','Arrachera servida sobre papas a la francesa.',115,null,'Para compartir','/menu/texas.png',false,false,'[]'::jsonb),
  ('club','Club Sándwich','Sándwich de tres pisos acompañado de papas.',90,null,'Para compartir','/menu/club.png',false,false,'[]'::jsonb),
  ('papas','Papas Fritas','300 gramos de papas a la francesa.',65,null,'Para compartir','/menu/alitas.png',false,false,'[]'::jsonb),
  ('chilaquiles','Chilaquiles','Costilla de res asada servida con chilaquiles.',80,null,'Antojitos mexicanos','/menu/nachos.png',false,false,'[]'::jsonb),
  ('carnita','Carnita Asada','Jugosa arrachera con papas y ensalada.',105,null,'Antojitos mexicanos','/menu/ensalada.png',false,false,'[]'::jsonb),
  ('burro-bistec','Mega Burro Bistec','Tortilla de harina de 35 cm con bistec.',95,null,'Mega burros','/menu/burro.png',true,false,'[]'::jsonb),
  ('burro-campechano','Mega Burro Campechano','Bistec con longaniza, ensalada y papas.',95,null,'Mega burros','/menu/burro.png',false,false,'[]'::jsonb),
  ('burro-pollo','Mega Burro Pollo','Mega burro relleno de pollo.',95,null,'Mega burros','/menu/burro.png',false,false,'[]'::jsonb),
  ('burro-pastor','Mega Burro Pastor','Mega burro relleno de carne al pastor.',95,null,'Mega burros','/menu/burro.png',false,false,'[]'::jsonb),
  ('burro-texano','Mega Burro Texano','Bistec, tocino y BBQ.',95,null,'Mega burros','/menu/burro.png',true,false,'[]'::jsonb),
  ('combo-nachos','Texas Burger + Nachos Chilli','Hamburguesa Texas con Nachos Chilli.',156,195,'Combos','/menu/texas.png',false,false,'[]'::jsonb),
  ('combo-alitas','Texas Burger + Alitas','Hamburguesa Texas con alitas.',169,230,'Combos','/menu/texas.png',false,false,'[]'::jsonb),
  ('combo-boneless','Texas Burger + Boneless','Hamburguesa Texas con boneless.',169,230,'Combos','/menu/texas.png',false,false,'[]'::jsonb)
)
insert into public.products (
  restaurant_id, category_id, slug, name, description, price, compare_at_price,
  image_url, popular, is_new, options
)
select
  '00000000-0000-0000-0000-000000000001',
  c.id,
  ps.slug,
  ps.name,
  ps.description,
  ps.price,
  ps.compare_at,
  ps.image,
  ps.popular,
  ps.is_new,
  ps.options
from product_seed ps
join public.categories c
  on c.restaurant_id = '00000000-0000-0000-0000-000000000001'
  and c.name = ps.category
on conflict (restaurant_id, slug) do update set
  name = excluded.name,
  description = excluded.description,
  price = excluded.price,
  compare_at_price = excluded.compare_at_price,
  image_url = excluded.image_url,
  popular = excluded.popular,
  is_new = excluded.is_new,
  options = excluded.options,
  updated_at = now();

insert into public.menu_products (menu_id, product_id, sort_order)
select '00000000-0000-0000-0000-000000000101', id,
  row_number() over (order by created_at, name)
from public.products
where restaurant_id = '00000000-0000-0000-0000-000000000001'
on conflict (menu_id, product_id) do nothing;

-- Demonstrates the unavailable-product flow; admin can enable it when stock returns.
update public.products
set sold_out = true
where restaurant_id = '00000000-0000-0000-0000-000000000001'
  and slug = 'poutine';

do $$
begin
  alter publication supabase_realtime add table public.orders;
exception
  when duplicate_object then null;
end $$;
