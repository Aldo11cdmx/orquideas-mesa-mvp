# Supabase

Ejecuta las migraciones de `supabase/migrations` en orden numérico desde
**SQL Editor**. La migración `008_omelette_and_trial_period.sql` es el parche
más reciente. Corrige el omelette y agrega el periodo de prueba de 14 días.

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
