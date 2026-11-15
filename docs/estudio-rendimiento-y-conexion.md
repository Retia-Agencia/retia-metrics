# Estudio: conexión a la base, rendimiento de consultas y navegación

> **Estado:** hallazgos del 14-nov (sesión del ticket 243), **sin plan aprobado ni código**. Es el insumo de una sesión
> propia de estudio y diseño. Rango N8: documento de investigación; manda el código sobre qué hace hoy, y un ADR o un
> ticket sobre qué debería hacer. Toda cifra de aquí se midió contra producción **solo con lecturas**, con scripts
> desechables que ya se borraron; lo que es inferencia lo dice ("*sin fuente verificada*").

## 0. Cómo retomar

Abrir una sesión nueva en este repo y pegarle esto:

> Lee `AGENTS.md` y `docs/estudio-rendimiento-y-conexion.md` completo. Es el insumo de un estudio de rendimiento del
> CRM con tres frentes: (1) arreglar la conexión a la base (causa raíz del ticket 243; Mani se inclina por el driver
> `pg`), (2) optimizar las consultas y la navegación actuales, y (3) definir un contrato de rendimiento para todo lo
> nuevo, que aguante concurrencia de usuarios, muchas peticiones y crecimiento. Empieza por la §9 (lo que falta medir)
> y la §10 (decisiones abiertas): mide antes de proponer, y proponme el orden de trabajo y los tickets antes de tocar
> código. El código lo implementa Codex (`/delegate`); las migraciones y el cambio de variables en Vercel los hago yo.

Orden sugerido para esa sesión, cada paso con su forma de verificar:

1. **Conexión (bloqueante, va primero):** reproducir el bucle de la §3.3 contra producción, prototipar `pg` en una rama
   y correr el mismo bucle hasta que dé 0 cuelgues y 0 parámetros cruzados (§5). Sin esto, toda medición de
   rendimiento está contaminada por cuelgues de 300 s.
2. **Inventario medido:** cuántas consultas y cuánto tiempo cuesta renderizar cada una de las 37 páginas (§9.1).
3. **Arreglos por patrón** (N+1, conteos sobre todo, prefetch), de mayor a menor costo medido (§6, §7).
4. **Contrato** (§8) escrito en `AGENTS.md` › Contratos, con su guardián en `tests/`, igual que los demás.

## 1. Resumen

- **El síntoma:** `/nerd-stats` se queda cargando y a los 300 s Vercel responde **504 `FUNCTION_INVOCATION_TIMEOUT`**
  (reproducido el 14-nov 21:10 con la sesión de Mani). El 14-oct el mismo origen dio otra cara:
  `invalid input syntax for type bigint: "f"` (22P02). Las dos son el mismo bug.
- **La causa raíz no es de Nerd Stats: es la conexión.** El pooler de Supabase en modo *transaction* (Supavisor, puerto
  6543) rompe las consultas con parámetros que `postgres-js` manda en dos idas cuando `prepare: false` (§3).
- **Alcance:** toda pantalla y ruta que consulte con parámetros, y más mientras más consultas haga. Explica los 504 de 7
  días en `/p/[programa]/programa`, `/api/salud/alertas` y `/api/salud/cierre` (§4).
- **Encima de eso, hay un problema de rendimiento propio:** renderizar `/nerd-stats` son **52 consultas y ~10 s** sobre
  tablas de menos de 71.000 filas. El volumen no es el problema; lo son las idas y vueltas y los patrones N+1 (§6).
- **Y la navegación multiplica la carga:** abrir la app dispara ~20 renders completos de páginas en 2 s (prefetch), cada
  uno con sus consultas (§7).

## 2. Cronología del incidente

