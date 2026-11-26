## Restricciones no-negociables

Reglas duras que gobiernan todo el proyecto y que ningun linter puede verificar.

**Integridad de los datos**

<a id="dedup-obligatorio-por-correo"></a>
- **Dedup obligatorio por correo.** Toda tasa se calcula sobre personas, nunca sobre filas. La
  BBDD de Tactical Investor tiene ~2.950 filas que son ~1.840 personas, y hay un correo con 12
  aplicaciones. Calcular sobre filas infla las tasas ~60% y toda decision de presupuesto sale
  mal. La garantia vive en un indice unico de la base, no solo en el codigo (ADR 0005).
<a id="programa-como-frontera"></a>
- **El PROGRAMA es parte de la identidad de un lead, y dos programas no se cruzan JAMAS**
  (Mani, 21-sep). Un lead siempre entra con su programa asignado, y la llave del dedup es
  `(program_id, email_normalizado)`, no el correo solo: **la misma persona en los dos programas son
  dos leads**, y eso es correcto, no un duplicado. La base ya lo enforza en todo lo que importa
  —`leads_programa_email_idx`, `lead_contactos_valor_idx`, `deals_uno_abierto_por_lead_y_programa_idx`,
  `calls_huella_idx`, `ad_spend_huella_idx`, `productos_programa_nombre_idx`,
  `cohorts_programa_codigo_idx`— y `lead_contactos.program_id` esta **denormalizado a proposito**
  para poder hacerlo. **De nada sirve combinar metricas de programas:** ComunicArte y Tactical tienen
  tickets distintos (USD 797 vs 1.500), economia distinta y umbrales distintos, asi que una cifra
  que los sume no significa nada y **se ve perfectamente creible**. **Desde el 9-nov (ADR 0125) la base lo garantiza:** `UNIQUE (id, program_id)` y FK compuestas impiden un hijo de otro programa, y `programs` borra con `restrict` hacia leads, deals, llamadas, abonos, cohortes y fuentes. **Excepcion unica, 24-sep (ADR
  0048):** el Dashboard ofrece "todos los programas" y ahi **solo suma magnitudes sumables en la misma
  unidad** (conteos, caja en USD, gasto); tasas, meta, meta dinamica, CPL, ROAS y comision van por
  programa, lado a lado, y la funcion del agregado **no compila** con una tasa. Toda lista operativa
  (Leads, Deals, Calls, Students, Inbox) es de un programa, con selector obligatorio. Consecuencia para toda pantalla
  nueva: el programa **no es un filtro, es una frontera**. Una vista que cruce programas tiene que
  ser imposible de construir, no solo desaconsejada — el molde es el del ADR 0023, donde el
  comparativo entre closers *"no se puede acotar ni queriendo, porque el tipo de la consulta no lo
  admite"*. Se enforza en el TIPO, no en la revision.
