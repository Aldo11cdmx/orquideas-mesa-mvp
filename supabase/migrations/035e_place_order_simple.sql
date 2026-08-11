-- 035e_place_order_simple.sql
-- Versión radicalmente simple: usa optionPriceModifier del cliente
-- No busca choicePrices en option_groups del backend

create or replace function public.place_order(
  p_table_code text, p_items jsonb, p_notes text,
  p_idempotency_key uuid, p_session_id uuid default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_rid uuid; v_tid uuid; v_oid uuid; v_sub numeric(10,2); v_cnt int;
begin
  -- Idempotencia
  select id into v_oid from public.orders where idempotency_key = p_idempotency_key;
  if v_oid is not null then return public.order_as_json(v_oid); end if;

  -- Validar items
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 30 then
    raise exception 'invalid_items';
  end if;

  -- Validar mesa
  select t.id, t.restaurant_id into v_tid, v_rid
  from public.tables t join public.restaurants r on r.id = t.restaurant_id
  where t.code = upper(trim(p_table_code)) and t.active and r.active
  limit 1;
  if v_tid is null then raise exception 'invalid_table'; end if;

  -- Validar sesión
  if p_session_id is not null then
    if not exists (
      select 1 from public.table_sessions ts
      where ts.id = p_session_id and ts.restaurant_id = v_rid
        and ts.table_id = v_tid and ts.status = 'active'
    ) then raise exception 'invalid_session'; end if;
  end if;

  -- Rate limit
  if (select count(*) from public.orders where table_id = v_tid and created_at > now() - interval '1 minute') >= 8 then
    raise exception 'rate_limited'; end if;

  -- Tabla temporal para items validados
  create temp table tvi (
    slug text, qty int, extras jsonb, ostr text,
    uprice numeric(10,2), pid uuid, pname text, oitem jsonb
  ) on commit drop;

  -- Insertar items validados con precio calculado
  insert into tvi (slug, qty, extras, ostr, uprice, pid, pname, oitem)
  with req as (
    select
      x->>'productId' as slug,
      (x->>'quantity')::int as qty,
      x->'extras' as extras,
      nullif(x->>'optionPriceModifier','')::numeric as cmod,
      nullif(left(trim(coalesce(x->>'option','')), 80), '') as ostr,
      x as oitem
    from jsonb_array_elements(p_items) as x
  )
  select
    r.slug, r.qty, r.extras, r.ostr, r.oitem,
    -- Precio = precio base + optionPriceModifier del cliente + extras
    p.price
    + coalesce(r.cmod, 0)
    + coalesce((
      select sum(greatest(0, coalesce(
        (select (ec->>'price')::numeric from jsonb_array_elements(coalesce(p.extras_config, '[]'::jsonb)) ec
         where ec->>'name' = re->>'name' and ec->>'active' <> 'false' limit 1),
        (select be.price from public.breakfast_extras be
         where be.name = re->>'name' and be.active = true limit 1),
        (select df.price_modifier from public.drink_flavors df
         where df.name = re->>'name' and df.active = true limit 1),
        0
      )))
      from jsonb_array_elements(coalesce(r.extras, '[]'::jsonb)) re
    ), 0) as uprice,
    p.id as pid, p.name as pname
  from req r
  join public.products p on p.restaurant_id = v_rid and p.slug = r.slug and p.active and not p.sold_out
  where r.qty between 1 and 10;

  -- Contar y sumar
  select count(*), coalesce(sum(qty * uprice), 0) into v_cnt, v_sub from tvi;
  if v_cnt <> jsonb_array_length(p_items) then
    raise exception 'invalid_or_unavailable_product'; end if;

  -- Crear orden
  insert into public.orders (
    folio, restaurant_id, table_id, subtotal, total,
    notes, idempotency_key, status, session_id
  ) values (
    'O-' || lpad(nextval('public.order_folio_seq')::text, 4, '0'),
    v_rid, v_tid, v_sub, v_sub,
    left(trim(coalesce(p_notes, '')), 250),
    p_idempotency_key, 'accepted', p_session_id
  ) returning id into v_oid;

  -- Crear items
  insert into public.order_items (
    order_id, product_id, product_name, unit_price,
    quantity, notes, selected_option, extras, substitutes
  )
  select
    v_oid, pid, pname, uprice, qty,
    left(trim(coalesce(oitem->>'notes', '')), 250),
    ostr,
    case when extras is not null and jsonb_typeof(extras) = 'array' and jsonb_array_length(extras) > 0
         then extras else null end,
    oitem->'substitutes'
  from tvi;

  -- Evento
  insert into public.order_events (order_id, to_status) values (v_oid, 'accepted');

  return public.order_as_json(v_oid);
end; $$;

revoke all on function public.place_order(text, jsonb, text, uuid, uuid) from public;
grant execute on function public.place_order(text, jsonb, text, uuid, uuid) to anon, authenticated;
