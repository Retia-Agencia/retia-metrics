# Handoff — Retia Metrics

> Session memory + roadmap. Read at session start, update at session end.
> The roadmap is a DAG: a task is only **ready** when its dependencies are done.

## Memory

_Estado actual del trabajo. Lo mas reciente arriba._

- **2026-09-18 (CIERRE 3 del mismo día) — Verificación del 029 contra `production` HECHA y pasada.
  Equipo y productos dados de alta en `production`. Un bug de rol encontrado y arreglado.
  Dos hallazgos nuevos sin tocar, uno de ellos grave. 496 tests.**

  **PARA QUIEN ABRA LA PRÓXIMA SESIÓN, leer esto primero:**

  - 👑 **REGLA NUEVA DE MANI, y gobierna todo: el developer es el DUEÑO, no se le restringe NADA.**
    Está en AGENTS.md y en el ADR 0025 punto 5. Operativamente: **todo `rol === "..."` escrito a
    mano que excluya al developer es un bug, no una decisión.** La proyección por rol existe para
    que una pantalla no le salga vacía, nunca para darle menos.
  - **El pendiente del 029 está cerrado.** Se corrieron contra `production` las MISMAS funciones
    que llaman las páginas (`conteosPorPrograma`, `armarVistaDelDashboard` ×4, `historialDePersona`),
    con el cliente apuntado allá. Ninguna reventó; 470 a 740 ms. **`conteosPorPrograma` da 1.977 y
    2.622, no cero: la subconsulta correlacionada del 025 no volvió.** Se eligió ese camino en vez
    de apuntar el dev server a `production` porque contesta lo mismo y **no puede escribir**.
  - **`production` ya tiene equipo y productos** (escrituras con el ok de Mani, rama comprobada
    antes de cada una):

    | quién | rol | closer_id | programas |
    |---|---|---|---|
    | `administrativa@retiagrowth.com` | gerente | — | — |
    | `manuelmejiaarana@gmail.com` | developer | — (no lo quiere) | — |
    | `soymarumarquez@gmail.com` | closer | `Maru` | los dos |

    Productos: **Método ComunicArte** 797 USD (Comunicarte) y **De Cero a Tactical Investor**
    1500 USD (Tactical). Precios = los de la cohorte C2 activa, aprobado por Mani.
  - 🔑 **El `closer_id` NO se inventa ni se le pregunta a nadie: está en la columna "Closer" de la
    pestaña "Registro de llamadas" de cada hoja.** Valores reales: `Andrea` (125 Tactical + 192
    Comunicarte), `Maru` (1 + 10), y además `Dana`, `Alejo`, `juanse` (minúscula, ojo) y
    `Sebastian`, 96 llamadas entre los cuatro, que Michael no listó como activos. **Falta el correo
    de Andrea y nada más**: su `closer_id` ya se sabe.
  - **Mani NO quiere `closer_id` ni membresías.** Como developer solo quiere ver, y para ver no
    hace falta ninguna de las dos: los dashboards y `/nerd-stats` no filtran por usuario.

  🔴 **HALLAZGO GRAVE, SIN TOCAR: 1.034 de las 2.622 personas de Tactical Investor (39%) tienen
  `fecha_primera_aplicacion` en el año 1, así que NO cuentan como lead en ninguna pantalla.**
  Comunicarte está limpio. La hoja de Tactical trae literalmente `1/1/0001 0:00:00` como centinela
  de "vacío"; `parsearFecha` lo lee **correctamente** como el 1 de enero del año 1, porque es una
  fecha válida, y no avisa. Peor: el dedup conserva la fecha **más antigua**
  (`lib/sheets/dedup.ts:103`), y el año 1 le gana a cualquier fecha real, así que **una sola fila
  envenenada le borra la fecha buena a alguien que sí tiene filas buenas**: 704 de los 1.034 son
  personas con 2+ aplicaciones. **Y no se cura solo:** `fechaPrimeraAplicacion` se escribe en el
  update pero NO está en `CAMPOS_COMPARABLES` (`lib/sheets/plan-sync.ts:17`) y el plan descarta a
  quien no tenga ningún diff (`plan-sync.ts:57`), así que arreglar el parser no repara lo escrito.
  Arreglo en tres piezas: piso de plausibilidad en `parsearFecha` (año 1 → `null`, y el dedup lo
  ignora solo), backfill desde `raw`, y decidir si `fechaPrimeraAplicacion` debe ser comparable.

  🐛 **EL BUG ARREGLADO, y la lección es que apareció fuera de los tests.** `exigirAccesoAlPrograma`
  en `lib/catalogo/productos.ts` preguntaba `actor.rol === "gerente"`, así que un developer caía al
  chequeo de membresía y recibía un **403 que además mentía**: *"no puedes gestionar productos de un
  programa donde no vendes"*, cuando el developer no vende en ninguno por definición. Se destapó
  **intentando cargar los productos reales de `production`**, no en un test. Arreglo: una línea,
  `esAdministrador(actor.rol)`, predicado que el repo ya tenía sin usar acá. Test de regresión con
  un developer **sin membresías**, visto en rojo con el mensaje exacto del bug antes de tocar nada.
  Los productos se cargaron **con la cuenta de developer**, que es la prueba real del arreglo.

  ⚠️ **Incumplimiento conocido de la regla nueva, sin tocar:** `app/(app)/recursos/page.tsx:41`
  decide `esGerente` con `rol === "gerente"` y le esconde al developer la creación de recursos y
  enlaces. Es del ticket **028**, que convierte esa pregunta en `rolDeVista`.

  🕳️ **HUECO DE DISEÑO, sin tocar: un gerente no puede abrir el historial de NINGÚN lead.** El
  único enlace a `/personas/[id]` está dentro del buscador de `/mi-dia`
  (`components/mi-dia-registro.tsx:216`), `buscarPersonas` filtra por membresía y `/mi-dia` es
  exclusiva de closer (ADR 0003). El gerente no tiene ruta. No es config, es diseño.

  **Corrección a algo que se creía:** en `/nerd-stats`, "Últimos cambios desde la app" **vacío era
  lo correcto** en `production`: filtra por `origen = "app"` y las 80 filas de `change_log` de allá
  eran todas del sync. Ya no: las altas de esta sesión dejaron 12 filas con `origen: app`.

  **Sigue pendiente de Mani:** el correo de Andrea, los 5 enlaces de PayPal (el script los lee de un
  JSON fuera del repo vía `ENLACES_PAGO_JSON`, ADR 0017), decidir el 021, y los dos hallazgos de
  arriba. El 028 está listo para codear. ⏰ **Comunicarte C2 cierra ventas el 21-sep.**