<a id="origen-del-lead"></a>
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
  solo en ese canal, para escribir `traido_por_user_id`. **Enmendado el 29-sep (ADR 0062, reunion con
  Pauta):** la pauta de Meta usa la plantilla de Pauta con macros (`utm_medium=paid_social`,
  `utm_content={{ad.name}}`, `utm_term={{placement}}`, **`utm_id={{ad.id}}`**), y **`utm_id` es la llave
  del anuncio** hacia el arbol y el gasto de Meta. `utm_content` y `utm_term` los sigue leyendo **solo el
  emparejador**, segun el `utm_medium` (ADR 0087). El significado de `utm_content` depende del
  canal, y leerlo sin mirar el canal es el error medido el 21-sep (anuncio en ComunicArte, conjunto en
  Tactical; y el 29-sep: en el `facebook / cpc` historico de Retia es el conjunto). **Desde el 14-oct (ADR 0087, ticket 246) el area y el canal salen de una REGLA, no
  de un catalogo:** `utm_medium` pago (`cpc`, `paid_social`, `paid`) = Paid; `referido` = Referidos; con
  `utm_source` o `utm_medium` = Organico; sin ninguno = Sin UTM. El canal es la primera palabra de
  `utm_source` (con alias: `ig`, `fb`...) y la cuenta el resto (`instagram rosario` = Instagram · Rosario). La
  respuesta vive en `resolverCanal` (`lib/atribucion/canal.ts`) y nadie la duplica; la tabla `canales` sigue
  en el esquema pero ya no la lee nadie: su pantalla de Ajustes es un redirect a Hub › Origen (248). Ningun link de organico o
  de closer se arma a mano: sale del builder del CRM; los de Meta los arma Meta con sus macros. Una macro que
  llega sin expandir (`{{campaign.name}}`) es un **centinela**, no un dato: cuenta como ausente. 🩸 Y el
  emparejamiento contra el arbol de Meta **tiene que ser determinista**: un nombre de campana repetido es un
  aviso visible (`campana_ambigua`), nunca una eleccion silenciosa — es el `fuentes[0]` sin `ORDER BY` del ADR
  0031, con dinero encima. 🎯 **"Sin clasificar" desaparecio con el catalogo**: todo envio con UTM tiene area.
  Lo que queda es **sin UTM** —un envio que llego sin origen, problema de **captacion**, **irrecuperable** para
  lo que ya entro— y las macros sin expandir, contadas aparte. El riesgo nuevo es otro: un par pago mal escrito
  cae en Organico **sin error**; por eso Hub › Origen (248) muestra cada par con la regla que lo decidio y marca
  los nuevos. **"Sin UTM" no es un estado de error**: es un hecho del lead, tan valido como `facebook / cpc`, y se
  muestra siempre con su conteo y su porcentaje.
<a id="norte-de-las-metricas"></a>
- **Norte de las métricas (ADR 0115, aceptado el 30-oct; auditoría en `docs/auditoria-metricas-2026-10-30.md`).**
  El 30-oct el CRM mostraba un ROAS ×2,2 del real, un % de show sobre una de cada cinco citas y una comisión corta en un
  40 %, con la suite en verde: cada pregunta tenía varias respuestas y ninguna pantalla distinguía una cifra a medias.
  Nueve reglas, cada una con su guardián: **(N1)** un concepto, un módulo (venta, show, cita sin resultado, agenda,
  registro, lead, "sin UTM", ancla de fecha, gasto convertido, calendario: una función SQL y su gemela TS, en el módulo
  de la tabla "Conceptos" de `docs/metricas.md` §0; nadie reescribe el predicado); **(N2)** paridad probada con el caso
  que las haría divergir; **(N3)** toda razón devuelve su cobertura y la pantalla dice "parcial" o "—", nunca una razón
  con medio dato (gasto desde el 8-oct contra ventas desde el 1-oct); **(N4)** un nombre por concepto, de un solo
  vocabulario; **(N5)** ningún texto visible con `utm_*`, ADR, ids, "macro" o "periodo A/B", y formato solo por
  `lib/format.ts` con la regla del vacío (— no se puede calcular, 0 es cero, "Sin datos" aún no hay periodo); **(N6)** lo
  que una métrica necesita se exige al escribir, no se parcha al leer; **(N7)** reemplazar es borrar, y cada función que
  cita el diccionario tiene un llamador fuera de `tests/`; **(N8)** sobre qué hace el código manda el código, sobre qué
  debería hacer manda ADR vigente > ticket > documento de reunión, y una enmienda reescribe título, índice, diccionario y
  vocabulario en el mismo commit; **(N9)** un ticket es `done` solo con sus casillas marcadas y el tracker igual al
  `status:` del archivo.
<a id="caja-y-ventas-separadas"></a>
- **Caja recaudada y ventas cerradas son dos metricas separadas.** Los montos de la columna
  Precio son adelantos parciales, no precios finales. Nunca inferir una de la otra. La caja es
  la suma de `abonos` por fecha del abono; las ventas son el conteo de **deals en Abonado o
  Completo** (ADR 0013, ADR 0037; `sales` ya no existe).
