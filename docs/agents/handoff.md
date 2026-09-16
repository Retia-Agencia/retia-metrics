# Handoff — Retia Metrics

> Session memory + roadmap. Read at session start, update at session end.
> The roadmap is a DAG: a task is only **ready** when its dependencies are done.

## Memory

_Estado actual del trabajo. Lo mas reciente arriba._

- **2026-09-16 (noche) — F0 arranca: tickets 008-011 hechos, migraciones en las dos ramas, Google
  Cloud y login pasados a Retia, respuestas de Michael bajadas.**

  **Codigo** (Kiro implementa con TDD en segundo plano; cada ticket se reviso contra su "Done
  cuando" y va en su propio commit; 94 tests, typecheck y lint limpios):
  - **008** Corte → Cohorte. Migracion `drizzle/0002_*` escrita a mano, solo `RENAME`.
  - **009** `tests/contrato-extension.test.ts`: falla si un programa aparece escrito en `lib/`,
    `app/` o `components/` (contenido **y** rutas).
  - **010** Programas desde la base: `app/(app)/programas/[slug]`, `lib/queries/programas.ts`,
    `lib/nav.ts` puro, `destinoInicial()` en `lib/auth/page-guards.ts`; las rutas viejas
    redirigen desde `next.config.ts`. La descripcion del dashboard ya no trae la fecha de C2;
    vuelve con `cohorteActiva()` (002).
  - **011** Molde `lib/catalogo/molde.ts` (listar/crear/editar/desactivar, `change_log` con
    `userId`, nunca `DELETE`) estrenado con `lib/catalogo/plataformas.ts`. Migracion `0003_*`
    con 7 plataformas. La base entra por parametro; `lib/db/ejecutar-juntas.ts` usa `batch`
    (neon-http) o `transaction` (PGlite). Deuda: un id que no es uuid da 500 (validar en 013).
  - **ADR 0020 (Mani):** tests de base con PGlite en memoria; `tests/helpers/base-de-prueba.ts`
    aplica todas las migraciones.
  - **Bug evitado:** el `when` de 0002 en el journal era mayor que el de 0003 y el migrador se
    habria saltado 0003. Corregido; `tests/migraciones.test.ts` lo vigila.
  - `npm run cuenta-servicio -- <ruta>` acepta la ruta de la llave.

  **Infraestructura (verificado):**
  - Migraciones 0002 y 0003 aplicadas en `dev` (`npm run db:migrate`) y en `production` (SQL
    Editor de Neon, una transaccion, con las filas de `drizzle.__drizzle_migrations` y los mismos
    hash que `dev`). Ambas: 4 migraciones, 7 plataformas.
  - `DATABASE_URL` de Vercel Production recargada por Mani con la rama `production`.
  - Google Cloud: todo lo de la app vive en el proyecto **`retia-growth`**. Cuenta de servicio
    `retia-metrics-sync@retia-growth.iam.gserviceaccount.com` en `.env.local` y Vercel
    Production; las dos hojas compartidas y `npm run descubrir` las ve. El **login** se movio a
    un cliente OAuth web de `retia-growth` (antes vivia en el proyecto personal
    `google-workspace-mcp`); Google acepta las URIs de produccion y `localhost:3000`, y
    `.env.local` y el deploy de produccion usan el mismo cliente. `AUTH_URL` en Production.
  - Produccion desplegada y sana (`/api/health` 200, redirecciones 308 ok).

  **Decisiones de negocio** (detalle en `docs/insumos/mensaje-michael-2026-09-16.md` y el
  tracker): closers activos Andrea y Maru; los usuarios reales (closers y managers) se cargan
  desde la UI del 015 al salir a produccion; abonos siempre en USD y el closer convierte al
  registrar; snapshot de ultimo, parecido al reporte diario actual; `Estado` es la clasificacion
  del lead (valores contados y mapeo propuesto en F-01). **Alcance nuevo:** todo lead tiene un
  closer responsable que se asigna en el CRM, y eso choca con ADR 0004.

  **Hallazgos:** la hoja de Tactical tiene pestanas que `docs/estructura-bbdd.md` no documenta
  (`🚨 Urgencias`, `_urg_data`, `Leads interesados en prox. Cohort`, `Lead Magnet Ruta`,
  `BK_*_20260905_1650`). `New form` devuelve justo 2.000 filas (eran 1.320 el 19-ago): revisar
  si son filas vacias con formula.

  **Siguiente sesion, en orden:** ver **Now** abajo.
  Skills sugeridas: `/grill-with-docs` (responsable del lead vs ADR 0004), `/tdd` por ticket
  delegando a Kiro.

- **2026-09-16 (tarde) — Sesion de riesgos: S-14, CRON_SECRET, B-01, decisiones de negocio.**

  **Siguiente sesion, en orden** (_todo resuelto en la sesion de la noche salvo F-03 + F-07_):
  1. Cargar `GOOGLE_SERVICE_ACCOUNT_JSON_B64` (`npm run cuenta-servicio`, necesita el JSON de
     Google Cloud) en `.env.local` y en Vercel Production.
  2. S-10: `AUTH_URL=https://retia-metrics-seven.vercel.app` en Production + callback en Google OAuth.
  3. Redeploy de produccion y probar `/api/cron/sync` (hoy responde 500: falta `CRON_SECRET` en el
     deploy activo, falla cerrado, esperado).
  4. Confirmar que la `DATABASE_URL` de Production es la rama `production` (ADR 0018).
  5. F-03 + F-07 juntos, con migracion en `dev` (diseno en el tracker).
  6. Tickets 008 y 009. Cuando Michael responda, bajar sus respuestas al tracker y los tickets.

  **Hecho:**
  - **S-14 (ADR 0018):** la base de `.env.local` es el proyecto Neon `retia-metrics-crm` (org
    Retia-Agencia, creado el 15-sep), del fork y casi vacio (0 personas, 1 usuario). Rama `dev`
    creada; `.env.local` y Vercel Preview la usan; Production conserva su `DATABASE_URL`.
    `neonctl` quedo autenticado en esta maquina (`npx neonctl ...`).
  - **Vercel:** proyecto `agencia-dani/retia-metrics` (cuenta de Daniel, dominio
    `retia-metrics-seven.vercel.app`). La CLI de esta maquina quedo logueada como
    `danieltovartech-4302`; para volver a `manigreeen`: `vercel logout` + `vercel login`. Repo
    enlazado con `.vercel/repo.json`.
  - **CRON_SECRET:** `npm run rotar` no lo genera (se corrigio esa instruccion). Nuevo
    `npm run cron-secret` (sin eco, con respaldo, `-- --vercel` sube por la API). Esta en
    `.env.local` y en Vercel Production; aplica con el proximo deploy.
  - **B-01:** la decision del sync vive en `lib/sheets/plan-sync.ts` (`planificarSync`, pura) y
    `sync.ts` solo escribe. 6 tests verificados con mutaciones; 77 en total.
  - **F-03 no se hizo:** con `neon-http` no hay advisory locks de sesion; necesita indice unico
    parcial (migracion).
  - **Decisiones:** sync de leads con Sheets **si** (Michael); "todos ven todo" **si** e importar
    el historico de C2 **si** (Mani). Idea de Mani convertida en ADR 0019: plantilla de lead por
    programa, heredada y ajustable por fuente, campos fijos en codigo y extras a `raw`; se
    construye en el ticket 016. Las hojas **no** se estandarizan.
  - **Mensaje a Michael** (`docs/insumos/mensaje-michael-2026-09-16.md`): **enviado por Mani el
    16-sep**, esperando respuesta sobre closers y correos, moneda de abonos, leads fuera del
    formulario, formato del snapshot y valores de `Estado`.
  - Tarea de Notion del CRM actualizada con el estado. El respaldo `.env.local.bak-*` se borro.
  - Los push a `origin/main` los hace Mani a mano; `main` despliega a produccion en Vercel.

- **2026-09-16 — Overview del CRM, contrato de extension y re-plan completo en 5 fases.**
  Se reviso el repo entero, los grupos de WhatsApp "Ventas ComunicArte" y "Ventas JP Vieira", y
  los 5 reportes diarios de Mike (1 al 15 de sep, en Downloads). Hallazgos que cambiaron el
  modelo: una venta puede tener varios pagos (Maryce pago USD 750 el 15-sep sobre un cupo del
  31-ago); las plataformas de pago crecen (Zelle, DollarApp, Addi); los links de pago y los
  brochures se pierden en el chat; Juanito tiene closers de Calendly escritos en su codigo;
  Andrea vende en los dos programas; el reporte gira sobre origen del cierre, motivos,
  compromisos de pago con fecha y meta dinamica; hay mas de un producto por programa.

  **Decisiones de Mani (16-sep), ya bajadas a ADR:** 0012 contrato de extension (instancias en
  base, tipos en codigo; reemplaza el ticket 001), 0013 abonos separados de ventas, 0014 "Corte"
  pasa a "Cohorte" en todo, 0015 resultado ampliado (`compromiso_pago`, `cancelada`) y motivos
  como catalogo, 0016 productos por programa que crean gerentes **y** closers, 0017 recursos y
  comprobantes solo como links (descarta Vercel Blob de `docs/design.md`).

  **Documentos reescritos:** `docs/spec.md` (4 pilares + contrato, 6 criterios), `docs/plan.md`
  (fases F0-F4, modelo de datos, grafo de tickets), `docs/agents/context.md` (Cohorte, Abono,
  Producto, Recurso, Catalogo, Instancia/Tipo...), `AGENTS.md` (restriccion y contrato nuevos).
  Tickets 001-007 actualizados y 008-025 creados. **Tracker unico: `docs/tasks/README.md`.**
  Orden acordado: F0 contrato → F1 llamadas y ventas → F2 metricas → F3 recursos → F4 Nerd Stats.

  **Pendientes de negocio para Michael** (en el tracker): lista y correos de closers activos,
  moneda de los abonos por Bancolombia/MercadoPago, lead que no esta en el sync, formato del
  snapshot, confirmacion de "todos ven todo", que importar del historico C2.
  **Propuestas de Notion sin aplicar** (Mani no las aprobo aun): enlazar el tracker en la tarea
  del CRM y cerrar "Pedirle a Michael el .env.local" (el archivo ya existe).

  **No se toco codigo en esta sesion.** Siguiente paso: tickets 008 y 009 (listos). Ojo con S-14
  antes de aplicar cualquier migracion. Tarea de Notion asociada: "Definir arquitectura y
  construir dashboard CRM para closers de Retia".

- **2026-09-15 — Sesion de diseno: se creo `docs/design.md`** (vista de diseno del CRM que faltaba:
  actores, servicios por rol, propuesta de valor, layout de 3 capas, C4, secuencia por actor). Es un
  BORRADOR vivo, voz de Mani como principal, con etiquetas 🎯 MVP / 🔮 futuro / ⚔️ choca-con-ADR.
  Partio del raw de ideas de Mani (recuperado tras un incidente: el agente sobrescribio el archivo
  con `create` sin releer — leccion guardada, no repetir).

  **Decisiones de negocio nuevas tomadas por Mani en esta sesion (aun NO bajadas a spec/ADR/tickets):**
  1. **PDF -> snapshot.** El dashboard es el reporte en vivo; se permite un snapshot descargable a
     demanda (refleja, no re-calcula). YA aplicado en `docs/spec.md` §2. Reemplaza la restriccion
     anterior de "ningun reporte exportable". Formato (PDF/PNG/CSV) y quien lo toma: sin decidir.
  2. **Tercer rol: Developer.** All-around user (ve todo, cambia de vista, salud de la herramienta,
     settings dev). El ROL entra al MVP; las CAPACIDADES son post-scaffold. Requiere ampliar
     `rolEnum` (hoy `["gerente","closer"]`) + guards + tests + nav -> **actualiza ADR 0003
     conscientemente** (no re-litigar en silencio). Sin ticket aun.
  3. **Cuentas (cierra el bloqueante que tenia el registro por closer):** cada CLOSER entra con su
     propia cuenta Google (asi `closerId` se copia limpio de la sesion, ADR 0011 funciona); los
     MANAGERS comparten `administrativa@retiagrowth.com`; los DEVELOPERS usan cualquier cuenta.
  4. **Comprobante como archivo:** ademas de los datos de venta, ofrecer subir el comprobante como
     archivo. Recomendacion: Vercel Blob (`sales.comprobanteUrl` + endpoint upload) si el deadline
     lo permite; si aprieta, cae a post-lanzamiento. No bloquea el registro de la venta. Sin ticket.
  5. **Ambicion:** el CRM REEMPLAZA la operacion (estandarizar + automatizar + persistir), no es
     solo un dashboard de lectura.
  6. **Futuro (🔮) validado, fuera de MVP:** intake automatico por DTO+crontab desde Typeform/
     Calendly/Kapso; mapeo enriquecido de leads (perfil, notas, estado frio/caliente); calendar
     view en la pestana Calls del gerente; cambio de vista del developer.

  **Insumos guardados en el repo esta sesion:**
  - `docs/insumos/fleeting/2026-09-14-reunion-jefes-retia.md` — notas crudas de la reunion.
  - `docs/insumos/historico-c2/comunicarte-c2-consolidado.md` y `…/tactical-investor-c2-consolidado.md`
    — los dos MD historicos de Michael (backlog hasta que se inyecten; NO son insumo limpio 1:1,
    ver `docs/spec.md` §7).

  **Lo que este diseno DESTAPO y falta hacer (deuda de reconciliacion):** el diseno introduce un
  rol y 3 features que el spec/plan/tickets actuales NO cubren. Antes de codear hay que reconciliar:
  _(Nota del 16-sep: estos numeros se reasignaron. Snapshot = ticket 021; comprobante como
  archivo = descartado por ADR 0017, queda como link; rol Developer = ticket 024.)_
  - **Ticket 008** (falta escribir): snapshot descargable. Decidir formato y permiso primero.
  - **Ticket 009** (falta escribir): comprobante como archivo (Vercel Blob).
  - **Ticket 010** (falta escribir): rol Developer (enum + guards + tests + nav) + actualizar ADR 0003.
  - **`docs/spec.md`**: sumar Developer, snapshot (ya), comprobante; mover a §2/§7 lo que sea futuro.
  - **Pendiente de negocio:** Maico va a mandar ejemplos de reportes reales para alimentar la
    pestana de metricas del gerente. Sin recibir.

  **Decisiones abiertas** (ver `docs/design.md` §8): formato del snapshot; quien lo toma; comprobante
  en MVP o post; + los supuestos que ya venian en `docs/spec.md` §7 (todos-ven-todo sin confirmar por
  Michael, import historico con discrepancias, lead que no esta en el sync, marco regulatorio de
  datos financieros, Calendly individual vs compartido).

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
  bajo Michael) no se hereda. Desde el 14-sep el fork se despliega en `agencia-dani/retia-metrics`
  (`retia-metrics-seven.vercel.app`) con su propia base Neon (ADR 0018).

