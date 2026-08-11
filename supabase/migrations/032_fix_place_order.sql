-- ============================================================================
-- 032_fix_place_order.sql
-- Fix place_order corrupta + reparación official_extra alias
-- ============================================================================

drop function if exists public.place_order(text, jsonb, text, uuid, uuid);


create or replace function public.place_order(
  p_table_code text,
  p_items jsonb,
  p_notes text,
  p_idempotency_key uuid,
  p_session_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$

declare
  v_restaurant_id uuid;
  v_table_id uuid;
  v_order_id uuid;
  v_subtotal numeric(10,2);
  v_item_count integer;

begin

  -- Idempotency
  select id into v_order_id
  from public.orders
  where idempotency_key = p_idempotency_key;

  if v_order_id is not null then
    return public.order_as_json(v_order_id);
  end if;


  if jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) < 1
    or jsonb_array_length(p_items) > 30
  then
    raise exception 'invalid_items';
  end if;


  -- Obtener restaurante desde mesa
  select 
    t.id,
    t.restaurant_id
  into
    v_table_id,
    v_restaurant_id
  from public.tables t
  join public.restaurants r
    on r.id = t.restaurant_id
  where t.code = upper(trim(p_table_code))
    and t.active
    and r.active
  limit 1;


  if v_table_id is null then
    raise exception 'invalid_table';
  end if;


  -- Validar sesión
  if p_session_id is not null then

    if not exists (
      select 1
      from public.table_sessions ts
      where ts.id = p_session_id
        and ts.restaurant_id = v_restaurant_id
        and ts.table_id = v_table_id
        and ts.status = 'active'
    ) then
      raise exception 'invalid_session';
    end if;

  end if;



  create temporary table temp_validated_items(
    slug text,
    quantity integer,
    extras jsonb,
    option_str text,
    unit_price numeric,
    product_id uuid,
    product_name text,
    original_item jsonb
  )
  on commit drop;



  insert into temp_validated_items
  (
    slug,
    quantity,
    extras,
    option_str,
    unit_price,
    product_id,
    product_name,
    original_item
  )


  with requested as (

    select
      x->>'productId' as slug,
      (x->>'quantity')::integer as quantity,
      x->'extras' as extras,
      nullif(x->>'option','') as option_str,
      x as original_item

    from jsonb_array_elements(p_items) x

  ), validated as (

    select

      r.slug,
      r.quantity,
      r.extras,
      r.option_str,
      r.original_item,


      (
        case

          -- Extras comida corrida
          when r.slug = 'comida-corrida'
          and jsonb_typeof(r.extras) = 'array'

          then
            p.price +
            coalesce(
              (
                select sum(
                  greatest(
                    0,
                    (official_match.official_extra->>'price')::numeric
                  )
                )

                from jsonb_array_elements(r.extras) requested_extra

                cross join lateral (

                  select 
                    jsonb_array_elements(
                      coalesce(
                        (
                          select dm.courses->'Extras'
                          from public.daily_menus dm
                          where dm.restaurant_id = v_restaurant_id
                          and dm.active
                          limit 1
                        ),
                        '[]'::jsonb
                      )
                    ) as official_extra

                ) official_match

                where official_match.official_extra->>'name'
                  =
                  requested_extra->>'name'

              ),
              0
            )


          -- Extras productos normales
          when jsonb_typeof(r.extras) = 'array'
          and p.extras_config is not null

          then

            p.price +

            coalesce(

              (
                select sum(
                  greatest(
                    0,
                    (official_match.official_extra->>'price')::numeric
                  )
                )

                from jsonb_array_elements(r.extras) requested_extra

                cross join lateral (

                  select
                    jsonb_array_elements(p.extras_config)
                    as official_extra

                ) official_match


                where official_match.official_extra->>'name'
                =
                requested_extra->>'name'

              ),
              0
            )


          else
            p.price

        end
      ) as unit_price,


      p.id,
      p.name


    from requested r

    join public.products p

      on p.restaurant_id = v_restaurant_id
      and p.slug = r.slug
      and p.active
      and not p.sold_out

    where r.quantity between 1 and 10

  )


  select
    slug,
    quantity,
    extras,
    option_str,
    unit_price,
    id,
    name,
    original_item

  from validated;



  select
    count(*),
    coalesce(sum(quantity * unit_price),0)

  into
    v_item_count,
    v_subtotal

  from temp_validated_items;



  if v_item_count <> jsonb_array_length(p_items)
  then
    raise exception 'invalid_or_unavailable_product';
  end if;



  insert into public.orders
  (
    folio,
    restaurant_id,
    table_id,
    subtotal,
    total,
    notes,
    idempotency_key,
    status,
    session_id
  )

  values

  (
    'O-' ||
    lpad(nextval('public.order_folio_seq')::text,4,'0'),

    v_restaurant_id,
    v_table_id,
    v_subtotal,
    v_subtotal,

    left(trim(coalesce(p_notes,'')),250),

    p_idempotency_key,

    'accepted',

    p_session_id
  )

  returning id into v_order_id;



  insert into public.order_items
  (
    order_id,
    product_id,
    product_name,
    unit_price,
    quantity,
    notes,
    selected_option,
    extras
  )

  select

    v_order_id,
    product_id,
    product_name,
    unit_price,
    quantity,

    left(
      trim(
        coalesce(original_item->>'notes','')
      ),
      250
    ),

    option_str,

    extras


  from temp_validated_items;



  insert into public.order_events
  (
    order_id,
    to_status
  )

  values
  (
    v_order_id,
    'accepted'
  );


  return public.order_as_json(v_order_id);


end;

$function$;



grant execute on function public.place_order(text,jsonb,text,uuid,uuid)
to anon, authenticated;