<a id="definicion-unica"></a>
- **Todo dinero derivado tiene UNA definicion (ADR 0024).** Lo abonado y el saldo viven en
  `lib/queries/saldo.ts`; ninguna consulta vuelve a escribir `sum(abonos.monto)` a mano. La regla
  general: si dos lugares tienen que dar la misma cifra, la cifra vive en un modulo y los dos la
  importan. Estuvo copiada en `saldoDeVenta` (la reja que bloquea un sobrepago) y en
  `ventasDePersona` (lo que el closer ve): una pantalla y una reja discrepando sobre el mismo
  numero no se descubre hasta que el dinero no cuadra. `tests/saldo-centralizado.test.ts` compara
  las dos salidas y falla si alguien las separa. El modulo volvio el 27-sep sobre el deal (`saldosDeDeals`) y
  el test comparativo el 28-sep con el ticket 060: la reja del sobrepago de `registrarAbono`
  (`lib/deals/abonos.ts`) acepta exactamente el saldo del modulo y un centavo mas se rechaza. **La regla no es solo del dinero:** si dos lugares
  responden la MISMA pregunta, la respuesta vive en un modulo y los dos la importan — la proyeccion
  es del llamador, el predicado es del modulo (asi se consolido `programasActivos`). Dos preguntas
  distintas que hoy dan el mismo SQL siguen siendo dos funciones.
<a id="registros-anulados"></a>
- **Un registro anulado no cuenta en NINGUNA metrica, y eso lo garantiza un predicado y un
  guardian (ADR 0026, ADR 0038).** Llamadas, ventas y abonos se anulan (nunca se borran) con
  quien, cuando y por que. Toda lectura de `calls`, `sales` o `abonos` —en `lib/`, `app/`,
  `components/` o `scripts/`, no solo en `lib/queries/`— pasa por `vigente(tabla)` de
  `lib/queries/vigente.ts`; la que quiere ver lo anulado lo dice con `incluyendoAnulados(tabla)`.
  `tests/vigencia-centralizada.test.ts` recorre el codigo cadena por cadena y falla si una consulta
  lee esas tablas sin decidir. **El riesgo no es escribir la anulacion: es olvidar una consulta**,
  porque una cifra inflada se ve creible y no lanza ningun error.

<a id="meta-de-cohorte"></a>
- **La meta es de la cohorte y no se reparte entre closers.** Un closer tiene contribucion
  (sus ventas de la cohorte), no meta propia: el reparto no existe en la base y seria un numero
  inventado con el que se mide a personas (ADR 0023). Lo mismo con la meta de leads por dia.
  Y los leads de un closer son las personas de las que es responsable, asi que la suma de los
  closers **no** da el total del programa: la pantalla lo dice en vez de cuadrarlo a la fuerza.
<a id="moneda-visible"></a>
- **Nunca convertir moneda en silencio.** Tickets en USD, pauta en COP, sin TRM historica unica.
  Siempre mostrar la moneda al lado del numero.
<a id="fechas-de-bogota"></a>
- **TODA fecha de este sistema es de Bogota, Colombia (Mani, 19-sep).** No existe "la zona del
  entorno": la maquina de quien corre un script y una funcion de Vercel no son la misma, y sobre
  una columna `timestamptz` eso produce instantes distintos para la MISMA fila. Colombia no tiene
  horario de verano, asi que siempre es `-05:00` y va **explicito**. Dos lugares lo implementan y
  no debe haber un tercero: `parsearFecha` en `lib/sheets/mapeo.ts` (lo que entra desde las hojas)
  y `hoyEnBogota()` en `lib/format.ts` (lo que la app prellena). `new Date(a, m, d)` y
  `toISOString().slice(0,10)` estan PROHIBIDOS para una fecha de negocio: el primero usa la zona
  del proceso y el segundo da el dia en UTC, que de 7pm a medianoche ya es manana.
<a id="dias-habiles"></a>
- **Solo dias habiles, y los festivos cuentan como habiles.** Regla de Retia, no del calendario
  colombiano: solo se excluyen sabados y domingos.

**Seguridad y privacidad**

<a id="rol-en-servidor"></a>
- **El rol se enforza en el servidor, en cada ruta.** Esconder un boton no es seguridad. Todo
  route handler y toda pagina pasa por `requireRole` / `paginaConRol`.
