<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- BEGIN:retia -->

# Proyecto Retia Metrics

Antes de escribir codigo lee, en este orden:

1. `PROJECT.md` — contexto de negocio, vocabulario, reglas que no se pueden violar, stack y
   las trampas del entorno (npm y no pnpm, `proxy.ts` y no `middleware.ts`, `@base-ui/react`).
2. `STATE.md` — que existe ya, que decisiones se tomaron y que queda pendiente.
3. El spec de la fase que te toca.

Nada mas. No explores el codebase completo al arrancar: `STATE.md` te dice donde quedo todo.
Una fase por sesion.

## Al cerrar la fase

1. Corre los criterios de aceptacion del spec y reporta el resultado **real**. Si algo falla,
   dilo; no declares terminado lo que no verificaste.
2. **Relee `STATE.md` completo y corrige lo que ya no sea cierto.** No solo agregues lo nuevo.
   Este paso es obligatorio y es el que faltaba.
3. Detente.

Por que el paso 2 existe: estas instrucciones convierten a `STATE.md` en la unica fuente de
verdad de la proxima sesion, asi que una afirmacion falsa ahi no se corrige, **se hereda**. La
revision del 29 de agosto encontro cuatro heredadas asi: que el rol se revalidaba en cada
peticion (no lo hacia), que `lib/sheets/` estaba vacia (tenia cinco archivos y era el corazon de
la Fase 1), que `sync.ts` hacia upsert (hacia insert y update por separado, que es justo el
origen de F-03 y F-04), y dos conteos de tests distintos en el mismo documento. Ninguna era
mentira cuando se escribio: todas quedaron viejas y nadie las releyo.

<!-- END:retia -->
