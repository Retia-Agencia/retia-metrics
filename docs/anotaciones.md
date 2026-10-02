# Anotaciones de UI y UX

Bandeja única de lo que sale de recorrer la app a mano: cambios que queremos, aclaraciones y usabilidad.
**Quienes usan el CRM no son técnicos**: cada anotación se mira con esa vara.

## Cómo se usa

- Una anotación por fila, con id `A-NN` que no se reutiliza. Se agrega abajo, nunca se reescribe la de otro.
- **Tipo:** `cambio` (algo que hay que construir o rehacer) · `aclaración` (una duda de cómo funciona;
  se responde aquí) · `bug`.
- **Destino:** el ticket donde vive el trabajo. Si ya existe, el ticket lleva un bloque "Anotaciones" que
  **cita el id, no copia el texto**. Si no cabe en ninguno, queda `sin ticket` hasta que se cree uno.
- **Estado:** `abierta` · `en ticket` · `resuelta` (con fecha) · `descartada` (con por qué).
- Las aclaraciones respondidas se quedan: son el manual que alguien más va a buscar.

## Recorrido 1 · 30-sep · Mani (developer, gerente y closer, contra producción)

| Id | Pantalla | Tipo | Anotación | Destino | Estado |
|---|---|---|---|---|---|
| A-01 | Ficha del Deal | aclaración | ¿Cómo se le asigna un producto a un Deal? | 074 | resuelta · 30-sep (abajo) |
| A-02 | Ficha del Deal | cambio | La ficha nombra los objetos que tiene colgados (llamadas, abonos, actividades) pero no se puede hacer clic para ver el detalle de cada uno. Cada objeto tiene que ser un enlace a su propia vista. | 075 | en ticket |
| A-03 | Ficha del Deal → Llamadas | cambio | "Agregar llamada" solo **crea** una llamada a mano. Debería dejar **elegir una de las sueltas** (llamadas sin deal) del programa, y crear a mano solo si no está. Hoy asignar una suelta solo se hace desde el lado de la llamada (Inbox y Calls). | 075 | en ticket |
| A-04 | Navegación (closer) | aclaración | El closer solo ve Mi día, Personas, Productos, Recursos y Ajustes. ¿Qué va a ver? | 097, 094 | resuelta · 30-sep (abajo) |
| A-05 | Mi día / Inbox | aclaración + cambio | ¿En qué se convierte Mi día? Propuesta: el hub del closer, con todo lo suyo (Deals, Llamadas, Students…). | 071, 075 | resuelta la aclaración · el hub queda en 075 |
| A-06 | Todas | cambio | Regla general: ninguna pantalla crece en scroll infinito con cada entrada nueva (paginar o limitar). Y las subsecciones no se apilan una encima de otra: se elige cuál se ve (tabs, filtros o plegables) para no tener que pasar por todas. | 075 (criterio transversal) | en ticket |
| A-07 | Deals (Kanban) | cambio | La página no hace scroll vertical: es fija y cada etapa hace scroll por dentro. Al pie de cada etapa, el **valor total en USD** que hay sentado en ella en ese momento. | 075 | en ticket |
| A-08 | Deals (Kanban) | cambio | Al arrastrar un Deal, acercarlo al borde tiene que desplazar el tablero a izquierda o derecha para llegar a las etapas que no caben en pantalla. | 075 | en ticket |
| A-09 | Personas / Leads | cambio | Los leads se ven en tabla, como una hoja histórica, paginada de a 25 o 50, **sin esperar a que se busque a alguien**, y con los **campos crudos del envío**. | 072 | en ticket |
| A-10 | Cohortes | aclaración + cambio | ¿Dónde se manejan las cohortes? Hay que poder crearlas, asociarlas a su programa y darles fecha de inicio. | 014 (existe), 100 | resuelta la aclaración · lo visible queda en 100 |
| A-11 | Personas / Leads | aclaración + cambio | ¿Por qué existe Personas si ya hay Leads? Leads es la que debe tener todo lo de A-09 (y la búsqueda). Personas se retira. | 072 | en ticket |
| A-12 | Leads → Posibles duplicados | cambio | El aviso de posible duplicado tiene que traer **pegado el lead que cree que es el mismo**, lado a lado y con la razón (el teléfono en común), para decidir ahí sin buscar a nadie. Es un caso del principio P-1. | 072, 075 | en ticket |
| A-13 | Ficha del Deal | cambio | Un bloque de **Alertas** en el Deal: en **rojo** lo urgente que falta llenar; en **amarillo**, dicho explícito, lo que el Deal necesita para pasar a la siguiente etapa. Que el closer no tenga que memorizar el flujo. | 128 (nuevo) | en ticket |
| A-14 | Personas / Leads | aclaración | ¿Cuál es la diferencia entre Leads y Personas? Está muy confuso. | 072 | resuelta · 30-sep (abajo) |

