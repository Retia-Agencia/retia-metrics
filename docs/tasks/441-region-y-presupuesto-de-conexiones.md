---
id: 441
etapa: rendimiento
serves: "docs/estudio-rendimiento-y-conexion.md §8.9, §13.4 y §13.7 · decisión 5 de la §10"
depends: [435, 436]
status: todo
---

# 441 — La función corre junto a la base y las conexiones tienen una cuenta escrita

## Qué
Dos cambios de operación (los hace la sesión principal con el ok de Mani, no Codex) y una cuenta escrita:
mover las funciones de Vercel a la región de la base, ajustar el tamaño del pool del pooler, y dejar en AGENTS.md el
presupuesto de conexiones.

## Por qué
- Las funciones corren en `iad1` (us-east-1, el valor por defecto) y la base en us-east-2. La región de Vercel en
  us-east-2 es **`cle1`** (https://vercel.com/docs/regions). Cada consulta paga esa ida y vuelta, y hoy un render hace
  entre 14 y 846.
- Medido el 14-nov (estudio §13.4): `max_connections` 60, 29 ocupadas en reposo, pico de 25 bajo carga, y el pooler
  responde `ECHECKOUTTIMEOUT` cuando 16 renders pesados compiten: el techo es el pool del pooler (~15), no Postgres.

## Cómo

**1. Región.** En `vercel.json`:

```json
{ "regions": ["cle1"], "functionFailoverRegions": ["iad1"] }
```

Antes y después, medir con el log del 436: `msEnBase / consultas` por petición (la ida y vuelta promedio). Si
`functionFailoverRegions` no está en el plan, se deja solo `regions`.

**2. Pool del pooler.** En Supabase › Database › Settings › Connection pooling, leer el `Pool Size` y el `Max client
connections` actuales (los fija el tamaño del cómputo) y anotarlos aquí. Subir `Pool Size` solo si la cuenta de abajo
lo pide; nunca por encima de `max_connections` menos lo reservado.

**3. La cuenta** (va a AGENTS.md › Contratos con el 445):

```
max_connections de Postgres                       60
− reservadas por Supabase y sus servicios        ~12   (medir: pg_stat_activity por usename en reposo)
− conexión directa (migraciones, scripts)          3
= backends disponibles para el pooler             ~45  → Pool Size ≤ 40

Clientes: instancias de función × MAX_CONEXIONES_POR_PROCESO (435: 5)
  hoy: 5 personas, picos de ~4 instancias → 20 clientes
  tope del pooler (Max client connections): anotar
```

Regla: en modo transaction un cliente solo ocupa un backend mientras dura su consulta o transacción, así que el límite
real es **consultas simultáneas ≤ Pool Size**. Por eso el presupuesto por render (436 a 439) es parte de esta cuenta:
un render de 846 consultas ocupa el pool 60 veces más que uno de 14.

## Done cuando
- [ ] `vercel.json` con `cle1` desplegado; ida y vuelta promedio por consulta antes y después, pegada aquí.
- [ ] `Pool Size` y `Max client connections` reales anotados; cambio de `Pool Size` hecho o descartado con la cuenta.
- [ ] Conexiones en reposo por rol (`select usename, count(*) from pg_stat_activity group by 1`) anotadas.
- [ ] La cuenta, con números reales, en AGENTS.md › Contratos (fila "Presupuesto de conexiones") y en
      `docs/operations.md`.
- [ ] 24 h sin `ECHECKOUTTIMEOUT` ni "too many clients" en `vercel logs`.
- [ ] Decisión 5 del estudio §10 (¿cambiar de plan o de pooler?) respondida con estos números.
