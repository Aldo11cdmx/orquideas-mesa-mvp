-- Repairs the six menu records affected by repeated UTF-8 decoding.
-- PostgreSQL Unicode escapes keep this migration ASCII-only so copying it
-- through the SQL editor cannot corrupt accented characters again.

update public.products
set
  description = U&'Chilaquiles con un huevo al gusto. Paquete con fruta y caf\00E9.',
  package_includes = jsonb_build_array('Fruta de temporada', U&'Caf\00E9 de la casa'),
  option_groups = jsonb_build_array(
    jsonb_build_object(
      'id', 'huevos',
      'label', U&'\00BFC\00F3mo quieres tu huevo?',
      'choices', jsonb_build_array('Revuelto', 'Estrellado', 'A la mexicana'),
      'required', true
    )
  ),
  updated_at = now()
where restaurant_id = '00000000-0000-0000-0000-000000000001'
  and slug = 'chilaquiles-huevo';

update public.products
set
  package_includes = jsonb_build_array('Fruta de temporada', U&'Caf\00E9 de la casa'),
  updated_at = now()
where restaurant_id = '00000000-0000-0000-0000-000000000001'
  and slug in ('chilaquiles-pechuga', 'chilaquiles-suizos');

update public.products
set
  description = case slug
    when 'enchiladas-verdes'
      then U&'Tres piezas rellenas de pollo. Paquete con fruta y caf\00E9.'
    when 'enfrijoladas'
      then U&'Rellenas de pollo, cubiertas con frijol y chorizo. Incluye fruta y caf\00E9.'
    when 'molletes'
      then U&'Pan con frijoles, tocino y chorizo. Paquete con fruta y caf\00E9.'
  end,
  package_includes = jsonb_build_array('Fruta de temporada', U&'Caf\00E9 de la casa'),
  updated_at = now()
where restaurant_id = '00000000-0000-0000-0000-000000000001'
  and slug in ('enchiladas-verdes', 'enfrijoladas', 'molletes');
