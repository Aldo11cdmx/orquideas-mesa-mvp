-- 029 — Seed data: corregir precios de café, insertar productos faltantes y poblar extras_config.
--
-- Esta migración es INCREMENTAL y NO DESTRUCTIVA:
-- - Actualiza precios de productos existentes (cafe-leche: $25 → $30)
-- - Inserta productos faltantes (cafe-normal $15, te $15) con ON CONFLICT
-- - Puebla extras_config en productos a la carta
-- - Es idempotente: usa ON CONFLICT y IS DISTINCT FROM

-- ============================================================================
-- 1. Actualizar precio de café con leche evaporada a $30
-- ============================================================================
update public.products
set price = 30,
    name = 'Café con leche evaporada',
    description = 'Café caliente preparado con leche evaporada.',
    updated_at = now()
where restaurant_id = '00000000-0000-0000-0000-000000000001'
  and slug = 'cafe-leche';

-- ============================================================================
-- 2. Insertar café normal ($15) si no existe
-- ============================================================================
insert into public.products (
    restaurant_id, category_id, slug, name, description, price,
    compare_at_price, image_url, active, sold_out, popular, is_new,
    options, option_groups, package_includes, extras_config, updated_at
)
select
    '00000000-0000-0000-0000-000000000001',
    c.id,
    'cafe-normal',
    'Café normal',
    'Café caliente preparado al momento.',
    15,
    null, '/menu/imperio/cafe-leche.jpg',
    true, false, false, false,
    '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, now()
from public.categories c
where c.restaurant_id = '00000000-0000-0000-0000-000000000001'
  and c.name = 'Bebidas'
on conflict (restaurant_id, slug) do update set
    price = 15,
    name = 'Café normal',
    description = 'Café caliente preparado al momento.',
    image_url = '/menu/imperio/cafe-leche.jpg',
    active = true,
    sold_out = false,
    updated_at = now();

-- ============================================================================
-- 3. Insertar té ($15) si no existe
-- ============================================================================
insert into public.products (
    restaurant_id, category_id, slug, name, description, price,
    compare_at_price, image_url, active, sold_out, popular, is_new,
    options, option_groups, package_includes, extras_config, updated_at
)
select
    '00000000-0000-0000-0000-000000000001',
    c.id,
    'te',
    'Té',
    'Té caliente preparado al momento.',
    15,
    null, '/menu/imperio/cafe-leche.jpg',
    true, false, false, false,
    '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, now()
from public.categories c
where c.restaurant_id = '00000000-0000-0000-0000-000000000001'
  and c.name = 'Bebidas'
on conflict (restaurant_id, slug) do update set
    price = 15,
    name = 'Té',
    description = 'Té caliente preparado al momento.',
    image_url = '/menu/imperio/cafe-leche.jpg',
    active = true,
    sold_out = false,
    updated_at = now();

-- ============================================================================
-- 4. Poblar extras_config en productos a la carta
--    Extras oficiales: Café $15, Fruta extra $10
--    Se aplica a productos a la carta y panes. NO se aplican a bebidas
--    (cafe-normal, cafe-leche, te) para evitar extras sin sentido.
-- ============================================================================
update public.products
set extras_config = '[{"name":"Café","price":15,"active":true},{"name":"Fruta extra","price":10,"active":true}]'::jsonb,
    updated_at = now()
where restaurant_id = '00000000-0000-0000-0000-000000000001'
  and slug in (
    -- Desayunos individuales (sin paquete)
    'arrachera-desayuno',
    -- A la carta
    'taco-bistec-longaniza',
    'papas-francesa',
    'ensalada-fresca',
    'club-sandwich',
    'enfrijoladas-carta',
    'salchipulpos-papas',
    -- Panes y más
    'bisquet',
    'pan-frances',
    'hot-cakes',
    'waffles',
    'cuernito',
    -- Comidas a la carta
    'pechuga-empanizada',
    'pechuga-plancha',
    'milanesa-res',
    'pechuga-rellena',
    'filete-pescado',
    'enchiladas-suizas-comida',
    'arrachera-comida',
    'enchiladas-mole-comida'
  )
  and extras_config IS DISTINCT FROM '[{"name":"Café","price":15,"active":true},{"name":"Fruta extra","price":10,"active":true}]'::jsonb;
