# Handoff — Retia Metrics

> Session memory + roadmap. Read at session start, update at session end.
> The roadmap is a DAG: a task is only **ready** when its dependencies are done.

## Memory

_Estado actual del trabajo. Lo mas reciente arriba._

- **2026-09-17 (cierre 2) — Ticket 022: recursos y enlaces de pago. Migracion 0011 en `dev` Y en
  `production`.**

  **Siguiente sesión:** **023** (pantalla `/recursos`), que el 022 acaba de destrabar. Queda el
  **007** (operación) y el **021** bloqueado. Y dos cosas que solo puede hacer Mani: cargar los 5
  enlaces de PayPal, y abrir en el navegador `/mi-dia` y `/personas/[id]`.

  **Base de datos:** la **0011** está aplicada en las **dos** ramas, verificado por `neon.branch_id`
  y no por el nombre de la variable: `dev` (`br-withered-sun-b439zjof`) y `production`
  (`br-withered-mud-b4cvvg80`), las dos con 12 migraciones y las tres tablas nuevas. Se aplicó
  primero a `dev` y después a `production`, con el ok explícito de Mani. Es una migración
  puramente aditiva (tres `CREATE TABLE`): ningún código lee todavía esas tablas, así que
  aplicarla antes de que exista la pantalla no rompe nada.

  **Esquema (lo escribió la sesión principal; `drizzle-kit` no se delega):** `categorias_recurso`
  como catálogo del molde, `recursos` (link, no archivo) y `enlaces_pago` con monto y moneda al lado.
  - **Un recurso global tiene `program_id` NULL y Postgres considera dos NULL como DISTINTOS.** Un
    índice único ingenuo habría dejado pasar dos recursos globales vigentes con el mismo título, que
    es exactamente lo que el ticket prohíbe. `nullsNotDistinct` **no existe en drizzle 0.45**
    (verificado en `node_modules`), así que el índice va sobre
    `coalesce(program_id, <uuid de ceros>)`, y es PARCIAL para que el historial no ocupe cupo.
  - `vigente` (cuál es la versión de hoy) y `activo` (borrado suave del molde) son distintos y los
    dos hacen falta: una versión reemplazada queda `vigente = false` pero `activo = true`.

  **Código de Kiro** (420 tests, typecheck, lint y build limpios; revisado por la sesión principal):
  - `lib/catalogo/versionar.ts` con `reemplazarVersionado`, compartido por recursos y enlaces de
    pago **citando el ADR 0024**: las dos hacen lo mismo, así que lo hace un módulo y las dos lo
    importan. **El orden de las escrituras no es opcional:** primero el UPDATE que baja la vigente
    (libera el cupo del índice), después el INSERT de la nueva; al revés Postgres tira un `23505`
    que parece aleatorio.
  - `lib/catalogo/{categorias-recurso,recursos,enlaces-pago}.ts` sobre el molde, zod exigiendo
    `https://` (ADR 0017), y una línea en `lib/catalogo/registro.ts` para que las categorías salgan
    en `/ajustes/catalogos`.
  - Un duplicado sale como **409**, no 400: es lo que el molde ya hacía desde el ticket 011. El
    prompt de delegación decía 400; Kiro siguió el repo, que es lo correcto.

  **Los 5 enlaces de PayPal NO están cargados.** `scripts/cargar-enlaces-pago.ts` los lee de
  `ENLACES_PAGO_JSON` (archivo fuera del repo) y falla con mensaje explícito si falta. Ningún link
  real ni placeholder vive en el repo: son datos de pago y no van a git.

  **Permisos:** `.claude/settings.json` ahora **permite** `drizzle-kit generate` y `migrate`, y
  **deniega** `push` y `drop`. `push` aplica el esquema directo sin dejar archivo de migración: se
  salta el historial y la revisión, que es la disciplina que este repo enforza. La denegación es
  deliberada, no un olvido.

