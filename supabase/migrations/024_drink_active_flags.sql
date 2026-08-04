-- 024 — Convertir bebidas de strings a objetos {name, active} en daily_menus.courses.Bebida.
--
-- Esta migración es SEGURA E IDEMPOTENTE:
-- - Solo convierte elementos tipo string a objetos {name, active: true}.
-- - Si un elemento ya es objeto, se deja intacto (no se vuelve a transformar).
-- - Si Bebida no existe o ya está migrada, no hace nada.
-- - NO borra, duplica, renombra ni cambia precios, productos, pedidos ni place_order.
-- - Solo toca courses.Bebida dentro de daily_menus.

update public.daily_menus
set courses = jsonb_set(
  courses,
  '{Bebida}',
  coalesce(
    (
      select jsonb_agg(
        case
          when jsonb_typeof(elem) = 'string' then
            jsonb_set('{"active":true}'::jsonb, '{name}', elem)
          else
            elem
        end
        order by ord
      )
      from jsonb_array_elements(courses -> 'Bebida') with ordinality as elems(elem, ord)
    ),
    '[]'::jsonb
  )
)
where (courses ? 'Bebida')
  and jsonb_typeof(courses -> 'Bebida') = 'array'
  and exists (
    select 1
    from jsonb_array_elements(courses -> 'Bebida') as elems(elem)
    where jsonb_typeof(elem) = 'string'
  );
