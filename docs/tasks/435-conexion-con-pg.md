---
id: 435
etapa: rendimiento
serves: "Ticket 243 (causa raíz) · docs/estudio-rendimiento-y-conexion.md §3, §5.1 y §13.1 · ADR 0047 (enmienda)"
depends: []
status: todo
---

# 435 — La app se conecta con `pg`: un pool por proceso, sin cuelgues por el pooler

## Qué
Cambiar el driver de `postgres` (postgres-js) a `pg` (node-postgres) en `lib/db/`, con **un solo pool por proceso**,
tamaño acotado y cierre de conexiones ociosas. Cierra el 243.

## Por qué (medido el 14-nov, estudio §13.1 y §13.4)
- `postgres-js` con `prepare: false` manda cada consulta con parámetros en dos idas y el pooler en modo transaction
  suelta la conexión en medio: cuelgue de 300 s o parámetros cruzados. Control del 14-nov: colgada en la ronda 1.
- `pg` manda Parse + Bind + Describe + Execute + Sync en una ida (`node_modules/pg/lib/query.js`, `submit`): 12 de 12
  rondas en paralelo, 6 de 6 en serie, 104 de 105 rondas de transacciones, 0 diferencias de tipos en Nerd Stats.
- Hoy el proceso abre **más de un pool** (15 conexiones en un proceso de producción; en `next dev` agota las 100 del
  Postgres local), porque `instancia` vive en el módulo y el módulo se instancia más de una vez.

## Archivos
`lib/db/index.ts` · `lib/db/cliente-de-script.ts` · `lib/db/tipos.ts` · `package.json` + lock ·
`tests/abonos-concurrencia-postgres.test.ts` · `tests/base-portable.test.ts` (lista `PROHIBIDOS`) ·
`docs/adr/0047-*.md` y `docs/adr/README.md` (enmienda, N8) · `AGENTS.md` (párrafo "La base es Supabase…").
Nadie más importa el driver (ADR 0047 punto 8; verificado con `grep 'from "postgres"'`).

## Cómo

`lib/db/index.ts` (boceto; conserva el `Proxy` perezoso y el comentario de por qué es perezoso):

```ts
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { attachDatabasePool } from "@vercel/functions";
import * as schema from "./schema";
import { loggerDeConsultasMcp } from "@/lib/mcp/contador-de-consultas";

type DB = ReturnType<typeof crear>;

/** Tope de conexiones de ESTE proceso. La cuenta completa vive en AGENTS.md › Contratos (ticket 441). */
const MAX_CONEXIONES_POR_PROCESO = 5;

// Un pool por PROCESO, no por copia del módulo: Next instancia `lib/db` más de una vez (páginas y route
// handlers) y `next dev` lo recarga en cada cambio. Medido el 14-nov: 15 conexiones en un proceso de
// producción y "too many clients" en dev. `globalThis` es lo único que comparten todas las copias.
const global = globalThis as unknown as { __retiaDb?: DB };

function crear() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("Falta DATABASE_URL. …");
  const pool = new Pool({
    connectionString,
    max: MAX_CONEXIONES_POR_PROCESO,
    idleTimeoutMillis: 5_000,          // Vercel: ociosas se cierran pronto (guía de connection pooling)
    connectionTimeoutMillis: 10_000,   // sin conexión en 10 s se falla con error, no se cuelga
  });
  // Un error en una conexión ociosa no puede tumbar el proceso.
  pool.on("error", (error) => console.error("[db] conexión ociosa:", error.message));
  attachDatabasePool(pool);            // cierra ociosas antes de que Vercel suspenda la instancia
  return drizzle(pool, { schema, logger: loggerDeConsultasMcp });
}

export const db = new Proxy({} as DB, {
  get(_, prop) {
    global.__retiaDb ??= crear();
    const valor = Reflect.get(global.__retiaDb, prop);
    return typeof valor === "function" ? valor.bind(global.__retiaDb) : valor;
  },
});
```

`lib/db/tipos.ts`:

```ts
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
export type Db = NodePgDatabase<typeof schema> | PgliteDatabase<typeof schema>;
```

`lib/db/cliente-de-script.ts`: `Pool` con `max: 2`; la puerta de SQL crudo pasa de `cliente.unsafe(texto, params)` a
`(await pool.query(texto, params)).rows`; `cerrar: () => pool.end()`.

Cosas que cambian de forma y hay que revisar una por una:
1. **`db.execute(sql…)`** (2 usos en `lib/`, `app/`, `scripts/`): con `postgres-js` devuelve el arreglo de filas; con
   `node-postgres` devuelve `{ rows }`. PGlite también devuelve `{ rows }`. Deja un helper `filasDe(resultado)` si
   hace falta que sirva para los dos.
2. **Tipos devueltos por SQL crudo:** `count(*)` sin `::int` llega como texto en los dos drivers; `numeric` como
   texto; `timestamptz` en una plantilla `sql` sin `mapWith` puede llegar como `Date` (pg) donde antes era texto.
   Busca `sql<` con `timestamp`, `date` y `numeric` y compara una fila real antes y después.
3. **`ejecutarJuntas` y `db.transaction`:** sin cambio de código; drizzle toma un cliente del pool para la transacción.
4. **Scripts:** siguen saliendo con `process.exit` (el pool queda abierto).
5. **SSL:** el pooler acepta la misma URL; no agregues `ssl` salvo que el bucle falle por eso.

## Guardián (lo que evita que vuelva)
`tests/conexion-pooler.test.ts`, que corre solo con `DATABASE_URL_PRUEBA_POSTGRES` (como
`tests/abonos-concurrencia-postgres.test.ts`): 20 rondas de 10 transacciones concurrentes más 50 consultas con
parámetros en paralelo; cada consulta devuelve su propio parámetro y el test falla si llega otro o si una ronda pasa
de 15 s. Y un guardián de código: `import … from "postgres"` o `new Pool(` fuera de `lib/db/` falla
(amplía `tests/base-portable.test.ts`).

## Done cuando
- [ ] `npm run typecheck`, `npm run lint` y los tests del cambio en verde; el CI completo verde (incluye Postgres real).
- [ ] **El bucle del estudio §3.3 contra producción, con el cliente nuevo por 6543: 30 rondas de las 5 funciones de
      Nerd Stats en paralelo y 60 rondas de transacciones, 0 cuelgues y 0 parámetros cruzados.** Lo corre la sesión
      principal (solo lectura) y pega la salida aquí.
- [ ] Un proceso de `next start` contra la base local, tras recorrer todas las rutas, tiene ≤ 5 conexiones
      (`select count(*) from pg_stat_activity`). `next dev` tras 200 peticiones: ≤ 5.
- [ ] `/nerd-stats`, `/p/[programa]/programa` y `POST /api/salud/alertas` responden en producción; 24 h sin 504 en
      `vercel logs --status-code 5xx`.
- [ ] `postgres` fuera de `package.json` (N7); ADR 0047 enmendado en el mismo commit (título, índice, punto 1 y la
      nota de `prepare: false`); AGENTS.md actualizado.
- [ ] Ticket 243 cerrado con referencia a este; tracker y `status:` iguales (N9).

## Riesgos
- El error no capturado de 1 en 105 rondas de transacciones (estudio §13.1): el guardián imprime el error completo.
- `@vercel/functions` es dependencia nueva: se instala en este ticket porque aquí se usa (ADR 0006).
- No tocar variables de Vercel: `DATABASE_URL` sigue siendo el pooler 6543.