- **2026-09-17 (cierre) — ADR 0024: el saldo estaba escrito dos veces. Centralizado. Sin
  migracion.**

  **Siguiente sesión:** F1 y F2 cerradas salvo el **007** (operación, no código). Con código lo
  siguiente es **F3**: el **022** está listo, y detrás el **023**. El **021** sigue bloqueado.

  **Lo que lo destapó:** al cerrar el 006 se reportó que `historialDePersona` "compone
  `ventasDePersona` en vez de repetir el SQL del saldo". Mani respondió la regla general (no dejar
  que el saldo se desincronice; priorizar bajo acoplamiento y centralización). Al revisarlo con eso
  en mente salió que la composición del 006 evitó una **tercera** copia, pero **ya había dos**, con
  el SQL idéntico palabra por palabra: `saldoDeVenta` (la reja que bloquea un sobrepago) y
  `ventasDePersona` (lo que el closer ve en pantalla). Una pantalla y una reja discrepando sobre el
  mismo número no se descubre hasta que el dinero no cuadra.

  **Código** (392 tests, typecheck, lint y build limpios):
  - `lib/queries/saldo.ts` nuevo: `ABONADO`, `SALDO` y `estaPagadaCompleta`, la única definición.
    `lib/queries/ventas.ts` y `lib/queries/personas.ts` ahora la importan; ninguna consulta escribe
    `sum(abonos.monto)` a mano.
  - `tests/saldo-centralizado.test.ts`: lee la misma venta por los dos caminos y exige que
    coincidan, con abonos parciales, sin abonos, sin precio de contrato y con sobrepago. **Un
    comentario pidiendo no separarlos no falla nunca; este test sí.**
  - Refactor sin cambio observable: misma salida, mismas columnas, ninguna migración.

  **ADR 0024** lo deja escrito, y la regla subió a `AGENTS.md` (Restricciones no-negociables):
  si dos lugares tienen que dar la misma cifra, la cifra vive en un módulo y los dos la importan.
  Es el mismo error que el ADR 0023 ya había evitado por otro lado (descartar
  `dashboard-por-closer.ts` para no duplicar el anclaje de fecha en Bogotá); ahora tiene nombre.

  **Glosario:** entraron *Saldo pendiente*, *Sobrepago* e *Historial de una persona*.

  **Pendiente que dejó abierto:** nadie ha verificado `lib/queries/dashboard.ts` contra esta regla.
  Hoy no parece duplicado, pero es una revisión que no se hizo, no una garantía.

  **Dudas de Mani resueltas en esta sesión** (quedan acá porque volverán a aparecer):
  - *"¿Cómo así que no lista personas?"* — **Persona** = un lead deduplicado por correo, el ser
    humano. El dashboard muestra **cuentas** (agendas, cierres, caja, comparativo), no nombres: no
    hay ninguna fila con un nombre en la que se pueda hacer clic. Por eso el enlace al historial
    salió del buscador de `/mi-dia`. Darle una lista de personas al dashboard es trabajo real
    (¿qué personas?, ¿del rango?, ¿paginadas?) y merece su propio ticket si se quiere.
  - *"¿Las dos decisiones son para atacar 500 y 404?"* — Solo una. **Quién ve la página** es
    permisos (gerente y closer, ADR 0009), no errores. **El guard de uuid** sí es de errores: un
    correo en la URL contra una columna uuid revienta en Postgres y saldría como **500**, que
    insinúa que el id existe y esconde que el problema era la URL; el **404** dice la verdad.