- **2026-09-18 (CIERRE 2 del mismo día) — Ticket 029 cerrado: anular registros. ADR 0027 nuevo.
  Migraciones 0013 y 0014 en `dev` Y en `production`. Commiteado, pusheado y desplegado.
  Recorrido visual de la anulación hecho, 3 hallazgos, los 3 arreglados. 495 tests.**

  **PARA QUIEN ABRA LA PRÓXIMA SESIÓN, leer esto primero:**

  - **Las DOS ramas de Neon van en 15 migraciones.** `dev` (`br-withered-sun-b439zjof`) y
    `production` (`br-withered-mud-b4cvvg80`). Las 0013 y 0014 se aplicaron en `production` con el
    ok explícito de Mani, comprobando `neon.branch_id` antes de escribir (ADR 0018) y pasando la
    URL por el entorno del proceso, nunca por la línea de comandos.
  - **`main` está pusheado y desplegado.** Commit `8eff647`, verificado contra el remoto real con
    `git ls-remote`. Deploy de producción `Ready`; `/api/health` responde 200 y el dashboard sin
    sesión redirige al login con 307.
  - ⚠️ **El orden importó y quedó bien por poco.** El código de `main` consulta `anulado_en` y
    `sales.call_id` en cada consulta del embudo. Si se hubiera pusheado ANTES de migrar, el
    dashboard, `/mi-dia`, el historial y `/nerd-stats` habrían reventado con *column does not
    exist*. **Migrar primero y desplegar después es la regla**: las migraciones aditivas no rompen
    el código viejo (las columnas sobran hasta que llega quien las use), al revés sí.
  - **Forma de los datos de `production` (18-sep):** ~4.600 personas y **cero llamadas, cero
    ventas, cero abonos**. Solo leads. Por eso la anulación allá todavía no tiene nada que tocar, y
    por eso un dashboard en ceros allá es lo correcto, no un síntoma.
  - 🤔 **Algo pusheó `main` antes de que yo corriera `git push`**, que respondió "Everything
    up-to-date". No hay hooks de git en el repo. Sospecha: la integración del escritorio. No está
    confirmado; se deja anotado por si vuelve a pasar y confunde a alguien.
  - **El 029 está commiteado en `main`** (31 archivos, incluidas las dos migraciones y estos
    docs). Árbol limpio; typecheck, lint, build y 495 tests, todos limpios.
  - **En `dev` se gastaron los datos de prueba del recorrido anterior.** Las dos ventas de
    Ana Prueba y sus tres abonos quedaron anulados, más una venta nueva que se creó y se anuló para
    probar la cascada. Queda viva una llamada de compromiso de pago. Si hace falta ver
    `/personas/[id]` con contenido vigente, hay que registrar algo nuevo desde `/mi-dia`.
  - **A Mani se le cargó `closer_id = 'Mani'` en `dev`.** Estaba en `null` desde que volvió a
    `developer`, y sin eso `/mi-dia` rechaza cualquier registro. En `production` sigue sin cargar.

  **Qué es el 029, en una línea:** una llamada, una venta o un abono se ANULAN con motivo, dejan de
  contar en toda métrica, y siguen viéndose tachados en el historial de la persona.

  🎯 **LA LECCIÓN DE LA SESIÓN, y no es sobre anular: `revalidatePath` no refresca la pantalla que
  acaba de escribir.** Al anular un abono la base quedaba perfecta —anulado, con motivo, autor y su
  fila en `change_log`— y **la pantalla seguía mostrando el total anterior**. Escritura correcta y
  pantalla mintiendo, que es peor que fallar: quien lo viera volvería a anular "porque no funcionó".
  La causa: `revalidatePath("/personas", "layout")` no coincidía con nada (ruta dinámica, y
  `personas/` no tiene layout propio), así que esa línea parecía trabajo y no invalidaba nada, **sin
  error**. El arreglo es `router.refresh()` en el cliente para la ruta actual, y `revalidatePath`
  por PATRÓN (`"/personas/[id]", "page"`) para las otras. Está en AGENTS.md. **Ningún test lo
  habría cogido nunca**: es exactamente lo que el recorrido visual existe para encontrar.

  **Lo que se construyó:**

  - **`lib/queries/vigente.ts`** — `vigente(tabla)` es LA definición de "este registro cuenta", e
    `incluyendoAnulados(tabla)` es la marca explícita de que una consulta quiere ver lo anulado (el
    historial, ADR 0026 punto 4). Las 21 lecturas del embudo pasan por ahí.
  - **`tests/vigencia-centralizada.test.ts`** — el guardián, escrito ANTES y visto en rojo. La
    unidad de análisis es la **cadena de drizzle**, no el archivo ni el statement: dentro de una
    función no hay ningún `;` a profundidad cero, así que cortar por statements mete el archivo
    entero en una unidad y el guardián deja de poder señalar CUÁL consulta falla.
  - **`lib/mutations/anulaciones.ts`** — la cascada del ADR 0026 punto 2 en una escritura atómica,
    los permisos del punto 6 y una fila de `change_log` por registro anulado.
  - **UI**: `/personas/[id]` dejó de ser de solo lectura, y `/mi-dia` puede anular una venta desde
    la lista.

  **Tres cosas que el ticket NO pedía y que hubo que hacer:**

  1. 🩸 **`sales` no sabía de qué llamada nació**, así que la cascada "llamada cerrada → su venta"
     del ADR 0026 **no se podía cumplir**. Se agregó `sales.call_id` con índice único (una llamada
     cierra como mucho una venta, garantizado en la base) → **ADR 0027**. Las filas viejas y las de
     Sheets no tienen enlace: ahí se RECHAZA con mensaje en vez de adivinar por persona y fecha.
  2. **El guardián acabó mirando todo el código, no solo `lib/queries/`.** Ensancharlo destapó
     cuatro lecturas de esas tablas viviendo en `lib/mutations/`, fuera del alcance original.
  3. **`ventasDePersona` respondía dos preguntas distintas** con el mismo SQL: "¿sobre cuál puedo
     registrar un abono?" (`/mi-dia`) y "¿qué le pasó a esta persona?" (historial). Con la
     anulación dejan de tener la misma respuesta. Partida en dos funciones, sin un booleano.

  **Del 028, adelantado sin querer:** `trabajaLeads(rol)` (la tercera pregunta de la familia de
  roles) y **`/ajustes/usuarios` ya deja cargarle el `closer_id` y las membresías a un developer**.
  Preguntaba `rol === "closer"` a mano, así que el criterio del 028 "con el closerId cargado" era
  **imposible desde la app**. Y quedó DECIDIDO: **la vista del developer estrecha también la
  guarda**, no solo la proyección (razones en el ticket 028).

  **Los 3 hallazgos del recorrido visual de la anulación, todos arreglados:**
  1. 🔴 El refresco (arriba). El grande.
  2. **Tres botones "Anular" idénticos apilados** bajo cada venta: dos de abonos y uno que se lleva
     la venta entera. Ahora el de la venta dice "Anular la venta".
  3. **"Saldo pendiente: USD 797,00" en una venta anulada.** Tachada y aun así afirmando una deuda
     viva. El precio y lo abonado son hechos; el saldo es una afirmación sobre lo que alguien debe,
     y una venta anulada no reclama nada. Es el primo del "Saldo pendiente: USD -103" del cierre 1.

  **Lo que se verificó en vivo** (no solo en tests): la cascada con enlace real (toast *"Se anuló la
  llamada, su venta y 1 abono"*), la rama legacy de punta a punta (rechaza → anulas la venta → ahora
  sí), que un abono ya anulado **conserva su motivo original** cuando después se anula la venta, que
  `saldoLegible` pasó sola de "Sobrepago" a "Saldo pendiente", y que dashboard, `/mi-dia` y el
  historial cuentan la misma realidad después de anular.

  **Sigue pendiente de Mani, sin cambios:** cargar los 5 enlaces de PayPal, decidir el 021, el 007
  (⚠️ `production` tiene 0 productos, así que ningún closer podrá registrar una venta cerrada hasta
  que alguien los cargue), y mirar `/nerd-stats` contra `production`, que nunca se ha visto allá.

  **MINI PROMPT PARA LA PRÓXIMA SESIÓN** (copiar tal cual):

  > Retomamos el Retia CRM (retia-metrics-mani). Lee AGENTS.md y la entrada "CIERRE 2" del 18-sep
  > en docs/agents/handoff.md.
  >
  > Contexto: el ticket 029 (anular registros) está cerrado, commiteado (`8eff647`), pusheado y
  > desplegado. Las dos ramas de Neon van en 15 migraciones. 495 tests verdes, typecheck, lint y
  > build limpios.
  >
  > Lo único que quedó sin comprobar del 029: **abrir el dashboard desplegado con mi sesión.** El
  > build pasa y la app arranca, pero que las consultas nuevas corran bien contra la base de
  > `production` solo se ve pidiendo la página con sesión, y el login es mío. Dime exactamente qué
  > mirar y en qué orden; con `production` en cero llamadas y cero ventas, lo esperable es un
  > dashboard en ceros, no un error.
  >
  > Y de paso `/nerd-stats` contra production, que nunca se ha visto allá. El total de personas
  > debe rondar 4.600 y SUBE con cada corrida del cron, así que no compares contra un número fijo:
  > lo que importa es que los conteos por programa NO sean cero. Un cero ahí es la subconsulta
  > correlacionada del 025 volviendo.
  >
  > Después, en este orden: (1) el **007**, dar de alta al equipo en production — ojo que
  > `production` tiene **0 productos** y sin eso ningún closer puede registrar una venta cerrada;
  > (2) cargar los 5 enlaces de PayPal; (3) decidir el **021**.
  >
  > El **028** está listo para codear y ya tiene decidido que la vista estrecha también la guarda;
  > el 029 le adelantó `trabajaLeads` y el `closer_id` del developer en `/ajustes/usuarios`. El
  > 016 y el 030 pueden esperar.

