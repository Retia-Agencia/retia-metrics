<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Retia Metrics

CRM y dashboard comercial interno de Retia para sus programas (hoy Comunicarte y Tactical
Investor). Lee los leads de Google Sheets, deduplica, registra llamadas, ventas y abonos,
calcula el embudo y proyecta la cohorte.
Uso restringido: no hay ninguna vista publica y no existe el auto-registro.

## Agent skills

This repo is set up for agentic engineering. Read these before working:

- **Spec** (`docs/spec.md`, or one per domain in `docs/specs/`) — what this MVP does and does not do, in 7 blocks (built by `/spec`). The product contract; read it before planning or building. When the product spans several bounded domains there is one spec per domain, and those files also draw the domain boundaries. Anything uncertain lives in its *supuestos por validar* block, never invented as fact.
- **Plan + tickets** (`docs/plan.md`, `docs/tasks/`) — the ordered build derived from the spec, decomposed into small tickets (built by `/plan`). `plan.md` carries a mermaid flow diagram of how the MVP works. Each ticket is sized to a clean context window and cites the acceptance criterion it serves. Never jump from spec straight to code. **`docs/tasks/README.md` is the single progress tracker**: pick a ticket whose dependencies are all `done`, and when you close it tick its box there and set `status: done` in the ticket file.
- **Handoff** (`docs/agents/handoff.md`) — session memory + roadmap. Read at the start of every session to recover state; update it at the end. Tracks which tickets are done; references ticket ids, doesn't duplicate them. This is how the next agent (or future you) avoids starting from zero.
- **Context** (`docs/agents/context.md`) — the domain glossary (ubiquitous language). Read it before naming variables, functions, or files, and before discussing the domain. Sharpen it with `/grill-with-docs`.
- **ADRs** (`docs/adr/`) — architecture decisions and why they were made. Read the relevant ones before changing a decided area; don't re-litigate them. Add new ones via `/grill-with-docs` or `/improve-codebase`.

Hay un quinto documento propio de este proyecto: **`docs/estructura-bbdd.md`**, el mapa real de
las dos hojas de Google Sheets. Leelo antes de tocar `lib/sheets/`: dice que pestana es fuente,
cuales son vistas derivadas que romperian el dedup, y cuales son respaldos viejos que inflan los
conteos. Eso no se deduce del codigo ni lo devuelve `npm run descubrir`.

Available skills (the pipeline is **spec → plan → build**): `/spec` (interview → `docs/spec.md`, or `docs/specs/*.md` one per domain), `/plan` (spec → `docs/plan.md` + tickets), `/grill-me`, `/grill-with-docs` (align + document before building), `/tdd` (red-green-refactor), `/diagnose` (disciplined debugging), `/improve-codebase` (deepen modules), `/handoff` (compact a session).

Keep this file current yourself: when a feedback-loop command turns out wrong or missing, or a durable convention emerges that no linter enforces, update the relevant section below directly rather than letting it drift.

## Restricciones no-negociables

Reglas duras que gobiernan todo el proyecto y que ningun linter puede verificar.

**Integridad de los datos**

- **Dedup obligatorio por correo.** Toda tasa se calcula sobre personas, nunca sobre filas. La
  BBDD de Tactical Investor tiene ~2.950 filas que son ~1.840 personas, y hay un correo con 12
  aplicaciones. Calcular sobre filas infla las tasas ~60% y toda decision de presupuesto sale
  mal. La garantia vive en un indice unico de la base, no solo en el codigo (ADR 0005).
- **Caja recaudada y ventas cerradas son dos metricas separadas.** Los montos de la columna
  Precio son adelantos parciales, no precios finales. Nunca inferir una de la otra. La caja es
  la suma de `abonos` por fecha del abono; las ventas son el conteo de `sales` (ADR 0013).
- **Todo dinero derivado tiene UNA definicion (ADR 0024).** Lo abonado y el saldo viven en
  `lib/queries/saldo.ts`; ninguna consulta vuelve a escribir `sum(abonos.monto)` a mano. La regla
  general: si dos lugares tienen que dar la misma cifra, la cifra vive en un modulo y los dos la
  importan. Estuvo copiada en `saldoDeVenta` (la reja que bloquea un sobrepago) y en
  `ventasDePersona` (lo que el closer ve): una pantalla y una reja discrepando sobre el mismo
  numero no se descubre hasta que el dinero no cuadra. `tests/saldo-centralizado.test.ts` compara
  las dos salidas y falla si alguien las separa. **La regla no es solo del dinero:** si dos lugares
  responden la MISMA pregunta, la respuesta vive en un modulo y los dos la importan — la proyeccion
  es del llamador, el predicado es del modulo (asi se consolido `programasActivos`). Dos preguntas
  distintas que hoy dan el mismo SQL siguen siendo dos funciones.