| Fecha | Qué pasó | Fuente |
|---|---|---|
| 14-oct 00:20 | `GET /nerd-stats` falla con `22P02 invalid input syntax for type bigint: "f"` sobre `limit $1`, con `params: [8]` del lado de la app | Ticket 243, "Lo medido" |
| 14-oct | La consulta sola funciona 3 de 3 veces; las seis juntas desde un script local "se quedaron colgadas más de 7 minutos" | Ticket 243 |
| 9-nov | Se borra `ultimasCorridasDeSync` (la consulta del error de octubre) con el 401 M13 | `git show 5e368505` |
| 14-nov 16:50 a 20:33 | 50 peticiones `GET /nerd-stats`, todas 200 en los logs | `vercel logs --query nerd-stats` |
| 14-nov 21:04:13 y 21:04:38 | Dos `GET /nerd-stats` sin respuesta (status 0): Mani la abre y se queda cargando | `vercel logs`, ids `bj6zc-…` y `brhzk-…` |
| 14-nov ~21:10 | Abierta desde el navegador del agente con la sesión de Mani: **504 a los 300 s**. `/nerd-stats/bitacora` entrando directo carga | Navegador del agente |

🩸 **Lección de diagnóstico:** "200 en los logs de hoy" no prueba nada en un fallo intermitente, y un 504 por tiempo no
deja mensaje de error: buscar `22P02` en los logs dio 0 aunque el bug estaba vivo. Para este tipo de fallo, la única
prueba es un bucle que lo reproduzca (§3.3).

## 3. Causa raíz: el pooler en modo transaction y las dos idas de `postgres-js`

### 3.1 La configuración de hoy

`lib/db/index.ts`:

```ts
// Supabase (ADR 0047). La app entra por el pooler en modo *transaction* (puerto 6543)...
const cliente = postgres(connectionString, { prepare: false });
return drizzle(cliente, { schema, logger: loggerDeConsultasMcp });
```

- `DATABASE_URL` → `aws-0-us-east-2.pooler.supabase.com:6543` (Supavisor, modo transaction).
- `DATABASE_URL_DIRECTA` → el mismo host en `:5432` (Supavisor, modo sesión), que hoy usa solo `drizzle-kit`.
- Versiones: `postgres` 3.4.9, `drizzle-orm` 0.45.2, `next` 16.4.6. Postgres 17.6, `max_connections` = **60**.
- El driver solo se importa en `lib/db/` (`index.ts`, `cliente-de-script.ts`, `tipos.ts`): ADR 0047 punto 8 se cumple, y
  eso hace que cambiar de driver sea un cambio localizado.

### 3.2 El mecanismo, en el código de `postgres-js`

Con `prepare: false`, **toda consulta con parámetros** se manda en dos idas
(`node_modules/postgres/cjs/src/connection.js`):

```js
// :238  describeFirst = true para toda consulta con parámetros que no esté preparada
q.describeFirst = q.onlyDescribe || (parameters.length && !q.prepared)

// :185  primera ida: Parse + Describe + Flush (sin Sync)
: q.describeFirst
  ? Buffer.concat([describe(q), Flush])

// :633  cuando Postgres devuelve los tipos de los parámetros, segunda ida: Bind + Execute
query.describeFirst && !query.onlyDescribe && (write(prepared(query)), query.describeFirst = false)
```

El pooler en modo transaction asigna un backend de Postgres por transacción y lo devuelve cuando la transacción
termina. Entre la primera ida y la segunda **no hay `Sync`**, y lo que medimos (§3.3) es compatible con que Supavisor
entregue la conexión a otro backend en ese hueco (*sin fuente verificada en su documentación: es inferencia sobre la
medida*). Las dos consecuencias observadas:

1. **Parámetros cruzados:** el `Bind + Execute` llega a un backend donde la sentencia sin nombre es la de otra consulta.
   De ahí el `"f"` (un booleano de otra consulta) como `limit $1` el 14-oct, y el `"calendly"` como `uuid` el 14-nov.
2. **Cuelgue:** el backend que recibió el `Parse + Describe` se queda esperando el resto del mensaje para siempre. La
   función no responde y Vercel la corta a los 300 s.

### 3.3 La evidencia (el bucle que lo reproduce)

