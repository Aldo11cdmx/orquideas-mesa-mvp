-- 036: Fix place_order - column alias "oe" in WHERE is invalid in PostgreSQL
-- The comida-corrida branch used `select jsonb_array_elements(...) oe where oe->>'name'=...`
-- which references a SELECT column alias in WHERE — not allowed in PostgreSQL.
-- Fix: move jsonb_array_elements to FROM clause where the alias IS a table alias.
-- Also replaces the other lateral join pattern that had the same issue.

drop function if exists public.place_order(text, jsonb, text, uuid, uuid) cascade;

create function public.place_order(
  p_table_code text, p_items jsonb, p_notes text,
  p_idempotency_key uuid, p_session_id uuid default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_restaurant_id uuid; v_table_id uuid; v_order_id uuid;
  v_subtotal numeric(10,2); v_item_count integer;
begin
  -- Idempotency
  select id into v_order_id from public.orders where idempotency_key = p_idempotency_key;
  if v_order_id is not null then return public.order_as_json(v_order_id); end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 30 then
    raise exception 'invalid_items'; end if;

  -- Validate table
  select t.id, t.restaurant_id into v_table_id, v_restaurant_id
  from public.tables t join public.restaurants r on r.id = t.restaurant_id
  where t.code = upper(trim(p_table_code)) and t.active and r.active limit 1;
  if v_table_id is null then raise exception 'invalid_table'; end if;

  -- Validate session
  if p_session_id is not null then
    if not exists (select 1 from public.table_sessions ts
      where ts.id = p_session_id and ts.restaurant_id = v_restaurant_id
        and ts.table_id = v_table_id and ts.status = 'active') then
      raise exception 'invalid_session'; end if; end if;

  -- Rate limit
  if (select count(*) from public.orders where table_id = v_table_id
    and created_at > now() - interval '1 minute') >= 8 then
    raise exception 'rate_limited'; end if;

  create temporary table tvi (slug text, quantity integer, extras jsonb, option_str text,
    unit_price numeric, product_id uuid, product_name text, original_item jsonb) on commit drop;

  insert into tvi (slug, quantity, extras, option_str, unit_price, product_id, product_name, original_item)
  with req as (
    select
      x->>'productId' slug,
      (x->>'quantity')::int qty,
      x->'extras' extras,
      nullif(x->>'optionPriceModifier','')::numeric cmod,
      nullif(left(trim(coalesce(x->>'option','')),80),'') ostr,
      x oitem
    from jsonb_array_elements(p_items) x
  ), val as (
    select r.slug, r.qty, r.extras, r.ostr, r.oitem,
      -- Base price + extras cost
      case
        -- Comida corrida: extras from daily_menus.courses.Extras
        when r.slug = 'comida-corrida' and r.extras is not null
          and jsonb_typeof(r.extras)='array' and jsonb_array_length(r.extras)>0
        then p.price + coalesce((
          select sum(greatest(0, coalesce((
            select (course_extra->>'price')::numeric
            from jsonb_array_elements(
              coalesce((select dm.courses->'Extras'
                from public.daily_menus dm
                where dm.restaurant_id=v_restaurant_id and dm.active limit 1),
                '[]'::jsonb)
            ) as course_extra
            where course_extra->>'name' = re->>'name'
              and course_extra->>'active' <> 'false'
            limit 1
          ), 0)))
          from jsonb_array_elements(r.extras) re
        ), 0)
        -- Regular products: extras from products.extras_config, breakfast_extras, drink_flavors
        when r.extras is not null and jsonb_typeof(r.extras)='array'
          and jsonb_array_length(r.extras)>0
        then p.price + coalesce((
          select sum(greatest(0, coalesce(
            (select (ec->>'price')::numeric
             from jsonb_array_elements(coalesce(p.extras_config,'[]'::jsonb)) as ec
             where ec->>'name' = re->>'name' and ec->>'active' <> 'false' limit 1),
            (select be.price from public.breakfast_extras be
             where be.name = re->>'name' and be.active limit 1),
            (select df.price_modifier from public.drink_flavors df
             where df.name = re->>'name' and df.active limit 1),
            0
          )))
          from jsonb_array_elements(r.extras) re
        ), 0)
        else p.price
      end
      +
      -- Option price modifier (backend-authoritative)
      coalesce(case when p.option_groups is not null and jsonb_typeof(p.option_groups)='array'
        and jsonb_path_exists(p.option_groups,'$[*] ? (@.choicePrices != null)') then (
        (select og->'choicePrices'->>(ch.ci-1)::numeric
         from jsonb_array_elements(p.option_groups) og,
         jsonb_array_elements_text(
           case when jsonb_typeof(og->'choices')='array' then og->'choices' else '[]'::jsonb end
         ) with ordinality ch(cv,ci)
         where jsonb_typeof(og->'choicePrices')='array'
           and jsonb_array_length(og->'choices')=jsonb_array_length(og->'choicePrices')
           and r.ostr is not null and ch.cv=split_part(r.ostr,': ',2) limit 1)
        union all
        (select mod_val::numeric from jsonb_array_elements(p.option_groups) og
         cross join jsonb_array_elements_text(
           case when jsonb_typeof(og->'choicePrices')='array'
             then og->'choicePrices' else '[]'::jsonb end
         ) with ordinality cp(mod_val,ord)
         where mod_val::numeric=r.cmod limit 1) limit 1) else null end,0)::numeric as uprice,
      p.id pid, p.name pname
    from req r
    join public.products p on p.restaurant_id=v_restaurant_id
      and p.slug=r.slug and p.active and not p.sold_out
    where r.qty between 1 and 10
  )
  select slug, qty, extras, ostr, uprice, pid, pname, oitem from val;

  select count(*), coalesce(sum(quantity*unit_price),0) into v_item_count, v_subtotal from tvi;
  if v_item_count <> jsonb_array_length(p_items) then
    raise exception 'invalid_or_unavailable_product'; end if;

  insert into public.orders (folio, restaurant_id, table_id, subtotal, total,
    notes, idempotency_key, status, session_id)
  values ('O-'||lpad(nextval('public.order_folio_seq')::text,4,'0'),
    v_restaurant_id, v_table_id, v_subtotal, v_subtotal,
    left(trim(coalesce(p_notes,'')),250), p_idempotency_key, 'accepted', p_session_id)
  returning id into v_order_id;

  insert into public.order_items (order_id, product_id, product_name, unit_price,
    quantity, notes, selected_option, extras, substitutes)
  select v_order_id, product_id, product_name, unit_price, quantity,
    left(trim(coalesce(original_item->>'notes','')),250), option_str,
    case when extras is not null and jsonb_typeof(extras)='array'
      and jsonb_array_length(extras)>0 then extras else null end,
    original_item->'substitutes'
  from tvi;

  insert into public.order_events (order_id, to_status) values (v_order_id, 'accepted');
  return public.order_as_json(v_order_id);
end; $$;

grant execute on function public.place_order(text, jsonb, text, uuid, uuid) to anon, authenticated;
