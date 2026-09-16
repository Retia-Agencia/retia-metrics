# 0018 — Produccion y desarrollo usan ramas de Neon separadas

**Fecha:** 2026-09-16 · **Estado:** aceptado y aplicado el 16-sep (S-14)

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
  comando. Nunca se deja la URL de `production` en `.env.local`.
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