Todas las corridas desde la máquina de Mani contra producción, solo lectura, llamando las funciones reales de
`lib/queries/nerd-stats.ts` con un cliente de drizzle igual al de la app:

| Prueba | Resultado |
|---|---|
| Cada consulta de la página, una por una, por 6543 | Todas terminan; la más lenta `saludDeFuentes`, 6 a 8 s |
| Las cinco funciones de la página en `Promise.all`, por 6543 | Ronda 1 ok, luego **cuelgue** (en todas las corridas), y una vez `22P02 invalid input syntax for type uuid: "calendly"` (`where: unnamed portal parameter $1`) |
| Igual, con `max_pipeline: 1` | Cuelga igual: el pipelining **no** es la causa |
| **Una sola conexión y consultas en serie** (`max: 1, max_pipeline: 1`), por 6543 | **Cuelga en la ronda 1**: no es la concurrencia de la página; basta con la carga de los demás clientes del pooler |
| Las cinco en `Promise.all`, por 5432 (modo sesión) | 5 de 5 rondas ok |
| Dos páginas a la vez (10 funciones), por 5432, 6 rondas | **0 fallos** |
| Las consultas de la Bitácora en paralelo, por 6543 (con `postgres` crudo, `sql\`\``) | 5 de 5 ok (sus consultas son pocas; el fallo es probabilístico) |

`pg_stat_activity` leído por 5432 **durante** un cuelgue:

```
active  Client  ClientRead  45s  select count(*) from "lead_contactos" inner join "leads" ... left join ...
active  Client  ClientRead  45s  select "id" from "sources" where ("sources"."activo" = $1 and "sources"."estado" = $2)
```

`active` + `ClientRead` = Postgres está a mitad de una consulta esperando bytes del cliente que nunca llegan.

El arnés, para repetirlo (un script desechable en `scripts/`, se corre con `npx tsx` y se borra; AGENTS.md › 🔑):

```ts
import "./load-env";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "@/lib/db/schema";
import * as q from "@/lib/queries/nerd-stats";

async function main() {
  const url = process.argv[2]; // DATABASE_URL (6543) o DATABASE_URL_DIRECTA (5432)
  const db = drizzle(postgres(process.env[url]!, { prepare: false }), { schema }) as any;
  for (let r = 1; r <= 8; r++) {
    const a = Date.now();
    const res = await Promise.race([
      Promise.allSettled([q.conteosPorPrograma(db), q.fuentesConSalud(db), q.conteosPorOrigen(db),
        q.ultimosCambiosDesdeLaApp(15, db), q.usuariosActivosPorRol(db)]),
      new Promise((ok) => setTimeout(() => ok("colgado"), 90_000)),
    ]);
    if (res === "colgado") { console.log("ronda", r, "COLGADA"); break; }
    const errs = (res as PromiseSettledResult<unknown>[]).filter((x) => x.status === "rejected");
    console.log("ronda", r, Date.now() - a, "ms", errs.length ? errs.map((e: any) => e.reason?.cause?.message) : "ok");
  }
  process.exit(0);
}
main();
```

⚠️ Dos trampas que salieron armándolo: `tsx` compila a CJS y **no acepta `await` de nivel superior** (va dentro de
`main()`), y un regex con `\s` dentro de una plantilla `sql` pierde el backslash (AGENTS.md › Arquitectura): para
limpiar espacios en `pg_stat_activity` usa `[[:space:]]`.

## 4. Alcance: qué más está afectado

**Los 5xx de producción en 7 días** (`vercel logs --status-code 5xx --since 7d`, 14-nov):

| Ruta | Error | Relación |
|---|---|---|
| `GET /p/comunicate-confianza/programa`, `POST /p/liderarte/programa` | 504 a los 300 s | Llaman `saludDeFuentes` (`lib/queries/ficha-programa.ts:238`) |
| `POST /api/salud/alertas` | 504 a los 300 s | `saludDeFuentes` (`lib/alertas/registro.ts:90`) |
| `POST /api/salud/cierre` | 504 a los 300 s | `saludDeFuentes` (`lib/salud/cierre.ts:28`) |
| `GET /api/cron/calendly` | 500 diario: `Cannot read properties of undefined (reading 'ownerUserId')` | **Otro bug**, no de conexión (§11) |