<a id="capacidades-por-rol"></a>
- **Hay un tercer rol, `developer`, y es la unica excepcion a la disjuncion (ADR 0025).** Pasa
  toda guarda: exclusiva de gerente, exclusiva de closer o compartida. La excepcion vive en UN
  solo lugar, `esAccesoTotal` dentro de `puedeAcceder`: **nunca se escribe `"developer"` en un
  `requireRole` ni en un `paginaConRol`**, o la ruta que alguien agregue el mes que viene se
  olvidaria de el. Y pasar la guarda no es tener una pantalla util: lo que la pagina proyecta
  adentro sigue decidiendose por rol (`/mi-dia` y `/productos` le dan la union de programas, no la
  de un closer sin membresias). "Administrar" es OTRA pregunta: `esAdministrador` la cumplen el
  gerente y el developer, y es la que usa la salvaguarda del ultimo administrador. **La SEXTA
  pregunta, `administraGlobal`** (ADR 0094), distingue esa capacidad dentro de un programa de
  administrar lo transversal: el developer siempre la cumple; gerente y paid trafficker solo
  cuando no tienen filas en `usuarios_programas_alcance`. Con filas ven únicamente esos programas
  y no entran al resto de Ajustes. **`administraUsuarios`** la cumplen developer y todo gerente, y el
  catálogo limita cada escritura a sus programas (ADR 0118). Y hay una
  TERCERA, `trabajaLeads`: quien tiene `closer_id`, membresias, puede ser responsable de una
  persona y registrar. La cumplen el closer y el developer, **no el gerente** (ADR 0003). **Y una
  CUARTA, `manejaPauta`** (ADR 0052, construida el 3-oct con el 173), para el rol `paid_trafficker`,
  que cumplen el paid trafficker, el gerente y el developer: abre Hub › Origen (antes Canales), su Mi espacio (179) y el Hub (102, ADR 0086). **Una
  QUINTA, `veEquipoComercial`** (102, 5-oct): quien ve el trabajo de los closers en el Hub (comparativo, comision,
  abiertos por owner, filtro de closer y la lista detras de cada cifra); la cumplen gerente, closer y developer, no el paid
  trafficker, y sus cifras se proyectan en el servidor con `sinListas`. Y la pregunta de **alcance**, *"¿que
  programas ve esta sesion?"* (ADR 0048, enmendado por el 0094), tambien en `lib/auth/`: gerente y
  paid trafficker sin filas ven todos los activos; con filas, solo esos; developer siempre todos;
  closer y customer success conservan sus membresias. Son preguntas distintas y funciones
  distintas: una pantalla que pregunte `rol === "closer"` a mano deja al developer
  afuera, que es justo como `/ajustes/usuarios` quedo sin poder cargarle su `closer_id` (18-sep).
<a id="developer-dueno"></a>
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
<a id="gerente-y-closer-disjuntos"></a>
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
  admite. **Retirada para el closer por el ADR 0082 (224, 9-oct; enmienda del 30-oct):** el closer ya no abre el Hub,
  ni el de un programa ni el de "todos"; las rutas le responden 404. La regla "todos ven todo" queda para quien abre el
  Hub (gerente, developer y, sin el trabajo del equipo comercial, el paid trafficker).
