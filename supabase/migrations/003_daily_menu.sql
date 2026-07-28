-- Operational daily-menu configuration.
-- Safe to run after 001_initial.sql and 002_fix_staff_pin.sql.

create table if not exists public.daily_menus (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null unique references public.restaurants(id) on delete cascade,
  service_date date not null default ((now() at time zone 'America/Mexico_City')::date),
  active boolean not null default false,
  available_from time not null default '13:00',
  available_until time not null default '17:00',
  price numeric(10,2) not null check (price > 0),
  courses jsonb not null check (jsonb_typeof(courses) = 'object'),
  updated_at timestamptz not null default now()
);

alter table public.daily_menus enable row level security;

drop policy if exists "public active daily menu" on public.daily_menus;
create policy "public active daily menu" on public.daily_menus for select
  using (active);

insert into public.daily_menus (
  restaurant_id,
  service_date,
  active,
  available_from,
  available_until,
  price,
  courses
)
values (
  '00000000-0000-0000-0000-000000000001',
  (now() at time zone 'America/Mexico_City')::date,
  true,
  '13:00',
  '17:00',
  125,
  '{
    "Entrada": ["Sopa de tortilla", "Consomé del día"],
    "Plato fuerte": ["Milanesa con papas", "Enchiladas verdes"],
    "Bebida": ["Agua de jamaica", "Agua de horchata"]
  }'::jsonb
)
on conflict (restaurant_id) do nothing;

insert into public.products (
  restaurant_id,
  category_id,
  slug,
  name,
  description,
  price,
  image_url,
  active,
  sold_out,
  popular,
  is_new,
  options
)
select
  '00000000-0000-0000-0000-000000000001',
  c.id,
  'comida-corrida',
  'Comida corrida',
  'Menú completo del día con entrada, plato fuerte y bebida.',
  125,
  '/menu/ensalada.png',
  true,
  false,
  false,
  false,
  '[]'::jsonb
from public.categories c
where c.restaurant_id = '00000000-0000-0000-0000-000000000001'
  and c.name = 'Antojitos mexicanos'
on conflict (restaurant_id, slug) do nothing;

create or replace function public.daily_menu_as_json(p_admin boolean default false)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'active', d.active,
    'availableToday',
      d.active and d.service_date = (now() at time zone 'America/Mexico_City')::date,
    'serviceDate', d.service_date,
    'availableFrom', to_char(d.available_from, 'HH24:MI'),
    'availableUntil', to_char(d.available_until, 'HH24:MI'),
    'price', d.price,
    'courses', d.courses,
    'updatedAt', d.updated_at
  )
  from public.daily_menus d
  where d.restaurant_id = '00000000-0000-0000-0000-000000000001'
    and (p_admin or d.active)
  limit 1;
$$;

create or replace function public.get_daily_menu()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.daily_menu_as_json(false);
$$;

create or replace function public.admin_daily_menu(p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.restaurants
    where active
      and demo_pin_hash is not null
      and demo_pin_hash = extensions.crypt(p_pin, demo_pin_hash)
  ) then
    raise exception 'invalid_pin';
  end if;

  return public.daily_menu_as_json(true);
end;
$$;

create or replace function public.save_daily_menu(
  p_pin text,
  p_active boolean,
  p_service_date date,
  p_available_from time,
  p_available_until time,
  p_price numeric,
  p_courses jsonb
)
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
  where active
    and demo_pin_hash is not null
    and demo_pin_hash = extensions.crypt(p_pin, demo_pin_hash)
  limit 1;

  if v_restaurant_id is null then raise exception 'invalid_pin'; end if;
  if p_price <= 0 or p_price > 10000 then raise exception 'invalid_price'; end if;
  if p_available_until <= p_available_from then raise exception 'invalid_schedule'; end if;
  if jsonb_typeof(p_courses) <> 'object' then raise exception 'invalid_courses'; end if;

  insert into public.daily_menus (
    restaurant_id,
    service_date,
    active,
    available_from,
    available_until,
    price,
    courses,
    updated_at
  )
  values (
    v_restaurant_id,
    p_service_date,
    p_active,
    p_available_from,
    p_available_until,
    p_price,
    p_courses,
    now()
  )
  on conflict (restaurant_id) do update set
    service_date = excluded.service_date,
    active = excluded.active,
    available_from = excluded.available_from,
    available_until = excluded.available_until,
    price = excluded.price,
    courses = excluded.courses,
    updated_at = now();

  update public.products
  set
    price = p_price,
    active = p_active,
    sold_out = not p_active,
    updated_at = now()
  where restaurant_id = v_restaurant_id
    and slug = 'comida-corrida';

  return public.daily_menu_as_json(true);
end;
$$;

revoke all on function public.daily_menu_as_json(boolean) from public;
revoke all on function public.get_daily_menu() from public;
revoke all on function public.admin_daily_menu(text) from public;
revoke all on function public.save_daily_menu(text, boolean, date, time, time, numeric, jsonb)
  from public;

grant execute on function public.get_daily_menu() to anon, authenticated;
grant execute on function public.admin_daily_menu(text) to anon, authenticated;
grant execute on function public.save_daily_menu(text, boolean, date, time, time, numeric, jsonb)
  to anon, authenticated;
