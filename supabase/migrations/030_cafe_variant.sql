-- 030 — Consolidar café en un solo producto con variantes de precio.
--
-- Esta migración es INCREMENTAL, NO DESTRUCTIVA e IDEMPOTENTE:
-- - Los UPDATEs afectan 0 filas si ya fueron aplicados (slug ya renombrado, etc.)
-- - No borra ni modifica datos históricos (pedidos/order_items)
-- - Es compatible con pedidos existentes: el rename de slug no afecta
--   order_items.product_name (columna de texto, no FK a slug)
--
-- Mejoras de revisión (revisor principal):
-- 1. UUID hardcodeado → subquery (select id from restaurants where active limit 1)
--    para que funcione aunque cambie el UUID del restaurante seed
-- 2. Anti-patrón SQL `like '%choicePrices%'` → jsonb_path_exists
-- 3. Eliminación TOTAL de duplicación: un CTE `validated` computa unit_price
--    una sola vez; resultados en temp_validated_items reusados para subtotal,
--    count check e order_items INSERT
-- 4. Label "Tipo" en option_groups para consistencia con lib/menu.ts
-- 5. Mapeo estricto opción → precio: backend parsea option_str ("label: choice")
--    → choice value → índice en choices[] → choicePrices[idx]
--    Ignora optionPriceModifier del cliente (defensa contra overcharging)
--    Fallback: si parseo falla, valida modifier contra choicePrices (compatibilidad
--    histórica)
--
-- - Rename cafe-normal → cafe (slug), nombre "Café", precio $15
-- - Desactivar cafe-leche (no aparece en menú cliente)
-- - Agregar option_groups con choicePrices para variantes de precio
-- - Override place_order: calcular unit_price desde configuración oficial

-- ============================================================================
-- 1. Renombrar cafe-normal → cafe
-- Idempotent: afecta 0 filas si ya fue aplicado
-- ============================================================================
update public.products
set slug = 'cafe',
    name = 'Café',
    description = 'Café caliente preparado al momento.',
    price = 15,
    available_from = '09:00',
    available_until = '17:00',
    updated_at = now()
where restaurant_id = (select id from public.restaurants where active limit 1)
  and slug = 'cafe-normal';

-- ============================================================================
-- 2. Desactivar cafe-leche (el cliente solo verá "Café")
-- Idempotent: ON CONFLICT / IS DISTINCT FROM garantiza no-op si ya está hecho
-- NO es destructivo: el producto sigue existiendo para orders históricos
-- ============================================================================
update public.products
set active = false,
    updated_at = now()
where restaurant_id = (select id from public.restaurants where active limit 1)
  and slug = 'cafe-leche'
  and active is distinct from false;

-- ============================================================================
-- 2b. Asignar imagen apropiada al té (bebidas.jpg, no cafe-leche.jpg)
--  Idempotent: IS DISTINCT FROM evita escritura si ya está corregido
-- ============================================================================
update public.products
set image_url = '/menu/imperio/bebidas.jpg',
    updated_at = now()
where restaurant_id = (select id from public.restaurants where active limit 1)
  and slug = 'te'
  and image_url is distinct from '/menu/imperio/bebidas.jpg';

-- ============================================================================
-- 3. Configurar option_groups con choicePrices en el producto "Café"
--    choicePrices: [0, 15] → Café normal (+$0), Café con leche evaporada (+$15)
--    Label "Tipo" para coincidir con lib/menu.ts (selectionSummary = "Tipo: ...")
-- Idempotent: IS DISTINCT FROM evita escritura si el valor ya es idéntico
-- ============================================================================
update public.products
set option_groups = '[{"id":"cafe-tipo","label":"Tipo","choices":["Café normal","Café con leche evaporada"],"choicePrices":[0,15],"required":true}]'::jsonb,
    extras_config = '[]'::jsonb,
    updated_at = now()
where restaurant_id = (select id from public.restaurants where active limit 1)
  and slug = 'cafe'
  and (
    option_groups is distinct from '[{"id":"cafe-tipo","label":"Tipo","choices":["Café normal","Café con leche evaporada"],"choicePrices":[0,15],"required":true}]'::jsonb
    or extras_config is distinct from '[]'::jsonb
  );