- **2026-09-18 (CIERRE DE SESIÓN) — Se hizo el recorrido visual de `/mi-dia` de punta a punta.
  7 hallazgos, los 7 arreglados. Dos decisiones nuevas de Mani: "ver como" del developer (028) y
  poder anular/borrar desde la app (ADR 0026, tickets 029 y 030).**

  **PARA QUIEN ABRA LA PRÓXIMA SESIÓN, leer esto primero:**

  - **El recorrido visual de `/mi-dia` YA SE HIZO y pasó.** Era el pendiente número uno del cierre
    anterior. Lo que sigue sin mirarse: `/nerd-stats` **contra production** (en local sí se vio, y
    ahí los números no significan nada), y `/recursos` con contenido (está vacía en las dos ramas).
  - **Árbol limpio, todo en `origin/main`.** 477 tests, typecheck, lint y build limpios.
  - **Mani volvió a `developer` en `dev`**, pero le quedaron **las dos membresías de programa
    activas**. Eso no es basura: el buscador de `/mi-dia` se filtra por MEMBRESÍA, no por rol, así
    que como developer en `dev` la búsqueda ahora sí devuelve resultados. En `production` no tiene
    membresías, así que allá sí daría 0.
  - **En `dev` quedaron datos de prueba a propósito:** 2 personas ("Ana Prueba" en Comunicarte,
    "Ana En Tactical"), 2 llamadas, 1 venta de USD 797 y 2 abonos (400 + 500, con sobrepago
    confirmado). Sirven para mirar `/personas/[id]` con contenido. No se borran porque **no hay
    forma de borrarlos**, que es justo el hallazgo que originó el 029.

  🔴 **LO QUE DESTAPÓ EL RECORRIDO Y ES LO MÁS IMPORTANTE DE LA SESIÓN: no existe ni un solo
  `.delete(` en `lib/`, `app/` ni `scripts/`.** Un closer que le da a "Cerrada" por error inventa
  una venta permanente que cuenta en el embudo, en la caja y en el comparativo entre closers, para
  siempre. La única salida hoy es entrar a la base a mano. Mani decidió que eso se arregla:
  **ADR 0026**, tickets **029** (anular registros) y **030** (borrar del catálogo lo no usado).

  **Los 7 hallazgos del recorrido, todos arreglados y verificados en el navegador:**
  1. 🟠 **"Persona creada" mentía cuando en realidad fue dedup.** El mismo toast verde en un alta
     real y en un correo repetido, con el nombre recién escrito descartado en silencio.
     `crearPersonaManual` ahora devuelve `{ persona, creada }` y el toast dice "Esa persona ya
     existía". El tipo `ResultadoAltaManual` obliga a distinguirlos.
  2. 🟠 **Al abono posterior le faltaba el campo Comprobante.** El estado y el envío a la acción
     existían, pero no había input: el soporte del primer pago se adjuntaba y el de los siguientes
     no. Estado muerto colgando.
  3. **404 en inglés** ("This page could not be found") en una app en español. Ahora hay
     `app/not-found.tsx` (raíz, sin sesión) y `app/(app)/not-found.tsx` (dentro del shell, con
     sidebar y salida).
  4. **Error de Base UI en consola** por `render={<Link/>}` con `nativeButton` en true: se pierde
     la semántica nativa de botón. Arreglado en `mi-dia-registro.tsx` y en `programas-admin.tsx`,
     que tenía el mismo patrón.
  5. **Mensajes de validación del navegador en inglés.** Se resolvió con
     `components/validacion-en-espanol.tsx`, montado UNA vez en el layout raíz, en vez de decorar
     los 32 inputs `required` repartidos en 7 componentes. Listener en fase de CAPTURA porque
     `invalid` no burbujea, y limpieza del mensaje al escribir o el campo queda inválido para
     siempre.
  6. **El dólar salía sin decimales** ("USD 797"). Ahora `usd` siempre lleva dos. El peso NO
     cambia: en Colombia no se cobra con centavos. Era una convención **testeada a propósito**, así
     que se cambió el test, no se rodeó.
  7. **"Saldo pendiente: USD -103"** tras confirmar un sobrepago, que le dice al closer que el
     cliente debe plata cuando pagó de más. `saldoLegible` en `lib/format.ts` devuelve **etiqueta y
     valor juntos** (un sobrepago cambia las dos) y lo importan las dos pantallas que lo preguntan.

  **Lo que el recorrido CONFIRMÓ que funciona** (nada de esto se había visto correr nunca):
  - 🎯 **La zona horaria.** Compromiso de pago con fecha 19 → `2026-09-19 17:00:00+00` (mediodía de
    Bogotá) → el historial dice "19 sep 2026". De punta a punta sin correrse un día.
  - 🎯 **La reja del sobrepago.** Rechaza con la cifra exacta, ofrece "Confirmar sobrepago" y al
    confirmar escribe. Era la garantía del ADR 0024 que nadie había ejercitado.
  - El dedup por (programa, correo) no duplica, no pisa el nombre existente y no ensucia
    `change_log`; el mismo correo en otro programa sí es otra persona.
  - El buscador: mínimo 2 caracteres, ILIKE, `%` escapado (con `%%` da "Sin resultados", no la base
    entera) y **el texto buscado nunca llega a la URL**.
  - `entrada: crm`, `num_aplicaciones: 0` explícito, responsable copiado de la sesión, cohorte
    activa asignada sola, `origen: app`, y venta+abono+llamada en una escritura atómica.
  - `/personas/[id]` da 404 limpio con id basura, **con un correo en la URL** y con uuid
    inexistente. Ningún 500.
  - El rol se relee de la base en cada emisión del token: cambiarlo surte efecto sin cerrar sesión.

  **Las dos decisiones nuevas de Mani (18-sep):**
  - **028 · "Ver como" del developer.** Estaba en "Futuro" y se sacó. La cookie guarda la vista y
    `rolDeVista(session)` pasa a ser LA definición de con qué rol se proyecta cada pantalla. Hoy esa
    pregunta está contestada a mano en tres sitios distintos (`/mi-dia`, `/recursos`, `/productos`),
    **y eso es exactamente por qué el hueco de `/recursos` sobrevivió al ticket 024**. El developer
    SÍ escribe cuando está en vista closer, con su propio `closerId` (decisión explícita de Mani);
    el truco para no tocar las mutaciones es que `actorDe` construya el actor con `rolDeVista`.
    **Queda UNA decisión abierta dentro del ticket:** si la vista estrecha también la GUARDA o solo
    la proyección. Recomendación escrita ahí: que estreche la guarda.
  - **ADR 0026 · anular y borrar.** Registros se ANULAN (soft, con quién/cuándo/motivo, nunca un
    booleano) y lo anulado desaparece de toda métrica pero se ve tachado en el historial. Del
    catálogo se BORRA de verdad solo lo que tiene cero referencias; lo demás se desactiva y la app
    dice por qué. Enmienda acotada al ADR 0012, ya reflejada en AGENTS.md.

  ⚠️ **El riesgo del 029, escrito para que nadie lo subestime:** lo difícil no es escribir la
  anulación, es **olvidar una consulta**. Una cifra inflada se ve creíble y no lanza ningún error.
  Por eso el predicado "está vigente" vive en un solo módulo y hay un test guardián que se escribe
  ANTES y se ve en rojo. Es la misma lección que la subconsulta correlacionada del 025.

  **Sigue pendiente de Mani, sin cambios:** cargar los 5 enlaces de PayPal, decidir el 021, y el
  007 (dar de alta al equipo en `production`). ⚠️ **Y un hallazgo nuevo para el 007:
  `production` tiene 0 productos**, así que cuando entre el equipo ningún closer va a poder
  registrar una venta cerrada hasta que alguien los cargue.

  ~~**MINI PROMPT PARA LA PRÓXIMA SESIÓN**~~ **OBSOLETO: ya se ejecutó.** El 029 se cerró el mismo
  18-sep; el mini prompt vigente es el de la entrada de arriba (CIERRE 2). Se deja el texto porque
  el razonamiento del orden sigue valiendo.

  > Retomamos el Retia CRM (retia-metrics-mani). Lee AGENTS.md y la entrada "CIERRE DE SESIÓN"
  > del 18-sep en docs/agents/handoff.md.
  >
  > Contexto: el recorrido visual de /mi-dia ya se hizo y pasó; los 7 hallazgos están arreglados.
  > Árbol limpio, todo en origin/main, 477 tests verdes. Soy `developer` en las dos ramas de Neon.
  >
  > Arranca por el ticket 029 (anular un registro, ADR 0026). Antes de tocar consultas, escribe el
  > test guardián de `lib/queries/vigente.ts` y muéstramelo en rojo: el riesgo del ticket no es la
  > anulación, es que se te escape una consulta del embudo y las cifras queden infladas sin error.
  > La migración la generas y aplicas tú en `dev`, nunca un subagente, y `production` solo con mi ok.
  >
  > Antes de empezar dime qué decides del 028: si la vista del developer estrecha también la guarda
  > o solo la proyección (tu recomendación quedó escrita en el ticket).
  >
  > Después: /nerd-stats contra production (nunca se ha mirado allá), cargar los enlaces de PayPal,
  > el 007 (ojo: production tiene 0 productos), decidir el 021. El 016 y el 030 pueden esperar.

