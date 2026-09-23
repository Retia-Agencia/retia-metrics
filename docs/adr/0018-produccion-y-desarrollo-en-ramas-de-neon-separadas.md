# 0018 — Produccion y desarrollo usan ramas de Neon separadas

> ⛔ **REEMPLAZADO el 22-sep por el [ADR 0047](./0047-la-base-se-muda-a-supabase.md):** la base se mudó a
> Supabase, con dos proyectos (`dev` y producción) en vez de ramas de Neon. Se conserva como historia;
> sus reglas de disciplina (probar en `dev` primero, `DB_PROD` sin código que la lea, el ok de Mani para
> escribir en producción) siguen vigentes en el 0047.

**Fecha:** 2026-09-16 · **Estado:** aceptado y aplicado el 16-sep (S-14) · **Enmendado** el 16-sep
(ver "Enmienda" al final: la URL de `production` vive en `.env.local` como `DB_PROD`)

Hasta hoy un solo `DATABASE_URL` servia a todo: produccion en Vercel, los previews y el
`.env.local` de desarrollo. Cualquier `npm run db:migrate` o `npm run seed:datos` corrido en local
pegaba en la base que usan los closers. F0 trae varias migraciones seguidas (008, 010, 011...), asi
que el riesgo deja de ser teorico.

**Decidimos separar por ramas de Neon, no por proyectos:**

| Entorno | Rama de Neon | Donde vive el `DATABASE_URL` |
|---|---|---|
| Production (Vercel) | `production` (la rama por defecto) | Vercel → Environment Variables → Production |
| Preview (Vercel) | `dev` | Vercel → Environment Variables → Preview |
| Local (`npm run dev`, scripts, `db:migrate`) | `dev` | `.env.local` |

- Una rama de Neon es una copia copy-on-write: nace con los datos y el esquema de `production` al
  instante y sin costo de almacenamiento hasta que diverge. Otro proyecto obligaria a sembrar y
  sincronizar datos a mano.
- `dev` se puede resetear desde `production` cuando se desordene, sin tocar produccion.

## Consecuencias

- **Una migracion se prueba primero en `dev`** (`npm run db:migrate` con el `.env.local`) y solo
  despues se aplica a `production`, de forma explicita y con la URL de produccion cargada solo para ese
  comando. ~~Nunca se deja la URL de `production` en `.env.local`.~~ (reemplazado por la enmienda)
- `dev` contiene PII real copiada de produccion. Mismas reglas que `production`: la URL es un secreto.
- La base se creo desde la consola de Neon, no con la integracion de Vercel, asi que Vercel no
  inyecta `DATABASE_URL` por su cuenta: se carga a mano por entorno. Si algun dia se conecta la
  integracion, revisar que Preview no quede apuntando a `production`.

## Datos del 16-sep

- Proyecto Neon `retia-metrics-crm` (`calm-frog-89494611`), org `Retia-Agencia`, creado desde la
  consola el 15-sep. Es la base de este fork, no la del deployment viejo de Michael.
- Ramas: `production` (`br-withered-mud-b4cvvg80`, endpoint `ep-jolly-silence`) y `dev`
  (`br-withered-sun-b439zjof`, endpoint `ep-mute-shadow`, creada el 16-sep desde `production`).
- Al crear `dev`, `production` tenia 0 personas, 1 usuario y las migraciones 0000-0001.
- `.env.local` ya apunta a `dev`. Para ver o cambiar ramas: `npx neonctl branches list
  --project-id calm-frog-89494611` (login con `npx neonctl auth`).
- Vercel: proyecto `agencia-dani/retia-metrics` (`prj_7XSmQuw14kAiqB8B6IP4V9ITqVU8`, cuenta de
  Daniel, dominio `retia-metrics-seven.vercel.app`). El 16-sep la `DATABASE_URL` compartida quedo
  solo en Production y se creo otra solo para Preview con la URL de `dev`.
