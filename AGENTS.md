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

This repo is set up for agentic engineering. **Desde el 27-sep-2026 la documentación vive en un solo
lugar, sin copias entre documentos.** Léelos en este orden:

1. **Este archivo** (`AGENTS.md`): las reglas duras, los contratos, los comandos y las convenciones.
2. **Plan + tickets** (`docs/plan.md`, `docs/tasks/`) — **el punto de entrada del trabajo**: el norte, los
   tres tracks (CRM, UI/UX, Integraciones), el orden por pasos con hitos, qué paso cumple cada criterio
   de aceptación y **la lista única de decisiones abiertas**. Cada ticket cabe en una ventana de
   contexto limpia y cita lo que sirve. Nunca se salta del producto al código sin pasar por un ticket.
   **`docs/tasks/README.md` es el único tracker de avance**: se toma un ticket cuyas dependencias estén
   todas en `done`, y al cerrarlo se marca ahí y se pone `status: done` en su archivo.
3. **`docs/overview.md`** — qué es la herramienta de principio a fin: el problema, los programas, los
   roles y sus historias de usuario, el recorrido de un lead, las métricas, el alcance, los criterios de
   aceptación, de dónde salió y **el vocabulario del dominio** (§11). Es el contrato de producto (lo que
   antes era la spec) y el glosario: léelo antes de nombrar variables, funciones o archivos.
4. **`docs/structure.md`** — los diagramas y los componentes, técnicos y operacionales: la operación de
   hoy, los flujos, **el motor de etapas y su tabla de transiciones**, la arquitectura, el modelo de
   datos, la ingesta, la atribución, las pantallas y quién ve qué, **el sistema de diseño "Tinta"**
   (§9, **obligatorio antes de tocar cualquier pantalla**: ningún color, sombra ni radio a mano, un solo
   acento morado, cinco tonos de estado por `<Badge variant>`, toda cifra comparable en `cifra`), **el
   mapa de las hojas de Sheets** (§10, antes de tocar `lib/sheets/` o el traslado: qué pestaña es
   fuente, cuáles son vistas derivadas que romperían el dedup y cuáles son respaldos que inflan los
   conteos) y la migración.
5. **`docs/operations.md`** — cómo se opera: entornos, las URLs de cada programa, variables, base de
   datos, scripts, despliegue, secretos, incidentes, deuda y datos de validación.
6. **ADRs** (`docs/adr/`, índice en `docs/adr/README.md`) — las decisiones vigentes, cada una reescrita
   para decir lo que se va a construir, y el índice de las retiradas (el código cita sus números).
   Léelas antes de cambiar un área decidida; no se re-litigan. Una nueva toma el siguiente número libre.
7. **Handoff** (`docs/agents/handoff.md`) — memoria de sesiones: se lee al arrancar y se actualiza al
   cerrar. Referencia tickets, no los duplica.

Los documentos que se fundieron el 27-sep (spec, plan v2, propuesta del 24-sep, revisión del 22-sep,
diseño, sistema de diseño, glosario, mapa de las hojas, auditoría del 19-sep e insumos) siguen en git
(`git show da68cdf:<ruta>`). **`docs/plan.md` §8 dice dónde quedó cada referencia vieja** que citen un
ticket o un comentario del código.

Available skills (the pipeline is **spec → plan → build**): `/spec` (el contrato de producto de este
repo vive en `docs/overview.md`), `/plan` (`docs/plan.md` + tickets), `/grill-me`, `/grill-with-docs`
(alinea y documenta antes de construir; aquí escribe ADR en `docs/adr/` y vocabulario en
`docs/overview.md` §11), `/tdd` (red-green-refactor), `/diagnose` (disciplined debugging),
`/improve-codebase` (deepen modules), `/handoff` (compact a session).

Keep this file current yourself: when a feedback-loop command turns out wrong or missing, or a durable convention emerges that no linter enforces, update the relevant section below directly rather than letting it drift.

## Restricciones no-negociables

Reglas duras que gobiernan todo el proyecto y que ningun linter puede verificar.

**Integridad de los datos**

- **Dedup obligatorio por correo.** Toda tasa se calcula sobre personas, nunca sobre filas. La
  BBDD de Tactical Investor tiene ~2.950 filas que son ~1.840 personas, y hay un correo con 12
  aplicaciones. Calcular sobre filas infla las tasas ~60% y toda decision de presupuesto sale
  mal. La garantia vive en un indice unico de la base, no solo en el codigo (ADR 0005).