- **2026-09-18 (cierre anterior, mismo día) — F4 cerrada, todo desplegado y vivo. Lo que falta NO es
  código: es abrir la app y mirarla.**

  **PARA QUIEN ABRA LA PRÓXIMA SESIÓN, leer esto primero:**

  - **El árbol está limpio y todo está en `origin/main`** (`f8aac63`). Sin ramas sueltas, sin
    stash, sin subagentes corriendo. El stash "wip 024 rol developer" que llevaba dos sesiones
    ahí **ya no existe**: se rescató el código y se descartó su migración (cierre 5).
  - **DESPLEGADO Y VERIFICADO.** Deploy de producción `Ready` el 17-sep 23:59, con el alias
    `retia-metrics-seven.vercel.app`. Verificado con la CLI de Vercel
    (`npx vercel ls retia-metrics --scope agencia-dani`), que en esta máquina está logueada como
    `danieltovartech-4302`. **Eso es nuevo y útil: la CLI SÍ sirve para leer deploys**, aunque el
    conector MCP de Vercel pida OAuth y no funcione en sesión no interactiva.
  - **Las dos ramas de Neon están idénticas: 13 migraciones cada una**, `dev`
    (`br-withered-sun-b439zjof`) y `production` (`br-withered-mud-b4cvvg80`), verificado por
    `neon.branch_id` y no por el nombre de la variable.
  - **Mani es `developer` en LAS DOS ramas.** Con eso una sola cuenta ve las pantallas de todos
    los roles, sin cambiarse el rol en la base entre una y otra.
  - **`production` tiene UN solo usuario** (Mani). El equipo todavía no entra: eso es el 007.

  **Qué se cerró hoy:** **024** (rol developer, ADR 0025, migración 0012) y **025**
  (`/nerd-stats`). **Con eso F4 queda cerrada, y con ella F0–F4 completas en código.** Lo único
  abierto del CRM es el **016** (puede esperar), el **007** (operación) y el **021** (bloqueado
  por decisión de Mani). Detalle de cada uno en los cierres 5 y 6, abajo.

  🔴 **EL PENDIENTE NÚMERO UNO NO ES CÓDIGO.** Hay **cuatro pantallas en producción que nadie ha
  abierto nunca**: `/mi-dia`, `/personas/[id]`, `/recursos` y `/nerd-stats`. Mani decidió
  explícitamente acumular toda la verificación para el final, con la advertencia sobre la mesa
  de que acumularla es lo que produjo este estado. Ahora todo está live y no hay nada que
  esperar. **`/mi-dia` es la que más urge:** es la pantalla de captura que alimenta todas las
  métricas, y un campo roto ahí ensucia la base antes de que el dashboard lo delate; ahí el
  arreglo ya no es solo de código. La sesión de recorrido merece checklist, no una pasada.

  **Tres cosas que sigue debiendo Mani y que nadie más puede hacer:**
  1. **El recorrido visual de las cuatro pantallas** (arriba).
  2. **Cargar los 5 enlaces de PayPal** (`scripts/cargar-enlaces-pago.ts` los lee de
     `ENLACES_PAGO_JSON`, fuera del repo; ningún link real vive en git).
  3. **Decidir el 021.**

  **Dos reglas nuevas que gobiernan de aquí en adelante:**
  - **ADR 0025:** `developer` es la única excepción a la disjunción de roles, y la excepción vive
    en UN solo lugar (`esAccesoTotal` dentro de `puedeAcceder`). **Nunca escribas `"developer"`
    en un `requireRole` ni en un `paginaConRol`.** Y pasar la guarda no es tener una pantalla
    útil: lo que la página proyecta adentro sigue decidiéndose por rol.
  - **La plantilla `sql` de drizzle no califica las columnas**, así que una subconsulta
    correlacionada devuelve **0 sin lanzar error**. Está en `AGENTS.md`. Costó la primera versión
    de los conteos del 025 y lo destapó un test, no una revisión.

  ~~**MINI PROMPT PARA LA PRÓXIMA SESIÓN**~~ **OBSOLETO: ya se ejecutó.** El recorrido visual que
  pedía se hizo el mismo 18-sep. El mini prompt vigente es el de la entrada de arriba. Se deja el
  texto porque el razonamiento del orden sigue valiendo.

  > Retomamos el Retia CRM (retia-metrics-mani). Lee AGENTS.md y la entrada "CIERRE DE SESIÓN"
  > de docs/agents/handoff.md.
  >
  > Contexto: F0 a F4 cerradas en código. Todo está en origin/main (f8aac63), árbol limpio, sin
  > stash ni subagentes. Desplegado y vivo en retia-metrics-seven.vercel.app. Las dos ramas de
  > Neon con 13 migraciones, y yo soy `developer` en las dos.
  >
  > No arranques código. Lo primero es el recorrido visual: hay cuatro pantallas en producción
  > que nadie ha abierto nunca (/mi-dia, /personas/[id], /recursos y /nerd-stats). Ármame un
  > checklist por pantalla, campo por campo, empezando por /mi-dia, que es la de captura.
  > Levanta el server local si hace falta (npm run dev, hay .claude/launch.json) y avísame qué
  > mirar; el login lo hago yo.
  >
  > Después de eso: cargar los enlaces de PayPal, decidir el 021, y el 007 (dar de alta al
  > equipo en production, que hoy tiene un solo usuario). El 016 puede esperar.

