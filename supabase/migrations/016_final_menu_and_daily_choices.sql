-- Sincroniza el menú confirmado y los horarios definitivos.

update public.products p
set
  price = case p.slug
    when 'chilaquiles-huevo' then 60
    when 'molletes' then 65
    when 'enchiladas-verdes' then 70
    when 'enfrijoladas' then 85
    when 'chilaquiles-carne' then 85
    when 'chilaquiles-pechuga' then 85
    when 'enchiladas-suizas' then 90
    when 'enmoladas' then 90
    when 'chilaquiles-divorciados' then 90
    when 'arrachera-desayuno' then 90
    when 'omelette-champinones' then 65
    when 'taco-bistec-longaniza' then 26
    when 'papas-francesa' then 45
    when 'ensalada-fresca' then 65
    when 'club-sandwich' then 65
    when 'desayuno-combinado' then 65
    when 'bisquet' then 25
    when 'pan-frances' then 40
    when 'hot-cakes' then 40
    when 'waffles' then 45
    when 'cuernito' then 35
    when 'coca-cola' then 28
    when 'licuado' then 30
    when 'cafe-leche' then 25
    when 'malteada' then 40
    when 'jugo-verde' then 35
    when 'agua-fruta' then 35
    else case
      when p.name = 'Chilaquiles sencillos' and c.name = 'Desayunos' then 50
      else p.price
    end
  end,
  name = case
    when p.slug = 'chilaquiles-pechuga' then 'Chilaquiles con pechuga'
    else p.name
  end,
  description = case
    when p.name = 'Chilaquiles sencillos' and c.name = 'Desayunos'
      then 'Totopos con crema y cebolla. Paquete con fruta y café.'
    when p.slug = 'chilaquiles-pechuga'
      then 'Chilaquiles con pechuga de pollo. Paquete con fruta y café.'
    when p.slug = 'desayuno-combinado'
      then '2 hot cakes, 2 huevos, 2 piezas de tocino y 1 porción de fruta.'
    else p.description
  end,
  updated_at = now()
from public.categories c
where p.category_id = c.id
  and p.restaurant_id = '00000000-0000-0000-0000-000000000001'
  and (
    p.slug in (
      'chilaquiles-huevo', 'molletes', 'enchiladas-verdes', 'enfrijoladas',
      'chilaquiles-carne', 'chilaquiles-pechuga', 'enchiladas-suizas',
      'enmoladas', 'chilaquiles-divorciados', 'arrachera-desayuno',
      'omelette-champinones', 'taco-bistec-longaniza', 'papas-francesa',
      'ensalada-fresca', 'club-sandwich', 'desayuno-combinado', 'bisquet',
      'pan-frances', 'hot-cakes', 'waffles', 'cuernito', 'coca-cola',
      'licuado', 'cafe-leche', 'malteada', 'jugo-verde', 'agua-fruta'
    )
    or (p.name = 'Chilaquiles sencillos' and c.name = 'Desayunos')
  );

update public.products p
set available_from = '09:00', available_until = '13:00', updated_at = now()
from public.categories c
where p.category_id = c.id
  and p.restaurant_id = '00000000-0000-0000-0000-000000000001'
  and (c.name in ('Desayunos', 'Panes y más') or p.slug = 'desayuno-combinado');

update public.products p
set available_from = '09:00', available_until = '17:00', updated_at = now()
from public.categories c
where p.category_id = c.id
  and p.restaurant_id = '00000000-0000-0000-0000-000000000001'
  and c.name in ('A la carta', 'Bebidas')
  and p.slug <> 'desayuno-combinado';

update public.products p
set available_from = '13:00', available_until = '17:00', updated_at = now()
from public.categories c
where p.category_id = c.id
  and p.restaurant_id = '00000000-0000-0000-0000-000000000001'
  and c.name = 'Comidas a la carta';

update public.daily_menus
set
  available_from = '13:00',
  available_until = '17:00',
  updated_at = now()
where restaurant_id = '00000000-0000-0000-0000-000000000001';
