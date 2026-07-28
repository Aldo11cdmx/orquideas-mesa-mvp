-- Fix staff PIN verification on Supabase projects where pgcrypto lives in
-- the `extensions` schema. Safe to run after 001_initial.sql.

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
  where active
    and demo_pin_hash is not null
    and demo_pin_hash = extensions.crypt(p_pin, demo_pin_hash)
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

revoke all on function public.kitchen_orders(text) from public;
revoke all on function public.update_order_status(uuid, text, text) from public;
grant execute on function public.kitchen_orders(text) to anon, authenticated;
grant execute on function public.update_order_status(uuid, text, text) to anon, authenticated;
