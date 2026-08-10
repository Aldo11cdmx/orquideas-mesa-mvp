-- 033_breakfast_extras.sql
-- Extras configurables para todos los productos de Desayunos
-- Gestionado desde admin > Desayunos (PIN verificado en API route)

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

-- Admin full access (PIN checked in API route)
create policy "Admin full access"
  on public.breakfast_extras
  for all
  to anon
  using (true)
  with check (true);

-- Public read only active extras
create policy "Public read active extras"
  on public.breakfast_extras
  for select
  to anon
  using (active = true);

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

-- Function: admin list all extras (PIN checked in API route)
create or replace function public.admin_breakfast_extras(p_pin text)
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
        'active', active,
        'sortOrder', sort_order
      )
      order by sort_order, name
    ), '[]'::jsonb)
    from public.breakfast_extras
  );
end;
$$;

-- Function: upsert breakfast extra (PIN checked in API route)
create or replace function public.upsert_breakfast_extra(
  p_pin text,
  p_id uuid,
  p_name text,
  p_price integer,
  p_active boolean,
  p_sort_order integer
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_id uuid;
begin
  if p_id is not null then
    update public.breakfast_extras
    set name = p_name,
        price = p_price,
        active = p_active,
        sort_order = p_sort_order,
        updated_at = now()
    where id = p_id
    returning id into v_id;
  end if;

  if v_id is null then
    insert into public.breakfast_extras (name, price, active, sort_order)
    values (p_name, p_price, p_active, p_sort_order)
    returning id into v_id;
  end if;

  return jsonb_build_object('id', v_id);
end;
$$;

-- Function: delete breakfast extra (PIN checked in API route)
create or replace function public.delete_breakfast_extra(
  p_pin text,
  p_id uuid
)
returns void
language plpgsql
security definer
as $$
begin
  delete from public.breakfast_extras where id = p_id;
end;
$$;

grant execute on function public.get_breakfast_extras() to anon, authenticated;
grant execute on function public.admin_breakfast_extras(text) to anon, authenticated;
grant execute on function public.upsert_breakfast_extra(text, uuid, text, integer, boolean, integer) to anon, authenticated;
grant execute on function public.delete_breakfast_extra(text, uuid) to anon, authenticated;

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