## Recorrido 2 · 1-oct · revisión visual del 139 (closer, base local con un envío real copiado de producción)

| Id | Pantalla | Tipo | Anotación | Destino | Estado |
|---|---|---|---|---|---|
| A-15 | Ficha del Deal → Facturación | cambio | "Cambiar cohorte" sale dos veces: en el encabezado del bloque y otra vez junto a la cohorte, abajo. Basta uno. Venía del 074. | 075 | abierta |
| A-16 | Ficha del Deal → Facturación | cambio | A 375 px el encabezado del bloque (título, "Cambiar cohorte" y "Registrar abono") no cabe y el botón queda pegado al borde de la tarjeta. Venía del 074. | 075 | abierta |
| A-17 | Ficha del Deal → Cabecera y Facturación | cambio | Cuando no hay valor vendido, el saldo dice "sin precio de contrato registrado" en la fuente de cifras (`cifra`); es texto, no una cifra, y se lee como un número roto. | 075 | abierta |
| A-18 | Ficha del Deal → Perfil | aclaración | Las respuestas del formulario repiten datos que ya están en otros bloques: correo y WhatsApp (en Lead y contactos) y las variables de Typeform como `variable:lead_value` o `variable:tag_lead_quality` (ya arriba como lead value y quality). El 139 solo quita las llaves `utm_*`. ¿Se ocultan también estas, y con qué regla? Decisión de Mani. | sin ticket | abierta |

## Recorrido 3 · 2-oct · ticket 153 (closer `mani.closer`, base local desechable con el seed del 153)

Recorrido parcial de `docs/pruebas-operacion-comercial.md` (33 pruebas), cortado por uso. Pasaron, sin errores de consola: 1, 5,
6, 8, 10, 12, 14, 15, 17, 18, 19, 20, 22, 26 y 31. (El primer registro decía "17 de 40" y daba por pasadas la 38 y la 40, que no
existen.) El resto quedó para el recorrido 4.