-- ============================================================================
-- 4. Override place_order
--    Firma idéntica a migración 028: (text, jsonb, text, uuid, uuid)
--    Arquitectura: un CTE `validated` computa unit_price (extras + option_modifier)
--    una sola vez. Los resultados se almacenan en temp_validated_items (tabla
--    temporal con ON COMMIT DROP) y se reusan para: (a) count + subtotal check,
--    (b) order_items INSERT. Cero duplicación de lógica de cálculo.
--
--    Compatibilidad con 028:
--    - La firma de la función es idéntica
--    - Los parámetros p_table_code, p_items, p_notes, p_idempotency_key, p_session_id
--      funcionan igual
--    - La lógica de validación de extras (comida-corrida y carta) se preserva
--    - Los pedidos históricos sin optionPriceModifier siguen funcionando (default 0)
-- ============================================================================
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
as $$
declare
  v_restaurant_id uuid;
  v_table_id uuid;
  v_order_id uuid;
  v_subtotal numeric(10,2);
  v_item_count integer;
begin
  -- Idempotency: si ya existe el pedido, devolverlo.
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

  -- v_restaurant_id se obtiene dinámicamente desde la mesa, NO se hardcodea.
  select t.id, t.restaurant_id into v_table_id, v_restaurant_id
  from public.tables t
  join public.restaurants r on r.id = t.restaurant_id
  where t.code = upper(trim(p_table_code)) and t.active and r.active
  limit 1;
  if v_table_id is null then raise exception 'invalid_table'; end if;

  -- Validar session_id si se proporciona: debe pertenecer a esta mesa y estar activa.
  if p_session_id is not null then
    if not exists (
      select 1 from public.table_sessions ts
      where ts.id = p_session_id
        and ts.restaurant_id = v_restaurant_id
        and ts.table_id = v_table_id
        and ts.status = 'active'
    ) then
      raise exception 'invalid_session';
    end if;
  end if;

  -- Rate limit per table.
  if (
    select count(*) from public.orders
    where table_id = v_table_id and created_at > now() - interval '1 minute'
  ) >= 8 then
    raise exception 'rate_limited';
  end if;

  ------------------------------------------------------------------
  -- Validate items, calculate unit_price.
  -- IMPORTANTE: precios de extras y option modifier vienen de la
  -- configuración oficial del producto (extras_config,
  -- option_groups.choicePrices), NO del cliente.
  --
  -- Un solo CTE `validated` computa todo. El resultado se inserta en
  -- temp_validated_items para reusarlo en el count check y en el
  -- order_items INSERT — cero duplicación de lógica.
  ------------------------------------------------------------------
  create temporary table temp_validated_items (
    slug           text,
    quantity       integer,
    extras         jsonb,
    option_str     text,
    unit_price     numeric,
    product_id     uuid,
    product_name   text,
    original_item  jsonb
  ) on commit drop;

  insert into temp_validated_items (
    slug, quantity, extras, option_str, unit_price, product_id, product_name, original_item
  )
  with requested as (
    select
      x->>'productId' as slug,
      (x->>'quantity')::integer as quantity,
      x->'extras' as extras,
      nullif(x->>'optionPriceModifier', '')::numeric as client_option_modifier,
      nullif(left(trim(coalesce(x->>'option', '')), 80), '') as option_str,
      x as original_item
    from jsonb_array_elements(p_items) x
  ), validated as (
    select
      r.slug,
      r.quantity,
      r.extras,
      r.option_str,
      r.original_item,
      ----------------------------------------------------------------
      -- unit_price = base_price + extras_cost + option_modifier
      -- Cada componente se calcula desde la config oficial del producto.
      ----------------------------------------------------------------
      -- 1. Base price + extras cost
      case
        -- Comida corrida: extras desde daily_menus.courses.Extras
        when r.slug = 'comida-corrida'
          and r.extras is not null
          and jsonb_typeof(r.extras) = 'array'
          and jsonb_array_length(r.extras) > 0
        then p.price + coalesce((
          select sum(
            greatest(0, (official_extra->>'price')::numeric)
          )
          from jsonb_array_elements(r.extras) requested_extra
          cross join lateral (
            select jsonb_array_elements(
              coalesce(
                (select dm.courses->'Extras' from public.daily_menus dm
                 where dm.restaurant_id = v_restaurant_id and dm.active limit 1),
                '[]'::jsonb
              )
            ) as official_extra
            where official_extra->>'name' = requested_extra->>'name'
              and official_extra->>'active' <> 'false'
          ) official_match
        ), 0)
        -- Productos a la carta: extras desde products.extras_config
        when r.extras is not null
          and jsonb_typeof(r.extras) = 'array'
          and jsonb_array_length(r.extras) > 0
          and p.extras_config is not null
          and jsonb_typeof(p.extras_config) = 'array'
          and jsonb_array_length(p.extras_config) > 0
        then p.price + coalesce((
          select sum(
            greatest(0, (official_extra->>'price')::numeric)
          )
          from jsonb_array_elements(r.extras) requested_extra
          cross join lateral (
            select jsonb_array_elements(p.extras_config) as official_extra
            where official_extra->>'name' = requested_extra->>'name'
              and official_extra->>'active' <> 'false'
          ) official_match
        ), 0)
        else p.price
      end
      +
      ----------------------------------------------------------------
      -- 2. Option price modifier (backend-authoritative):
      --    (a) Strict lookup: parse option_str ("label: choice") →
      --        extract choice value via split_part → find index in
      --        choices[] → use choicePrices[idx] as autority
      --    (b) Fallback: validate client_option_modifier against
      --        choicePrices values (pero no usar client value, solo
      --        devolverlo si coincide)
      --    (c) Default: 0
      --
      --    jsonb_path_exists reemplaza el anti-patrón like '%choicePrices%'
      --    CASE guard en jsonb_array_elements_text previene error si
      --    choices/choicePrices no son arrays
      ----------------------------------------------------------------
      coalesce(
        case
          when p.option_groups is not null
            and jsonb_typeof(p.option_groups) = 'array'
            and jsonb_path_exists(p.option_groups, '$[*] ? (@.choicePrices != null)')
          then (
            -- (a) Strict lookup: parse option_str → choice value → choicePrices[idx]
            (
              select og->'choicePrices'->>(ch.ch_idx - 1)::numeric
              from jsonb_array_elements(p.option_groups) og
              , jsonb_array_elements_text(
                  case when jsonb_typeof(og->'choices') = 'array'
                    then og->'choices'
                    else '[]'::jsonb
                  end
                ) with ordinality as ch(choice_val, ch_idx)
              where jsonb_typeof(og->'choicePrices') = 'array'
                and jsonb_array_length(og->'choices') = jsonb_array_length(og->'choicePrices')
                and r.option_str is not null
                and ch.choice_val = split_part(r.option_str, ': ', 2)
              limit 1
            )
            -- (b) Fallback: validate client modifier against choicePrices values
            union all
            (
              select mod_val::numeric
              from jsonb_array_elements(p.option_groups) og
              cross join jsonb_array_elements_text(
                case when jsonb_typeof(og->'choicePrices') = 'array'
                  then og->'choicePrices'
                  else '[]'::jsonb
                end
              ) with ordinality as cp(mod_val, ord)
              where mod_val::numeric = r.client_option_modifier
              limit 1
            )
            limit 1
          )
          else null
        end,
        0
      )::numeric as unit_price,
      p.id as product_id,
      p.name as product_name
    from requested r
    join public.products p
      on p.restaurant_id = v_restaurant_id
        and p.slug = r.slug
        and p.active
        and not p.sold_out
    where r.quantity between 1 and 10
  )
  select slug, quantity, extras, option_str, unit_price, product_id, product_name, original_item
  from validated;

  ------------------------------------------------------------------
  -- Count check: todos los items deben haber sido validados
  ------------------------------------------------------------------
  select count(*), coalesce(sum(quantity * unit_price), 0)
    into v_item_count, v_subtotal
  from temp_validated_items;

  if v_item_count <> jsonb_array_length(p_items) then
    raise exception 'invalid_or_unavailable_product';
  end if;

  ------------------------------------------------------------------
  -- Create the order
  ------------------------------------------------------------------
  insert into public.orders (
    folio, restaurant_id, table_id, subtotal, total, notes, idempotency_key, status, session_id
  ) values (
    'O-' || lpad(nextval('public.order_folio_seq')::text, 4, '0'),
    v_restaurant_id,
    v_table_id,
    v_subtotal,
    v_subtotal,
    left(trim(coalesce(p_notes, '')), 250),
    p_idempotency_key,
    'accepted',
    p_session_id
  ) returning id into v_order_id;

  ------------------------------------------------------------------
  -- order_items INSERT: reusa temp_validated_items directamente.
  -- unit_price ya fue calculado y validado. No hay duplicación.
  ------------------------------------------------------------------
  insert into public.order_items (
    order_id, product_id, product_name, unit_price, quantity, notes, selected_option, extras, substitutes
  )
  select
    v_order_id,
    product_id,
    product_name,
    unit_price,
    quantity,
    left(trim(coalesce(original_item->>'notes', '')), 250),
    option_str,
    case
      when extras is not null
        and jsonb_typeof(extras) = 'array'
        and jsonb_array_length(extras) > 0
      then extras
      else null
    end,
    original_item->'substitutes'
  from temp_validated_items;

  insert into public.order_events (order_id, to_status)
  values (v_order_id, 'accepted');

  return public.order_as_json(v_order_id);
end;
$$;

grant execute on function public.place_order(text, jsonb, text, uuid, uuid) to anon, authenticated;