- **El PROGRAMA es parte de la identidad de un lead, y dos programas no se cruzan JAMAS**
  (Mani, 21-sep). Un lead siempre entra con su programa asignado, y la llave del dedup es
  `(program_id, email_normalizado)`, no el correo solo: **la misma persona en los dos programas son
  dos leads**, y eso es correcto, no un duplicado. La base ya lo enforza en todo lo que importa
  —`leads_programa_email_idx`, `lead_contactos_valor_idx`, `deals_uno_abierto_por_lead_y_programa_idx`,
  `calls_huella_idx`, `ad_spend_huella_idx`, `productos_programa_nombre_idx`,
  `cohorts_programa_codigo_idx`— y `lead_contactos.program_id` esta **denormalizado a proposito**
  para poder hacerlo. **De nada sirve combinar metricas de programas:** ComunicArte y Tactical tienen
  tickets distintos (USD 797 vs 1.500), economia distinta y umbrales distintos, asi que una cifra
  que los sume no significa nada y **se ve perfectamente creible**. **Excepcion unica, 24-sep (ADR
  0048):** el Dashboard ofrece "todos los programas" y ahi **solo suma magnitudes sumables en la misma
  unidad** (conteos, caja en USD, gasto); tasas, meta, meta dinamica, CPL, ROAS y comision van por
  programa, lado a lado, y la funcion del agregado **no compila** con una tasa. Toda lista operativa
  (Leads, Deals, Calls, Students, Inbox) es de un programa, con selector obligatorio. Consecuencia para toda pantalla
  nueva: el programa **no es un filtro, es una frontera**. Una vista que cruce programas tiene que
  ser imposible de construir, no solo desaconsejada — el molde es el del ADR 0023, donde el
  comparativo entre closers *"no se puede acotar ni queriendo, porque el tipo de la consulta no lo
  admite"*. Se enforza en el TIPO, no en la revision.
- **El ORIGEN de un lead tiene dos mitades y ninguna se inventa (ADR 0044, ADR 0045).** De donde vino
  el clic lo dice el **UTM**, que es texto copiado de la fuente y **no se normaliza ni se reescribe**
  (ADR 0004). Quien lo trajo lo dice `leads.traido_por_user_id`, que es una **FK real a `users`,
  nunca texto** — escribirlo como nombre repetiria el ADR 0030 con `Maru`, `maru` y `closer maru`
  como tres closers. **Un closer no teclea un UTM: tiene un enlace de captacion**, por closer y
  programa, **calculado y no guardado** (ADR 0024). Y el estandar de UTM son **TRES campos,
  uno solo para todos los programas** (Mani, 21-sep): `utm_source` la plataforma, `utm_medium` el tipo
  de trafico, `utm_campaign` la campana. **Desde el 24-sep (ADR 0051) `utm_content` y `utm_term` se
  CAPTURAN pero ningun reporte los lee**, con UNA excepcion: `utm_content` lleva el **codigo opaco del
  closer** en su enlace (`utm_source=closer`, `utm_medium=referido`) y lo lee **solo el emparejador**,
  solo en ese canal, para escribir `traido_por_user_id`. El significado de `utm_content` depende del
  canal, y leerlo sin mirar el canal es el error medido el 21-sep (anuncio en ComunicArte, conjunto en
  Tactical). El par source + medium es un **Canal** con su Area; el catalogo se llama asi y no
  "origen" porque la tabla `origenes` ya existe con otro significado. Ningun link se arma a mano: sale
  del builder del CRM. 🩸 Y el emparejamiento de un
  envio contra los patrones **tiene que ser determinista**: gana el mas especifico, un empate es un
  **error visible** y no una eleccion silenciosa, y lo garantiza un indice unico. Un envio que casa
  con dos campanas se cuenta en las dos y el CPL de ambas sale mal **sin lanzar un error** — es el
  `fuentes[0]` sin `ORDER BY` del ADR 0031, ahora con dinero encima. 🎯 Y hay **DOS categorias de huerfano, no una, y no se funden**:
  **sin UTM** es un envio que llego sin origen —problema de **captacion**, **irrecuperable** para lo
  que ya entro, hoy 726 de 4.823 (15%), con Tactical en 26% y ComunicArte en 1%— y **sin clasificar**
  es un envio que **si trae UTM** pero no casa con ningun patron —problema de **configuracion**, se
  arregla con una fila y **repara hacia atras**—. Un tablero que diga *"800 sin atribucion"* no dice
  cual de los dos problemas tiene el negocio. **Las dos se muestran siempre, con su conteo y su
  porcentaje**, y **"sin UTM" no es un estado de error**: es un hecho del lead, tan valido como
  `facebook / cpc`.
- **Caja recaudada y ventas cerradas son dos metricas separadas.** Los montos de la columna
  Precio son adelantos parciales, no precios finales. Nunca inferir una de la otra. La caja es
  la suma de `abonos` por fecha del abono; las ventas son el conteo de **deals en Abonado o
  Completo** (ADR 0013, ADR 0037; `sales` ya no existe).