- **2026-09-17 (noche) — Ticket 006: `/personas/[id]`, el historial de una persona. Sin
  migración.**

  **Siguiente sesión:** F1 y F2 quedan cerradas salvo el **007** (alta de los closers reales, es
  operación, no código). Lo siguiente con código es **F3**: **022** (recursos + enlaces de pago),
  que está listo, y detrás el **023**. El **021** sigue bloqueado esperando decisión. Y sigue
  pendiente la prueba manual de `/mi-dia` y de esta pantalla con login real.

  **Código** (385 tests, typecheck, lint y build limpios; hecho en la sesión principal con TDD,
  rojo-verde-refactor de a un comportamiento):
  - `historialDePersona` en `lib/queries/personas.ts`: persona + llamadas + ventas con sus abonos.
    **Compone `ventasDePersona` (del 003) en vez de repetir el SQL del saldo**: el dinero se resta
    en un solo lugar, porque dos definiciones de "saldo" se desincronizan sin que nadie lo note.
    Los abonos de todas las ventas salen en UNA consulta con `inArray`, así el número de consultas
    no depende de cuántas ventas tenga la persona.
  - `app/(app)/personas/[id]/page.tsx` y `components/historial-persona.tsx`: **solo lectura**, sin
    componente cliente ni server action, porque editar o borrar registros pasados está fuera del
    alcance. Los motivos, orígenes y plataformas salen resueltos a su nombre (nunca el uuid), y los
    montos con su moneda al lado.
  - Los timestamps se pasan por `diaDeCalendario` antes de formatear: es la única definición de
    "qué día es" del proyecto, y Vercel corre en UTC mientras el equipo está en Bogotá.

  **Tres decisiones, con su argumento:**
  - **El enlace sale del buscador de `/mi-dia`, no del dashboard.** El objetivo del ticket decía
    "desde el dashboard, entrar a una persona", pero **el dashboard no lista personas**: muestra
    agregados. La puerta que el ticket suponía no existía. Ponerla ahí exigía agregarle una lista
    de personas al dashboard, que es una feature nueva. El buscador del 003 es hoy el único lugar
    donde se listan personas.
  - **La ven gerente y closer**, igual que el dashboard desde el que se entra (ADR 0009). Ningún
    ADR pide restringirla más, así que no se inventó una restricción.
  - **Un id que no es uuid es 404 sin tocar la base.** `where id = 'lead@correo.co'` sobre una
    columna uuid revienta en Postgres y saldría como 500, que además insinuaría que el id existe.
    Hay test de que en ese caso la query ni se llama.

  **Base de datos:** sin cambios. Ninguna migración nueva.

  **Verificado / no verificado:** `npm test` (385), typecheck, lint y `npm run build`. **No** se
  abrió en el navegador: la página exige sesión de Google.