**`saludDeFuentes` es el factor común de todos los 504.** Tiene sentido: es la función que más consultas lanza (29, §6),
así que es la que más veces se juega la lotería del §3.2. Sus llamadores (todos expuestos):

`app/(app)/ajustes/salud/page.tsx:99` · `components/mi-espacio/tab-por-decidir.tsx:40` ·
`lib/queries/ficha-programa.ts:238` · `lib/queries/nerd-stats.ts:194` · `lib/alertas/registro.ts:90` ·
`lib/salud/cierre.ts:28` · `lib/reporte-whatsapp/vista-previa.ts:37` · `app/api/semaforo/envios/route.ts:96`.

**Superficie del patrón de consultas en paralelo:** `Promise.all` aparece 41 veces en 23 archivos de `app/`, 167 en 97
de `lib/` y 7 en 5 de `components/`. No es el disparador (el cuelgue ocurre también en serie), pero multiplica cuántas
consultas por petición se exponen.

**Lo que no está probado:** si `db.transaction` (89 usos en `lib/`, `app/` y `scripts/`) también se ve afectado. Dentro
de una transacción el backend queda fijo, así que en teoría no; *sin fuente verificada*, hay que medirlo (§9).

## 5. Opciones para la conexión

### 5.1 Driver `pg` (node-postgres) por el pooler en modo transaction (la que prefiere Mani)

**La idea:** `pg` manda una consulta con parámetros como `Parse + Bind + Describe + Execute + Sync` de una vez, sin
esperar los tipos, así que no hay un hueco donde el pooler suelte la conexión. *Sin fuente verificada: confirmarlo
leyendo `node_modules/pg/lib/query.js` (`prepare`) y `pg-protocol` tras instalarlo, y sobre todo con el bucle del §3.3.*

**Lo que cambia** (localizado gracias al ADR 0047 punto 8):

- `lib/db/index.ts`: `drizzle-orm/node-postgres` con un `Pool` de `pg`.
- `lib/db/cliente-de-script.ts`: lo mismo para los scripts de medición (y su puerta de SQL crudo, que hoy usa
  `cliente.unsafe`).
- `lib/db/tipos.ts`: `Db = NodePgDatabase<typeof schema> | PgliteDatabase<typeof schema>`.
- `package.json`: `pg` y `@types/pg`; quitar `postgres` si nadie más lo usa (N7).
- ADR 0047: enmienda del punto 1 (driver) y la nota del 🩸 sobre `prepare: false`, en el mismo commit (N8).

**Riesgos que hay que medir antes de mezclar:**

1. **Tipos devueltos.** `pg` y `postgres-js` no convierten igual: `bigint`/`count(*)` sin cast, `numeric`, `date`,
   `timestamptz`, `jsonb`, arreglos. El código ya castea muchos conteos a `::int`, pero hay que buscar cada lectura que
   dependa del tipo. Un número que llega como texto **no lanza error**: concatena o compara mal. Guardián candidato:
   correr la suite contra Postgres real (`DATABASE_URL_PRUEBA_POSTGRES`, que ya existe en el CI) con el driver nuevo.
2. **Transacciones.** `db.transaction` de drizzle funciona igual sobre `node-postgres` (*sin fuente verificada para
   0.45.2*); `ejecutarJuntas` no debería cambiar.
3. **Pool en serverless.** Tamaño del `Pool` por instancia, `idleTimeoutMillis`, y en Vercel Fluid,
   `attachDatabasePool` de `@vercel/functions` para cerrar conexiones ociosas al suspender la instancia (*sin fuente
   verificada; buscarlo en la documentación de Vercel*).
4. **PGlite no ve nada de esto:** la prueba de verdad es el bucle del §3.3 contra Supabase, más la suite contra Postgres
   real del CI.

