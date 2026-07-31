# Supabase

Ejecuta las migraciones de `supabase/migrations` en orden numérico desde
**SQL Editor**. La migración `013_live_menu_payments_and_catalog.sql` es el
parche más reciente: unifica el catálogo, registra efectivo o tarjeta y
actualiza el corte de caja.

Las migraciones:

- crean el modelo y los índices;
- activan RLS;
- validan mesas, productos, cantidades y precios;
- evitan pedidos duplicados;
- guardan el historial de cada pedido;
- habilitan la comida corrida diaria;
- sincronizan los estados para clientes, cocina y meseros.

Para cambiar el PIN del personal:

```sql
update public.restaurants
set demo_pin_hash = crypt('NUEVO_PIN', gen_salt('bf'))
where id = '00000000-0000-0000-0000-000000000001';
```
