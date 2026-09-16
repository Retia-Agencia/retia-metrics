# 0018 — Produccion y desarrollo usan ramas de Neon separadas

**Fecha:** 2026-09-16 · **Estado:** aceptado. Local aplicado el 16-sep; falta Vercel (S-14)

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
- **Falta:** el deployment vive en una cuenta de Vercel que no esta conectada a esta maquina.
  Ahi hay que dejar Production con la URL de `production` y Preview con la de `dev`. Hasta
  verificar eso, las migraciones de F0 se aplican solo a `dev`.
