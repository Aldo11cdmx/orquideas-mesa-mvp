-- Extiende los horarios de servicio hasta las 9:00 p.m.
-- Ejecutar después de 008_omelette_and_trial_period.sql.

update public.daily_menus
set
  available_until = '21:00',
  updated_at = now()
where restaurant_id = '00000000-0000-0000-0000-000000000001';