- **Todo dinero derivado tiene UNA definicion (ADR 0024).** Lo abonado y el saldo viven en
  `lib/queries/saldo.ts`; ninguna consulta vuelve a escribir `sum(abonos.monto)` a mano. La regla
  general: si dos lugares tienen que dar la misma cifra, la cifra vive en un modulo y los dos la
  importan. Estuvo copiada en `saldoDeVenta` (la reja que bloquea un sobrepago) y en
  `ventasDePersona` (lo que el closer ve): una pantalla y una reja discrepando sobre el mismo
  numero no se descubre hasta que el dinero no cuadra. `tests/saldo-centralizado.test.ts` compara
  las dos salidas y falla si alguien las separa. ⚠️ **El modulo volvio el 27-sep sobre el deal** (`saldosDeDeals`,
  lo lee el motor de etapas, ticket 045); **su test comparativo todavia NO EXISTE**: salio con `sales`
  en el corte de la 0020 y lo recrea el ticket 060, cuando exista la reja del abono que comparar. **La regla no es solo del dinero:** si dos lugares
  responden la MISMA pregunta, la respuesta vive en un modulo y los dos la importan — la proyeccion
  es del llamador, el predicado es del modulo (asi se consolido `programasActivos`). Dos preguntas
  distintas que hoy dan el mismo SQL siguen siendo dos funciones.
- **Un registro anulado no cuenta en NINGUNA metrica, y eso lo garantiza un predicado y un
  guardian (ADR 0026, ADR 0038).** Llamadas, ventas y abonos se anulan (nunca se borran) con
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
- **TODA fecha de este sistema es de Bogota, Colombia (Mani, 19-sep).** No existe "la zona del
  entorno": la maquina de quien corre un script y una funcion de Vercel no son la misma, y sobre
  una columna `timestamptz` eso produce instantes distintos para la MISMA fila. Colombia no tiene
  horario de verano, asi que siempre es `-05:00` y va **explicito**. Dos lugares lo implementan y
  no debe haber un tercero: `parsearFecha` en `lib/sheets/mapeo.ts` (lo que entra desde las hojas)
  y `hoyEnBogota()` en `lib/format.ts` (lo que la app prellena). `new Date(a, m, d)` y
  `toISOString().slice(0,10)` estan PROHIBIDOS para una fecha de negocio: el primero usa la zona
  del proceso y el segundo da el dia en UTC, que de 7pm a medianoche ya es manana.
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
  persona y registrar. La cumplen el closer y el developer, **no el gerente** (ADR 0003). **Decidida el
  24-sep y sin construir: una CUARTA, `manejaPauta`** (ADR 0052), para el rol nuevo `paid_trafficker`,
  que cumplen el paid trafficker, el gerente y el developer; y la pregunta de **alcance**, *"¿que
  programas ve esta sesion?"* (ADR 0048), tambien en `lib/auth/`. Son preguntas distintas y funciones
  distintas: una pantalla que pregunte `rol === "closer"` a mano deja al developer
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
  que un gerente: es la politica "todos ven todo" (ADR 0048), **acotada desde el 24-sep a los programas
  donde el closer tiene membresia activa** (ADR 0048, ticket 094): fuera de ellos no ve nada. Ambas reglas conviven: la
  disjuncion de roles sigue rigiendo el acceso a rutas de administracion, pero ya no rige la
  visibilidad de datos dentro del dashboard. Los productos (`/productos`) los editan ambos roles
  (ADR 0016), y desde el 19-sep un closer tambien crea recursos de sus programas y plataformas de
  pago; el resto de la configuracion es de quien administra. El filtro del dashboard sale
  de la URL y nunca de la sesion (ADR 0023): un closer sin filtro ve el programa completo, y el
  comparativo entre closers no se puede acotar ni queriendo, porque el tipo de la consulta no lo
  admite.
- **Nada de la app es publico.** Sin sesion no se ve ni una cifra. Unica excepcion:
  `/api/health`, que no expone ningun dato del negocio.
- **Ningun dato personal en URLs ni en query strings.** Los identificadores en rutas son ids
  opacos, nunca correos.
- **Secretos solo en `.env.local` y en Vercel.** Nunca en el repo, nunca abiertos en un editor
  (ver la seccion de incidentes en `docs/agents/handoff.md`). **Excepcion nombrada (ticket 105, ADR
  0055):** el secreto HMAC de cada fuente webhook vive en `sources.secreto_webhook`, porque es una fila
  editable (ADR 0012) y verificar una firma exige el valor. Lo escribe SOLO `rotarSecretoDeFuente`, se
  muestra una vez, nunca pasa por el molde ni por `change_log`, y ninguna lectura del catalogo ni de la
  pantalla lo devuelve (`tests/fuentes-webhook.test.ts`). **Segunda excepcion (ADR 0057, 28-sep):** el token de
  Calendly de cada programa vive en `programs`, con las mismas reglas (ticket 109).

**Arquitectura**