<a id="nada-publico"></a>
- **Nada de la app es publico.** Sin sesion no se ve ni una cifra. Excepciones: `/api/health`, que no
  expone ningun dato del negocio, y **`POST /api/semaforo/envios`** (ADR 0089, ticket 259): la llama Juanito con
  `x-semaforo-secreto` (comparado en tiempo constante; sin el, 401 sin cuerpo y nada se mueve) y devuelve el
  semaforo ya calculado, sin un solo nombre, correo, telefono ni id de lead. Con el mismo secreto,
  **`POST /api/semaforo/clasificar`** (ticket 314): Juanito le reenvia la respuesta del grupo ("4521 A, 8830 L") y
  el CRM marca esas campañas como agenda o lanzamiento, solo en los programas que reportan a ese grupo, con rastro
  en `change_log` (origen `whatsapp`). Solo con el formato exacto (codigos y A/L, nada mas); cualquier otro texto
  responde `{ texto: null }` y Juanito calla (28-oct).
  **Tercera excepcion: `POST /api/semaforo/estudiantes-nuevos` y su `/confirmar`** (ticket 408): Juanito usa el
  mismo secreto para leer durante 48 h los avisos pendientes por numero de Customer Success y confirmar cada par.
  Es el unico endpoint de maquina que lleva datos personales: solo dentro del `texto` ya armado y en los telefonos
  de CS declarados por su contrato `.strict()`; sin secreto responde 401 sin cuerpo.
  **`POST /api/pendientes/avisos` y su `/confirmar`** (ticket 428): Juanito usa el mismo secreto para pedir y
  confirmar los avisos personales de registros pendientes de cada closer; el texto ya armado solo lleva el nombre
  completo de sus propios leads, sin correos ni telefonos, y sin secreto responde 401 sin cuerpo.
  **`POST /api/salud/alertas`** (ADR 0130, ticket 425) lo consulta Juanito con `x-alertas-secreto` y devuelve alertas tecnicas sin datos personales; **`POST /api/salud/cierre`** usa el mismo secreto y devuelve el cierre diario, también sin datos personales.
  **El MCP del CRM** (ADR 0119, tickets 348, 383 y 384; por construir): `/api/mcp` y sus endpoints de OAuth.
  Sin token, 401 sin cuerpo; con token, la persona dueña del token con su rol y su alcance, revalidados en cada
  llamada, y nada que la app no le muestre.
  **`POST /api/webhooks/pagos/[fuente]`** recibe Hotmart: el `hottok` de `X-HOTMART-HOTTOK` se compara en tiempo constante; sin él responde 401 y nada se mueve. Con firma válida guarda el cuerpo crudo y la respuesta no expone datos personales.
<a id="ids-opacos"></a>
- **Los identificadores en rutas son ids opacos, nunca datos personales.** La UNICA informacion personal
  permitida en un query string es el texto libre `q` del buscador de una lista (ADR 0116); correos,
  telefonos y nombres nunca identifican una ruta.
<a id="secretos"></a>
- **Secretos solo en `.env.local` y en Vercel.** Nunca en el repo, nunca abiertos en un editor
  (ver la seccion de incidentes en `docs/agents/handoff.md`). **Excepcion nombrada (ticket 105, ADR
  0055):** el secreto HMAC de cada fuente webhook vive en `sources.secreto_webhook`, porque es una fila
  editable (ADR 0012) y verificar una firma exige el valor. Lo escribe SOLO `escribirSecreto` (privada en `lib/catalogo/fuentes.ts`), por dos puertas: `rotarSecretoDeFuente` lo genera y `guardarSecretoDeFuente` guarda el que genera el proveedor (Form30x no acepta uno propio, 15-oct); se
  muestra una vez, nunca pasa por el molde ni por `change_log`, y ninguna lectura del catalogo ni de la
  pantalla lo devuelve (`tests/fuentes-webhook.test.ts`). **Segunda excepcion (ADR 0057, 28-sep):** el token de
  Calendly de cada programa vive en `programs`, con las mismas reglas (ticket 109); su clave de firma del
  webhook (`calendly_signing_key`, 096) sigue las mismas reglas. **Otra excepcion (ADR 0062, 29-sep):** el
  token de la API de Meta (uno solo: el usuario del sistema de Retia lee las cuentas de todos los programas) vive en `meta_conexiones`, con las mismas reglas (ticket 119).
  **Y otra (Mani, 29-sep; construida el 6-oct con el 126 B):** el token de la API de Typeform de cada fuente vive
  en `sources.typeform_token`; lo escribe solo `guardarTokenTypeform` y lo lee solo `embudoPorPregunta`
  (`tests/typeform-insights.test.ts`).

**Interfaz**