- **2026-09-17 (noche) — Ticket 003: `/mi-dia` deja de ser un `ProximaFase`. Sin migración,
  sin mutaciones nuevas.**

  **Siguiente sesión:** **006** (historial de una persona), que ya tenía su dependencia (005)
  cerrada. Sigue pendiente la prueba de login real, lo único que no se puede verificar desde acá.

  **Código** (371 tests, typecheck y lint limpios; un solo commit). Lo implementó Kiro con TDD; la
  sesión principal revisó contra el "Done cuando" y corrió los tres loops:
  - **La pantalla no escribe nada por su cuenta.** Todo lo que toca la base ya existía: 002
    (`registrarLlamada`), 019 (`registrarAbono`), 026 (`asignarResponsable`, `crearPersonaManual`).
    El ticket aportó lectura, UI y server actions. `lib/db/schema.ts` y `lib/mutations/*` quedaron
    intactos.
  - `lib/queries/personas.ts` (solo SELECT): `buscarPersonas` acotada a los programas donde el
    closer tiene membresía **activa** (mismo join que `programasGestionablesPorUsuario`), ILIKE
    sobre nombre y correo con los comodines escapados, mínimo 2 caracteres y tope de 20 filas;
    `ventasDePersona` con lo abonado y el saldo **calculados en SQL sobre `numeric`** y devueltos
    como texto, igual que `saldoDeVenta` (el dinero nunca pasa por un float de JS).
  - `app/(app)/mi-dia/acciones.ts`: seis acciones, **todas con `requireRole("closer")`**, incluida
    la de tomar persona. `asignarResponsable` acepta gerente, pero esta pantalla es del closer
    (ADR 0003) y la barrera se declara en la ruta. Resultado serializable, nunca se lanza al
    cliente (patrón de `productos/acciones.ts`).
  - `components/mi-dia-registro.tsx`: buscador, alta manual, formulario con los campos
    condicionales de la tabla del ADR 0015, y abonos sobre las ventas existentes. Reusa
    `ProductoCrearEnLinea` tal cual (se escribió en el 017 pensando en esta pantalla). Los montos
    salen por `monto(valor, moneda)` y las fechas por `fecha(iso)`: nada formateado a mano.

  **Dos decisiones que tomó la sesión principal antes de delegar, para que no se inventaran:**
  - **El texto del buscador NO va a la URL.** Un correo o un nombre en un query string viola
    "ningún dato personal en URLs" de `AGENTS.md`. La búsqueda es una server action con el texto
    en estado local. No contradice el ADR 0023 (el filtro del dashboard sí vive en la URL): allá
    lo que viaja es un `closerId` y un preset de rango, no el dato de un lead.
  - **Las fechas del formulario se anclan al MEDIODÍA de Bogotá** (`T12:00:00-05:00`), en la
    acción y no en la mutación (que pide `z.date()` y no se toca). Con `new Date('2026-09-20')`
    —medianoche UTC— el día se lee como 19 en Bogotá y un compromiso de pago quedaría registrado
    un día antes del prometido. Hay test que lo fija leyendo la fila en `America/Bogota`.

  **Base de datos:** sin cambios. Ninguna migración nueva, ninguna escritura en `production`.
  Las 11 migraciones siguen siendo las del 17-sep; "aplicar el 003 en producción" no tocó la base
  porque el ticket no trajo esquema.

  **Desplegado:** commit `47e2413` empujado a `main` el 17-sep en la noche, con `npm run build`
  limpio antes del push. `main` es la rama de producción en Vercel, así que el push dispara el
  deploy. **El resultado del deploy no se verificó desde la sesión** (el MCP de Vercel pide
  autorización y la sesión era no interactiva): queda por confirmar en el panel.

  **Verificado / no verificado:** `npm test` (371), typecheck, lint y `npm run build`, corridos por
  la sesión principal además de por Kiro. **No** se abrió en el navegador: la página exige sesión
  de Google. `/mi-dia` salió a producción sin que ningún humano la haya visto renderizada; es una
  pantalla de captura del closer, así que la primera pasada manual es la prueba que falta.

  **Dos costuras conocidas, ninguna introducida por este ticket:**
  - El botón de confirmar sobrepago se activa detectando la palabra "sobrepago" en el mensaje de
    error de `registrarAbono`. Si alguien reescribe ese mensaje, el flujo de confirmación
    desaparece sin que nada falle. Se hizo así porque la mutación devuelve un string y este ticket
    no podía tocarla; el día que moleste, la mutación necesita un código de error, no la UI otra
    regex.
  - `ventasDePersonaAccion` y `registrarAbonoAccion` reciben un id y no comprueban membresía en el
    programa. Es exactamente lo que ya hacen el dashboard (`/programas/[slug]` abre a cualquier
    closer, ADR 0009) y `registrarAbono` desde el 019: es la política vigente, no un hueco nuevo.
    Si alguna vez se decide acotar por membresía, se decide para los tres a la vez.

  **Fuera del 003 a propósito:** seleccionar automáticamente el producto recién creado en línea.
  `crearProductoAccion` no devuelve el id del producto nuevo y cambiarla estaba fuera de alcance;
  hoy se refresca la lista y el closer lo elige.