- **La estructura se organiza por dominio, no por tamaño ni por tipo técnico.** Las pantallas,
  tipos y helpers que pertenecen a un mismo límite viven juntos: por ejemplo,
  `components/resources/` y `components/admin/`. Las rutas en `app/` coordinan; las consultas y
  mutaciones de negocio viven en `lib/`; un componente de pantalla no debe importar la
  implementación interna de otro dominio para reutilizar un tipo o helper. Extraer una pieza solo
  cuando tenga una responsabilidad y contrato propios, conservar imports públicos durante la
  migración y añadir un test de su comportamiento puro. No hacer movimientos masivos ni crear
  carpetas genéricas (`shared`, `common`, `utils`) para esconder acoplamiento. Ver ADR 0033.
- **El crecimiento se mide antes de reorganizar.** Un módulo grande no se divide por contar líneas:
  se identifica una frontera de dominio, se extraen primero tipos/helpers puros, se conserva el
  comportamiento, y se valida con typecheck, lint y tests del dominio más la suite completa.
  Las extracciones posteriores de `mi-dia-registro`, `dashboard` y `schema` deben seguir el mismo
  orden; si no hay frontera estable, se deja el módulo en su lugar y se documenta la deuda.
- **Las instancias viven en la base, los tipos viven en el codigo (ADR 0012).** Si el codigo no
  toma una decision segun un valor (un programa, una cohorte, un closer, un producto, una
  plataforma, un motivo, un origen, un recurso), ese valor es una fila editable desde la app,
  nunca un literal, un enum ni una ruta fija. Toda entidad configurable sigue el molde de
  `lib/catalogo/`: tabla con `activo`, un solo esquema zod, pantalla con guard, y cada cambio va a
  `change_log`. **No se borra lo que YA SE USO** (enmienda del ADR 0026 al 0012, 18-sep): una fila
  con cero referencias se borra de verdad, una con referencias solo se desactiva y la app dice
  cuantas tiene. Lo que no puede pasar es que la app diga "borrado" habiendo desactivado.
  Ningun slug de programa aparece en `lib/`, `app/` ni `components/`.
- **`Mani` y `mani` son el MISMO closer (ADR 0030).** `closerId` es texto copiado (ADR 0030) que
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
- **Legado, se retira con el corte directo (decisión A6 de `docs/plan.md`): una corrida de sync es
  de un PROGRAMA, no de una fuente (ADR 0031, retirado; el molde del candado quedó en el ADR 0005).** Las personas se
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
- **El Deal es el objeto central, y `sales` ya no existe (ADR 0037).** Una venta es un deal en
  **Abonado o Completo**, nunca un deal a secas: contar todos los deals infla las ventas y **no
  lanza ningun error**. `deal.etapa` es un `pgEnum` porque el codigo decide con ella (embudo,
  Students, cartera, movimientos automaticos): son **once** etapas desde el 24-sep (Seguimiento entra
  con el ticket 043). `lead.estado` es texto; si se retira en favor de `calificacion` es la decision
  D4 de `docs/plan.md` §7.
  **`deals.etapa` no se escribe a mano desde ninguna parte**: el unico camino es `moverEtapa()`
  (etapa 2), que valida y escribe `deal_etapa_historial`.
- **Anular NO es Cierre Perdido, y por eso anulado no es una etapa (ADR 0038).** Cierre Perdido es
  un resultado del negocio y CUENTA en el embudo; anulado es una correccion de tecleo y no cuenta
  en ninguna metrica. 🩸 Si se funden, un error de dedo se convierte en una venta perdida y la
  tasa de conversion miente. Y como es una marca ortogonal, anular no borra el dato de en que
  etapa estaba el deal cuando se descubrio el error.
