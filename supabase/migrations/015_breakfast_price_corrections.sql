-- Corrige únicamente los cuatro precios confirmados del desayuno.

update public.products p
set
  price = case
    when p.slug = 'chilaquiles-huevo' then 65
    when p.slug = 'enfrijoladas' then 85
    when p.slug = 'chilaquiles-pechuga' then 85
    when p.name = 'Chilaquiles sencillos' and c.name = 'Desayunos' then 60
    else p.price
  end,
  updated_at = now()
from public.categories c
where p.category_id = c.id
  and p.restaurant_id = '00000000-0000-0000-0000-000000000001'
  and (
    p.slug in ('chilaquiles-huevo', 'enfrijoladas', 'chilaquiles-pechuga')
    or (p.name = 'Chilaquiles sencillos' and c.name = 'Desayunos')
  );