## Roadmap

> **El avance de los tickets del CRM (F0 a F4) se marca en
> [`docs/tasks/README.md`](../tasks/README.md)**, no aqui. Esta seccion solo resume lo listo y
> guarda la deuda heredada.

### Now (ready — no unmet dependencies)

1. [ ] **Probar el login con una cuenta real** en local y en produccion; despues borrar el
       cliente OAuth **web** viejo de `google-workspace-mcp` (el de escritorio es del MCP de Mani).
2. [ ] **`/grill-with-docs`: responsable del lead y alta manual de leads** (Michael, 16-sep) contra
       ADR 0004. Sale un ADR y, si hace falta, un ticket nuevo. Bloquea el 003.
3. [ ] **Sembrar `production`** (programas, cohortes, fuentes) con la URL de `production` cargada
       solo para ese comando, y probar `/api/cron/sync` con el `CRON_SECRET`. Sembrar tambien
       `dev` (`npm run seed:datos`) y hacer la prueba manual del 010 (programas en el sidebar).
4. [ ] **Tickets F0 listos** (estado en `docs/tasks/README.md`): 012 → 013 → 015 → 014 → 017, y 020.
5. [ ] **F-03 + F-07** juntos, con migracion (diseno en el tracker); primero `dev`, luego
       `production`.
