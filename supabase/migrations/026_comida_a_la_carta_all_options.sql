-- 026 — Agregar opciones de "Comidas a la carta" a productos adicionales.
--
-- Se extiende la configuración de option_groups a cinco productos más que
-- pertenecen a "Comidas a la carta": filete-pescado, milanesa-res,
-- pechuga-plancha, pechuga-empanizada y pechuga-rellena.
--
-- Esta migración es IDEMPOTENTE: usa IS DISTINCT FROM, por lo que no
-- hace nada si los option_groups ya están configurados correctamente.
-- NO modifica precios, nombres, imágenes, horarios, pedidos, extras,
-- realtime ni productos que no pertenezcan a "Comidas a la carta".

update public.products
set
  option_groups = '[
    {"id":"primer-tiempo","label":"Primer tiempo","choices":["Consomé","Sopa"],"required":true},
    {"id":"acompanamiento","label":"Acompañamiento","choices":["Arroz","Pasta"],"required":true},
    {"id":"agua","label":"Agua","choices":["Agua de fruta","Agua simple"],"required":true}
  ]'::jsonb,
  updated_at = now()
where restaurant_id = '00000000-0000-0000-0000-000000000001'
  and slug in ('filete-pescado', 'milanesa-res', 'pechuga-plancha', 'pechuga-empanizada', 'pechuga-rellena')
  and option_groups IS DISTINCT FROM '[
    {"id":"primer-tiempo","label":"Primer tiempo","choices":["Consomé","Sopa"],"required":true},
    {"id":"acompanamiento","label":"Acompañamiento","choices":["Arroz","Pasta"],"required":true},
    {"id":"agua","label":"Agua","choices":["Agua de fruta","Agua simple"],"required":true}
  ]'::jsonb;