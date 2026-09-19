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
- **Un registro anulado no cuenta en NINGUNA metrica, y eso lo garantiza un predicado y un
  guardian (ADR 0026, ADR 0027).** Llamadas, ventas y abonos se anulan (nunca se borran) con
  quien, cuando y por que. Toda lectura de `calls`, `sales` o `abonos` —en `lib/`, `app/`,
  `components/` o `scripts/`, no solo en `lib/queries/`— pasa por `vigente(tabla)` de
  `lib/queries/vigente.ts`; la que quiere ver lo anulado lo dice con `incluyendoAnulados(tabla)`.
  `tests/vigencia-centralizada.test.ts` recorre el codigo cadena por cadena y falla si una consulta
  lee esas tablas sin decidir. **El riesgo no es escribir la anulacion: es olvidar una consulta**,
  porque una cifra inflada se ve creible y no lanza ningun error.

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
  gerente y el developer, y es la que usa la salvaguarda del ultimo administrador. Y hay una
  TERCERA, `trabajaLeads`: quien tiene `closer_id`, membresias, puede ser responsable de una
  persona y registrar. La cumplen el closer y el developer, **no el gerente** (ADR 0003). Son tres
  preguntas y tres funciones: una pantalla que pregunte `rol === "closer"` a mano deja al developer
  afuera, que es justo como `/ajustes/usuarios` quedo sin poder cargarle su `closer_id` (18-sep).
