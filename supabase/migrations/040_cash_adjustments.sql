-- 040: Ajustes manuales de caja (entradas/salidas) para el corte de caja.
--
-- Agrega la tabla cash_adjustments y 3 RPCs protegidos por PIN (mismo patron
-- que admin_sales_report: demo_pin_hash via extensions.crypt):
--   save_cash_adjustment(p_pin, p_type, p_amount, p_concept, p_created_by)
--   delete_cash_adjustment(p_pin, p_id)
--   admin_cash_adjustments(p_pin, p_from, p_to)
--
-- Balance esperado en caja (calculado en el frontend/PDF):
--   efectivo esperado = cashSales + entradas (income) - salidas (expense)

create table if not exists public.cash_adjustments (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  type text not null check (type in ('income', 'expense')),
  amount numeric(10,2) not null check (amount > 0),
  concept text not null check (char_length(trim(concept)) between 1 and 200),
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists cash_adjustments_restaurant_created_idx
  on public.cash_adjustments (restaurant_id, created_at);

-- ─── save_cash_adjustment ────────────────────────────────────────────────
create or replace function public.save_cash_adjustment(
  p_pin text,
  p_type text,
  p_amount numeric,
  p_concept text,
  p_created_by text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant_id uuid;
  v_row public.cash_adjustments%rowtype;
begin
  select id into v_restaurant_id
  from public.restaurants
  where active
    and demo_pin_hash is not null
    and demo_pin_hash = extensions.crypt(p_pin, demo_pin_hash)
  limit 1;

  if v_restaurant_id is null then raise exception 'invalid_pin'; end if;
  if p_type not in ('income', 'expense') then raise exception 'invalid_type'; end if;
  if p_amount is null or p_amount <= 0 or p_amount > 999999.99 then
    raise exception 'invalid_amount';
  end if;
  if p_concept is null or char_length(trim(p_concept)) < 1
    or char_length(trim(p_concept)) > 200 then
    raise exception 'invalid_concept';
  end if;

  insert into public.cash_adjustments (restaurant_id, type, amount, concept, created_by)
  values (v_restaurant_id, p_type, round(p_amount, 2), trim(p_concept), p_created_by)
  returning * into v_row;

  return jsonb_build_object(
    'id', v_row.id,
    'type', v_row.type,
    'amount', v_row.amount,
    'concept', v_row.concept,
    'createdBy', v_row.created_by,
    'createdAt', v_row.created_at
  );
end;
$$;

-- ─── delete_cash_adjustment ──────────────────────────────────────────────
create or replace function public.delete_cash_adjustment(
  p_pin text,
  p_id uuid
) returns jsonb
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

  delete from public.cash_adjustments
  where id = p_id and restaurant_id = v_restaurant_id;

  return jsonb_build_object('ok', found);
end;
$$;

-- ─── admin_cash_adjustments ──────────────────────────────────────────────
create or replace function public.admin_cash_adjustments(
  p_pin text,
  p_from timestamptz,
  p_to timestamptz
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant_id uuid;
  v_items jsonb;
  v_totals jsonb;
begin
  select id into v_restaurant_id
  from public.restaurants
  where active
    and demo_pin_hash is not null
    and demo_pin_hash = extensions.crypt(p_pin, demo_pin_hash)
  limit 1;

  if v_restaurant_id is null then raise exception 'invalid_pin'; end if;
  if p_from is null or p_to is null or p_to <= p_from then
    raise exception 'invalid_period';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', id,
        'type', type,
        'amount', amount,
        'concept', concept,
        'createdBy', created_by,
        'createdAt', created_at
      )
      order by created_at desc, id desc
    ),
    '[]'::jsonb
  )
  into v_items
  from public.cash_adjustments
  where restaurant_id = v_restaurant_id
    and created_at >= p_from
    and created_at < p_to;

  select jsonb_build_object(
    'income', coalesce(sum(amount) filter (where type = 'income'), 0),
    'expense', coalesce(sum(amount) filter (where type = 'expense'), 0)
  )
  into v_totals
  from public.cash_adjustments
  where restaurant_id = v_restaurant_id
    and created_at >= p_from
    and created_at < p_to;

  return jsonb_build_object('items', v_items, 'totals', v_totals);
end;
$$;

-- ─── Permisos (mismo patron que admin_sales_report) ──────────────────────
revoke all on function public.save_cash_adjustment(text, text, numeric, text, text) from public;
grant execute on function public.save_cash_adjustment(text, text, numeric, text, text) to anon, authenticated;

revoke all on function public.delete_cash_adjustment(text, uuid) from public;
grant execute on function public.delete_cash_adjustment(text, uuid) to anon, authenticated;

revoke all on function public.admin_cash_adjustments(text, timestamptz, timestamptz) from public;
grant execute on function public.admin_cash_adjustments(text, timestamptz, timestamptz) to anon, authenticated;
