-- Revisión obligatoria del mesero antes de enviar el pedido a cocina.
-- Ejecutar después de 010_limit_omelette_customizations.sql.

create or replace function public.order_as_json(p_order_id uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', o.id,
    'folio', o.folio,
    'tableCode', t.code,
    'status', o.status,
    'notes', o.notes,
    'subtotal', o.subtotal,
    'total', o.total,
    'createdAt', o.created_at,
    'updatedAt', o.updated_at,
    'accessToken', o.access_token,
    'source', 'supabase',
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'itemId', oi.id,
          'productId', coalesce(p.slug, oi.product_id::text),
          'name', oi.product_name,
          'unitPrice', oi.unit_price,
          'quantity', oi.quantity,
          'notes', oi.notes,
          'option', oi.selected_option,
          'image', coalesce(p.image_url, '/menu/imperio/chilaquiles-sencillos.jpg')
        ) order by oi.id
      )
      from public.order_items oi
      left join public.products p on p.id = oi.product_id
      where oi.order_id = o.id
    ), '[]'::jsonb)
  )
  from public.orders o
  join public.tables t on t.id = o.table_id
  where o.id = p_order_id;
$$;

revoke all on function public.order_as_json(uuid) from public, anon, authenticated;

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

revoke all on function public.remove_order_item(uuid, uuid, text) from public;
grant execute on function public.remove_order_item(uuid, uuid, text)
to anon, authenticated;