### 5.2 Modo sesión (5432) con `postgres-js`

- **A favor:** es la única opción ya probada (0 fallos, §3.3) y es un cambio de una variable.
- **En contra, y es serio:** en modo sesión cada conexión de cliente toma un backend entero mientras vive.
  `max_connections` = 60 (con 12 ocupadas en reposo por Supabase y el pooler). Con el `max` por defecto de `postgres-js`
  (10) bastan unas 5 instancias de función a la vez para agotarlo, y entonces la app falla con "too many clients"
  (*sin fuente verificada el texto exacto de Supavisor*). Con `max` 2 o 3 y `idle_timeout` corto alcanza para el tráfico
  de hoy (5 usuarios), pero es el techo de escala que el estudio quiere evitar.

### 5.3 Otras a evaluar

- **`prepare: true` con nombres:** no sirve en modo transaction (por eso el ADR 0047 puso `false`).
- **Un pooler distinto** (el PgBouncer dedicado de Supabase, en planes pagos): *sin fuente verificada*; preguntar si el
  plan lo incluye.
- **Reintento ante 22P02:** no. Esconde el síntoma y no cubre el cuelgue.

## 6. Rendimiento de las consultas

### 6.1 Lo medido

Por 5432 (sin cuelgues), desde la máquina local (una ida y vuelta `select 1` = **109 ms**; en producción la función
corre en `iad1` y la base en `us-east-2`, mucho más cerca, así que los tiempos absolutos de Vercel serán menores: hay
que medirlos allá, §9):

| Función | Consultas | Tiempo |
|---|---:|---:|
| `conteosPorPrograma` | 19 | 1,7 s |
| `saludDeFuentes` | 29 | 5,6 s |
| `fuentesConSalud` (envuelve la anterior) | 30 | 6 a 10 s |
| **Render completo de `/nerd-stats`** | **52** | **~10,5 s** |

Las tablas son chicas (`pg_stat_user_tables`, 14-nov): `change_log` 70.252 filas, `entregas_webhook` 8.966,
`sobres_crudos` 8.960, `lead_contactos` 8.363, `submissions` 6.790, `deal_etapa_historial` 6.739, `deals` 4.159,
`leads` 4.157. **El costo no es el volumen: son las idas y vueltas, y alguna consulta lenta dentro de
`saludDeFuentes`** (29 consultas × 109 ms explican ~3 s de los 5,6). Falta el `EXPLAIN ANALYZE` de cada una (§9).

### 6.2 Patrones N+1 encontrados (una consulta por elemento de una lista)

**a) `conteosPorPrograma` llama la lista completa de duplicados de cada programa** (`lib/queries/nerd-stats.ts:84`):

```ts
const unidos = new Map(await Promise.all(lista.map(async (p) => {
  const { filas } = await posiblesDuplicadosDelPrograma(db, p.id, { porPagina: Number.MAX_SAFE_INTEGER });
  return [p.id, new Set(filas.map((f) => f.leadId)).size] as const;
})));
```

Trae **todas las filas** de cada programa para contarlas en memoria. Con 5 programas son 5 llamadas, cada una con sus
propias consultas. La regla de "una respuesta, un módulo" (AGENTS.md) obliga a reusar el predicado, pero se puede
reusar como conteo en SQL en vez de como lista.

**b) `saludDeFuentes`: el penúltimo envío, una consulta por fuente** (`lib/queries/salud-fuentes.ts:209`):

```ts
const penultimoDe = new Map(await Promise.all(fuentes.map(async (f) => {
  const [fila] = await db.select({ penultimo: max(submissions.createdAt) }).from(submissions)
    .where(and(eq(submissions.sourceId, f.sourceId), lt(submissions.createdAt, ultimo)));
  ...
})));
```

Una sola consulta con una función de ventana (`row_number() over (partition by source_id order by created_at desc)`)
devuelve último y penúltimo de todas las fuentes.

