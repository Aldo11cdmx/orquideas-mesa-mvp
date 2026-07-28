# Supabase

Ejecuta `migrations/001_initial.sql` una sola vez desde **SQL Editor**.

La migración:

- crea el modelo completo y los índices;
- activa RLS;
- niega lecturas directas de pedidos anónimos;
- publica únicamente RPCs validados;
- recalcula precios dentro de PostgreSQL;
- usa `idempotency_key` para evitar duplicados;
- limita cantidades y frecuencia de pedidos;
- valida mesas y productos activos;
- guarda nombre y precio como fotografía histórica;
- prepara políticas para migrar cocina/admin a Supabase Auth.

PIN inicial de demostración: `2026`. Cámbialo antes de uso real:

```sql
update public.restaurants
set demo_pin_hash = crypt('NUEVO_PIN', gen_salt('bf'))
where slug = 'orquideas';
```