- 👑 **El developer es el DUEÑO: no se le restringe NADA, en lo absoluto** (Mani, 18-sep; ADR 0025
  punto 5). La proyeccion por rol existe para que una pantalla no le salga vacia, **nunca para
  darle menos** que a un gerente o un closer. De ahi la regla que se aplica al revisar codigo:
  **todo `rol === "..."` escrito a mano que excluya al developer es un bug, no una decision.** La
  respuesta vive en `lib/auth/roles.ts` (`esAccesoTotal` · `esAdministrador` · `trabajaLeads`); si
  ninguna de las tres encaja, la pregunta nueva se agrega ahi y no en el archivo que la necesita.
  **Y no aplica solo a las guardas de ruta:** `puedeAcceder` ya cerro ese frente, y el agujero que
  quedo fue el de las **reglas de datos** en `lib/catalogo/` y `lib/mutations/` ("¿este actor puede
  tocar esta fila?"). `exigirAccesoAlPrograma` preguntaba `rol === "gerente"` y le negaba al
  developer crear un producto con un 403 que ademas mentia ("un programa donde no vendes": el
  developer no vende en ninguno). Se destapo cargando los productos reales de `production`, no en
  un test. El otro incumplimiento, `/recursos` escondiendole la creacion, quedo arreglado el mismo
  dia: la prop se llama `puedeEditar` y sale de `esAdministrador`. **El nombre viejo, `esGerente`,
  era el bug en si**: la pregunta nunca fue de que rol es alguien, sino de que puede hacer. Cuando
  una variable de permiso se llame como un rol, sospecha.
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
- **`Mani` y `mani` son el MISMO closer (ADR 0030).** `closerId` es texto copiado (ADR 0011) que
  producen dos fuentes que no se hablan: la columna Closer de las hojas, escrita a mano, y el
  formulario de la app. **El texto se guarda como se escribio** —la ortografia de la hoja es suya,
  ADR 0004—, pero la pregunta "¿son el mismo closer?" la contesta `lib/closers/identidad.ts` y
  nadie mas: `mismoCloser` en memoria, `igualCloser` en SQL, `claveDeCloser`/`claveDeCloserSql`
  para agrupar. Que no haya dos cuentas reclamando el mismo closer lo garantiza un **indice unico
  sobre la forma normalizada** (migracion 0015), no el codigo (ADR 0005). 🩸 Salio del primer
  recorrido real en `production`: el `closer_id` quedo en `mani` mientras el de la otra closer era
  `Maru`, y con comparacion cruda eso son **dos closers en todas las metricas, sin un solo error**
  — el comparativo muestra dos filas, el filtro devuelve la mitad, y la reja de la anulacion le
  dice "la registro otro closer" a quien la registro.
  ⚠️ **Y ojo con el regex dentro de una plantilla `sql`: pasa por DOS capas de escape.** `'\s+'`
  escrito en un template literal de JS se cocina a `'s+'` y colapsa las **eses**: `Jose` habria
  quedado `jo e`. Por eso la expresion usa `'[[:space:]]+'`, que no lleva backslash, y hay un test
  que compara la normalizacion de SQL contra la de JavaScript **ejecutandolas**. Si escribes un
  regex con backslash dentro de `sql`, pruebalo contra el motor.
- **Una fila de catalogo se crea por el molde, tambien desde un script (ADR 0029).** La linea no
  es "script o pantalla": es **si la base ya esta viva**. Un script que mete filas de negocio en
  una base con datos reales hace lo mismo que un humano en una pantalla, asi que llama a la
  funcion de `lib/catalogo/` y nunca a `db.insert` en crudo. De ahi salen gratis la validacion y
  el `change_log`: **no hay que acordarse de registrar, no hay forma de crear la fila sin que
  quede registrada.** El "quien" lo da `actorDelScript()` de `scripts/actor.ts`
  (`SCRIPT_ACTOR_EMAIL`), en UN solo lugar, y el script **se niega a arrancar sin el**. Excepciones
  nombradas, no un permiso general: sembrar una base VACIA (`seed:datos`) y el acceso de
  emergencia (`npm run usuarios`), que existe justo para cuando no hay administrador con quien
  actuar. 🩸 Salio de los 5 enlaces de PayPal cargados en `production` el 18-sep: `change_log` de
  `enlaces_pago` quedo en **0**. **Omitir un rastro no lanza ningun error**, y dentro de tres
  meses "¿quien puso estos links?" no tiene respuesta en la base. Esos 5 siguen sin rastro a
  proposito: un historial de auditoria fabricado se ve igual que el de verdad.
- **Una corrida de sync es de un PROGRAMA, no de una fuente (ADR 0031).** Las personas se
  sincronizan leyendo TODAS las fuentes del programa juntas y deduplicando sobre el conjunto, asi
  que colgar la corrida de una fuente obligaba a elegir una a dedo (`fuentes[0]`) y **atribuia cada
  corrida a uno de los formularios de forma NO DETERMINISTA** cuando el programa tiene dos (esa
  consulta no lleva `ORDER BY`), o sea la bitacora podia decir cosas distintas de corridas
  identicas (F-07). Lo que se
  leyo se guarda como dato en `sync_runs.fuentes_leidas`, no como llave foranea, y las corridas
  viejas que no lo tienen muestran `—` en vez de un nombre inventado. Y solo puede haber UNA
  corriendo por programa (F-03): lo garantiza el indice unico parcial, no el codigo. Una corrida
  colgada mas de `MINUTOS_ANTES_DE_DAR_POR_MUERTA` (10 = 2x el `maxDuration` de las rutas) la cierra
  el reaper antes de arrancar la siguiente, o el candado pasaria de proteger a bloquear para
  siempre. **Chocar con el candado no es un fallo**: es 409 y el cron lo cuenta como `omitidos`.
- **Google Sheets es la fuente de verdad de los leads; el CRM lo es de llamadas, ventas y
  abonos.** El sync de leads no cambia (ADR 0004). Las llamadas y ventas se registran nativas en
  la app (ADR 0008) sobre las mismas tablas, con `origen = "app"` (ADR 0010).
- **Un mapeo de columnas que no cuadra falla ruidosamente.** Nunca adivinar una columna: se
  resuelve por texto del encabezado, no por posicion, y si falta un campo obligatorio se lanza
  `MapeoInvalidoError` con lo que se buscaba y los encabezados reales.
- **Un CENTINELA no es un dato, y el que se cuela no falla: miente** (18-sep). La regla de arriba
  ataja lo que no se puede leer; el agujero que quedaba era lo que SI se lee y no significa nada.
  Una hoja traia `1/1/0001 0:00:00` como "vacio", `parsearFecha` lo leia sin un solo error como el
  1 de enero del ano 1, y esas personas caian fuera de todo rango de fechas: dejaban de contar como
  lead **sin error, sin cifra rara y sin nada que revisar**. Era el 39% de un programa. Por eso
  `parsearFecha` tiene un piso de plausibilidad (`ANO_MINIMO_PLAUSIBLE`, ano 2000) y devuelve
  `null`, que es lo que el centinela de verdad significa. **Cuando entre otro tipo de dato desde una
  hoja, preguntale lo mismo: ¿cual es el valor que esta fuente escribe cuando no sabe?** Y ojo con
  el efecto de segundo orden, que fue el peor: el dedup conserva la fecha mas antigua, asi que el
  ano 1 le ganaba a las buenas y **una sola fila envenenada le borraba la fecha real a alguien que
  si la tenia** (839 de las 1.034). Tests en `tests/dedup.test.ts`.
- **Las fechas de aplicacion SI se comparan en el sync** (Mani, 18-sep). `fechaPrimeraAplicacion` y
  `fechaUltimaAplicacion` estan en `CAMPOS_COMPARABLES` (`lib/sheets/plan-sync.ts`), asi que un
  centinela reparado por el parser produce un diff y **el sync se auto-repara** en la corrida
  siguiente, con bitacora. Antes estaban fuera, y por eso arreglar el parser no reparaba lo ya
  escrito: sin diff no hay `aActualizar`. `npm run backfill-fechas` queda como herramienta de una
  sola vez (ya ejecutada), no como pieza del diseno. **El riesgo de comparar una fecha tiene test
  propio** en `tests/plan-sync.test.ts`: si una fecha leida de la base y la misma recien parseada
  dejaran de dar la misma cadena, el sync reescribiria la base entera cada dia sin fallar. Medido
  contra `production` el 18-sep: de 4.599 personas, el plan actualiza 6 filas y ninguna por fecha.

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
| Que registros cuentan | `vigente(tabla)` / `incluyendoAnulados(tabla)` en `lib/queries/vigente.ts` (ADR 0026) | `tests/vigencia-centralizada.test.ts`: recorre `lib/`, `app/`, `components/` y `scripts/` cadena de drizzle por cadena, y falla si una lee `calls`, `sales` o `abonos` sin aplicar el predicado |
| Con que rol actua una sesion | `rolDeVista(session)` en `lib/auth/vista.ts` (ADR 0028): la vista solo ESTRECHA, nunca ensancha | `tests/rol-de-vista-centralizado.test.ts`: recorre `app/` y `lib/` y falla si alguien decide alcance o permiso leyendo `session.user.rol` crudo; las lecturas de IDENTIDAD van como excepciones nombradas |
| Cuando puede arrancar una corrida de sync | El indice unico parcial `sync_runs_una_corriendo_por_programa_idx` + `SyncEnCursoError` (409) y el reaper, en `lib/sheets/sync.ts` (ADR 0031) | `tests/sync-candado.test.ts`: dos corridas simultaneas, el rechazo **sin tocar la corrida viva**, el reaper, y que las fuentes leidas queden guardadas. Mordido ademas contra Neon de verdad el 19-sep, no solo contra PGlite |
| Si un error del driver es de un codigo de Postgres | `lib/db/errores.ts`: `esViolacionUnica` (23505) y `esViolacionCheck` (23514) sobre `esCodigoPostgres`, que camina la cadena de `cause` | Revision manual: una copia local de ese bucle en cualquier modulo es el olor. Vivia duplicado byte a byte en 4 modulos hasta el 19-sep |
| Cuando dos textos son el mismo closer | `lib/closers/identidad.ts` (ADR 0030) + indice unico sobre `lower()` en `users` | `tests/closer-identidad.test.ts`: guardian sobre `lib/`, `app/` y `components/`, probado mordiendo en los dos sentidos (caza lo malo y **no** marca la solucion) |
| Quien crea una fila de catalogo, y desde donde | `lib/catalogo/` siempre (ADR 0029); el actor de un script, `actorDelScript()` en `scripts/actor.ts` | Revision manual: un `db.insert` sobre una tabla de catalogo en `scripts/` es el olor. Las dos excepciones estan en la tabla del ADR 0029 |
| Contrato de extension | ADR 0012, enmendado por el 0026; molde en `lib/catalogo/` | `tests/contrato-extension.test.ts` (ticket 009): ningun programa escrito en el codigo; tests del molde (ticket 011): siempre `change_log`, y **nunca `DELETE` sobre una fila con referencias** (hasta el ticket 030 el molde no borra nunca) |

## Feedback loops

The agent should run these to get fast signal on whether code works. Keep them current.

- **Test:** `npm test` (Vitest, 577 pasando al 19-sep). Los tests que necesitan base usan PGlite en
  memoria con todas las migraciones aplicadas: `tests/helpers/base-de-prueba.ts` (ADR 0020).
- **Typecheck:** `npm run typecheck` (`tsc --noEmit`) · **Lint:** `npm run lint`
- **Run:** `npm run dev` (http://localhost:3000)

`npm run build` no necesita `.env.local`: el cliente de la base se crea de forma perezosa.

## Conventions

- **El gestor de paquetes es `npm`, no `pnpm`** (ADR 0001). Donde una instruccion diga `pnpm X`,
  corre `npm run X`.
- **`revalidatePath` NO refresca la pantalla que acaba de escribir.** Una server action que muta
  y quiere que la vista actual cambie llama `router.refresh()` en el cliente; `revalidatePath`
  sirve para las OTRAS rutas cuyo cache de ruta quedaria viejo. Y en una ruta dinamica se invalida
  por su **patron** con el tipo (`revalidatePath("/personas/[id]", "page")`), no por un path
  concreto ni con `"layout"` sobre un segmento que no tiene layout propio: eso no coincide con
  nada y **no falla, simplemente no invalida**. Costo un falso "no funciona" en el recorrido del
  18-sep, con la escritura correcta en la base y la pantalla mostrando el total anterior.
- **Next 16 renombro `middleware.ts` a `proxy.ts`.** El archivo vive en la raiz con ese nombre.
- **shadcn/ui corre sobre `@base-ui/react`, no sobre Radix.** Se usa `render={<Componente />}` en
  vez de `asChild`, y `onClick` en vez de `onSelect` en los items de menu. **Y Base UI es ESTRICTO
  con la composicion: una parte fuera de su contenedor lanza en tiempo de ejecucion, no en
  compilacion.** `DropdownMenuLabel` es `Menu.GroupLabel` y exige vivir dentro de un `Menu.Group` o
  un `Menu.RadioGroup`; suelto tira `MenuGroupContext is missing`. Eso paso de verdad (18-sep) y
  como el menu de usuario vive en el sidebar, **el error se llevaba puesta la pagina entera al
  ABRIR el menu**, con 543 tests en verde. Estuvo roto varios dias.
- **Cargar una pantalla no es probarla, y un "recorrido visual" que solo carga no sirve.** Lo que
  rompe en Base UI son las INTERACCIONES: abrir un menu, desplegar un select, abrir un dialogo.
  Ningun test de este repo ve un error de contexto de React en tiempo de ejecucion. Cuando revises
  una pantalla, **hace clic en todo lo que se abre**, y mira la consola del navegador.
- **Y para una regla de PERMISO, hacer clic tampoco alcanza: hay que forjar la peticion.** Mirar
  que el boton no aparezca prueba lo unico que un atacante no hace. Las dos reglas duras de arriba
  —"el rol se enforza en el servidor" y "esconder un boton no es seguridad"— estuvieron escritas
  meses sin que ningun recorrido las midiera. **Como se muerde una server action** (hecho el 18-sep
  con el 031): envolves `window.fetch` en la pagina para capturar la cabecera `Next-Action` al
  enviar el formulario UNA vez desde la vista que si puede; con ese id invocas la accion a mano,
  saltandote la interfaz entera, desde la vista que NO deberia poder. Se espera el mensaje de 403 y
  **la base sin moverse**. En el mismo viaje se prueba la otra mitad: meterle al cuerpo un `id`
  ajeno y comprobar que se ignora, porque el objetivo sale de la sesion y no del input.
  **Un contrato que nadie mordio es una creencia.**
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
  **Afinado el 19-sep midiendolo, porque la regla de arriba esta escrita mas ancha de lo que es:**
  lo que desactiva la calificacion es meter una TABLA en la plantilla (`${people}`), no la plantilla
  en si. Una plantilla que solo referencia columnas las sigue calificando —`sql`${syncRuns.fuentesLeidas}``
  dentro de un select con join se renderiza `"sync_runs"."fuentes_leidas"`, comprobado con
  `.toSQL()`—. La conducta practica no cambia (**nada de subconsultas correlacionadas**), pero no
  hay que desconfiar de un cast de tipo sobre una columna ni "arreglarlo" a ciegas. Si dudas,
  imprime `query.toSQL().sql`: cuesta un comando y responde de verdad.
- **La base se usa por `drizzle-orm/neon-http`: sin sesion ni transacciones interactivas.** Cada
  consulta es una peticion HTTP aparte, asi que `pg_advisory_lock` y `SET` de sesion no sirven.
  La exclusion mutua se hace con un indice unico en la base. **Hecho en el sync (ADR 0031):** el
  INSERT de la corrida ES el candado, contra un indice unico parcial `WHERE estado = 'corriendo'`.
  Si necesitas exclusion mutua en otra parte, ese es el molde: no hay candado que pedir ni que
  acordarse de soltar.
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