6. [ ] **F-01:** confirmar el mapeo de `Estado` propuesto en el tracker e implementarlo.
7. [ ] **Documentar las pestanas nuevas** en `docs/estructura-bbdd.md` y revisar las 2.000 filas
       de `New form`.
8. [ ] **F-05 · Migrar las fechas ya guardadas.** El codigo ya escribe con `-05:00` explicito,
       pero las filas viejas quedaron en la zona del servidor y `compararCampos` no mira fechas,
       asi que un `npm run sync` normal **no** las repara. Decidir entre migracion puntual o
       re-sync forzado.

### Next (blocked until a "Now" item lands)

Cadena del CRM: ver el grafo en `docs/plan.md` y el estado en `docs/tasks/README.md`.

Los cinco de abajo se pueden verificar ahora: desde el 15-sep ya hay un `.env.local` con
`DATABASE_URL` y los IDs de las hojas (verificado el 16-sep, solo nombres de variables).

- [x] **B-01 (alto)** — hecho el 16-sep: `lib/sheets/plan-sync.ts` + `tests/plan-sync.test.ts`.
- [ ] **F-04 (medio)** — Las actualizaciones van fila por fila; la proxima carga grande se pasa
      del limite de la funcion. Falta upsert por lotes.
- [ ] **Prueba manual de S-02** — que `npm run usuarios -- quitar <correo>` saque a la persona en
      el siguiente request. El callback `jwt` no es testeable sin extraerlo de Auth.js.