**c) `saludDeFuentes`: árbol de pauta y alarmas de Calendly, una tanda por programa** (`:178` y `:181`):
`arbolDePauta(db, programId)` y `alarmasCalendly(db, programId, ahora)` dentro de `programas.map`. Medir cuántas
consultas lanza cada una.

**d) `saludDeFuentes` trae todos los envíos de las últimas 24 h con sus UTM** para clasificarlos en memoria
(`enviosRecientes`). A la escala de hoy es poco; crece con el tráfico de pauta.

### 6.3 Lo que no hay

- **Ninguna caché de datos:** una sola coincidencia de `unstable_cache`/`"use cache"`/`cache(` en `app/` y `lib/`.
  32 páginas declaran `export const dynamic = "force-dynamic"`. Toda visita recalcula todo.
- **Ningún presupuesto por pantalla:** nada mide ni limita cuántas consultas o milisegundos cuesta un render. El
  `loggerDeConsultasMcp` (`lib/mcp/contador-de-consultas.ts`) ya cuenta consultas para el MCP: es el punto de partida
  natural para medir las páginas.

## 7. Navegación y carga entre el navegador y el servidor

- **Ráfaga de prefetch medida:** al entrar a la app (14-nov 21:04:39 a 21:04:41) llegan ~20 `GET` de páginas completas
  en 2 s: `/`, `/mi-espacio`, `/ajustes`, `/media` y las 10 pestañas del programa (`hub`, `leads`, `deals`, `calls`,
  `inbox`, `students`, `proxima-cohorte`, `programa`, `recursos`). Son renders del servidor (`source: serverless`), con
  sus consultas, de pantallas que el usuario quizá nunca abre. Con el bug del §3 cada una es una lotería más; sin él,
  sigue siendo carga multiplicada por usuario. *Hipótesis: es el prefetch por defecto de `<Link>` del menú lateral y de
  `components/layout/pestanas.tsx`; confirmarlo en `node_modules/next/dist/docs/` (la versión 16 cambió el prefetch) y
  con la pestaña de red del navegador.*
- **`experimental.staleTimes.dynamic = 15`** (`next.config.ts`): volver a una pestaña dentro de 15 s sale del caché del
  cliente. Ayuda a A→B→A, no a la primera visita.
- **El contrato de `loading.tsx`** (AGENTS.md › Contratos) da respuesta visual inmediata, pero no reduce el trabajo del
  servidor.
- **Tiempo máximo de función:** las páginas usan el de Vercel por defecto (300 s); solo los webhooks (60 s) y dos crons
  (300 s) lo declaran. Un render que tarda más de unos segundos debería fallar rápido y con un mensaje, no colgar 5
  minutos. Candidato: `statement_timeout` en la conexión de la app y `maxDuration` corto en las páginas.

## 8. Contrato de rendimiento (borrador para decidir en la sesión)

Lo que se propone discutir, en el molde de los demás contratos (estándar, dónde vive, cómo se enforza):

1. **Conexión.** Un solo cliente en `lib/db/`, compatible con el pooler en modo transaction, con un bucle de
   concurrencia contra Postgres real que lo vigile en el CI (el del §3.3, reducido).
2. **Presupuesto por render.** Toda página y ruta tiene un tope de consultas y de tiempo; un test cuenta las consultas
   con un logger de drizzle sobre la base de prueba y falla al pasarse. Cifras a decidir con la medición del §9.1.
3. **Prohibido el N+1.** Una consulta por elemento de una lista (`lista.map(async … db.select …)`) es el olor; el
   guardián lo caza leyendo el código, como `tests/vigencia-centralizada.test.ts`. Excepciones nombradas.
4. **Contar en SQL, no en memoria.** Una cifra que es un conteo no trae las filas para contarlas
   (`porPagina: Number.MAX_SAFE_INTEGER` es el olor).
5. **Índices justificados con `EXPLAIN` a 10× el volumen de hoy** (ya lo pide C-2 para las métricas; se extiende a toda
   consulta).
