-- 034_drink_flavors.sql
-- Sabores configurables para bebidas (café, malteada, licuado, agua de fruta)
-- La señora puede agregar, quitar o desactivar sabores desde admin
-- Admin: API route usa service_role (bypassea RLS)
-- Público: solo lectura de sabores activos

create table if not exists public.drink_flavors (
  id uuid primary key default gen_random_uuid(),
  drink_type text not null,
  name text not null,
  price_modifier integer not null default 0,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.drink_flavors enable row level security;

-- Solo lectura pública de sabores activos
create policy "Public read active drink flavors"
  on public.drink_flavors
  for select
  to anon, authenticated
  using (active = true);

-- Sin política de escritura para anon.
-- El admin usa service_role que se salta RLS.

create index if not exists idx_drink_flavors_type_sort
  on public.drink_flavors (drink_type, sort_order, name);

-- Function: get active drink flavors grouped by type (public)
create or replace function public.get_drink_flavors()
returns jsonb
language plpgsql
security definer
as $$
begin
  return (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', id,
        'drinkType', drink_type,
        'name', name,
        'priceModifier', price_modifier,
        'active', active
      )
      order by drink_type, sort_order, name
    ), '[]'::jsonb)
    from public.drink_flavors
    where active = true
  );
end;
$$;

grant execute on function public.get_drink_flavors() to anon, authenticated;

-- Seed data: sabores actuales
insert into public.drink_flavors (drink_type, name, price_modifier, sort_order) values
  -- Café
  ('cafe', 'Café normal', 0, 1),
  ('cafe', 'Café con leche evaporada', 15, 2),
  -- Malteada
  ('malteada', 'Fresa', 0, 1),
  ('malteada', 'Vainilla', 0, 2),
  ('malteada', 'Chocolate', 0, 3),
  ('malteada', 'Cajeta', 0, 4),
  ('malteada', 'Nescafé', 0, 5),
  -- Licuado
  ('licuado', 'Plátano', 0, 1),
  ('licuado', 'Fresa', 0, 2),
  ('licuado', 'Mamey', 0, 3),
  -- Agua de fruta
  ('agua-fruta', 'Jamaica', 0, 1),
  ('agua-fruta', 'Horchata', 0, 2),
  ('agua-fruta', 'Limonada', 0, 3),
  ('agua-fruta', 'Tamarindo', 0, 4)
on conflict do nothing;
