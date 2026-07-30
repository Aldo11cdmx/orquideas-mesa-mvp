-- Corrige el corte de caja y conserva el historial por día.
-- La alerta de pedidos listos se implementa en el tablero de meseros;
-- este parche repara la consulta que alimenta administración.

create or replace function public.admin_sales_report(
  p_pin text,
  p_from timestamptz,
  p_to timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant_id uuid;
  v_summary jsonb;
  v_top_products jsonb;
  v_daily_sales jsonb;
  v_orders jsonb;
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

  if p_from is null
    or p_to is null
    or p_to <= p_from
    or p_to - p_from > interval '370 days' then
    raise exception 'invalid_period';
  end if;

  select jsonb_build_object(
    'orderCount', count(*) filter (where status = 'delivered'),
    'grossSales', coalesce(sum(total) filter (where status = 'delivered'), 0),
    'itemsSold', coalesce((
      select sum(oi.quantity)
      from public.order_items oi
      join public.orders item_order on item_order.id = oi.order_id
      where item_order.restaurant_id = v_restaurant_id
        and item_order.status = 'delivered'
        and item_order.created_at >= p_from
        and item_order.created_at < p_to
    ), 0),
    'averageTicket', coalesce(avg(total) filter (where status = 'delivered'), 0),
    'pendingOrders', count(*) filter (
      where status not in ('delivered', 'cancelled')
    ),
    'pendingAmount', coalesce(sum(total) filter (
      where status not in ('delivered', 'cancelled')
    ), 0)
  )
  into v_summary
  from public.orders
  where restaurant_id = v_restaurant_id
    and created_at >= p_from
    and created_at < p_to;

  select coalesce(
    jsonb_agg(row_data order by (row_data->>'quantity')::integer desc),
    '[]'::jsonb
  )
  into v_top_products
  from (
    select jsonb_build_object(
      'name', oi.product_name,
      'quantity', sum(oi.quantity),
      'revenue', sum(oi.line_total)
    ) as row_data
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where o.restaurant_id = v_restaurant_id
      and o.status = 'delivered'
      and o.created_at >= p_from
      and o.created_at < p_to
    group by oi.product_name
    order by sum(oi.quantity) desc, sum(oi.line_total) desc
    limit 10
  ) ranked;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'day', daily.day,
        'orderCount', daily.order_count,
        'total', daily.total
      )
      order by daily.day
    ),
    '[]'::jsonb
  )
  into v_daily_sales
  from (
    select
      (o.created_at at time zone 'America/Mexico_City')::date as day,
      count(*) as order_count,
      sum(o.total) as total
    from public.orders o
    where o.restaurant_id = v_restaurant_id
      and o.status = 'delivered'
      and o.created_at >= p_from
      and o.created_at < p_to
    group by (o.created_at at time zone 'America/Mexico_City')::date
  ) daily;

  select coalesce(
    jsonb_agg(public.order_as_json(recent.id) order by recent.created_at desc),
    '[]'::jsonb
  )
  into v_orders
  from (
    select id, created_at
    from public.orders
    where restaurant_id = v_restaurant_id
      and status <> 'cancelled'
      and created_at >= p_from
      and created_at < p_to
    order by created_at desc
    limit 200
  ) recent;

  return jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'summary', v_summary,
    'topProducts', v_top_products,
    'dailySales', v_daily_sales,
    'orders', v_orders
  );
end;
$$;

revoke all on function public.admin_sales_report(text, timestamptz, timestamptz)
from public;
grant execute on function public.admin_sales_report(text, timestamptz, timestamptz)
to anon, authenticated;