- **Sin verificar:** el valor de la `DATABASE_URL` de Production es un secreto que Vercel no deja
  leer. Todo indica que es la rama `production` (Neon y Vercel se configuraron la misma noche),
  pero no se comprobo. Antes de la primera migracion a produccion, confirmarlo o volver a
  cargarla explicitamente con la URL de `production`.

## Enmienda del 16-sep: la URL de `production` vive en `.env.local` como `DB_PROD`

**Decision de Mani.** Pegar la URL a mano en cada verificacion o siembra de `production` era lento
y dependia de que Mani estuviera presente. Desde el 16-sep, `.env.local` guarda la URL de la rama
`production` en la variable **`DB_PROD`**.

Por que sigue siendo seguro:

- **Ningun codigo lee `DB_PROD`.** La app, `drizzle.config.ts` y los scripts solo leen
  `DATABASE_URL`, que sigue apuntando a `dev`. Para tocar `production` hay que nombrar `DB_PROD`
  a proposito en el comando. Un `npm run db:migrate` o un `npm run seed:datos` a secas sigue yendo
  a `dev`.
- **Uso explicito:** `DATABASE_URL="$(grep '^DB_PROD=' .env.local | cut -d= -f2- | tr -d '"')" npm run <script>`.
  La configuracion de dotenv no reemplaza una variable que ya viene en el comando.
- **Lectura libre, escritura con permiso.** Un agente puede usar `DB_PROD` para **consultas de
  solo lectura** (conteos, estado de migraciones). Toda **escritura** en `production` (migracion,
  siembra, cambio de datos) necesita el ok de Mani en esa conversacion, y antes se comprueba que el
  host empiece por `ep-jolly-silence`.
- Nada cambia en Vercel: Production sigue con su `DATABASE_URL` propia.

Riesgo que se acepta: quien tenga `.env.local` tiene acceso de escritura a `production`. El
archivo ya tenia secretos de igual peso (`AUTH_SECRET`, la llave de la cuenta de servicio), tiene
permisos `600` y nunca se sube al repo.

## Hallazgo del 16-sep (noche): `.env.local` no apuntaba a `dev`

Al preparar las migraciones 0004-0007 se comprobó (comparando las URLs sin imprimirlas y
consultando `neon.branch_id`) que **`DATABASE_URL` y `DB_PROD` de `.env.local` son la misma URL**,
la de `production` (`br-withered-mud-b4cvvg80`, `ep-jolly-silence`). La linea de arriba que dice
"`.env.local` ya apunta a `dev`" dejo de ser cierta en algun momento del 16-sep (el archivo se
modifico a las 17:05). Consecuencias:

- Todo lo que se corrio en local desde entonces (`npm run dev`, `seed:datos`, `db:migrate`)
  escribio en `production`. Lo que el handoff registra como "0002 y 0003 aplicadas en `dev`" muy
  probablemente fue `production`.
- La rama `dev` no se pudo revisar: Vercel guarda la `DATABASE_URL` de Preview como variable
  sensible y `vercel env pull` no devuelve su valor, y `neonctl` no esta instalado.
- Con ok de Mani, 0004-0007 se aplicaron **directo a `production`** (eran solo aditivas y ya
  corren en PGlite en cada test). Verificado despues: 8 migraciones, catalogos sembrados,
  columnas e indices nuevos.

**Resuelto el mismo dia:** Mani puso en `DATABASE_URL` la URL de `dev` (verificado:
`br-withered-sun-b439zjof`, `ep-mute-shadow`). `dev` tenia 4 migraciones y 0 programas; se le
aplicaron 0004-0007 y `seed:datos`. Las dos ramas quedaron con 8 migraciones.

**Regla que sale de esto:** antes de cualquier escritura con `DATABASE_URL`, comprobar la rama
(`select setting from pg_settings where name = 'neon.branch_id'`), no solo el nombre de la variable.
