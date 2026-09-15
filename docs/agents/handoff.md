# Handoff — Retia Metrics

> Session memory + roadmap. Read at session start, update at session end.
> The roadmap is a DAG: a task is only **ready** when its dependencies are done.

## Memory

_Estado actual del trabajo. Lo mas reciente arriba._

- **2026-09-14/15 — Se definio que se construye: el repo se convierte en el Retia CRM.** Reunion
  de Tech Retia del 14 sep (Michael Castellanos, Alejandro Carvajal, Alejandro Davila, via Granola)
  detono el cambio: los closers dejan WhatsApp y el calendario compartido, y registran llamadas y
  ventas directo en la app. `docs/spec.md` (primer spec del repo) documenta el alcance: registro de
  llamada+venta en una pantalla, dashboard en vivo sin PDF, "todos ven todo" (comparativo, caja y
  pauta visibles para cualquier closer, no solo gerente).

  `/grill-with-docs` encontro y resolvio dos contradicciones reales entre el codigo y lo que se
  estaba especificando: `calls`/`sales` ya existian pero disenadas solo para filas de Sheets
  (`huellaFila`, `closerId` de texto), y `resultadoLlamadaEnum` ya era un unico estado cuando el
  spec pedia dos casillas (show/cierre) por separado. Se resolvio a favor del codigo existente.
  Cuatro ADR nuevos documentan las decisiones: **0008** (Sheets deja de ser fuente de
  llamadas/ventas, sigue siendolo para leads), **0009** (el dashboard abre a closer lo que ADR 0003
  prohibia — cambio ya aplicado en codigo: `AGENTS.md`, `lib/nav.ts`, ambas paginas de programa y
  sus tests), **0010** (se reusan `calls`/`sales` con `origen="app"`, no tablas nuevas), **0011**
  (`closerId` en escrituras nativas se copia de `session.user.closerId`, no un FK nuevo). El
  glosario (`docs/agents/context.md`) ya refleja el nuevo lenguaje.

  `/plan` produjo `docs/plan.md` (arquitectura, diagrama de flujo, modelo de datos) y 7 tickets en
  `docs/tasks/` (001 a 007), del campo de plataforma de pago que falta hasta el onboarding de
  `closerId` para Andrea/Maru/Jero. Deadline de negocio: antes de que cierren los C2 actuales
  (Comunicarte 22 sep, Tactical 29 sep de 2026).

  **Supuestos sin validar con el negocio** (ver `docs/spec.md` §7): "todos ven todo" no lo confirmo
  Michael ni Alejandro Carvajal directamente; el import historico (dos MD consolidados que Michael
  ya paso, en Downloads al momento de escribir esto) tiene discrepancias documentadas entre si y
  necesita una decision de reconciliacion antes de migrarse; Calendly individual vs cuenta
  compartida, sin confirmar.

- **2026-09-14 — Repo scaffolded.** Se borro la documentacion heredada (los siete prompts de
  fase del master prompt original, el informe de revision externa y su plan de remediacion,
  2.670 lineas entre los dos, y `DEPENDENCIES.md`) y el conocimiento que valia se destilo a esta
  estructura: glosario en `context.md`, constitucion y convenciones en `AGENTS.md`, decisiones en
  `docs/adr/`, deuda en el roadmap de abajo. Todo lo borrado vive en el commit `269aa6c`.
  **El plan de construccion anterior se descarto a proposito**: era el metodo de otra persona.
  Lo que viene se define con `/spec`.

- **Lo que existe y funciona hoy** (verificado: `npm test` 68 verdes, `npm run typecheck` limpio):
  - `lib/auth/` — Auth.js v5 con Google OAuth, allowlist estricta contra la tabla `users`, rol
    revalidado contra la base en cada emision de token, guards para APIs y para paginas.
  - `lib/db/schema.ts` — 10 tablas: `users`, `programs`, `cohorts`, `sources`, `people`, `calls`,
    `sales`, `ad_spend`, `sync_runs`, `change_log`.
  - `lib/sheets/` — el motor de sincronizacion: lee una pestana, resuelve columnas por texto del
    encabezado, deduplica por correo, inserta por lotes y escribe la bitacora de cambios.
  - `proxy.ts` — protege todo salvo `/login`, `/api/auth/*` y `/api/health`.
  - `POST /api/sync/[programa]` (gerente) y `GET /api/cron/sync` (con `CRON_SECRET`, falla cerrado).
  - `/ajustes/fuentes` — la unica pantalla con contenido real. Las otras cinco son placeholders.
  - 13 scripts de CLI: setup de `.env.local`, rotacion de secretos, diagnostico de hojas, seeds,
    sync manual y gestion de usuarios. Ninguno de los de diagnostico imprime datos personales.

- **Verificado contra datos reales** (2026-08-19): Comunicarte 1.320 filas -> 1.253 personas
  (5,1% duplicados); Tactical Investor 2.965 -> 1.839 (38,0%). El motor reproduce el ratio
  documentado. La segunda corrida deja `change_log` intacto. Carga en frio de 1.253 personas en
  4,0 segundos.