- **2026-09-17 (tarde) — Ticket 005: el dashboard real en pantalla, con metricas individuales por
  closer. ADR 0023. Sin migracion.**

  **Siguiente sesion:** **003** (`/mi-dia`), que ya tiene todo lo que necesitaba (002, 019, 015,
  026). Despues **006** (historial de persona), que dependia del 005. Y sigue pendiente la prueba
  de login real, que es lo unico que no se puede verificar desde aca.

  **Codigo** (350 tests, typecheck, lint y `npm run build` limpios; un solo commit):
  - **005** `/programas/[slug]` deja de ser un `ProximaFase`: tarjetas (caja por moneda, ventas,
    llamadas y % show, % cierre, leads contra meta, compromisos), cohorte con su dia habil y su
    meta dinamica, comparativo entre closers, motivos y origenes. `components/dashboard-programa.tsx`
    no calcula ni consulta nada, y `components/filtro-dashboard.tsx` solo escribe en la URL.
  - **Decision de Mani que cambio el diseno a mitad de camino (ADR 0023):** el filtro por closer
    NO se queda en el comparativo. Baja hasta `lib/queries/dashboard.ts`, que pasa de
    `(programId, rango, db)` a `Alcance = { programId, rango, closerId? }`. Con eso quedan
    individuales tambien los leads (por `people.responsableCloserId`), los compromisos, los
    motivos, los origenes y la contribucion a la cohorte. Se descarto el modulo aparte
    (`dashboard-por-closer.ts`) para no tener dos implementaciones del anclaje de fecha en Bogota
    y del agrupado por moneda.
  - **Lo que NO se invento:** no hay meta individual. `vistaDeCohorteActiva` suma
    `vendidosDelCloser` como contribucion y deja la meta, la meta dinamica y el cumplimiento
    medidos contra la cohorte completa (ADR 0022). Y como "sin responsable" es valido (ADR 0021),
    la suma de leads de los closers no da el total del programa: la pantalla lo dice.
  - **El comparativo no se puede filtrar y lo impide el compilador:** el alcance de
    `embudoPorCloser` es `Omit<Alcance, "closerId">`. Es la garantia de "todos ven todo" (ADR
    0009) escrita en el tipo, no en un comentario.
  - `lib/rangos.ts` (puro, 11 tests): hoy, semana (lunes a hoy), mes (dia 1 a hoy), cohorte (su
    ventana de venta hasta hoy, sin pasarse del cierre) y personalizado. Un preset imposible cae a
    "hoy" **y el selector muestra "hoy"**: nunca dice que estas viendo algo distinto de lo que ves.
  - `lib/format.ts`: `monto(valor, moneda)` (la moneda siempre al lado, la caja una linea por
    moneda) y `fecha(iso)` → "14 ago 2026" (se parte el string, no se construye un `Date`, porque
    la fecha es un dia de calendario y no un instante). `Intl` en es-CO daba "14 de ago de 2026" y
    "sept", que no es como escribe el negocio.
  - `lib/dias-habiles.ts`: el helper privado `isoBogota` se exporto como `diaDeCalendario`. Es la
    unica definicion de "que dia es hoy" del proyecto; la pagina la usa sobre `new Date()` para no
    depender de la zona del servidor (Vercel corre en UTC).
  - **El filtro vive en la URL, nunca en la sesion.** `armarVistaDelDashboard` no recibe rol ni
    sesion, y `tests/paginas.test.ts` corre la pagina como gerente y como closer y compara con que
    argumentos pide la vista. Si alguien mete una diferencia por rol, ese test falla.

  **Base de datos:** sin cambios. Ninguna migracion nueva, ninguna escritura en `production`.

  **Verificado / no verificado:** tests, typecheck, lint y build, mas un render del componente a
  HTML con datos de forma real (dos monedas, tasas nulas, cohorte con ventana, fila "sin closer").
  **No** se abrio en el navegador: la pagina exige sesion de Google y eso lo tiene que probar Mani.

  **Fuera del 005 a proposito:** la pauta (ninguna consulta del 004 la lee, aunque el texto viejo
  del `ProximaFase` la prometia) y las graficas.