- **El formulario es la fuente de los leads; el CRM lo es de todo lo demas (ADR 0004).** Los leads
  entran por webhook (corte directo, 22-sep) o por alta manual; lo que hay en Sheets se traslada una
  sola vez por la misma puerta de ingesta. Deals, llamadas, abonos y dueño nacen y viven en el CRM, y
  nada se escribe de vuelta a la hoja. Lo que manda una fuente se guarda como llego.
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
| Que registros cuentan | `vigente(tabla)` / `incluyendoAnulados(tabla)` en `lib/queries/vigente.ts` (ADR 0026, ampliado a `deals` por el ADR 0038) | `tests/vigencia-centralizada.test.ts`: recorre `lib/`, `app/`, `components/` y `scripts/` cadena de drizzle por cadena, y falla si una lee `calls`, `deals` o `abonos` sin aplicar el predicado. 🩸 Cazo TRES lecturas reales el 22-sep, escritas horas antes por la misma sesion. **Ojo con izar el predicado a una variable**: el guardian lee CADENA por cadena, y una condicion escondida en un `const` le pasa por debajo — y al lector de la consulta tambien |
| Como se escribe un valor en `change_log` | `textoDeBitacora` en `lib/db/texto-de-bitacora.ts`, UNA funcion que importan el molde de catalogo y el rastro operativo: objeto o arreglo como JSON con llaves ordenadas, fecha en ISO, ausente como `null`. **El diff de una edicion se decide con ella**, asi que tambien decide SI hay cambio | `tests/texto-de-bitacora.test.ts` y `tests/bitacora-jsonb.test.ts`. 🩸 Hasta el 28-sep eran dos copias con `String(valor)`: editar SOLO un campo jsonb (el mapeo de una fuente) comparaba `"[object Object]"` contra si mismo y **no se guardaba, sin error** |
| Que toda escritura del CRM deje rastro | `crearConRastro` / `editarConRastro` en `lib/crm/rastro.ts` (ADR 0042): la escritura y su fila de `change_log` en la MISMA operacion, sobre `deals`, `calls`, `abonos` y `deal_actividades`. En un `update` se registran **los campos tocados**, uno por fila; si nada cambio no se escribe nada | `tests/rastro-operativo.test.ts`: guardian sobre `lib/`, `app/`, `components/` y `scripts/`, mordido en los dos sentidos. **Hoy no hay ni una escritura que vigilar y eso es el punto**: tiene que existir ANTES que las mutaciones de las etapas 2 y 4, porque omitir un rastro no lanza ningun error |
| Cuantos intakes de leads tiene un programa | UNO activo: `sources_una_activa_por_programa_idx`, unico PARCIAL `WHERE activo` (ADR 0039). `activarFuente` traduce el 23505 a un 409 que dice la regla | `tests/sync-candado.test.ts` y `tests/fuentes.test.ts`, mordidos en los dos sentidos. La reja vive en la base y **no en un `select` previo**: entre comprobar y escribir cabe otra activacion |
| Cuando un deal ocupa el cupo de su lead | `deals_uno_abierto_por_lead_y_programa_idx`: unico parcial `WHERE etapa NOT IN (completo, cierre_perdido) AND anulado_en IS NULL` (ADR 0037, ADR 0038) | `tests/modelo-crm-indices.test.ts`. 🩸 La mitad del `anulado_en` no es un detalle: sin ella, quien registra un deal sobre el lead equivocado y lo anula **no puede crear el correcto** — la base se lo rechaza por un registro que la app ya declaro inexistente |
| Con que rol actua una sesion | `rolDeVista(session)` en `lib/auth/vista.ts` (ADR 0028): la vista solo ESTRECHA, nunca ensancha | `tests/rol-de-vista-centralizado.test.ts`: recorre `app/` y `lib/` y falla si alguien decide alcance o permiso leyendo `session.user.rol` crudo; las lecturas de IDENTIDAD van como excepciones nombradas |
| Cuando una fuente puede estar ACTIVA | Una fuente activa SIEMPRE tiene un mapeo que cuadra: `activarFuente` prueba contra los encabezados reales en ese momento, y `editarFuente` vuelve a probar si la fuente ya esta activa (ticket 016) | `tests/fuentes.test.ts`, mordido en los dos sentidos: editar una ACTIVA a un mapeo roto se rechaza con 422 **sin tocar la fila**, y editar una INACTIVA a lo mismo se permite. **No se guarda bandera de "ultima prueba ok"**: envejeceria |
| Cuando puede arrancar una corrida de sync | El indice unico parcial `sync_runs_una_corriendo_por_programa_idx` + `SyncEnCursoError` (409) y el reaper, en `lib/sheets/sync.ts` (legado del sync de Sheets; el molde vive en el ADR 0005) | `tests/sync-candado.test.ts`: dos corridas simultaneas, el rechazo **sin tocar la corrida viva**, el reaper, y que las fuentes leidas queden guardadas. Mordido ademas contra Neon de verdad el 19-sep, no solo contra PGlite |
| Si un error del driver es de un codigo de Postgres | `lib/db/errores.ts`: `esViolacionUnica` (23505) y `esViolacionCheck` (23514) sobre `esCodigoPostgres`, que camina la cadena de `cause` | Revision manual: una copia local de ese bucle en cualquier modulo es el olor. Vivia duplicado byte a byte en 4 modulos hasta el 19-sep |
| Como sale una entrada invalida hacia el cliente | `normalizando` en `lib/errors-zod.ts`: traduce un `ZodError` al `ErrorDeApp` 400 del contrato | Revision manual: un `catch` local que haga `instanceof z.ZodError` es el olor. Vivia duplicado byte a byte en **9** modulos hasta el 20-sep. `lib/catalogo/cohortes.ts` es la unica excepcion legitima y **no se aplano**: ademas traduce 23505 y 23514, asi que compone. Esa parte suya SI tiene test: `tests/cohortes-errores-driver.test.ts`, donde el choque lo produce el indice y el CHECK de verdad, no un error fabricado con `{ code: "23505" }` |
| Cuando dos textos son el mismo closer | `lib/closers/identidad.ts` (ADR 0030) + indice unico sobre `lower()` en `users` | `tests/closer-identidad.test.ts`: guardian sobre `lib/`, `app/` y `components/`, probado mordiendo en los dos sentidos (caza lo malo y **no** marca la solucion) |
| Quien crea una fila de catalogo, y desde donde | `lib/catalogo/` siempre (ADR 0029); el actor de un script, `actorDelScript()` en `scripts/actor.ts` | Revision manual: un `db.insert` sobre una tabla de catalogo en `scripts/` es el olor. Las dos excepciones estan en la tabla del ADR 0029 |
| Contrato de extension | ADR 0012, enmendado por el 0026; molde en `lib/catalogo/` | `tests/contrato-extension.test.ts` (ticket 009): ningun programa escrito en el codigo; tests del molde (ticket 011): siempre `change_log`, y **nunca `DELETE` sobre una fila con referencias** |
| Si un actor puede tocar una fila de un programa | `exigirAccesoAlPrograma` en `lib/catalogo/acceso-programa.ts` (ADR 0016). Administra cualquiera; un closer solo donde tiene membresia ACTIVA | `tests/productos.test.ts` y `tests/acciones-recursos.test.ts`. **Vivia privada dentro de `productos.ts` hasta el 20-sep**: el olor es una segunda copia del `select` sobre `miembros_programa` |
| Cuando se puede BORRAR una fila de catalogo | `borrarSiNoSeUso` en `lib/catalogo/molde.ts` (ADR 0026 punto 5): cuenta referencias primero, cero borra, una o mas desactiva y devuelve el conteo | `tests/catalogo.test.ts`, guardian endurecido el 20-sep: **UN** solo `.delete(` en `lib/catalogo/`, dentro de `molde.ts` y despues del inicio de `borrarSiNoSeUso`. La version anterior solo pedia que el archivo contuviera el nombre de la funcion y **no cazaba un `DELETE` clandestino**. La UNICA excepcion, nombrada en `TABLAS_PUENTE_BORRABLES`: una tabla PUENTE (hoy `plataformas_programa`) — no la referencia nadie, asi que quitar el vinculo no pierde historial. El guardian exige que CADA `.delete(` de ese archivo caiga sobre una puente de la lista, asi que un `.delete(plataformasPago)` al lado sigue cayendo |
| Que programas ve un selector de plataforma | `plataformasDelPrograma` / `vinculosDePlataformas` en `lib/catalogo/plataformas.ts` (ADR 0034). Es **proyeccion, no reja**: el servidor NO rechaza un abono por una plataforma sin vincular, porque bloquear un cobro real por un dato de configuracion es peor que ofrecer una opcion de mas | `tests/plataformas-programa.test.ts` (18): idempotencia, el acceso por programa en los dos sentidos, y que crear un enlace de pago ESCRIBA el vinculo (`tests/acciones-recursos.test.ts`) — sin eso, la plataforma con la que el closer acaba de cobrar no le sale en el selector del abono, sin un solo error |
| Si un error del driver es una FK violada | `esViolacionForanea` en `lib/db/errores.ts`: 23503 (Postgres real, Supabase) **y 23001** (PGlite reporta asi el RESTRICT) | `tests/db-errores.test.ts`. Reconocer solo uno pasa en local y revienta con 500 en produccion |
| Que un POST de otro sitio no dispare una mutacion | `exigirMismoOrigen` en `lib/auth/origen.ts` (S-12), en el UNICO handler que muta: `POST /api/sync/[programa]`. El resto son Server Actions, que Next ya protege | `tests/sync-permisos.test.ts`, incluido el caso `x-forwarded-host`: comparar contra el host equivocado **rechaza peticiones legitimas en produccion sin romper un test** |
| Que quitar a alguien lo saque YA | `revalidarToken` en `lib/auth/revalidacion.ts` (S-02): revalida contra `users` en cada emision, no al expirar el JWT | `tests/revalidacion-sesion.test.ts`. Lo que NO cubre un test: que Auth.js llame el callback en cada emision |
| Como se arma un link de captacion | **UN** generador: `programs.form_url` + los UTM (de la campana, o del closer). **Derivado, nunca guardado** (ADR 0051, ADR 0024) | Revision manual: una segunda concatenacion de "URL mas parametros" es el olor. 🩸 Y el test que importa vive en el ticket 092: **el patron tiene que reconocer el link que el generador acaba de producir** — con macros de Meta son dos actos que pueden divergir; con el link generado es uno solo y no pueden |
| A quien pertenece un envio (area, campana, persona) | `lib/atribucion/emparejar.ts` (ADR 0045): un envio resuelve a **lo sumo uno**, gana el patron mas especifico, y el empate lo hace **imposible** un indice unico sobre la combinacion del patron dentro del programa | `tests/atribucion-emparejador.test.ts` (ticket 085): guardian sobre `lib/`, `app/`, `components/` y `scripts/`, mordido en los dos sentidos, **mas un test que corre los patrones en distinto orden y exige el mismo resultado**. Sin eso, el orden de la consulta decide la plata |
| Que significa cada campo UTM | La convencion del ADR 0051 (24-sep): **tres se leen** (`utm_source` plataforma · `utm_medium` tipo de trafico · `utm_campaign` campana) y **dos se capturan** (`utm_content` quien o que pieza, segun el Canal · `utm_term` variante libre). Minusculas y `snake_case`. Con el builder (ADR 0046, 0051) **el CRM lo impone por construccion**: el trafficker pega un link, no escribe parametros | Revision manual: **cualquier lectura de `utm_term`, o de `utm_content` fuera del emparejador (`lib/atribucion/`), es el olor**. El guardian del ticket 085 lo va a cazar. `utm_content` cambia de significado segun el canal: leerlo sin mirar el canal repite el error medido el 21-sep (anuncio en ComunicArte, conjunto en Tactical) |
| Quien escribe un envio, un contacto o un lead desde un formulario | `ingerirEntradas` en `lib/ingesta/ingerir.ts`: una transaccion, por lotes, idempotente sobre `(fuente, token, es_parcial)`; el resumen del lead se RECALCULA desde sus envios | `tests/ingesta-escritura.test.ts`. Revision manual: un `insert(submissions)` o `insert(leadContactos)` fuera de ese modulo es el olor — el webhook y el traslado desde Sheets son adaptadores, no escritores |
| El Estado de llegada de un lead | **Lo manda el formulario y el CRM confia** (ADR 0054, enmienda del 27-sep): `estadoDesdeTexto` en `lib/ingesta/estado.ts` TRADUCE, no califica. Tres valores con los nombres de la hoja (`descartado`, `setteo_no_calificado`, `con_calendly`); cualquier otro texto entra sin Estado y, si el envio es completo, se reporta en `sinCalificar`. **T2 se borro el 28-sep** (A8 cerrada: *"el CRM no calcula NADA"*); el puntaje (T4) sigue nulo. Lo unico que lee ademas es el hecho de agendar, por la llave `agenda` del mapeo de la fuente (106) | `tests/ingesta-estado.test.ts` (con el guardian: nada en `lib/ingesta/` califica) y `tests/ingesta-escritura.test.ts`. Revision manual: **deducir el Estado de las respuestas es el olor**, y un peso de puntaje escrito en el codigo tambien |
| Si una cifra puede cruzar dos programas | **Solo si es una suma en la misma unidad**, en la vista "todos los programas" del Dashboard (ADR 0048): conteos, caja en USD, gasto. **Una tasa, una meta, el CPL, el ROAS o la comision nunca.** El programa sigue siendo frontera para la identidad y las listas (ADR 0043): la llave de `leads` es `(program_id, email_normalizado)` y la unica visibilidad cruzada de un lead es `otrosProgramasDelCorreo`, **aviso de pantalla que ninguna metrica usa** | El **tipo** de la consulta, no la revision: la funcion del agregado no compila con una metrica de tipo tasa (ticket 095), igual que el comparativo entre closers del ADR 0023, que *"no se puede acotar ni queriendo"*. Medido: solo **5 correos de 4.818** estan en los dos programas |
| Que programas ve una sesion | UNA funcion de alcance en `lib/auth/` (ADR 0048, ticket 094): el closer, los de su membresia activa; gerente y developer, todos. La usan la guarda de ruta, las consultas de lectura y el selector de programa | Por construir. El olor: un filtro de membresia copiado en una consulta (hoy `buscarPersonas` tiene el suyo) o un programa ajeno que responde algo distinto de 404. Se prueba forjando la peticion |
| Cuando una llamada de Calendly se cuelga de un deal | Solo **sin duda**: el correo del invitado es de un solo lead del programa con un solo deal abierto. Si no, queda **suelta** en el Inbox y la asigna un closer (ADR 0049, ticket 096). El telefono no empareja | Por construir: el emparejador de llamadas es un modulo puro con su guardian. 🩸 Una asignacion equivocada se ve igual que una correcta y no lanza ningun error |
| Que programas sirve una plataforma de pago | `plataformas_programa`, tabla puente (ADR 0034). **Nunca una columna `program_id`**: obligaria a aflojar el indice `lower(nombre)` y PayPal seria dos filas | La unicidad, por el indice. La cardinalidad minima NO aplica: una plataforma sin programa es valida y queda invisible |