| Id | Pantalla | Tipo | Anotación | Destino | Estado |
|---|---|---|---|---|---|
| A-19 | Seed local (153) | cambio | Los deals de volumen nacen como **históricos** (`abrirDealesHistoricos`), y el motor les perdona el área y el valor vendido: un deal pasó a Compromiso Verbal sin área. Las pruebas de requisitos no muerden sobre ellos. Además todos tienen dueño, así que "Por settear" sale vacío y la prueba 4 (tomar un lead) no se puede hacer. El seed tiene que dejar deals no históricos y algunos sin dueño en Potencial y Registrado. | 153 | resuelta: rama `153-a19-seed` (6 deals sin dueño por la regla real, 6 no históricos de `mani.closer`; el seed ahora pide `aplicarReglaDeDeals: true`, que no viene por defecto) |
| A-20 | Ficha del Deal → Actividades | usabilidad | "Registrar" queda deshabilitado mientras la nota esté vacía y no dice por qué. El canal es opcional y no hay campo de fecha, pero la alerta pide "el contacto, con fecha y canal". Que la alerta y el formulario digan lo mismo. | sin ticket | abierta |
| A-21 | Ficha del Deal y Inbox → Registrar abono | usabilidad | "Registrar abono" se ofrece en En gestión y en Agendado (Inbox, "Lo mío que necesita atención"), donde el motor lo rechaza: el closer llena el formulario entero antes de que se lo digan. Esconderlo donde no aplica, o avisar antes. | sin ticket | abierta |
| A-22 | Ficha del Deal → Alertas | cambio | Al agendar una cita para hoy a las 4 p. m. (eran las 2:40), sale en rojo "La llamada de hoy no tiene resultado" antes de que la llamada ocurra. El "no value" debe esperar a que pase la hora. | 128 | abierta |
| A-23 | Ficha del Deal → Llamadas | cambio | Se aceptó el Grain de una cita fechada el 5-oct (futura) y el deal pasó a Atendido. Una llamada que no ha pasado no debería poder marcarse como ocurrida. | sin ticket | abierta |
| A-24 | Registrar abono → mensaje de sobrepago | cambio | "El abono (497.01 USD) supera el saldo del deal (497.00 USD)": punto decimal, contra el contrato de `lib/format.ts` (coma decimal). | sin ticket | abierta |
| A-25 | Ficha del Deal → Alertas en Ganado Pago Parcial | aclaración | "Otra ruta: Contactado / Calificado / Atendido / Compromiso Verbal" son las vueltas del sistema al anular el abono (A1), no rutas del closer. Se leen como opciones. | 128 | abierta |
| A-26 | Inbox → "Llamadas de hoy sin resultado" | aclaración | Lista llamadas del 8 al 25 de septiembre bajo el título "de hoy". O el título dice "pasadas sin resultado", o la lista se limita a hoy. | 128 | abierta |

## Recorrido 4 · 2-oct · ticket 153 (closer `mani.closer` y gerente, base local resembrada con A-19)

Las 18 que faltaban. Pasaron: 2, 3, 7, 9, 11, 16, 21, 23, 24, 25, 27, 29, 32 y 33. La 15, la 16 y la 24 se repitieron sobre
deals **no históricos** (`req-*`): ahí el área sí se exige y A1 sí baja de Completo a Parcial. Con hallazgo: la 4 y la 5 (la lista
estaba vieja contra el ADR 0071, ya corregida), la 13 (A-27), la 24 sobre un histórico (A-30) y la 30 (la prueba describía otra
pantalla, ya corregida). La 28 no se pudo: el seed no deja ningún "se perdió en el Calendly". Consola: solo ruido de entorno
(logins contra la base vieja, el websocket del reinicio, los 404 de la 32) y A-32.

| Id | Pantalla | Tipo | Anotación | Destino | Estado |
|---|---|---|---|---|---|
| A-27 | Ficha del Deal → Alertas | cambio | Un deal pasado a Atendido sin Grain muestra "Sin Grain" en la fila de la llamada, pero el bloque de Alertas no dice nada. La prueba 13 (ADR 0066) espera la alerta en rojo en la ficha y la tarjeta. | 128 | abierta |
| A-28 | Ficha del Deal → Log de eventos | cambio | Ediciones que no son altas salen tituladas **"Deal creado"**: reclamar el deal, congelar el valor vendido al calificar y poner el área al comprometer. El que lee el log cree que el deal se creó tres veces. | sin ticket | abierta |
| A-29 | Avisos de la ficha (toasts) | cambio | Al anular un abono el aviso dice "El deal volvió a compromiso_verbal." y "...a ganado_parcial.": el nombre interno de la etapa, no el de pantalla (`nombreDeEtapa`). | sin ticket | abierta |
| A-30 | Anular abono sobre un deal histórico | aclaración | En un Completo histórico sin valor vendido, anular un abono no lo baja a Parcial: el saldo es desconocido y A1 no corre (`lib/deals/abonos.ts`). Los deals migrados (078) son históricos: o la migración les escribe valor vendido, o se acepta que anular sobre ellos no recalcula la etapa. Decisión de Mani antes del 078. | 078 | abierta |
| A-31 | Ficha del Deal → Origen | cambio | "Fecha del envío" muestra la hora de ingesta (2 oct, 14:57), no la del envío (29 y 30 sep, que la ficha del lead sí muestra bien). | sin ticket | abierta |
| A-32 | Página 404 (programa ajeno) | aclaración | La consola dice "Encountered a script tag while rendering React component" alrededor del 404. No rompe nada visible; hay que ubicar qué componente lo emite. | sin ticket | abierta |
| A-33 | Ficha del Deal recuperado | usabilidad | Tras recuperar un Cierre perdido a En gestión, la cabecera sigue mostrando "Motivo del cierre: Sin dinero para invertir ahora". O se oculta fuera de Cierre perdido, o se rotula como "último motivo de cierre". | sin ticket | abierta |