6. **Caché con dueño.** Lo que no cambia por usuario ni por minuto (catálogos, árbol de pauta) se cachea con una
   invalidación explícita; lo que sí cambia, nunca. Hay que decidir el mecanismo con la documentación de Next 16.
7. **Prefetch decidido, no por defecto.** Qué enlaces precargan y cuáles no.
8. **Fallar rápido.** `statement_timeout` y `maxDuration` acotados: un render no espera 300 s.
9. **Escala.** Presupuesto de conexiones: (instancias de función × tamaño del pool) ≤ lo que admite el pooler, con la
   cuenta escrita y revisada cuando crezcan los usuarios.

## 9. Lo que falta medir

1. **Inventario por página:** consultas y milisegundos de render de las 37 `page.tsx` y de las rutas de `app/api/`, con
   el logger de drizzle, por 5432 para que el §3 no contamine. Tabla ordenada por costo.
2. **`EXPLAIN (ANALYZE, BUFFERS)`** de las consultas de `saludDeFuentes` y de las páginas más caras.
3. **Tiempos en Vercel, no en local:** la latencia local (109 ms por ida y vuelta) infla todo. Medir en producción
   (`vercel logs` con duración, o un log temporal etiquetado).
4. **`pg` contra el bucle del §3.3:** 0 cuelgues y 0 parámetros cruzados en N rondas, por 6543.
5. **¿`db.transaction` también cuelga por 6543?** Bucle con transacciones concurrentes.
6. **El prefetch:** confirmar qué lo dispara y cuánto pesa por usuario.
7. **Carga concurrente:** varias sesiones a la vez contra un despliegue de prueba para ver el techo real (cuidado: la
   base es producción, AGENTS.md; solo lecturas).

## 10. Decisiones abiertas (de Mani)

1. **Driver `pg` o modo sesión** (§5). Mani se inclina por `pg` (14-nov); falta la medición del §9.4.
2. **Presupuestos concretos** del contrato (consultas y ms por render).
3. **Qué se cachea** y con qué frescura (las cifras del Hub tienen la regla de "métricas dinámicas": la meta del día
   descuenta las ventas de hoy).
4. **Prefetch:** qué pantallas precargan.
5. **¿Cambiar de plan de Supabase o de pooler?** Solo si la medición lo pide.

## 11. Otros hallazgos de la misma revisión

- **`/api/cron/calendly` falla todos los días** (8 al 14-nov) con
  `TypeError: Cannot read properties of undefined (reading 'ownerUserId')`. Bug propio, sin relación con la conexión.
  Merece su ticket.
- **El ticket 243** queda con la causa raíz escrita; su arreglo es el paso 1 del §0.

## 12. Referencias

- Ticket `docs/tasks/243-nerd-stats-revienta.md` (Avance del 14-nov).
- ADR 0047 (`docs/adr/0047-la-base-se-muda-a-supabase.md`), puntos 1, 2 y 8.
- `lib/db/index.ts`, `lib/db/cliente-de-script.ts`, `lib/db/tipos.ts`, `lib/db/ejecutar-juntas.ts`.
- `lib/queries/nerd-stats.ts`, `lib/queries/salud-fuentes.ts`, `lib/queries/leads.ts:407`.
- `node_modules/postgres/cjs/src/connection.js:185`, `:238`, `:455` (`max_pipeline`), `:633`.
- `next.config.ts` (`staleTimes`), `components/layout/pestanas.tsx`.
- AGENTS.md: Feedback loops, 🔑 tokens compartidos, "La base es Supabase…", "Rendimiento y escala", C-2.
- Logs: `vercel --scope team_ieTBizkH5rn0BsF2pQfi5X6C logs --project prj_7XSmQuw14kAiqB8B6IP4V9ITqVU8
  --environment production --json --since 7d --query <texto>` (el MCP de Vercel responde 403 para este proyecto; la
  CLI sí funciona). El límite es de 100 filas por llamada: filtra con `--query` o `--status-code` o te corta la ventana.
