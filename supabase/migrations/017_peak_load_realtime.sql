-- Operación en horas pico: limita la carga del tablero a pedidos relevantes
-- y acelera las consultas por restaurante, estado y fecha.

create index if not exists idx_orders_restaurant_active_updated
on public.orders (restaurant_id, updated_at desc)
where status not in ('delivered', 'cancelled');

create index if not exists idx_orders_restaurant_recent_completed
on public.orders (restaurant_id, created_at desc)
where status in ('delivered', 'cancelled');

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
  where active
    and demo_pin_hash is not null
    and demo_pin_hash = extensions.crypt(p_pin, demo_pin_hash)
  limit 1;

  if v_restaurant_id is null then raise exception 'invalid_pin'; end if;

  return coalesce((
    select jsonb_agg(public.order_as_json(relevant.id) order by relevant.created_at asc)
    from (
      select o.id, o.created_at
      from public.orders o
      where o.restaurant_id = v_restaurant_id
        and (
          o.status not in ('delivered', 'cancelled')
          or o.updated_at > now() - interval '4 hours'
        )
      order by
        case when o.status not in ('delivered', 'cancelled') then 0 else 1 end,
        o.created_at asc
      limit 250
    ) relevant
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.kitchen_orders(text) from public;
grant execute on function public.kitchen_orders(text) to anon, authenticated;

do $$
begin
  alter publication supabase_realtime add table public.orders;
exception
  when duplicate_object then null;
end $$;