Bloqueados por una decision de negocio (hay que preguntarle a Michael):

- [ ] **F-01 (alto)** — El sync lee `estado` de la hoja y lo descarta, asi que el embudo se queda
      sin datos para calcularse. **Desbloqueado 16-sep:** valores reales y mapeo propuesto en
      `docs/tasks/README.md`. Falta confirmar el mapeo y que hacer con `agenda` y
      `capacidadInvertir`.
- [ ] **F-06 (medio)** — Nadie detecta a la persona que desaparece de la hoja. Falta saber si las
      filas se borran o solo se mueven de pestana.
- [ ] **S-06 + B-06 (medio)** — La PII queda duplicada sin retencion ni control de acceso, y
      `people.raw` guarda la fila entera y crece sin techo. Falta la politica de retencion.

### Later (someday / not yet scoped)

- [x] **S-14** — resuelto el 16-sep (ADR 0018).
- [x] **S-10** — `AUTH_URL` en Vercel Production y callback en el cliente OAuth de `retia-growth`
      (16-sep).
- [ ] **S-12** — Los route handlers dependen de `SameSite=Lax`, sin CSRF propio. Se resuelve
      migrando las mutaciones a Server Actions.
- [x] **`CRON_SECRET`** — en `.env.local` y en Vercel Production desde el 16-sep.
- [x] **Pantalla para administrar usuarios.** Pasa a ser el ticket 015.
- [ ] **Las fuentes de `calls`, `sales` y `ad_spend`** estan sembradas pero inactivas: sus
      encabezados no se han inspeccionado y esta prohibido adivinar mapeos. Empezar con
      `npm run inspeccionar <sheetId> "<pestana>"`.

### Done

- [x] 2026-09-16 (noche) — Tickets 008-011 (F0), ADR 0020, migraciones 0002-0003 en `dev` y
      `production`, cuenta de servicio y login en `retia-growth`, `AUTH_URL`, respuestas de
      Michael bajadas a los docs.
- [x] 2026-09-16 (tarde) — S-14 (ADR 0018), `CRON_SECRET`, B-01, mensaje a Michael.
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

- **Google Cloud (16-sep):** todo lo de la app vive en el proyecto `retia-growth`: la cuenta de
  servicio del sync y el cliente OAuth del login. `google-workspace-mcp` es el proyecto personal
  de Mani para su MCP y no debe tener nada de la app.
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
