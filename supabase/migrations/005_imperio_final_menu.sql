-- Menú final de Imperio, horarios y fotografías.
-- Ejecutar después de 004_daily_menu_timezone.sql.

update public.restaurants
set
  name = 'Imperio',
  address = 'Av. Orquídeas, Hacienda Coacalco, Estado de México',
  updated_at = now()
where id = '00000000-0000-0000-0000-000000000001';

insert into public.categories (restaurant_id, name, sort_order)
values
  ('00000000-0000-0000-0000-000000000001', 'Desayunos', 10),
  ('00000000-0000-0000-0000-000000000001', 'A la carta', 20),
  ('00000000-0000-0000-0000-000000000001', 'Panes y más', 30),
  ('00000000-0000-0000-0000-000000000001', 'Bebidas', 40),
  ('00000000-0000-0000-0000-000000000001', 'Comidas a la carta', 50)
on conflict (restaurant_id, name) do update
set sort_order = excluded.sort_order;

update public.products
set active = false, updated_at = now()
where restaurant_id = '00000000-0000-0000-0000-000000000001'
  and slug <> 'comida-corrida';

with product_seed(slug, name, description, price, category, image, popular, options) as (
  values
  ('chilaquiles-sencillos','Chilaquiles sencillos','Totopos bañados en salsa, con crema, queso y cebolla.',60,'Desayunos','/menu/imperio/chilaquiles-sencillos.jpg',true,'["Salsa verde","Salsa roja"]'::jsonb),
  ('huevos-al-gusto','Huevos al gusto','Dos huevos acompañados de frijoles refritos.',60,'Desayunos','/menu/imperio/chilaquiles-huevo.jpg',false,'["Revueltos","Estrellados","A la mexicana"]'::jsonb),
  ('chilaquiles-huevo','Chilaquiles con 1 huevo','Chilaquiles bañados en salsa con un huevo al gusto.',65,'Desayunos','/menu/imperio/chilaquiles-huevo.jpg',false,'["Salsa verde","Salsa roja"]'::jsonb),
  ('molletes','Molletes tradicionales','Pan con frijoles, tocino, chorizo y quesos gratinados.',70,'Desayunos','/menu/imperio/molletes.jpg',true,'[]'::jsonb),
  ('enchiladas-verdes','Enchiladas verdes','Tres piezas rellenas de pollo y bañadas en salsa verde.',85,'Desayunos','/menu/imperio/enchiladas-suizas.jpg',false,'[]'::jsonb),
  ('enfrijoladas','Enfrijoladas veracruzanas','Rellenas de pollo y queso, cubiertas con frijol y chorizo.',85,'Desayunos','/menu/imperio/enfrijoladas.jpg',true,'[]'::jsonb),
  ('chilaquiles-carne','Chilaquiles con carne asada','Chilaquiles servidos con carne asada.',85,'Desayunos','/menu/imperio/chilaquiles-huevo.jpg',false,'["Salsa verde","Salsa roja"]'::jsonb),
  ('chilaquiles-pechuga','Chilaquiles con pechuga empanizada','Chilaquiles acompañados de fajitas de pechuga empanizada.',90,'Desayunos','/menu/imperio/chilaquiles-pechuga.jpg',true,'["Salsa verde","Salsa roja"]'::jsonb),
  ('enchiladas-suizas','Enchiladas suizas','Rellenas de pollo, gratinadas con queso manchego y crema.',90,'Desayunos','/menu/imperio/enchiladas-suizas.jpg',true,'[]'::jsonb),
  ('enmoladas','Enmoladas','Cuatro enchiladas rellenas de pollo y bañadas en mole tradicional.',90,'Desayunos','/menu/imperio/enmoladas.jpg',false,'[]'::jsonb),
  ('chilaquiles-suizos','Chilaquiles suizos','Con fajitas de pechuga, queso manchego gratinado y salsa suiza.',90,'Desayunos','/menu/imperio/chilaquiles-sencillos.jpg',false,'[]'::jsonb),
  ('chilaquiles-divorciados','Chilaquiles divorciados','Dos huevos con chilaquiles en salsa verde y roja.',90,'Desayunos','/menu/imperio/chilaquiles-huevo.jpg',false,'[]'::jsonb),
  ('arrachera-desayuno','200 g de arrachera','Acompañada de papas fritas, ensalada y frijoles.',90,'Desayunos','/menu/imperio/pollo-plancha.jpg',false,'[]'::jsonb),
  ('omelette-champinones','Omelette de champiñones','Relleno de queso y jamón, acompañado de frijoles refritos.',65,'Desayunos','/menu/imperio/chilaquiles-huevo.jpg',false,'["Salsa verde","Salsa roja"]'::jsonb),
  ('taco-bistec-longaniza','Taco de bistec o longaniza','Taco servido con una porción de papas fritas.',26,'A la carta','/menu/imperio/chilaquiles-huevo.jpg',false,'["Bistec","Longaniza"]'::jsonb),
  ('papas-francesa','Orden de papas a la francesa','Papas doradas preparadas al momento.',45,'A la carta','/menu/imperio/club-sandwich.jpg',false,'[]'::jsonb),
  ('ensalada-fresca','Ensalada fresca','Con pollo o atún, rollitos de jamón, queso y vegetales frescos.',65,'A la carta','/menu/imperio/ensalada.jpg',false,'["Pollo","Atún"]'::jsonb),
  ('club-sandwich','Club sándwich','Sándwich de dos pisos con pollo, tocino, jamón, queso y verduras; incluye papas.',65,'A la carta','/menu/imperio/club-sandwich.jpg',true,'[]'::jsonb),
  ('desayuno-combinado','Desayuno combinado','Dos hot cakes, dos huevos, dos piezas de tocino y una porción de fruta.',65,'A la carta','/menu/imperio/hotcakes-waffles.jpg',false,'[]'::jsonb),
  ('bisquet','Bisquet horneado','Servido con mantequilla y mermelada de fresa.',25,'Panes y más','/menu/imperio/cuernito.jpg',false,'[]'::jsonb),
  ('pan-frances','Pan francés','Orden de tres piezas preparada al momento.',40,'Panes y más','/menu/imperio/hotcakes-waffles.jpg',false,'[]'::jsonb),
  ('hot-cakes','Hot cakes','Orden de tres piezas.',40,'Panes y más','/menu/imperio/hotcakes-waffles.jpg',false,'[]'::jsonb),
  ('waffles','Waffles','Dos piezas servidas con helado y fruta de temporada.',45,'Panes y más','/menu/imperio/hotcakes-waffles.jpg',false,'[]'::jsonb),
  ('cuernito','Cuernito horneado','Con jamón, quesos, lechuga y jitomate.',35,'Panes y más','/menu/imperio/cuernito.jpg',false,'[]'::jsonb),
  ('coca-cola','Coca-Cola 355 ml','Refresco frío en presentación de 355 ml.',28,'Bebidas','/menu/imperio/bebidas.jpg',false,'[]'::jsonb),
  ('licuado','Licuado','Preparado con leche y fruta.',30,'Bebidas','/menu/imperio/bebidas.jpg',false,'["Plátano","Fresa","Mamey"]'::jsonb),
  ('cafe-leche','Café con leche evaporada','Café caliente preparado al momento.',25,'Bebidas','/menu/imperio/bebidas.jpg',false,'[]'::jsonb),
  ('malteada','Malteada','Cremosa malteada fría.',40,'Bebidas','/menu/imperio/bebidas.jpg',false,'["Fresa","Chocolate","Vainilla"]'::jsonb),
  ('jugo-verde','Jugo verde','Jugo de piña, espinaca y apio, 500 ml.',35,'Bebidas','/menu/imperio/bebidas.jpg',false,'[]'::jsonb),
  ('agua-fruta','Agua de fruta','Agua fresca preparada con el sabor disponible del día.',25,'Bebidas','/menu/imperio/bebidas.jpg',false,'[]'::jsonb),
  ('pechuga-empanizada','Pechuga de pollo empanizada','Acompañada de ensalada y frijoles.',85,'Comidas a la carta','/menu/imperio/pechuga-rellena.jpg',false,'[]'::jsonb),
  ('pechuga-plancha','Pechuga de pollo a la plancha','Acompañada de ensalada y frijoles.',85,'Comidas a la carta','/menu/imperio/pollo-plancha.jpg',false,'[]'::jsonb),
  ('milanesa-res','Milanesa de res','Acompañada de ensalada y frijoles.',85,'Comidas a la carta','/menu/imperio/pechuga-rellena.jpg',false,'[]'::jsonb),
  ('pechuga-rellena','Pechuga de pollo rellena','Con jamón y quesos, acompañada de papas fritas y ensalada.',95,'Comidas a la carta','/menu/imperio/pechuga-rellena.jpg',true,'[]'::jsonb),
  ('filete-pescado','Filete de pescado empanizado','Acompañado de papas fritas y ensalada.',95,'Comidas a la carta','/menu/imperio/pechuga-rellena.jpg',false,'[]'::jsonb),
  ('enchiladas-suizas-comida','Enchiladas suizas de comida','Rellenas de queso Oaxaca, cubiertas con pollo y gratinadas con manchego.',100,'Comidas a la carta','/menu/imperio/enchiladas-suizas.jpg',false,'[]'::jsonb),
  ('arrachera-comida','200 g de arrachera','Acompañada de papas a la francesa, ensalada y frijoles.',100,'Comidas a la carta','/menu/imperio/pollo-plancha.jpg',false,'[]'::jsonb),
  ('enchiladas-mole-comida','Enchiladas de mole','Cuatro piezas rellenas de pollo y bañadas en mole tradicional.',100,'Comidas a la carta','/menu/imperio/enmoladas.jpg',false,'[]'::jsonb)
)
insert into public.products (
  restaurant_id, category_id, slug, name, description, price, image_url,
  active, sold_out, popular, is_new, options
)
select
  '00000000-0000-0000-0000-000000000001',
  c.id,
  ps.slug,
  ps.name,
  ps.description,
  ps.price,
  ps.image,
  true,
  false,
  ps.popular,
  false,
  ps.options
