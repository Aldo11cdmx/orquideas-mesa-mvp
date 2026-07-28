# Orquídeas · Pedidos desde mesa

MVP mobile-first para recibir pedidos desde un QR de mesa y atenderlos desde una
tablet. Incluye menú, carrito, seguimiento, tablero de cocina, administración,
hoja QR y modo demo.

> **Identidad provisional:** las capturas recibidas no mostraron el nombre ni el
> logotipo del restaurante. “Orquídeas · Cocina de barrio” se usa como identidad
> temporal, inspirada en la dirección confirmada. Los platillos, precios y
> fotografías sí provienen de las capturas del menú.

## Inicio rápido

```bash
npm install
npm run dev
```

Abre:

- `/demo`: guion de demostración.
- `/mesa/A1`: experiencia del cliente.
- `/cocina`: tablero para tablet.
- `/admin`: gestión básica.
- `/qr`: hoja imprimible de las seis mesas.

PIN de cocina y administración: `2026` (solo demostración).

## Supabase

1. Crea o abre el proyecto.
2. En **SQL Editor**, ejecuta
   [`supabase/migrations/001_initial.sql`](supabase/migrations/001_initial.sql).
3. Configura las variables de `.env.example`.
4. Reinicia o vuelve a desplegar.

No se utiliza `service_role` en el navegador. La creación del pedido pasa por
una función `security definer` que valida la mesa, disponibilidad, cantidades,
idempotencia y precios vigentes dentro de PostgreSQL.

Sin la migración, la app entra en modo demo automáticamente:

- conserva datos en el navegador;
- sincroniza pantallas abiertas mediante Supabase Broadcast;
- no garantiza recuperación entre dispositivos después de recargar.

## Variables

| Variable | Uso |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL pública del proyecto |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable/anon key |
| `STAFF_DEMO_PIN` | PIN del servidor para cocina |
| `NEXT_PUBLIC_APP_URL` | URL base usada para generar los QR |

## Despliegue en Vercel

1. Sube el repositorio a GitHub. Los archivos `.env*` están ignorados y
   `.env.example` contiene únicamente marcadores de posición.
2. Importa el repositorio desde Vercel.
3. En **Settings → Environment Variables**, agrega:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `STAFF_DEMO_PIN`
   - `NEXT_PUBLIC_APP_URL` con el dominio definitivo de Vercel.
4. Mantén el preset **Next.js** y el comando de compilación `npm run build`.
5. Despliega y vuelve a generar o imprimir los QR desde `/qr`.

No agregues `.env.local`, una llave `service_role` ni contraseñas al
repositorio. La llave pública/anon se configura directamente en Vercel.

## Seguridad implementada

- Total recalculado en PostgreSQL; no se acepta el precio del cliente.
- Copia histórica de nombre y precio en `order_items`.
- Mesa y productos activos validados en servidor.
- Cantidad limitada a 10 por renglón y 30 renglones por pedido.
- `idempotency_key` único para evitar dobles pedidos.
- Rate limit básico por mesa.
- Observaciones recortadas y validadas.
- Pedidos sin lectura directa anónima; acceso mediante RPC con token o PIN.
- RLS e índices incluidos.
- Estructura preparada para sustituir el PIN por Supabase Auth.

## Verificación

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

El flujo automatizado de navegador verifica:

- pedido desde A1;
- recepción en cocina;
- transición a preparando y listo;
- estado actualizado en el celular;
- producto agotado;
- mesa inexistente.

## Pendientes del dueño

- Confirmar nombre comercial, logotipo y colores oficiales.
- Confirmar la carta de comida corrida, horario y precio.
- Confirmar si los precios promocionales de DiDi aplican en consumo en mesa.
- Cambiar el PIN demo y crear usuarios de cocina/admin con Supabase Auth.