- **2026-09-17 (cierre 6) — Ticket 025: `/nerd-stats`. F4 cerrada. Sin migración.**

  **F4 queda cerrada.** Con el 024 y el 025 no queda ticket de F4 pendiente. Lo que sigue
  abierto en todo el plan es el **016** (fuentes configurables, puede esperar), el **007**
  (operación, no código) y el **021** (bloqueado esperando decisión de Mani).

  **Qué es `/nerd-stats`:** la salud de la herramienta sin abrir la base. Seis bloques:
  despliegue (entorno, commit, `CRON_SECRET` como sí/no y nunca su valor), usuarios activos
  por rol, registros por origen (hoja vs app — el canario de si el equipo está usando el CRM),
  conteos por programa, últimas corridas de sync y últimos cambios desde la app. Se renderiza
  entera en el servidor: es solo lectura, así que no hay componente cliente ni JS que enviar.

  **Es la primera ruta EXCLUSIVA del developer**, y salió gratis: `paginaConRol("developer")`
  cierra a gerente y closer por la misma función central que le abre todo lo demás al
  developer. El test la mira por el lado que faltaba, el restrictivo: gerente y closer,
  disjuntos entre sí, quedan los DOS afuera de la misma ruta.

  🩸 **El hallazgo de la sesión, y no estaba en el alcance: drizzle renderiza las columnas SIN
  CALIFICAR dentro de una plantilla `sql`.** La primera versión de `conteosPorPrograma` usaba
  subconsultas correlacionadas y se convertía en
  `select count(*) from "people" where "program_id" = "id"`. Ese `"id"` resuelve a la columna
  de la tabla INTERNA, así que compara una fila consigo misma: **todos los conteos devolvían 0
  y no lanzaba ningún error.** Una pantalla entera de ceros creíbles. Lo destapó el test de
  PGlite, que ya estaba escrito antes de correr nada. Reescrita con cinco consultas agrupadas
  unidas en memoria, que a esta escala es gratis y se lee obviamente correcto. **La trampa
  quedó en `AGENTS.md`** porque ningún linter la ve, y la lección general es la de siempre
  aquí: un número mudo en cero es peor que uno que revienta.

  **Dos consolidaciones por ADR 0024, ninguna pedida por el ticket:**
  - **"Últimas corridas de sync" ya existía** dentro de `estadoDeFuentes`. Dos pantallas
    (`/ajustes/fuentes` y `/nerd-stats`) haciendo la misma pregunta: se sacó a
    `ultimasCorridasDeSync` en `lib/queries/fuentes.ts` y las dos la importan. De paso ese
    módulo ganó inyección de base, que no tenía.
  - **`haceCuanto`** vivía suelto dentro de la página de fuentes; ahora está en
    `lib/format.ts` y lo importan las dos.

  **Privacidad, que era criterio de aceptación:** `ultimosCambiosDesdeLaApp` **no proyecta**
  `etiqueta` ni los valores, que es justo donde `lib/mutations/personas.ts` escribe el nombre
  y el correo de un lead. No es cuidado al pintar, es que la consulta no los pide: falla
  cerrado. El test siembra una fila de bitácora con datos de lead y verifica sobre la fila
  entera serializada, no columna por columna, así que una columna nueva con datos personales
  también lo rompe.

  **Rendimiento, el otro criterio:** medido contra `production` (4.497 personas), las cinco
  lecturas en paralelo tardan **356 ms**, contra **347 ms** que cuesta un `select 1` vacío
  desde la misma máquina. El trabajo de base son ~9 ms. **Salvedad honesta:** el primer golpe
  después de que el compute de Neon se duerme tarda ~1,4 s, y eso es Neon despertando.

  **Loops:** 474 tests (eran 462), typecheck, lint y build limpios. `/nerd-stats` aparece en
  el build.

  ~~🔴 **Nada de esto está desplegado todavía.**~~ **RESUELTO el 18-sep: pusheado y desplegado
  (`f8aac63`, deploy `Ready` 23:59, alias de producción), y Mani ya es `developer` en
  `production`.** Se deja el texto por el razonamiento del orden, que sigue siendo la regla si
  algún día se agrega otro rol. Cuando se escribió, los dos commits de hoy (024 y 025) estaban
  solo en local: Mani decidió dejar TODA la verificación visual para el final, con la app ya live.
  Lo que falta, en este orden: **pushear** → esperar el deploy → **poner a Mani `developer` en
  `production`** (la base ya lo acepta, las 13 migraciones están aplicadas en las dos ramas) →
  **sesión de recorrido de las cinco pantallas sin mirar**: `/mi-dia`, `/personas/[id]`,
  `/recursos` y `/nerd-stats`, más los enlaces de PayPal cuando los cargue.
  **El orden importa y no es negociable:** con el código viejo desplegado, un usuario con rol
  `developer` en la base cae en `esRolValido` → false → `token.rol = "closer"`, y Mani entraría
  como closer sin programas, o sea a una app vacía.

  ⚠️ **El riesgo que Mani ya aceptó por escrito:** acumular verificación es lo que produjo el
  estado actual, con pantallas en producción que nadie ha abierto. Ahora son cuatro. La sesión
  de recorrido merece checklist, no una pasada rápida.