- **2026-09-17 — Seis tickets cerrados (018, 027, 002, 026, 004 + esquema del 026), ADR 0022,
  migraciones 0008-0010 en las dos ramas, y la primera tanda de sesiones en paralelo.**

  **Siguiente sesion:** **019** (registrar abono, ya destrabado por el 002) y **005** (dashboard
  en pantalla, destrabado por el 004). Despues **003** (`/mi-dia`), que necesita 002, 019 y 026.
  Prompts listos en el historial de la sesion del 17-sep.

  **Codigo** (306 tests, typecheck y lint limpios; un commit por ticket):
  - **018** esquema del registro y abonos: `resultado_llamada` a 8 valores, `calls` con
    `fechaSeguimiento`/`motivoId`/`origenId`, `sales` con `productoId`, tabla `abonos` con
    `onDelete: restrict`, y `lib/abonos/esquema.ts` (solo USD). **Decision de Mani:
    `sales.esPagoCompleto` se elimina**, no queda como cache: todo derivado se calcula (enmienda
    en el ADR 0013). La 0008 copia cada `montoAbonado` viejo a un abono; habia 0 ventas.
  - **027** ventana de venta por cohorte (**ADR 0022**, sale de `/grill-with-docs`). Los reportes
    diarios desmienten las dos reglas que el glosario daba por buenas: el inicio no se deduce del
    cierre de la cohorte anterior (Comunicarte C2 arranca 14-ago, no 12-ago) y el cierre no se
    deduce del inicio de clases (un programa cierra el mismo dia, el otro la vispera). Ahora
    `cohorts.fechaInicioVentas` es dato editable y un `CHECK` impide una cohorte activa sin el; el
    cierre de Comunicarte C2 se corrigio a 21-sep. Verificado: 27 habiles y el 15-sep es el dia 23.
  - **002** `cohorteActiva` y `registrarLlamada` (`lib/mutations/registro.ts`): inserta la llamada
    con `origen="app"` y el `closerId` de la sesion; si el resultado es `cerrada`, la venta y su
    primer abono van en el mismo lote atomico. Rechaza producto de otro programa, producto
    desactivado y plataforma desactivada.
  - **026** `asignarResponsable` y `crearPersonaManual` (`lib/mutations/personas.ts`): una sola
    regla de asignacion (el closer destino vende en ese programa y esta activo) que de paso impide
    que un closer ajeno se lleve personas. El sync no incluye `responsableCloserId` en su
    registro, asi que no lo pisa, y una persona `crm` que reaparece en el formulario pasa a
    `formulario` con rastro en la bitacora. Un closer sin `closerId` recibe 400, no un 403 enganoso.
  - **004** `lib/queries/dashboard.ts`: caja por fecha del abono y agrupada por moneda (nunca
    mezcla dos), tasas `null` en vez de `NaN` con 0 agendas, anclaje de fechas en Bogota
    (02:00Z del 16 es el 15), leads solo de entrada `formulario`, y una cohorte sin inicio de
    ventas devuelve `null` en vez de inventar ventana.
  - `vitest.config.mts`: `testTimeout` y `hookTimeout` a 20s. Los tests con PGlite aplican todas
    las migraciones; con varias sesiones compitiendo por la maquina el suite se caia en cascada
    por el reloj, no por el codigo. **Un fallo de timeout aca no es una regresion: re-corre el
    archivo solo antes de investigar.**

  **Base de datos:** `dev` y `production` con 11 migraciones (0008, 0009 y 0010). `production`
  tiene **4.497 personas** reales; `dev` tiene 0, asi que una prueba manual contra `dev` necesita
  sembrar datos primero.

  **Proceso, tres cosas que costaron tiempo y no se repiten:**
  - **Las migraciones las genera y aplica la sesion principal, nunca un subagente** (regla ya en
    `AGENTS.md`). `drizzle-kit generate` es interactivo: pregunta si una columna es un renombre
    cuando una se va y otra llega, y dejo a Kiro colgado 12 minutos sin poder contestar. Desde la
    sesion principal se responde con `expect`.
  - **Un `CHECK` nuevo se crea DESPUES de arreglar los datos**, en la misma migracion. El de la
    0009 habria fallado con las dos cohortes activas que estaban sin inicio de ventas.
  - **El reparto en paralelo se hace por ARCHIVOS, no por el grafo de dependencias.** El 17-sep
    corrieron tres sesiones (002, 004, 026; una en otra cuenta) sin un solo choque. Los puntos de
    colision son las migraciones (journal + snapshot + `schema.ts`), `docs/tasks/README.md`,
    `docs/agents/handoff.md` y los commits. Reglas: nadie corre `drizzle-kit`, nadie edita el
    tracker ni el handoff, cada sesion commitea nombrando sus archivos (nunca `git add -A`), y el
    coordinador revisa contra el "Done cuando", marca y migra. **No van en paralelo dos tickets
    que escriben la misma logica** (019 y 002 comparten el insert del abono) ni dos que necesiten
    migracion (016 y 022).