- **Incidente de seguridad, 2026-08-18.** Una captura de pantalla de `.env.local` abierto en
  TextEdit expuso la contrasena de Neon, el secreto de OAuth y el `AUTH_SECRET`. Se rotaron el
  mismo dia, y otra vez el 6 de septiembre junto con seis secretos mas. De ahi salen
  `npm run setup` y `npm run rotar`, que leen los secretos sin eco: **nunca se abre `.env.local`
  en un editor**.

- **Este repo es un fork independiente.** El deployment original (`retia-metrics.vercel.app`,
  bajo Michael) no se hereda: no hay proyecto de Vercel propio todavia y las credenciales hay que
  generarlas desde cero a partir de `.env.example`.

## Roadmap

### Now (ready — no unmet dependencies)

- [ ] **Ticket 001 · Migracion: `plataformaPago` en `sales`.** Ver `docs/tasks/001-*.md`.
- [ ] **Ticket 007 · Onboarding: `closerId` de Andrea, Maru y Jero.** No depende de ningun otro
      ticket; puede hacerse en paralelo. Ver `docs/tasks/007-*.md`.
- [ ] **F-05 · Migrar las fechas ya guardadas.** El codigo ya escribe con `-05:00` explicito,
      pero las filas viejas quedaron en la zona del servidor y `compararCampos` no mira fechas,
      asi que un `npm run sync` normal **no** las repara. Decidir entre migracion puntual o
      re-sync forzado.

### Next (blocked until a "Now" item lands)

Cadena del CRM, bloqueada por el ticket 001 (y entre si, en cadena):

- [ ] **Ticket 002** — `corteActivo()` + `lib/mutations/registro.ts`. Bloqueado por 001.
- [ ] **Ticket 003** — Pantalla de `/mi-dia` (buscar persona, registrar resultado). Bloqueado por 002.
- [ ] **Ticket 004** — Consultas del dashboard (`lib/queries/dashboard.ts`). Bloqueado por 001.
- [ ] **Ticket 005** — Dashboard real en `/comunicarte` y `/tactical-investor`. Bloqueado por 004.
- [ ] **Ticket 006** — Historial de llamadas de una persona. Bloqueado por 005.

Los cinco de abajo estan bloqueados por lo mismo: **falta un `.env.local` con credenciales** para
verificar de punta a punta con `npm run sync`.

- [ ] **F-03 (alto)** — Dos sincronizaciones simultaneas se pisan y dejan la base a medias. Falta
      un candado por programa.
- [ ] **B-01 (alto)** — `lib/sheets/sync.ts`, lo mas riesgoso del repo, no tiene tests. Hay que
      separar la decision de la escritura para poder probarla.
- [ ] **F-04 (medio)** — Las actualizaciones van fila por fila; la proxima carga grande se pasa
      del limite de la funcion. Falta upsert por lotes.
- [ ] **F-07 (medio)** — La corrida de sync se atribuye a la primera fuente y no guarda la mitad
      de sus conteos.
- [ ] **Prueba manual de S-02** — que `npm run usuarios -- quitar <correo>` saque a la persona en
      el siguiente request. El callback `jwt` no es testeable sin extraerlo de Auth.js.

Bloqueados por una decision de negocio (hay que preguntarle a Michael):

- [ ] **F-01 (alto)** — El sync lee `estado` de la hoja y lo descarta, asi que el embudo se queda
      sin datos para calcularse. Falta: los valores reales de la columna `Estado` y su mapeo al
      enum, y que hacer con `agenda` y `capacidadInvertir`.
- [ ] **F-06 (medio)** — Nadie detecta a la persona que desaparece de la hoja. Falta saber si las
      filas se borran o solo se mueven de pestana.
- [ ] **S-06 + B-06 (medio)** — La PII queda duplicada sin retencion ni control de acceso, y
      `people.raw` guarda la fila entera y crece sin techo. Falta la politica de retencion.

### Later (someday / not yet scoped)

- [ ] **S-14** — `Production` y `Preview` comparten base de datos en Vercel. Separarlas con una
      rama de Neon antes de trabajar con previews.
- [ ] **S-10** — Fijar `AUTH_URL` en produccion. No aplica hasta que este fork tenga su propio
      proyecto de Vercel.
- [ ] **S-12** — Los route handlers dependen de `SameSite=Lax`, sin CSRF propio. Se resuelve
      migrando las mutaciones a Server Actions.
- [ ] **`CRON_SECRET` en Vercel.** Existe en `.env.local` y el cron esta probado en local, pero en
      produccion no correra hasta cargarlo y redesplegar.
- [ ] **Pantalla para administrar usuarios.** Hoy se hace con `npm run usuarios` y `db:studio`.
- [ ] **Las fuentes de `calls`, `sales` y `ad_spend`** estan sembradas pero inactivas: sus
      encabezados no se han inspeccionado y esta prohibido adivinar mapeos. Empezar con
      `npm run inspeccionar <sheetId> "<pestana>"`.