- **2026-09-17 (cierre 5) — Ticket 024: rol `developer`. ADR 0025, migración 0012 en `dev`.
  El `git stash` de Kiro quedó cerrado.**

  **El stash ya no existe.** Se decidió (Mani) **rescatar el código y descartar la migración**. Por
  qué: estaba basado en `cc40d4e`, **26 commits atrás**, y su migración pedía el slot `0008`, que
  desde entonces ocupa `0008_registro_y_abonos`; el ADR que proponía como `0022` también quedó
  ocupado (ventana de venta). Un `git stash pop` ni siquiera era posible: colisionaban
  `_journal.json` y `0008_snapshot.json`. Se extrajo archivo por archivo (`git checkout stash@{0} --`
  para los cuatro que no se habían movido, `git apply -3` para los que sí), se regeneró la migración
  como **0012** y el ADR como **0025**, y se hizo `git stash drop`.

  **El código de Kiro era bueno y su decisión de diseño se conservó:** el "pasa todo" vive en un
  solo `puedeAcceder` (vía `esAccesoTotal`) y no repetido en cada guarda. Pero era ~60% del ticket.
  **Tres huecos que no cubría:**
  1. **`/mi-dia` quedaba inservible para el developer.** Pasaba la guarda, pero la página seguía
     con `programasGestionablesPorUsuario(..., "closer", ...)` hardcodeado: un developer no es
     miembro de ningún programa, así que entraba a una pantalla vacía. Kiro hizo esta misma
     inversión en `/productos` y se le olvidó aquí. **El test solo miraba la guarda.** De ahí salió
     el punto 4 del ADR 0025: *una guarda que se pasa no es una pantalla que sirve*.
  2. **`protegerAdministrador` (015) le impedía a un gerente ponerse developer a sí mismo.** Ahora
     pregunta por `esAdministrador`: gerente ↔ developer se permite (no se pierde administración),
     bajar a `closer` o desactivarse no.
  3. **Había una TERCERA definición del union de roles**, escrita a mano en `types/next-auth.d.ts`.
     La destapó `tsc`, no un test: la sesión y el token seguían creyendo que había dos roles. Es
     exactamente el ADR 0024 y estaba escondida en un `.d.ts`, que es donde nadie mira.

  **De paso dejaron de tener literales de rol** `/ajustes/usuarios` (opciones desde `ROLES`), el
  menú de usuario (`Record<Rol, string>` exhaustivo: un rol nuevo sin etiqueta rompe el typecheck) y
  el CLI de emergencia (cuenta administradores, no gerentes).

  **Base:** migración **0012 aplicada en `dev`** (`br-withered-sun-b439zjof`, verificado por
  `neon.branch_id` antes de escribir), 13 migraciones. `manuelmejiaarana@gmail.com` quedó
  **developer en `dev`**.
  ~~🔴 **`production` sigue con 12 migraciones y Mani sigue de `gerente` allá.**~~ **RESUELTO el
  18-sep, con ok de Mani: 0012 aplicada en `production` (13 migraciones) y Mani es
  `developer` allá.** Ver la entrada de CIERRE DE SESIÓN arriba.

  **Loops:** 462 tests (eran 444), typecheck, lint y build limpios. Ningún test de disjunción
  gerente/closer cambió de resultado, que era el segundo criterio del "Done cuando".

  **Lo siguiente en F4 es el 025 (Nerd Stats)**, que ya está desbloqueado. `/nerd-stats` va a nacer
  con el developer cubierto sin escribir una línea para eso, porque la excepción vive en
  `puedeAcceder`.

  **Sigue pendiente de Mani, sin cambios:** cargar los 5 enlaces de PayPal, abrir `/mi-dia`,
  `/personas/[id]` y `/recursos` en un navegador, y decidir el 021. **El rol developer hace la
  segunda más fácil:** con una sola cuenta ya se ven las pantallas de los dos roles.

