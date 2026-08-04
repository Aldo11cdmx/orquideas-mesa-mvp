-- 025 — Configurar option_groups para productos de "Comidas a la carta" que requieren opciones.
--
-- Tres productos de "Comidas a la carta" — enchiladas-suizas-comida, arrachera-comida y
-- enchiladas-mole-comida — deberían ofrecer los mismos grupos de opciones que aparecen en
-- lib/menu.ts (Primer tiempo, Acompañamiento y Agua). Actualmente su columna option_groups
-- es [] en Supabase, por lo que el menú de mesa no muestra selectores.
--
-- Esta migración es IDEMPOTENTE: usa IS DISTINCT FROM, por lo que no hace nada si los
-- option_groups ya están configurados correctamente.
-- NO modifica precios, nombres, imágenes, horarios, pedidos, extras, realtime ni
-- productos que no pertenezcan a "Comidas a la carta".

update public.products
set
  option_groups = '[
    {"id":"primer-tiempo","label":"Primer tiempo","choices":["Consomé","Sopa"],"required":true},
    {"id":"acompanamiento","label":"Acompañamiento","choices":["Arroz","Pasta"],"required":true},
    {"id":"agua","label":"Agua","choices":["Agua de fruta","Agua simple"],"required":true}
  ]'::jsonb,
  updated_at = now()
where restaurant_id = '00000000-0000-0000-0000-000000000001'
  and slug in ('enchiladas-suizas-comida', 'arrachera-comida', 'enchiladas-mole-comida')
  and option_groups IS DISTINCT FROM '[
    {"id":"primer-tiempo","label":"Primer tiempo","choices":["Consomé","Sopa"],"required":true},
    {"id":"acompanamiento","label":"Acompañamiento","choices":["Arroz","Pasta"],"required":true},
    {"id":"agua","label":"Agua","choices":["Agua de fruta","Agua simple"],"required":true}
  ]'::jsonb;