## Feedback loops

The agent should run these to get fast signal on whether code works. Keep them current.

- **Test:** `npm test` (Vitest, 973 pasando al 28-sep, tras el 052, el 106 y la bitacora). Los tests que necesitan base usan PGlite en
  memoria con todas las migraciones aplicadas: `tests/helpers/base-de-prueba.ts` (ADR 0020).
  ⚠️ **27-sep: `npm ci` falla** porque `package-lock.json` no está sincronizado (faltan
  `@emnapi/runtime` y `@emnapi/core`). Mientras nadie lo repare con `npm install` y un commit del
  lock, instala con `npm install --no-package-lock`. Si ves 46 tests caídos por `drizzle-orm/postgres-js`,
  a tu `node_modules` le falta el driver `postgres`: es entorno, no regresión.
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
- 🩸 **El recorrido visual del 20-sep encontro DOS bugs con 669 tests en verde**, y los dos son
  del mismo tipo: **codigo que ningun test podia ver**. En este repo NO hay tests de componentes,
  asi que una condicion de `disabled` mal escrita deja un boton muerto sin que nada falle. Y una
  funcion de `lib/` **que nadie llama** puede estar mal desde el dia que se escribio: el conteo de
  referencias de un recurso miraba solo `reemplazaA` ("quien me reemplazo a MI"), asi que la
  version VIGENTE —la unica que el usuario toca— contaba CERO y se borraba, decapitando su
  historial con una FK `set null` que no protesta. **Antes de dar por probada una funcion de `lib/`,
  mira quien la llama: `grep` cuesta un comando.**
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
- **La base es Supabase y se usa por `drizzle-orm/postgres-js`, con transacciones de verdad**
  (ADR 0047, 22-sep; antes era Neon con `neon-http`, sin transacciones). La app entra por el
  **pooler en modo transaction (6543)** con `prepare: false`; `drizzle-kit` por la conexion de
  **5432** (`DATABASE_URL_DIRECTA`). 🩸 Sin `prepare: false` la app revienta **solo en
  produccion**: PGlite no pasa por ningun pooler, asi que ningun test lo ve. `ejecutarJuntas` es
  una transaccion real y corre **en orden**; quien necesite leer y decidir dentro de la misma
  transaccion usa `db.transaction` directo. **La exclusion mutua sigue viviendo en un indice
  unico**, no en `pg_advisory_lock`: con el pooler en modo transaction un lock de sesion no
  sobrevive entre consultas. **Hecho en el sync (ADR 0005):** el INSERT de la corrida ES el
  candado, contra un indice unico parcial `WHERE estado = 'corriendo'`. Si necesitas exclusion
  mutua en otra parte, ese es el molde: no hay candado que pedir ni que acordarse de soltar.
  Un script de `scripts/` **sale con `process.exit`**: `postgres-js` deja el pool abierto y el
  proceso se queda colgado.