- **2026-09-17 (CIERRE DE SESIÓN) — Cuatro tickets (003, 006, 022, 023), dos refactors, ADR 0024.
  Estado del repo para no chocar en la próxima sesión.**

  **PARA QUIEN ABRA LA PRÓXIMA SESIÓN, leer esto primero:**

  - **El árbol está limpio y todo está en `origin/main`** (último commit `bc95e46`). No hay trabajo
    a medias en el working tree, no hay ramas sueltas, no hay subagentes corriendo. Se puede
    arrancar cualquier cosa sin heredar nada.
  - ~~**HAY UN `git stash` VIVO: `stash@{0}` "wip 024 rol developer".**~~ **RESUELTO el 17-sep
    en el cierre 5: rescatado y dropeado.** Se deja el texto por el razonamiento. Es avance de Kiro del 16-sep
    **sin revisar por nadie**, de un ticket que entonces no tocaba. Quien arranque el **024** tiene
    que decidir explícitamente si lo hace `pop` o lo descarta y empieza de cero. **No lo dejes ahí
    otra sesión más**: un stash sin dueño es la forma más fácil de perder trabajo o de re-hacerlo.
  - **La base está al día en las DOS ramas:** 12 migraciones en `dev`
    (`br-withered-sun-b439zjof`) y en `production` (`br-withered-mud-b4cvvg80`), verificado por
    `neon.branch_id`. Ninguna migración pendiente de aplicar.
  - **Archivos que se movieron mucho HOY** (si otra sesión corre en paralelo, que no los toque):
    `lib/queries/{personas,recursos,programas,saldo,ventas}.ts`, `lib/catalogo/{recursos,
    enlaces-pago,categorias-recurso,versionar,registro}.ts`, `lib/db/schema.ts`, `lib/nav.ts`,
    `app/(app)/{mi-dia,personas,recursos,documentos}/`, `components/{mi-dia-registro,
    historial-persona,recursos-pantalla,app-sidebar}.tsx`, y los tests de todos ellos.
  - **Sigue rigiendo el reparto por ARCHIVOS, no por el grafo de dependencias**, y las colisiones
    siguen siendo las mismas: migraciones (journal + snapshot + `schema.ts`),
    `docs/tasks/README.md`, este handoff y los commits.

  **Qué se cerró hoy:** **003** (`/mi-dia`), **006** (`/personas/[id]`), **022** (tablas de recursos
  y enlaces de pago + migración 0011) y **023** (pantalla `/recursos`). Con eso **F1, F2 y F3 quedan
  cerradas** salvo el **007**, que es operación y no código. Detalle de cada uno en las entradas de
  abajo.

  **Lo que NO es código y nadie más puede hacer (tres cosas de Mani):**
  1. **Cargar los 5 enlaces de PayPal.** `scripts/cargar-enlaces-pago.ts` los lee de
     `ENLACES_PAGO_JSON` (archivo fuera del repo). Ningún link real vive en git y así debe seguir.
  2. **Abrir en un navegador `/mi-dia`, `/personas/[id]` y `/recursos`.** Las tres salieron a
     producción y **ninguna ha sido vista por un humano**: exigen sesión de Google. `/mi-dia` es la
     que más urge, porque es la pantalla de captura que alimenta todas las métricas: si tiene un
     campo roto, ensucia la base antes de que el dashboard lo delate. Y el criterio de celular del
     023 está marcado `[~]`, no `[x]`, justo por esto.
  3. **Decidir el 021** (snapshot del dashboard), que sigue bloqueado esperando esa decisión.

  **Dos reglas nuevas que gobiernan de aquí en adelante:**
  - **ADR 0024 (con su enmienda del mismo día):** si dos lugares responden la MISMA pregunta, la
    respuesta vive en un módulo y los dos la importan. Nació del saldo (que estaba escrito dos
    veces: en la reja del sobrepago y en la pantalla) y se generalizó con los programas activos
    (que estaban escritos tres veces). **El matiz importa:** dos preguntas distintas que hoy dan el
    mismo SQL siguen siendo dos funciones — por eso `programasGestionablesPorUsuario` no se fusionó.
  - **`drizzle-kit generate` y `migrate` están permitidos en `.claude/settings.json`; `push` y
    `drop` están DENEGADOS a propósito.** `push` aplica el esquema sin dejar migración y se salta
    todo el historial.

  **Lección de proceso con subagentes, que costó tiempo hoy:** Kiro notificó "terminado" **antes**
  de estarlo y siguió editando archivos. Un `npm run lint` corrido en esa ventana reportó un
  warning que minutos después ya no existía, y casi se reporta como defecto un archivo a medio
  guardar. **Confirmar que el agente está `completed` (con `ListAgents`) antes de verificar nada.**
  Además dejó un proceso de polling vivo que siguió re-notificando con resultados vacíos; hubo que
  matarlo a mano. La verificación independiente de la sesión principal coincidió con su reporte
  cuando por fin llegó, así que el resultado es sólido — pero por poco.

