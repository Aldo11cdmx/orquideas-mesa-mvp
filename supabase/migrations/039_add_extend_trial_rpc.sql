-- 039: RPC reutilizable para extender la prueba de un restaurante.
--
-- Reemplaza el UPDATE estatico por un mecanismo reutilizable:
--   select public.extend_trial('00000000-0000-0000-0000-000000000001', 24);
--
-- Seguridad: SECURITY DEFINER + ejecucion restringida a la service role
-- (la capa admin usa lib/supabase/server.ts -> createAdminClient(), que
-- firma con SUPABASE_SERVICE_ROLE_KEY). No se otorga a anon/authenticated.
--
-- No entra en conflicto con trial_status(): esa funcion es de solo lectura
-- y tiene otro nombre/firma.

create or replace function public.extend_trial(
  p_restaurant_id uuid,
  p_hours integer default 24
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ends_at timestamptz;
begin
  -- Validacion basica: horas positivas y con tope de 1 anio (8760 h).
  if p_hours is null or p_hours <= 0 or p_hours > 8760 then
    raise exception 'invalid_hours';
  end if;

  update public.restaurants
  set
    trial_ends_at = greatest(coalesce(trial_ends_at, now()), now()) + (p_hours || ' hours')::interval,
    updated_at = now()
  where id = p_restaurant_id
  returning trial_ends_at into v_ends_at;

  -- No se actualizo ninguna fila: el restaurante no existe.
  if not found then
    return jsonb_build_object(
      'ok', false,
      'restaurantId', p_restaurant_id,
      'trialEndsAt', null
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'restaurantId', p_restaurant_id,
    'trialEndsAt', v_ends_at,
    'active', v_ends_at > now()
  );
end;
$$;

-- Restringir: quitar el grant publico por defecto y otorgar solo a service_role.
revoke all on function public.extend_trial(uuid, integer) from public;
grant execute on function public.extend_trial(uuid, integer) to service_role;

-- Verificacion (ejecutar como service_role):
--   select public.extend_trial('00000000-0000-0000-0000-000000000001', 24);
--   select public.trial_status();
