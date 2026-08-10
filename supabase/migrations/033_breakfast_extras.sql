-- 033_breakfast_extras.sql (SEGURO)
-- Extras configurables para todos los productos de Desayunos
-- Admin: API route usa service_role (bypassea RLS)
-- Público: solo lectura de extras activos

create table if not exists public.breakfast_extras (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price integer not null default 0,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.breakfast_extras enable row level security;

-- Solo lectura pública de extras activos
create policy "Public read active extras"
  on public.breakfast_extras
  for select
  to anon, authenticated
  using (active = true);

-- NOTA: No hay política de escritura para anon.
-- El admin usa la API route con SUPABASE_SERVICE_ROLE_KEY,
-- que se salta el RLS completamente.

create index if not exists idx_breakfast_extras_sort
  on public.breakfast_extras (sort_order, name);

-- Function: get active breakfast extras for menu (public)
create or replace function public.get_breakfast_extras()
returns jsonb
language plpgsql
security definer
as $$
begin
  return (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', id,
        'name', name,
        'price', price,
        'active', active
      )
      order by sort_order, name
    ), '[]'::jsonb)
    from public.breakfast_extras
    where active = true
  );
end;
$$;

grant execute on function public.get_breakfast_extras() to anon, authenticated;

-- Seed data: extras iniciales de desayunos
insert into public.breakfast_extras (name, price, sort_order) values
  ('Café solo', 15, 1),
  ('Crema evaporada', 15, 2),
  ('Huevo extra (1 pieza)', 10, 3),
  ('Huevo extra (2 piezas)', 20, 4),
  ('Bistec asado', 35, 5),
  ('Pechuga asada', 35, 6),
  ('Pechuga empanizada', 35, 7),
  ('Arrachera', 50, 8)
on conflict do nothing;