- **2026-09-16 (cierre) — ADR 0021, tickets 012, 013, 015, 014, 017 y 020, migraciones
  0004-0007 en las dos ramas, incidente de `.env.local` resuelto.**

  **Siguiente sesion:** seguir **Now** en orden, por partes. El 024 (rol developer) **no** va
  ahora: es de F4 y espera su turno (su avance parcial esta en un stash, ver abajo).

  **Codigo** (Kiro con TDD, cada ticket revisado contra su "Done cuando", un commit por ticket;
  235 tests, typecheck y lint limpios):
  - `/grill-with-docs` sobre el responsable del lead: **ADR 0021** (responsable y alta manual
    viven en el CRM; las hojas no tienen columna de closer). Ticket nuevo **026** (depende de 015,
    bloquea 003). Glosario: Responsable, Alta manual.
  - **012** catalogos `motivos` y `origenes` (migracion 0004).
  - **013** `/ajustes/catalogos` sobre `lib/catalogo/registro.ts` (un catalogo nuevo = una
    linea); el molde gano `reactivar`; un id no-uuid da 400.
  - **015** `/ajustes/usuarios`, `users.calendlyEmail`, `miembros_programa` (migracion 0005).
    Un solo esquema para la pantalla y el CLI. Deuda y respuestas a Mani en el ticket: el CLI
    ahora pide uuid de programa para un closer; "usuario" es la cuenta que entra (closer o
    gerente, no un lead) y su fila y sus programas se guardan en dos lotes (no atomico).
  - **014** `/ajustes/programas` y `/ajustes/programas/[slug]`; indice unico parcial "una
    cohorte activa por programa" (migracion 0006). Cerrar una cohorte es su "desactivar".
  - **017** `/productos` para gerente y closer (el closer solo en sus programas), tabla
    `productos` (migracion 0007). Semillas en `seed-datos.ts`, solo insertan lo que falta.
  - **020** `lib/dias-habiles.ts`: dias habiles en Bogota, meta dinamica y lineal.

  **Base de datos (verificado con `neon.branch_id`):**
  - **Incidente:** `DATABASE_URL` de `.env.local` era la misma URL que `DB_PROD`, asi que todo lo
    local escribia en `production`. Mani lo arreglo: hoy `DATABASE_URL` = `dev`
    (`br-withered-sun-b439zjof`) y `DB_PROD` = `production` (`br-withered-mud-b4cvvg80`).
    Detalle en el ADR 0018; regla nueva en `AGENTS.md`: comprobar la rama antes de escribir.
  - 0004-0007 aplicadas a `production` (por decision de Mani, antes de arreglar `dev`) y luego a
    `dev`. Las dos ramas: 8 migraciones, 7 plataformas, 8 motivos, 7 origenes.
  - `dev` sembrada (2 programas, 4 cohortes, 3 productos, 10 fuentes). `production` **sin
    productos**. En las dos, el unico usuario es Mani como `gerente`;
    `administrativa@retiagrowth.com` no esta cargado.

  **Hallazgo:** la ventana de venta de Comunicarte C2 del reporte (14-ago a 21-sep) no coincide
  con la semilla (inicio implicito 12-ago, cierre 22-sep). Decision pendiente en el tracker;
  bloquea 004.

  **Pausado:** Mani pidio ser `developer`, pero ese rol es el ticket 024 (F4). Kiro alcanzo a
  empezarlo y se detuvo; su avance **sin revisar** esta en `git stash` ("wip 024 rol developer").
  No se aplico nada en ninguna base. Retomarlo cuando le toque (notas en el ticket).

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
  - **`production` sembrada** (`seed:datos`): 2 programas, 4 cohortes, 10 fuentes (3 activas).
    Estaba vacia.
  - **Enmienda al ADR 0018 (Mani):** la URL de `production` vive en `.env.local` como
    `DB_PROD`. Ningun codigo la lee; lectura libre, escritura solo con ok de Mani.

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

