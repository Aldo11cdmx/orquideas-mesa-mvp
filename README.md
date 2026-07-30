# Imperio · Pedidos desde mesa

Sistema mobile-first para recibir pedidos desde los códigos QR de las mesas y
atenderlos en tiempo real desde los tableros de cocina y meseros.

## Horarios

- Desayunos y carta: 9:00 a.m.–9:00 p.m.
- Comida corrida y comidas a la carta: 1:00–9:00 p.m.

## Pantallas

- `/`: centro de operación.
- `/mesa/A1`: experiencia del cliente.
- `/cocina`: preparación de pedidos.
- `/meseros`: seguimiento y entrega en mesa.
- `/admin`: configuración de productos y comida corrida.
- `/qr`: hoja imprimible para las seis mesas.

## Inicio local

```bash
npm install
npm run dev
```

## Supabase

En **SQL Editor**, ejecuta las migraciones en orden:

1. `supabase/migrations/001_initial.sql`
2. `supabase/migrations/002_fix_staff_pin.sql`
3. `supabase/migrations/003_daily_menu.sql`
4. `supabase/migrations/004_daily_menu_timezone.sql`
5. `supabase/migrations/005_imperio_final_menu.sql`
6. `supabase/migrations/006_product_image_coherence.sql`
7. `supabase/migrations/007_breakfast_packages_and_sales_report.sql`
8. `supabase/migrations/008_omelette_and_trial_period.sql`
9. `supabase/migrations/009_extend_service_hours.sql`
10. `supabase/migrations/010_limit_omelette_customizations.sql`

La quinta migración instala el menú final, actualiza los precios, registra las
rutas de las fotografías y configura la comida corrida en $75. La sexta
sincroniza las imágenes específicas de bebidas, panes, guarniciones y platos fuertes.
La séptima convierte los desayunos indicados en paquetes con fruta y café y
habilita el corte de caja por periodos.
La octava corrige el platillo a omelette de champiñones en $65 y registra el
periodo de prueba no bloqueante de 14 días.
La novena extiende el servicio de todos los menús hasta las 9:00 p.m.
La décima limita las elecciones de salsa y queso al omelette de champiñones.

## Variables

| Variable | Uso |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL pública del proyecto |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Llave pública del proyecto |
| `STAFF_DEMO_PIN` | PIN del servidor para personal |
| `NEXT_PUBLIC_APP_URL` | URL base usada para QR y metadatos |

No agregues `.env.local`, llaves privadas ni contraseñas al repositorio.

## Seguridad

- Los precios se recalculan dentro de PostgreSQL.
- Las mesas, los productos y las cantidades se validan en servidor.
- Cada envío usa una llave de idempotencia para evitar duplicados.
- Los clientes sólo pueden consultar su propio pedido mediante un token.
- Los tableros del personal requieren el PIN configurado.
- Supabase Realtime avisa los cambios y una consulta periódica recupera
  cualquier alerta que se haya retrasado.

## Verificación

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run build:sites
```

Antes de abrir el servicio, administración debe publicar los guisados y
opciones de la comida corrida del día.