### Done

- [x] 2026-09-14/15 — Definido que se construye: `/spec` (`docs/spec.md`), `/grill-with-docs`
      (ADR 0008-0011, `context.md` actualizado, `AGENTS.md` y tests de roles/paginas ya aplicados
      en codigo) y `/plan` (`docs/plan.md`, tickets 001-007 en `docs/tasks/`).
- [x] 2026-09-14 — Repo scaffolded: documentacion heredada borrada, conocimiento destilado.
- [x] 2026-09-14 — Auditoria de dependencias: fuera `@types/pg` (huerfano), `shadcn` movido a
      `devDependencies`. Fuera tres componentes de shadcn sin usar (`input`, `label`, `table`).
- [x] 2026-09-06 al 09-14 — Remediacion de la revision externa del 29 de agosto: se cerraron 21 de
      33 hallazgos y los tests pasaron de 35 a 68. El informe y el plan completos estan en
      `git show 269aa6c:docs/revision-2026-08-29.md` y `…:docs/plan-remediacion-2026-09-06.md`.
- [x] 2026-08-19 — Motor de datos: 10 tablas, sync con Sheets, dedup, bitacora de cambios,
      verificado contra las hojas reales.
- [x] 2026-08-18 — Esqueleto desplegado con login de Google, allowlist y roles.

### Datos de validacion — los cortes C1, que ya estan cerrados

Estos numeros salieron de las BBDD reales y **no cambian mas**: C1 esta cerrado. Sirven para
verificar cualquier motor de metricas que se construya. **No los hardcodees en la app** — la app
los debe recalcular desde los datos. Si tu codigo produce otra cosa con los mismos insumos, el bug
es tuyo.

| Comunicarte C1 | Tactical Investor C1 |
|---|---|
| Leads 1.100 -> descartados 561 (51,0%) | Filas 2.932 -> personas 1.825 (37,8% duplicados) |
| Con Calendly 152 (13,8%) -> llamadas 135 | Descartados 741 (40,6%) · cola de setteo 883 (48,4%) |
| Shows 51 (37,8%) -> cierres 29 (56,9% sobre show) | Agendaron 200 (11,0%) -> llamadas 140 -> shows 72 (51,4%) -> cierres 17 |
| **Lead a venta 2,64% · invitado a venta 21,5%** | **Lead a venta 0,93% · invitado a venta 8,5%** (bajo el umbral de 15%) |
| Pauta COP 10.119.796 · CPL COP 9.200 | ROAS motor de llamadas 1,97 · ROAS lanzamiento 9,04 (motores distintos, no se mezclan) |
| Ritmo sostenido: 73 leads/dia habil | Matriculados finales 31, pero solo 17 pasaron por el registro de llamadas |

Los numeros de los cortes C2 y los seis escenarios de proyeccion del plan original **no se
migraron a proposito**: eran del 18 de agosto, los dos C2 cierran el 22 y el 29 de septiembre, y
ya no describen la realidad. Se recalculan cuando haga falta. Estan en
`git show 269aa6c:PROJECT.md`.

### Detalles del entorno que cuestan tiempo si se olvidan

- **El proyecto de Google Cloud vive dentro de la organizacion `retiagrowth.com`** y la cuenta no
  puede crear proyectos fuera de ella. Ventaja: la cuenta de servicio es interna al dominio, asi
  que compartirle las hojas no choca con restricciones de compartir hacia afuera.
- **La pantalla de consentimiento de OAuth es External y esta publicada** ("En produccion"), asi
  que un closer podria entrar con Gmail personal. Quien controla el acceso es la tabla `users`,
  no Google.
- **El gerente del sistema es `administrativa@retiagrowth.com`** (el perfil de Google aparece como
  "Alejandro Carvajal Parra"). Michael lo confirmo el 18 de agosto tras plantearsele el riesgo dos
  veces. **Implicacion:** los registros de llamada van a quedar atribuidos a esa cuenta compartida,
  no a una persona individual. Tenerlo presente al construir el registro de llamadas.
- **`/ajustes/fuentes` es de solo lectura, a proposito.** El plan original pedia editar el mapeo de
  columnas desde la UI; hoy se cambia en `scripts/seed-datos.ts` y se vuelve a sembrar. Los tres
  formularios comparten un unico mapeo que ya funciona, asi que una UI de edicion sin necesidad
  real habria sido trabajo muerto. **Es una desviacion declarada, no un olvido.**

### Ojo al arrancar

**Si recibes un `.env.local` de antes del 6 de septiembre**, le faltan `SHEET_ID_COMUNICARTE` y
`SHEET_ID_TACTICAL`. Sin ellas `npm run seed:datos` falla con un mensaje que dice exactamente que
hacer. Los valores estan en la URL de cada hoja, entre `/d/` y `/edit`, y el prefijo de cada uno
esta en `docs/estructura-bbdd.md`.