- **UN solo proyecto de Supabase, "CRM Retia" (ref `hfqmiyiuyqapdsbywrag`), y ES produccion**
  (Mani, 28-sep; enmienda el ADR 0047, que pedia `dev` y produccion). No hay base de pruebas: local
  (`npm run dev`, los scripts, `db:migrate`) escribe en la base real. **Los previews de Vercel no tienen
  `DATABASE_URL` a proposito** y se trabaja todo en `main`. La regla de Mani: **asegurar la integridad
  antes de publicar.** En la practica: (1) una migracion se prueba primero en PGlite, que aplica TODAS
  las migraciones en cada `npm test`, y su SQL se lee antes de aplicarla; (2) nada se empuja a `main`
  sin `npm test`, `npm run typecheck`, `npm run lint` y `npm run build` limpios; (3) toda escritura de
  datos a mano o por script pide el ok de Mani; (4) antes de escribir, **mirar el ref dentro de la
  connection string** (`postgres.<ref>@...`), no el nombre de la variable. Lo que PGlite no ve y solo
  aparece en la base real: el pooler (`prepare: false`). 🩸 **La Data API de Supabase va APAGADA**:
  publica las tablas por REST con una llave anonima y la app no la usa.
- 🩸 **El SQL que genera `drizzle-kit` se LEE antes de aplicarlo, siempre.** Medido en la 0020
  (22-sep): de los cuatro defectos que traia, dos eran destructivos y dos la hacian fallar.
  (1) Expresaba el renombre `people` -> `leads` como `DROP TABLE ... CASCADE` + `CREATE TABLE`,
  que habria borrado 2.059 leads en `dev` y 4.791 en `production`; (2) ponia los `DROP CONSTRAINT`
  DESPUES del `DROP TABLE ... CASCADE` que ya se los habia llevado; (3) creaba el indice unico
  parcial de `sources` ANTES de desactivar la fuente vieja, con dos activas en la base; (4) dejaba
  las 271 filas de `change_log` hablando de una tabla que ya no existe. **Un `generate` es un
  borrador, no una migracion.** Reescribirla a mano no rompe el snapshot: el snapshot describe el
  esquema FINAL, no el camino.
- **Cuando `drizzle-kit generate` pregunta si algo es un renombre, la opcion por defecto (la
  primera) es SIEMPRE `create`.** Contestar eso en todo y arreglar el SQL despues es mas seguro que
  intentar acertar el rename en el prompt: un rename mal contestado escribe un `ALTER` que parece
  correcto. Si la sesion no tiene TTY, `generate` **falla en vez de colgarse** (lo dice
  explicito) — hay que darle un pty.
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
