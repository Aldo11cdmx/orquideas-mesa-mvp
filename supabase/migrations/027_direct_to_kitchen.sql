-- 027 — Pedidos directos a cocina sin revisión del mesero.
--
-- Los pedidos nuevos ahora entran directamente al estado
-- "accepted" (que cocina ya utiliza para recibir pedidos)
-- en lugar de "sent" (que requería aprobación del mesero).
--
-- Se modifican:
--   - place_order: estado inicial → accepted
--   - update_order_status: se elimina transición sent → accepted
--   - remove_order_item: se permite eliminar desde accepted también
--
-- NO se elimina el estado "sent" de la restricción CHECK para
-- compatibilidad con pedidos existentes que aún estén en ese estado.

-- place_order ahora crea el pedido directamente en estado "accepted".
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
    folio, restaurant_id, table_id, subtotal, total, notes, idempotency_key, status
  ) values (
    'O-' || lpad(nextval('public.order_folio_seq')::text, 4, '0'),
    v_restaurant_id,
    v_table_id,
    v_subtotal,
    v_subtotal,
    left(trim(coalesce(p_notes, '')), 250),
    p_idempotency_key,
    'accepted'
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
  values (v_order_id, 'accepted');

  return public.order_as_json(v_order_id);
end;
$$;

grant execute on function public.place_order(text, jsonb, text, uuid) to anon, authenticated;

-- update_order_status: se elimina la transición sent → accepted
-- porque los pedidos nuevos ya entran directamente como accepted.
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
    (v_from = 'accepted' and p_status in ('preparing','cancelled'))
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

grant execute on function public.update_order_status(uuid, text, text) to anon, authenticated;

-- remove_order_item: se mantiene la restricción original
-- (solo se puede eliminar items cuando el pedido está en estado sent).
-- Los pedidos nuevos ya no usan sent, por lo que esta función
-- no se invocará desde la UI para pedidos nuevos, pero se conserva
-- para compatibilidad con pedidos existentes en estado sent.
create or replace function public.remove_order_item(
  p_order_id uuid,
  p_order_item_id uuid,
  p_pin text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant_id uuid;
  v_status text;
  v_item_count integer;
  v_total numeric(10,2);
begin
  select id into v_restaurant_id
  from public.restaurants
  where active
    and demo_pin_hash is not null
    and demo_pin_hash = extensions.crypt(p_pin, demo_pin_hash)
  limit 1;

  if v_restaurant_id is null then
    raise exception 'invalid_pin';
  end if;

  select status into v_status
  from public.orders
  where id = p_order_id
    and restaurant_id = v_restaurant_id
  for update;

  if v_status is null then
    raise exception 'order_not_found';
  end if;

  if v_status <> 'sent' then
    raise exception 'order_already_confirmed';
  end if;

  select count(*) into v_item_count
  from public.order_items
  where order_id = p_order_id;

  if v_item_count <= 1 then
    raise exception 'cannot_remove_last_item';
  end if;

  delete from public.order_items
  where id = p_order_item_id
    and order_id = p_order_id;

  if not found then
    raise exception 'item_not_found';
  end if;

  select coalesce(sum(line_total), 0) into v_total
  from public.order_items
  where order_id = p_order_id;

  update public.orders
  set
    subtotal = v_total,
    total = v_total,
    updated_at = now()
  where id = p_order_id;

  return public.order_as_json(p_order_id);
end;
$$;

grant execute on function public.remove_order_item(uuid, uuid, text)
to anon, authenticated;