-- Corrige el platillo de champiñones y registra una prueba segura de 14 días.
-- Ejecutar después de 007_breakfast_packages_and_sales_report.sql.

update public.products
set
  active = false,
  sold_out = true,
  updated_at = now()
where restaurant_id = '00000000-0000-0000-0000-000000000001'
  and slug = 'molletes-champinones';

delete from public.menu_products
where product_id in (
  select id
  from public.products
  where restaurant_id = '00000000-0000-0000-0000-000000000001'
    and slug = 'molletes-champinones'
);

update public.products
set
  name = 'Omelette de champiñones',
  description = 'Omelette de champiñones con frijoles. Paquete con fruta y café.',
  price = 65,
  image_url = '/menu/imperio/omelette-champinones.jpg',
  active = true,
  sold_out = false,
  options = '[
    "Salsa verde",
    "Salsa roja",
    "Salsa suiza",
    "Queso fresco",
    "Manchego gratinado"
  ]'::jsonb,
  updated_at = now()
where restaurant_id = '00000000-0000-0000-0000-000000000001'
  and slug = 'omelette-champinones';

alter table public.restaurants
  add column if not exists trial_started_at timestamptz,
  add column if not exists trial_ends_at timestamptz;

update public.restaurants
set
  trial_started_at = coalesce(trial_started_at, now()),
  trial_ends_at = coalesce(trial_ends_at, now() + interval '14 days'),
  updated_at = now()
where id = '00000000-0000-0000-0000-000000000001';

create or replace function public.trial_status()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'startedAt', trial_started_at,
    'endsAt', trial_ends_at,
    'active', trial_ends_at is null or trial_ends_at > now(),
    'daysRemaining', greatest(
      0,
      ceil(extract(epoch from (trial_ends_at - now())) / 86400)
    )::integer,
    'hoursRemaining', greatest(
      0,
      ceil(extract(epoch from (trial_ends_at - now())) / 3600)
    )::integer
  )
  from public.restaurants
  where id = '00000000-0000-0000-0000-000000000001';
$$;

revoke all on function public.trial_status() from public;
grant execute on function public.trial_status() to anon, authenticated;