- **La meta es de la cohorte y no se reparte entre closers.** Un closer tiene contribucion
  (sus ventas de la cohorte), no meta propia: el reparto no existe en la base y seria un numero
  inventado con el que se mide a personas (ADR 0023). Lo mismo con la meta de leads por dia.
  Y los leads de un closer son las personas de las que es responsable, asi que la suma de los
  closers **no** da el total del programa: la pantalla lo dice en vez de cuadrarlo a la fuerza.
- **Nunca convertir moneda en silencio.** Tickets en USD, pauta en COP, sin TRM historica unica.
  Siempre mostrar la moneda al lado del numero.
- **Solo dias habiles, y los festivos cuentan como habiles.** Regla de Retia, no del calendario
  colombiano: solo se excluyen sabados y domingos.

**Seguridad y privacidad**

- **El rol se enforza en el servidor, en cada ruta.** Esconder un boton no es seguridad. Todo
  route handler y toda pagina pasa por `requireRole` / `paginaConRol`.
- **Hay un tercer rol, `developer`, y es la unica excepcion a la disjuncion (ADR 0025).** Pasa
  toda guarda: exclusiva de gerente, exclusiva de closer o compartida. La excepcion vive en UN
  solo lugar, `esAccesoTotal` dentro de `puedeAcceder`: **nunca se escribe `"developer"` en un
  `requireRole` ni en un `paginaConRol`**, o la ruta que alguien agregue el mes que viene se
  olvidaria de el. Y pasar la guarda no es tener una pantalla util: lo que la pagina proyecta
  adentro sigue decidiendose por rol (`/mi-dia` y `/productos` le dan la union de programas, no la
  de un closer sin membresias). "Administrar" es OTRA pregunta: `esAdministrador` la cumplen el
  gerente y el developer, y es la que usa la salvaguarda del ultimo administrador.
- **`gerente` y `closer` son conjuntos disjuntos, sin herencia.** Un closer nunca entra a una ruta
  exclusiva de gerente como `/ajustes` (ADR 0003). Excepcion explicita desde el 15 de septiembre de
  2026: en el dashboard del CRM (`/programas/[slug]`, antes `/comunicarte` y
  `/tactical-investor`) un closer SI ve el comparativo entre closers, la caja y la pauta, igual
  que un gerente: es la politica "todos ven todo" (ADR 0009). Ambas reglas conviven: la
  disjuncion de roles sigue rigiendo el acceso a rutas de administracion, pero ya no rige la
  visibilidad de datos dentro del dashboard. Los productos (`/productos`) los editan ambos roles
  (ADR 0016); es la unica configuracion que un closer puede tocar. El filtro del dashboard sale
  de la URL y nunca de la sesion (ADR 0023): un closer sin filtro ve el programa completo, y el
  comparativo entre closers no se puede acotar ni queriendo, porque el tipo de la consulta no lo
  admite.
- **Nada de la app es publico.** Sin sesion no se ve ni una cifra. Unica excepcion:
  `/api/health`, que no expone ningun dato del negocio.
- **Ningun dato personal en URLs ni en query strings.** Los identificadores en rutas son ids
  opacos, nunca correos.
- **Secretos solo en `.env.local` y en Vercel.** Nunca en el repo, nunca abiertos en un editor
  (ver la seccion de incidentes en `docs/agents/handoff.md`).

**Arquitectura**

- **Las instancias viven en la base, los tipos viven en el codigo (ADR 0012).** Si el codigo no
  toma una decision segun un valor (un programa, una cohorte, un closer, un producto, una
  plataforma, un motivo, un origen, un recurso), ese valor es una fila editable desde la app,
  nunca un literal, un enum ni una ruta fija. Toda entidad configurable sigue el molde de
  `lib/catalogo/`: tabla con `activo`, un solo esquema zod, pantalla con guard, y cada cambio va a
  `change_log`. **No se borra lo que YA SE USO** (enmienda del ADR 0026 al 0012, 18-sep): una fila
  con cero referencias se borra de verdad, una con referencias solo se desactiva y la app dice
  cuantas tiene. Lo que no puede pasar es que la app diga "borrado" habiendo desactivado.
  Ningun slug de programa aparece en `lib/`, `app/` ni `components/`.
- **Google Sheets es la fuente de verdad de los leads; el CRM lo es de llamadas, ventas y
  abonos.** El sync de leads no cambia (ADR 0004). Las llamadas y ventas se registran nativas en
  la app (ADR 0008) sobre las mismas tablas, con `origen = "app"` (ADR 0010).