### Principios que salen del recorrido

Reglas de UI que aplican a toda pantalla, no a una. El 075 las usa como criterio de revisión.

- **P-1 · El CRM trae el contexto, el usuario no lo busca (A-12).** Cuando el sistema sospecha algo
  (un duplicado, una llamada que podría ser de un deal, un deal sin producto, un lead que volvió a
  llenar el formulario), muestra **el candidato concreto y la razón**, y la acción para resolverlo en el
  mismo lugar. Un aviso que obliga a abrir otra pantalla y buscar a mano no está terminado. A-03 es el
  mismo principio aplicado a las llamadas sueltas.
- **P-2 · Nada crece sin tope y nada se apila (A-06).** Paginado o limitado; las subsecciones se eligen,
  no se recorren.

### Respuestas

**A-01 · Producto de un Deal.** ⚠️ **Obsoleta desde el 1-oct: el ticket 134 retiró `productos`.** El precio sale
de la cohorte del deal y el closer escribe el descuento (ADR 0065); el saldo se mide contra el valor vendido. Lo
que sigue es la respuesta del 30-sep, como historia. Había dos caminos, los dos en código (`lib/deals/editar-deal.ts`):
1. En la **ficha del Deal**, la acción *Editar deal* tiene el selector **Producto** (solo productos
   activos del mismo programa). Desaparece cuando el deal está en Completo, porque cambiarlo movería
   su saldo.
2. Al **mover** el deal a una etapa que exige producto (las de pago), el diálogo de mover lo pide antes
   de dejar pasar.

Sin producto no se puede registrar un abono: no hay precio contra el cual medir el saldo. Lo que la
anotación destapa es que **no es obvio**: nada en la ficha dice "a este deal le falta producto". Eso va
con A-02 al 075.

**A-04 · Qué ve el closer.** Las tabs de programa (Dashboard, Leads, Deals, Inbox, Calls, Students) solo
aparecen cuando la sesión **ve al menos un programa** (`lib/nav.ts`). Un closer ve solo los programas
donde tiene **membresía activa** (`lib/auth/alcance.ts`, ADR 0048). Y un developer en "ver como closer"
queda con **sus propias membresías**: la vista estrecha, nunca ensancha (ADR 0028). Sin membresía no hay
programa, y sin programa quedan solo Mi día, Personas, Productos, Recursos y Ajustes, que es lo que
viste. No es un hueco del diseño: es la membresía. Se prueba dándote membresía en un programa desde
`/ajustes/usuarios` (o mirando con la cuenta de Andrea, que sí tiene). Pendiente de producto: que un
closer **sin membresía** vea un mensaje claro ("todavía no tienes programas asignados, pídeselo a…") en
vez de una barra casi vacía. Va al 075.

**A-05 · Mi día.** Ya está decidido que desaparece: el **Inbox** es la tab de inicio del closer (ADR
0050, ticket 071, done). Mi día sigue vivo **solo como respaldo** para un closer sin programas
(`rutaInicial` en `lib/nav.ts`). El Inbox es por programa y trae: deals sin dueño, llamadas sueltas y
"lo mío que necesita atención" (llamada de hoy sin resultado, Re-agenda sin fecha, Compromiso vencido,
fecha de pago vencida con saldo, deal sin actividad en 3 días hábiles). Lo que **no** es todavía es el
hub que describes: no junta "mis Deals, mis Llamadas, mis Students" en un solo lugar; para eso hoy se
filtra Deals o Calls por closer. La idea del hub queda en el 075 como decisión de UI, con esta pregunta
abierta: ¿el hub es el Inbox ampliado (una sección "lo mío" con tabs), o se queda el Inbox como lista
de pendientes y "lo mío" es un filtro fijo en cada tab?

