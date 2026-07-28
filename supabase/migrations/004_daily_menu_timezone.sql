-- Keep "today" aligned with the restaurant timezone instead of UTC.
-- Safe to run after 003_daily_menu.sql.

alter table public.daily_menus
  alter column service_date
  set default ((now() at time zone 'America/Mexico_City')::date);

update public.daily_menus
set
  service_date = (now() at time zone 'America/Mexico_City')::date,
  updated_at = now()
where restaurant_id = '00000000-0000-0000-0000-000000000001'
  and service_date = current_date
  and current_date <> (now() at time zone 'America/Mexico_City')::date;

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

revoke all on function public.daily_menu_as_json(boolean) from public;