<a id="ui-ux"></a>
- **UI/UX es prioridad, al nivel de la integridad de los datos (Mani, 4-nov).** Una pantalla se juzga por si se
  entiende a la primera y sirve para decidir: jerarquía de tres pesos, visual antes que tabla, nada vacío a la vista,
  poco texto (lo demás en "Cómo se calcula"), nada redundante, lo principal nunca plegado y toda cifra abre su lista.
  El contrato completo, con sus diez puntos (el 10, la Cifra, del 10-nov), vive en `docs/structure.md` §9 ("Contrato de entendimiento") y se lee
  antes de tocar una pantalla. Lo que pidió gerencia en el weekly (`docs/hub.md` §0) decide qué va arriba.

**Arquitectura**

<a id="dato-en-su-objeto"></a>
- **Cada dato vive en la pantalla de su objeto, y lo que no se usa se quita (ADR 0077, Mani, 3-oct).** Los objetos
  son Programa, Perfil (Mi espacio), Deal y Lead; Ajustes solo guarda lo que no es de ningún objeto (usuarios y
  roles, Webhook Health, Motivos, Áreas; Canales pasó a Hub › Origen). Antes de agregar una pantalla, un campo o un catálogo, se busca
  qué quitar: un catálogo existe solo si el código decide con su valor o una métrica lo agrupa. Quienes usan el CRM
  no son técnicos; la complejidad de operación cuenta como deuda, igual que la del código.
<a id="organizacion-por-dominio"></a>
- **La estructura se organiza por dominio, no por tamaño ni por tipo técnico.** Las pantallas,
  tipos y helpers que pertenecen a un mismo límite viven juntos: por ejemplo,
  `components/resources/` y `components/admin/`. Las rutas en `app/` coordinan; las consultas y
  mutaciones de negocio viven en `lib/`; un componente de pantalla no debe importar la
  implementación interna de otro dominio para reutilizar un tipo o helper. Extraer una pieza solo
  cuando tenga una responsabilidad y contrato propios, conservar imports públicos durante la
  migración y añadir un test de su comportamiento puro. No hacer movimientos masivos ni crear
  carpetas genéricas (`shared`, `common`, `utils`) para esconder acoplamiento. Ver ADR 0033.
<a id="crecimiento-medido"></a>
- **El crecimiento se mide antes de reorganizar.** Un módulo grande no se divide por contar líneas:
  se identifica una frontera de dominio, se extraen primero tipos/helpers puros, se conserva el
  comportamiento, y se valida con typecheck, lint y tests del dominio más la suite completa.
  Las extracciones posteriores de `mi-dia-registro`, `dashboard` y `schema` deben seguir el mismo
  orden; si no hay frontera estable, se deja el módulo en su lugar y se documenta la deuda.
<a id="instancias-y-tipos"></a>
- **Las instancias viven en la base, los tipos viven en el codigo (ADR 0012).** Si el codigo no
  toma una decision segun un valor (un programa, una cohorte, un closer, un producto, una
  plataforma, un motivo, un origen, un recurso), ese valor es una fila editable desde la app,
  nunca un literal, un enum ni una ruta fija. Toda entidad configurable sigue el molde de
  `lib/catalogo/`: tabla con `activo`, un solo esquema zod, pantalla con guard, y cada cambio va a
  `change_log`. **No se borra lo que YA SE USO** (enmienda del ADR 0026 al 0012, 18-sep): una fila
  con cero referencias se borra de verdad, una con referencias solo se desactiva y la app dice
  cuantas tiene. Lo que no puede pasar es que la app diga "borrado" habiendo desactivado.
  Ningun slug de programa aparece en `lib/`, `app/` ni `components/`.
<a id="identidad-de-closer"></a>
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
<a id="catalogo-por-molde"></a>
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
<a id="sync-de-sheets-retirado"></a>
- **El sync de Sheets se retiro el 28-sep (ticket 108, decision A6 de `docs/plan.md`).** Los leads
  entran solo por el webhook. `sync_runs` queda como historial de solo lectura (nadie escribe en ella) y
  su molde de exclusion mutua (el INSERT como candado contra un indice unico parcial) sigue en el ADR
  0005. Lo que queda de `lib/sheets/` (lectura, mapeo, `parsearFecha`, dedup, prueba de fuente) sirve
  para leer una hoja UNA vez: el traslado y la migracion de la etapa 7.