- **2026-09-17 (cierre 3) — Ticket 023: la pantalla `/recursos`. F3 cerrada. Sin migracion.**

  **Siguiente sesión:** con esto F1, F2 y F3 quedan cerradas salvo el **007** (operación) y el
  **021** (bloqueado por decisión). Lo siguiente con código es **F4**: el **024** (rol developer),
  que tiene avance parcial **sin revisar** en `git stash` ("wip 024 rol developer"), y detrás el
  **025**. También sigue abierto el **016**, que puede esperar.

  **Código** (444 tests, typecheck, lint y build limpios). Lo implementó Kiro; la sesión principal
  revisó y corrió los cuatro loops:
  - `/recursos` con filtro por programa (incluye "Todos") y búsqueda por título, enlaces de pago
    agrupados por programa y producto, copiar/abrir e historial desplegable.
  - `/documentos` pasa a ser un `permanentRedirect` a `/recursos`; no había nada que conservar (era
    un `ProximaFase`). El ítem del sidebar se renombró a "Recursos" en `lib/nav.ts`, y con él la
    clave del icono en `components/app-sidebar.tsx`.
  - `lib/queries/recursos.ts` (solo SELECT) con los nombres de categoría y programa ya resueltos, y
    el historial por la cadena de `reemplazaA`.

  **Decisiones:**
  - **El filtro VA en la URL, al contrario que el buscador de `/mi-dia`.** No es incoherencia: allá
    lo que se teclea es el nombre o correo de un lead (dato personal, prohibido en query strings por
    `AGENTS.md`); el título de un brochure no lo es, así que aquí gana que el filtro sea compartible
    y recargable (ADR 0023). El programa viaja por **slug**, no por uuid.
  - **Leer lo pueden los dos roles; escribir solo el gerente.** No es como `/productos` (ADR 0016,
    específico de productos). Las seis acciones pasan por `requireRole("gerente")` y hay test de que
    un closer recibe `ok:false` en las seis: la barrera es de servidor, no un botón escondido.
  - Un recurso global (`programId` nulo) aparece con cualquier filtro de programa, con test.

  **Lo que NO se verificó, y es un criterio del ticket:** "en celular se usa sin scroll horizontal".
  El marcado se construyó mobile-first (sin tablas, sin anchos fijos, URLs con `break-all`) y se
  revisó por inspección, pero **nadie lo abrió en un teléfono**. Queda marcado `[~]` en el ticket,
  no `[x]`. Un test no ve un layout roto.

  **Nota de proceso:** Kiro notificó **tres veces**; las dos primeras sin reporte (avisos vacíos) y
  la tercera con el reporte completo, ya terminada la verificación de la sesión principal. Y siguió
  editando después de la primera notificación: un `npm run lint` corrido en ese momento reportó un
  warning (`plataformas` sin usar) que minutos después ya no existía, porque Kiro estaba cambiando
  ese formulario. **Una notificación no es señal de que el árbol esté quieto: hay que confirmar que
  el agente está `completed` antes de verificar**, o se verifica un estado que todavía se mueve. La
  verificación independiente de la sesión principal coincidió con el reporte cuando este llegó.

  **Deuda detectada Y arreglada en la misma sesión (Mani lo pidió al leer el reporte):**
  `lib/queries/programas.ts` tenía tres funciones que significaban "programas activos" y solo
  diferían en las columnas proyectadas. Quedaron en **una** `programasActivos` que devuelve id, slug
  y nombre; cada pantalla toma lo que necesita. El diff resta más de lo que suma (40 líneas fuera,
  24 dentro) y los 444 tests siguen verdes.
  - **`programasGestionablesPorUsuario` NO se fusionó**, aunque el SQL se parezca: no responde
    "cuáles están activos" sino "cuáles puede tocar esta persona" (membresía activa). Son dos
    preguntas distintas, y juntarlas por parecido sintáctico sería el error opuesto al que se estaba
    arreglando.
  - **El ADR 0024 se enmendó** con esto: la regla no era del dinero, era de las preguntas repetidas.
    Si dos lugares responden la misma pregunta, la respuesta vive en un módulo; la proyección es del
    llamador, el predicado es del módulo.

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

> Actualizado el 18-sep 01:35. **F0 a F4 estan cerradas en codigo** y el **029 ya esta cerrado**
> (anular registros, ADR 0026 + 0027). De los tres tickets que abrio el recorrido visual quedan el
> **028** (ver como del developer, listo para codear y con su decision tomada) y el **030** (borrar
> del catalogo). Siguen ahi el **016** (puede esperar), el **007** (operacion) y el **021**
> (bloqueado por decision de Mani).
>
> ✅ **Las dos ramas de Neon van en 15 migraciones** y `main` esta desplegado. Lo que queda del 029
> no es codigo: **abrir el dashboard desplegado con sesion**, que es lo unico que prueba que las
> consultas nuevas corren contra la base de `production`.

Por partes y en este orden:

1. [x] ~~🔴 **RECORRIDO VISUAL DE LO CONSTRUIDO**~~ — **HECHO el 18-sep** para `/mi-dia`,
       `/personas/[id]` y `/recursos` (local, rama `dev`), y `/nerd-stats` en local. 7 hallazgos,
       los 7 arreglados y verificados en el navegador. Detalle completo en la entrada de cierre
       del 18-sep. **Falta la parte que solo tiene sentido en production:** `/nerd-stats` alla
       (el chequeo es que los conteos por programa NO den cero; un cero es la subconsulta
       correlacionada del 025 volviendo) y `/recursos` con contenido, que esta vacia en las dos
       ramas. De paso sigue pendiente: borrar el cliente OAuth **web** viejo de
       `google-workspace-mcp`.
       ⚠️ **Los conteos de `/nerd-stats` ya no son 1.923 y 2.574**: el cron de sync sigue
       importando leads (4.497 → 4.599 en una hora el 18-sep). El chequeo es "no da cero", no un
       numero exacto.
1b.[x] ~~🔴 **029 · Anular un registro**~~ — **HECHO el 18-sep** (ADR 0026 + ADR 0027 nuevo).
       Predicado central, guardian sobre todo el codigo, cascada atomica, permisos, UI y recorrido
       visual con 3 hallazgos arreglados. Migraciones **0013 y 0014 SOLO en `dev`**.
1b'.[x] ~~🔴 **Aplicar 0013 y 0014 en `production`**~~ — **HECHO el 18-sep** con ok de Mani, ANTES
       del push, que es el orden correcto: una migracion aditiva no rompe el codigo viejo, pero
       codigo nuevo contra un esquema viejo revienta con *column does not exist*.
1b''.[ ] **Abrir el dashboard desplegado con sesion** (solo Mani). El build pasa y `/api/health`
       responde, pero las consultas nuevas contra `production` no se han ejercitado. De paso,
       `/nerd-stats` alla: el total de personas ronda 4.600 y **sube con cada sync**, asi que no se
       compara contra un numero fijo; lo que importa es que los conteos por programa no sean cero.
1c.[ ] **028 · "Ver como" del developer.** Decision TOMADA el 18-sep: la vista estrecha tambien la
       guarda. El 029 ya adelanto `trabajaLeads` y el `closer_id` del developer en
       `/ajustes/usuarios`; falta `rolDeVista`, la cookie, el selector y quitar las tres
       comparaciones a mano de `session.user.rol`.
2. [ ] **Cargar los 5 enlaces de PayPal.** Solo Mani: `scripts/cargar-enlaces-pago.ts` los lee de
       `ENLACES_PAGO_JSON`, un archivo fuera del repo. Ningun link real vive en git.
3. [ ] **Decidir el 021** (snapshot del dashboard), que sigue bloqueado esperando esa decision.
4. [ ] **Preparar `production` para los usuarios reales** (con ok de Mani, junto con el 007):
       sembrar productos (`seed:datos` con `DB_PROD`), cargar `administrativa@retiagrowth.com`
       como gerente y dar de alta a Andrea y Maru desde `/ajustes/usuarios`. Hoy `production`
       tiene UN solo usuario: Mani.
       ⚠️ **Verificado el 18-sep: `production` tiene CERO productos.** Sin productos, un closer no
       puede registrar una venta cerrada: el desplegable sale vacio. Sembrarlos es requisito del
       007, no un extra.
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
10. [ ] **016** (plantilla de lead por fuente) esta listo pero puede esperar. Necesita migracion.

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