Por partes y en este orden:

1. [ ] **Probar el login con una cuenta real** (local contra `dev`, y produccion) y con eso las
       pantallas nuevas: `/ajustes/catalogos`, `/ajustes/usuarios`, `/ajustes/programas`,
       `/productos`. Despues borrar el cliente OAuth **web** viejo de `google-workspace-mcp`.
2. [x] **019** (registrar abono) y **005** (dashboard en pantalla), los dos cerrados el 17-sep.
3. [ ] **003** (`/mi-dia`), que ya tiene sus cuatro dependencias listas (002, 019, 015, 026), y
       despues **006** (historial de persona), destrabado por el 005.
4. [ ] **Preparar `production` para los usuarios reales** (con ok de Mani, junto con el 007):
       sembrar productos (`seed:datos` con `DB_PROD`), cargar `administrativa@retiagrowth.com`
       como gerente y dar de alta a Andrea y Maru desde `/ajustes/usuarios`.
5. [ ] **Probar `/api/cron/sync` en produccion** con el `CRON_SECRET` (escribe leads reales, pedir ok).
6. [ ] **F-03 + F-07** juntos, con migracion (diseno en el tracker); primero `dev`, luego
       `production`.
7. [ ] **F-01:** confirmar el mapeo de `Estado` propuesto en el tracker e implementarlo.
8. [ ] **Documentar las pestanas nuevas** en `docs/estructura-bbdd.md` y revisar las filas de
       `New form` (el 16-sep devolvio 2.007 filas con datos; eran 1.320 el 19-ago).
9. [ ] **F-05 · Migrar las fechas ya guardadas.** El codigo ya escribe con `-05:00` explicito,
       pero las filas viejas quedaron en la zona del servidor y `compararCampos` no mira fechas,
       asi que un `npm run sync` normal **no** las repara. Decidir entre migracion puntual o
       re-sync forzado.
10. [ ] **016** (plantilla de lead) y **022** (recursos) estan listos pero pueden esperar. Los dos
       necesitan migracion, asi que no van en paralelo entre si.

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

- [ ] **024 · Rol developer (F4)** — Mani quiere ser `developer`. Avance parcial sin revisar en
      `git stash` ("wip 024 rol developer"); retomarlo en su turno. Notas en el ticket.
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

- [x] 2026-09-17 — Tickets 018, 027, 002, 026 y 004; ADR 0022; migraciones 0008-0010 en `dev` y
      `production`; regla de migraciones en `AGENTS.md`; tres sesiones en paralelo sin choques.
- [x] 2026-09-16 (cierre) — ADR 0021 + ticket 026; tickets 012, 013, 015, 014, 017, 020;
      migraciones 0004-0007 en `dev` y `production`; `.env.local` corregido.
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