**A-10 · Cohortes.** Existen desde el ticket 014: **Ajustes → Programas → (un programa)** abre las
cohortes de ese programa (`/ajustes/programas/[slug]`). Ahí se crea una cohorte (código, fecha de inicio
de ventas, cierre de ventas, inicio de clases, meta de cupos, meta de leads por día, precio de
referencia, TRM y estado) y queda asociada a ese programa. Solo una puede estar activa por programa, y
eso lo garantiza la base. La edita quien administra (gerente o developer). El problema es que **no
se encuentra**: está dos niveles adentro de Ajustes. El ticket 100 (la tab Programs, sin empezar) es donde el
programa muestra sus cohortes sin entrar a Ajustes; los objetivos por área de la cohorte llegan con el
122.

**A-09 · Nota.** La tab **Leads** (`/p/<programa>/leads`, ticket 072, falta su recorrido visual) ya lista
sin buscar y pagina de a 100. Personas es el buscador viejo entre programas y se va. Lo que falta de la
anotación: páginas de 25 o 50, formato de hoja y **los campos crudos del envío** como columnas.

**A-11 · Personas y Leads.** Personas es del MVP (ticket 006): un buscador entre programas más el
historial de una persona (`/personas/[id]`). La tab Leads nació para reemplazarla (`lib/nav.ts` lo dice:
*"pasa a ser la tab Leads"*), pero quedó sin **búsqueda por texto**, porque sus filtros viven en la URL y
un correo en la URL está prohibido (072). Por eso Personas sigue viva: es la única forma de buscar a
alguien, y la ficha de un lead todavía cuelga de `/personas/[id]` (el enlace de los duplicados, por
ejemplo). Para retirarla, Leads necesita: (1) un buscador que mande el texto por el cuerpo de la
petición y no por la URL; (2) la ficha del lead dentro del programa (`/p/<programa>/leads/<id>`, ticket
073); (3) redirigir `/personas` a Leads. Ojo: Personas busca **entre programas**, y eso Leads no lo
va a hacer, porque el programa es frontera (ADR 0043). El único cruce permitido es el aviso de
`otrosProgramasDelCorreo` (091), que ya vive en la ficha.

**A-12 · Qué hay hoy.** La lista de posibles duplicados (en Leads) muestra el lead al que se unió el
correo (nombre y enlace), su correo principal y el correo sin confirmar. **No muestra** por qué los
unió (el teléfono en común) ni los envíos de cada correo lado a lado, así que para decidir hay que abrir
la ficha y comparar a mano. El cambio: la fila trae las dos identidades lado a lado (nombre, correo,
fecha y respuestas del envío) con el teléfono resaltado, y los dos botones ahí mismo.

**A-13 · Cómo se construye.** Las dos mitades ya existen en código y la alerta solo las pinta: el
amarillo es `queLeFalta` (`lib/deals/requisitos.ts`), la misma función que hoy rechaza un movimiento
cuando falta algo, así que la ficha nunca puede decir algo distinto de lo que el motor exige. El rojo
son los motivos de "necesita atención" del Inbox (`lib/queries/inbox.ts`). Detalle en el ticket 128.

**A-14 · Leads y Personas son la MISMA cosa.** No hay distinción que entender: es un nombre viejo que
sobrevivió. En el dominio solo existe el **Lead** (una persona dentro de un programa; la misma persona
en dos programas son dos leads, `docs/overview.md` §11). La tabla se llamaba `people` y se renombró a
`leads` el 22-sep (ticket 036), pero la pantalla vieja siguió llamándose Personas. Hoy hay dos puertas
al mismo objeto: **Leads** (por programa, lista y filtros, lo nuevo) y **Personas** (buscador entre
programas, lo viejo). La confusión es real y la arregla A-11: la búsqueda y la ficha pasan a Leads,
`/personas` redirige ahí, y la palabra "Personas" desaparece de la navegación.