from product_seed ps
join public.categories c
  on c.restaurant_id = '00000000-0000-0000-0000-000000000001'
  and c.name = ps.category
on conflict (restaurant_id, slug) do update set
  category_id = excluded.category_id,
  name = excluded.name,
  description = excluded.description,
  price = excluded.price,
  compare_at_price = null,
  image_url = excluded.image_url,
  active = true,
  sold_out = false,
  popular = excluded.popular,
  is_new = false,
  options = excluded.options,
  updated_at = now();

update public.daily_menus
set
  service_date = (now() at time zone 'America/Mexico_City')::date,
  active = true,
  available_from = '13:00',
  available_until = '17:00',
  price = 75,
  courses = '{
    "Entrada": ["Consomé del día", "Sopa del día", "Crema del día"],
    "Guarnición": ["Arroz", "Pasta"],
    "Plato fuerte": ["Pechuga empanizada", "Enchiladas verdes"],
    "Bebida": ["Agua de fruta del día"]
  }'::jsonb,
  updated_at = now()
where restaurant_id = '00000000-0000-0000-0000-000000000001';

update public.products
set
  category_id = (
    select id
    from public.categories
    where restaurant_id = '00000000-0000-0000-0000-000000000001'
      and name = 'Comidas a la carta'
  ),
  name = 'Comida corrida',
  description = 'Entrada, arroz o pasta, guisado del día y agua de fruta.',
  price = 75,
  image_url = '/menu/imperio/pechuga-rellena.jpg',
  active = true,
  sold_out = false,
  updated_at = now()
where restaurant_id = '00000000-0000-0000-0000-000000000001'
  and slug = 'comida-corrida';

insert into public.menu_products (menu_id, product_id, sort_order)
select
  '00000000-0000-0000-0000-000000000101',
  p.id,
  row_number() over (order by c.sort_order, p.name)
from public.products p
join public.categories c on c.id = p.category_id
where p.restaurant_id = '00000000-0000-0000-0000-000000000001'
  and p.active
on conflict (menu_id, product_id) do update
set sort_order = excluded.sort_order;