- **Un mapeo de columnas que no cuadra falla ruidosamente.** Nunca adivinar una columna: se
  resuelve por texto del encabezado, no por posicion, y si falta un campo obligatorio se lanza
  `MapeoInvalidoError` con lo que se buscaba y los encabezados reales.

**Rendimiento y escala** — observados en produccion, no decididos en una reunion. Trata cualquier
cambio que los rompa como una regresion, y cualquier crecimiento que los supere como una senal de
que hay que re-pensar el diseno:

- **El sync completo cabe en el limite de una funcion de Vercel.** Con inserciones fila por fila
  tardaba 161 segundos y se pasaba; con lotes de 200 tarda 4,0 segundos para 1.253 personas.
  Cualquier operacion nueva sobre el set completo se escribe por lotes desde el principio.
- **Escala real hoy: ~3.000 filas por hoja, dos programas, 5 usuarios concurrentes.** No es un
  sistema de alto trafico y no hay que disenarlo como si lo fuera. Si el volumen se multiplica
  por diez, revisar la estrategia de lectura completa de la hoja.

## Contratos

Estandares transversales que todo output debe cumplir, sin importar la fase.

| Contract | Standard / where it lives | How it's enforced |
|---|---|---|
| Permisos de rol | `lib/auth/guards.ts` (APIs) y `lib/auth/page-guards.ts` (paginas) | `tests/guards.test.ts`, `tests/paginas.test.ts`, `tests/roles.test.ts` invocan los handlers y las paginas reales |
| Errores hacia el cliente | `lib/errors.ts` + `respuestaDeError` | `tests/errores.test.ts`: un error interno no se filtra ni aunque traiga la propiedad `status` |
| Validacion en el borde | `zod` en todo route handler y cron que reciba input | Patron fijado en B-03; `ZodError` sale como 400 |
| Formato de numero | `lib/format.ts` (punto de miles, coma decimal; el USD SIEMPRE con dos decimales) | `tests/format.test.ts` |
| Como se escribe un saldo | `saldoLegible` en `lib/format.ts`: decide la ETIQUETA y el valor juntos, porque un saldo negativo es un **sobrepago** y no una deuda | `tests/format.test.ts` |
| Mensajes de validacion del navegador | `components/validacion-en-espanol.tsx`, montado una vez en el layout raiz: traduce los globos nativos, que salen en el idioma del navegador y no en el del `lang` de la pagina | Revision manual |
| Contrato de extension | ADR 0012, enmendado por el 0026; molde en `lib/catalogo/` | `tests/contrato-extension.test.ts` (ticket 009): ningun programa escrito en el codigo; tests del molde (ticket 011): siempre `change_log`, y **nunca `DELETE` sobre una fila con referencias** (hasta el ticket 030 el molde no borra nunca) |

## Feedback loops

The agent should run these to get fast signal on whether code works. Keep them current.

- **Test:** `npm test` (Vitest, 477 pasando hoy). Los tests que necesitan base usan PGlite en
  memoria con todas las migraciones aplicadas: `tests/helpers/base-de-prueba.ts` (ADR 0020).