<a id="deal-central"></a>
- **El Deal es el objeto central, y `sales` ya no existe (ADR 0037).** Una venta es un deal en
  **Abonado o Completo**, nunca un deal a secas: contar todos los deals infla las ventas y **no
  lanza ningun error**. `deal.etapa` es un `pgEnum` porque el codigo decide con ella (embudo,
  Students, cartera, movimientos automaticos): son **once** etapas desde el 24-sep (Seguimiento entra
  con el ticket 043). `lead.estado` es texto y nadie decide con el: la etapa de entrada la decide
  `etapaDeEntrada` con la agenda y la calidad (`lead_quality`); D4 la cierra el ADR 0069 (el 0054 está retirado).
  **`deals.etapa` no se escribe a mano desde ninguna parte**: el unico camino es `moverEtapa()`
  (etapa 2), que valida y escribe `deal_etapa_historial`.
<a id="anular-no-es-perder"></a>
- **Anular NO es Cierre Perdido, y por eso anulado no es una etapa (ADR 0038).** Cierre Perdido es
  un resultado del negocio y CUENTA en el embudo; anulado es una correccion de tecleo y no cuenta
  en ninguna metrica. 🩸 Si se funden, un error de dedo se convierte en una venta perdida y la
  tasa de conversion miente. Y como es una marca ortogonal, anular no borra el dato de en que
  etapa estaba el deal cuando se descubrio el error.
<a id="fuentes-de-verdad"></a>
- **El formulario es la fuente de los leads; el CRM lo es de todo lo demas (ADR 0004).** Los leads
  entran por webhook (corte directo, 22-sep) o por alta manual; lo que hay en Sheets se traslada una
  sola vez por la misma puerta de ingesta. Deals, llamadas, abonos y dueño nacen y viven en el CRM, y
  nada se escribe de vuelta a la hoja. Lo que manda una fuente se guarda como llego.
<a id="mapeo-ruidoso"></a>
- **Un mapeo de columnas que no cuadra falla ruidosamente.** Nunca adivinar una columna: se
  resuelve por texto del encabezado, no por posicion, y si falta un campo obligatorio se lanza
  `MapeoInvalidoError` con lo que se buscaba y los encabezados reales.
<a id="centinelas"></a>
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

**Rendimiento y escala** — observados en produccion, no decididos en una reunion. Trata cualquier
cambio que los rompa como una regresion, y cualquier crecimiento que los supere como una senal de
que hay que re-pensar el diseno:

<a id="sync-en-lotes"></a>
- **El sync completo cabe en el limite de una funcion de Vercel.** Con inserciones fila por fila
  tardaba 161 segundos y se pasaba; con lotes de 200 tarda 4,0 segundos para 1.253 personas.
  Cualquier operacion nueva sobre el set completo se escribe por lotes desde el principio.
<a id="escala-real"></a>
- **Escala real hoy: ~3.000 filas por hoja, dos programas, 5 usuarios concurrentes.** No es un
  sistema de alto trafico y no hay que disenarlo como si lo fuera. Si el volumen se multiplica
  por diez, revisar la estrategia de lectura completa de la hoja.

<a id="contrato-de-tests"></a>
- **Contrato de tests (Mani, 25-nov-2026).** Todo test nuevo declara en el PR "falla si ___" y pasa los cinco
  filtros de `docs/agents/tests.md`: atrapa un bug con nombre, nadie más lo atrapa (typecheck, lint, base u
  otro test), vive en el nivel más barato que lo ve, prueba por la puerta pública y sobrevive a un refactor sin
  cambio de comportamiento. Cada comportamiento tiene un solo test dueño; los duplicados, las migraciones de
  datos ya aplicadas en producción y los textos de UI que no son contrato se borran. Ningún shard del CI pasa
  de 4 min de `npm test`. Origen: 4.975 tests y ~16 min de CPU por corrida sin medida de qué protegen.
