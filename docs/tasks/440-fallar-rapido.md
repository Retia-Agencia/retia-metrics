---
id: 440
etapa: rendimiento
serves: "docs/estudio-rendimiento-y-conexion.md §7 (tiempo máximo) y §8.8 · contrato de rendimiento"
depends: [435]
status: done
---

# 440 — Una petición lenta falla en segundos y con mensaje, no a los 300

## Qué
Topes de tiempo en tres capas: la consulta (`statement_timeout`), la espera por conexión (`connectionTimeoutMillis`)
y la función (`maxDuration`), con un error que la persona entiende.

## Por qué
- Hoy una página colgada espera los 300 s por defecto de Vercel y responde un 504 sin mensaje. Solo 4 archivos de
  `app/` declaran `maxDuration`.
- El `statement_timeout` del rol es de 2 minutos (medido el 14-nov): una consulta puede retener una conexión del
  pooler todo ese tiempo, y el pooler reparte ~15.

## Archivos
`lib/db/index.ts` · `app/(app)/layout.tsx` (o cada `page.tsx`, según lo que admita Next 16: lee
`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route-segment-config.md`) · `app/api/**/route.ts`
· `app/(app)/error.tsx` · `lib/errors.ts` · `tests/tiempo-maximo-guardian.test.ts` (nuevo).

## Cómo

**1. Tope por consulta, en la conexión de la app** (no en el rol: los scripts y las migraciones necesitan más):

```ts
const pool = new Pool({
  connectionString,
  max: MAX_CONEXIONES_POR_PROCESO,
  idleTimeoutMillis: 5_000,
  connectionTimeoutMillis: 10_000,
  statement_timeout: 15_000,   // pg lo manda como parámetro de arranque
});
```

⚠️ El pooler en modo transaction puede **no respetar** parámetros de arranque ni un `SET` de sesión (la conexión
cambia entre consultas). Pruébalo contra producción con `select pg_sleep(20)` por 6543: tiene que cortar a los 15 s.
Si no corta, usa `query_timeout: 15_000` de `pg` (corta en el cliente) y, para las transacciones,
`SET LOCAL statement_timeout` al abrirlas. Deja escrito cuál funcionó y por qué.

**2. Tope por función.** Páginas: `export const maxDuration = 30`. Rutas de máquina y webhooks: 60 (ya lo tienen los
webhooks). Crons que hablan con Meta, Calendly o Grain: conservan 300. Un solo lugar para los números:

```ts
// lib/tiempos.ts
/** Segundos. Una página que tarda más que esto está rota: se corta y se dice. */
export const MAX_SEGUNDOS_PAGINA = 30;
export const MAX_SEGUNDOS_MAQUINA = 60;
export const MAX_SEGUNDOS_CRON = 300;
```

⚠️ Next exige que `maxDuration` sea un literal analizable estáticamente: comprueba en la documentación si acepta una
constante importada; si no, el número va literal en cada archivo y el guardián compara contra `lib/tiempos.ts`.

**3. El error que se ve.** Un timeout de consulta (código Postgres `57014`) o de conexión se traduce en
`lib/errors.ts` a un `ErrorDeApp` con texto para la persona ("La consulta tardó demasiado. Vuelve a intentarlo.") y
`app/(app)/error.tsx` lo muestra con un botón de reintentar. Sin texto técnico (N5). Agrega `esTiempoAgotado` a
`lib/db/errores.ts` junto a `esViolacionUnica` (no copies el bucle de `cause`).

## Guardián
`tests/tiempo-maximo-guardian.test.ts`: todo `page.tsx` y todo `route.ts` de `app/` declara `maxDuration` o lo hereda
de un layout, con un valor ≤ al de su clase; excepciones nombradas (los crons). Mordido en los dos sentidos, como
`tests/loading-guardian.test.ts`.

## Done cuando
- [x] `select pg_sleep(20)` por el cliente de la app contra producción corta a los ~15 s con el error traducido.
      _Medido el 15-nov por el pooler 6543: el parámetro de arranque `statement_timeout` y `options=-c ...` los IGNORA el pooler (cortó a 20,5 s y 20,7 s). Lo que funciona: `query_timeout: 15_000` del cliente (cortó a 15,5 s, "Query read timeout"; la consulta sigue viva en el servidor) y `SET LOCAL statement_timeout` dentro de las transacciones (57014 a 16,1 s), que `aplicarTopeEnTransacciones` aplica tras cada `begin`._
- [x] Con el pool lleno (prueba local: `max: 1` y dos consultas lentas), la segunda falla a los 10 s con error, no se
      cuelga. _(medido: 10,0 s, "timeout exceeded when trying to connect")_
- [x] Una página con una consulta lenta forzada en `dev:local` muestra el mensaje y el botón de reintentar.
      _(visto el 15-nov: `/perfil` con `pg_sleep` y tope de 2 s muestra "No pudimos cargar esta pantalla" y Reintentar)_
- [x] Guardián verde y mordido; typecheck, lint, tests del cambio, build; tracker y `status:` iguales.