- **Typecheck:** `npm run typecheck` (`tsc --noEmit`) · **Lint:** `npm run lint`
- **Run:** `npm run dev` (http://localhost:3000)

`npm run build` no necesita `.env.local`: el cliente de la base se crea de forma perezosa.

## Conventions

- **El gestor de paquetes es `npm`, no `pnpm`** (ADR 0001). Donde una instruccion diga `pnpm X`,
  corre `npm run X`.
- **Next 16 renombro `middleware.ts` a `proxy.ts`.** El archivo vive en la raiz con ese nombre.
- **shadcn/ui corre sobre `@base-ui/react`, no sobre Radix.** Se usa `render={<Componente />}` en
  vez de `asChild`, y `onClick` en vez de `onSelect` en los items de menu.
- **`next-auth/jwt` solo re-exporta `@auth/core/jwt`.** La augmentacion de `JWT` tiene que
  declararse sobre `@auth/core/jwt` o no aplica (ver `types/next-auth.d.ts`).
- **`LayoutProps` / `PageProps` los genera `next build`.** No dependas de ellos: tipa las props a
  mano para que `tsc --noEmit` corra limpio sin build previo.
- **Un paquete no se instala antes del codigo que lo usa.** Instalar por adelantado es
  abstraccion especulativa (ADR 0006).
- **Dentro de una plantilla `sql` de drizzle, las columnas salen SIN calificar.**
  `sql`select count(*) from ${people} where ${people.programId} = ${programs.id}`` se renderiza como
  `select count(*) from "people" where "program_id" = "id"`: ese `"id"` resuelve a la columna de la
  tabla interna, la comparacion siempre da falso y **el conteo devuelve 0 sin lanzar ningun error**.
  Descubierto en el ticket 025, con un test que ya estaba escrito; sin ese test la pantalla habria
  mostrado ceros crebles. **No escribas subconsultas correlacionadas con la plantilla `sql`**: agrupa
  aparte y une en memoria, que a esta escala es gratis y se lee correcto. Dentro de una consulta de
  UNA sola tabla la plantilla es segura, porque no hay ambiguedad que resolver.
- **La base se usa por `drizzle-orm/neon-http`: sin sesion ni transacciones interactivas.** Cada
  consulta es una peticion HTTP aparte, asi que `pg_advisory_lock` y `SET` de sesion no sirven.
  La exclusion mutua se hace con un indice unico en la base (ver F-03 en el tracker).
- **Local y previews usan la rama `dev` de Neon; produccion usa `production`** (ADR 0018). Una
  migracion se prueba en `dev` antes de tocar `production`. La URL de `production` esta en
  `.env.local` como `DB_PROD`: ningun codigo la lee, se usa solo nombrandola en el comando.
  Consultas de solo lectura, libres; **toda escritura en `production` pide el ok de Mani**.
  Antes de escribir, comprobar la rama real (`neon.branch_id`), no el nombre de la variable: el
  16-sep `DATABASE_URL` resulto apuntar a `production` (ver el hallazgo en el ADR 0018).
- **Las migraciones las genera y aplica la sesion principal, nunca un subagente** (Mani, 17-sep).
  Un agente delegado (Kiro, Codex) implementa codigo y tests, pero no corre `db:generate` ni
  `db:migrate`. `drizzle-kit generate` es interactivo: si una columna se va y otra llega en el
  mismo cambio pregunta si es un renombre, y un agente sin terminal se queda colgado ahi.
- **`drizzle-kit generate` y `migrate` estan permitidos en `.claude/settings.json`; `push` y `drop`
  estan DENEGADOS.** `push` aplica el esquema directo contra la base sin dejar archivo de
  migracion: se salta el historial, el journal y la revision, que es justo la disciplina que este
  repo enforza. `drop` borra migraciones. Ninguno de los dos se usa aqui.
- **Un `CHECK` nuevo se crea despues de arreglar los datos**, en la misma migracion. El de la
  0009 habria fallado con las cohortes activas que estaban sin inicio de ventas.
- **Trabajo en paralelo: el reparto se hace por ARCHIVOS, no por el grafo de dependencias**
  (17-sep, tres sesiones sin choques). Los puntos de colision son las migraciones (journal +
  snapshot + `schema.ts`), `docs/tasks/README.md`, `docs/agents/handoff.md` y los commits. Cada
  sesion commitea nombrando sus archivos (nunca `git add -A`), nadie toca el tracker ni el
  handoff, y un coordinador revisa contra el "Done cuando", marca y migra. No van juntos dos
  tickets que escriben la misma logica ni dos que necesiten migracion.
- **Un fallo de `npm test` por timeout no es una regresion.** Los tests con PGlite aplican todas
  las migraciones; con varias sesiones compitiendo por la maquina el suite se cae en cascada por
  el reloj. Re-corre el archivo solo antes de investigar (`testTimeout` y `hookTimeout` en 20s).
- **`CRON_SECRET` se genera con `npm run cron-secret`**, no con `npm run rotar` (ese solo rota
  `AUTH_GOOGLE_SECRET` y `AUTH_SECRET`).
- **Idioma:** UI en espanol. Nombres de variables, tablas y archivos sin acentos, consistentes.
  Mensajes de commit en espanol.

## Permissions

The agent runs with a permission floor so it can work autonomously without deleting things. Destructive commands are denied in `.claude/settings.json` (Claude Code); other tools keep their own config. Widen the allow-list per project; keep the destructive deny-list.

## Agents & local skills

This repo can grow its own automation when a need repeats — not required, and there are no placeholder files or folders. When it earns its place:

- **Local skills** → `.claude/skills/<name>/` — a repeatable procedure you want deterministic (built with skill-creator).
- **Local agents** → `.claude/agents/<name>/` — a role with its way of working embedded: `AGENT.md` (what it does) + `MEMORY.md` (what it learned about this codebase) + optional `templates/`, `scripts/`, and references to skills (e.g. a UI agent references `impeccable`). Write it by hand once the need is proven; there is no generator to run, and an agent built before the need is real is worse than none. When a trigger applies, launch the subagent automatically, not only on manual command — the override still holds.

**Review principle (portable, every tool):** the review is done by a *different model/session than the one that wrote the code* — it validates the output against the spec and the architecture before the commit. This is the "cadenero". The reviewer is not tied to a fixed model; any strong reasoner in a fresh session works. Whoever builds it as an agent leaves the frontmatter without a pinned `model:` and states the rule in the body.
