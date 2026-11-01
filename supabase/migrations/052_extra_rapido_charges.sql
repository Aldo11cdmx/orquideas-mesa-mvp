create table if not exists public.order_extra_charges (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  amount_mxn integer not null,
  amount_cents integer not null,
  created_at timestamptz not null default now()
);

alter table public.order_extra_charges enable row level security;

create policy "Permitir lectura a usuarios autenticados y anon" 
  on public.order_extra_charges for select 
  using (true);

create policy "Permitir inserción de cargos extra" 
  on public.order_extra_charges for insert 
  with check (true);

grant select, insert on public.order_extra_charges to anon, authenticated, service_role;
