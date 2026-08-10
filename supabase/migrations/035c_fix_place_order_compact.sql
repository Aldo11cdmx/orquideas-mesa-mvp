-- 035c_fix_place_order_compact.sql
-- Versión compacta: misma lógica, mucho más corta

create or replace function public.place_order(
  p_table_code text, p_items jsonb, p_notes text,
  p_idempotency_key uuid, p_session_id uuid default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_rid uuid; v_tid uuid; v_oid uuid; v_sub numeric(10,2); v_cnt int;
begin
  select id into v_oid from public.orders where idempotency_key = p_idempotency_key;
  if v_oid is not null then return public.order_as_json(v_oid); end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 30 then
    raise exception 'invalid_items'; end if;

  select t.id, t.restaurant_id into v_tid, v_rid
  from public.tables t join public.restaurants r on r.id = t.restaurant_id
  where t.code = upper(trim(p_table_code)) and t.active and r.active limit 1;
  if v_tid is null then raise exception 'invalid_table'; end if;

  if p_session_id is not null then
    if not exists (select 1 from public.table_sessions ts
      where ts.id = p_session_id and ts.restaurant_id = v_rid
        and ts.table_id = v_tid and ts.status = 'active') then
      raise exception 'invalid_session'; end if;
  end if;

  if (select count(*) from public.orders where table_id = v_tid and created_at > now() - interval '1 minute') >= 8 then
    raise exception 'rate_limited'; end if;

  create temp table tvi (slug text, qty int, extras jsonb, ostr text, uprice numeric, pid uuid, pname text, oitem jsonb) on commit drop;

  insert into tvi (slug, qty, extras, ostr, uprice, pid, pname, oitem)
  with req as (
    select x->>'productId' slug, (x->>'quantity')::int qty, x->'extras' extras,
      nullif(x->>'optionPriceModifier','')::num cmod,
      nullif(left(trim(coalesce(x->>'option','')),80),'') ostr, x oitem
    from jsonb_array_elements(p_items) x
  ), val as (
    select r.slug, r.qty, r.extras, r.ostr, r.oitem,
      p.price + coalesce((
        select sum(coalesce(
          (select greatest(0,(ec->>'price')::num) from jsonb_array_elements(coalesce(p.extras_config,'[]'::jsonb)) ec
           where ec->>'name' = re->>'name' and ec->>'active' <> 'false' limit 1),
          (select be.price from public.breakfast_extras be
           where be.name = re->>'name' and be.active = true limit 1),
          (select df.price_modifier from public.drink_flavors df
           where df.name = re->>'name' and df.active = true limit 1),
          0))
        from jsonb_array_elements(coalesce(r.extras,'[]'::jsonb)) re
      ), 0)
      + coalesce(
        (select og->'choicePrices'->>(ch.ch_idx-1)::num
         from jsonb_array_elements(coalesce(p.option_groups,'[]'::jsonb)) og,
              jsonb_array_elements_text(case when jsonb_typeof(og->'choices')='array' then og->'choices' else '[]'::jsonb end) with ordinality ch(cv,ci)
         where jsonb_typeof(og->'choicePrices')='array'
           and jsonb_array_length(og->'choices')=jsonb_array_length(og->'choicePrices')
           and r.ostr is not null and ch.cv = split_part(r.ostr,': ',2) limit 1),
        0)::num as uprice,
      p.id pid, p.name pname
    from req r join public.products p on p.restaurant_id = v_rid and p.slug = r.slug and p.active and not p.sold_out
    where r.qty between 1 and 10
  )
  select slug, qty, extras, ostr, uprice, pid, pname, oitem from val;

  select count(*), coalesce(sum(qty*uprice),0) into v_cnt, v_sub from tvi;
  if v_cnt <> jsonb_array_length(p_items) then raise exception 'invalid_or_unavailable_product'; end if;

  insert into public.orders (folio, restaurant_id, table_id, subtotal, total, notes, idempotency_key, status, session_id)
  values ('O-'||lpad(nextval('public.order_folio_seq')::text,4,'0'), v_rid, v_tid, v_sub, v_sub,
    left(trim(coalesce(p_notes,'')),250), p_idempotency_key, 'accepted', p_session_id) returning id into v_oid;

  insert into public.order_items (order_id, product_id, product_name, unit_price, quantity, notes, selected_option, extras, substitutes)
  select v_oid, pid, pname, uprice, qty, left(trim(coalesce(oitem->>'notes','')),250), ostr,
    case when extras is not null and jsonb_typeof(extras)='array' and jsonb_array_length(extras)>0 then extras else null end,
    oitem->'substitutes' from tvi;

  insert into public.order_events (order_id, to_status) values (v_oid, 'accepted');
  return public.order_as_json(v_oid);
end; $$;

revoke all on function public.place_order(text, jsonb, text, uuid, uuid) from public;
grant execute on function public.place_order(text, jsonb, text, uuid, uuid) to anon, authenticated;
