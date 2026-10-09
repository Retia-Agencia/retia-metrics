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
| A-09 | Personas / Leads | cambio | Los leads se ven en tabla, como una hoja histórica, paginada de a 25 o 50, **sin esperar a que se busque a alguien**, y con los **campos crudos del envío**. | 072 | resuelta · cierra con 072 (marcado el 3-oct por la sesión central) |
| A-10 | Cohortes | aclaración + cambio | ¿Dónde se manejan las cohortes? Hay que poder crearlas, asociarlas a su programa y darles fecha de inicio. | 014 (existe), 100 | resuelta la aclaración · lo visible queda en 100 |
| A-11 | Personas / Leads | aclaración + cambio | ¿Por qué existe Personas si ya hay Leads? Leads es la que debe tener todo lo de A-09 (y la búsqueda). Personas se retira. | 072 | resuelta · cierra con 072 (marcado el 3-oct por la sesión central) |
| A-12 | Leads → Posibles duplicados | cambio | El aviso de posible duplicado tiene que traer **pegado el lead que cree que es el mismo**, lado a lado y con la razón (el teléfono en común), para decidir ahí sin buscar a nadie. Es un caso del principio P-1. | 072, 075 | en ticket |
| A-13 | Ficha del Deal | cambio | Un bloque de **Alertas** en el Deal: en **rojo** lo urgente que falta llenar; en **amarillo**, dicho explícito, lo que el Deal necesita para pasar a la siguiente etapa. Que el closer no tenga que memorizar el flujo. | 128 | resuelta · 2-oct (128): bloque de Alertas en la ficha, rojo lo urgente y amarillo "Para avanzar" con lo que pide el motor |
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
| A-20 | Ficha del Deal → Actividades | usabilidad | "Registrar" queda deshabilitado mientras la nota esté vacía y no dice por qué. El canal es opcional y no hay campo de fecha, pero la alerta pide "el contacto, con fecha y canal". Que la alerta y el formulario digan lo mismo. | 155 | resuelta · 2-oct (155): el mensaje dice "Falta registrar un contacto con el lead." y el formulario avisa "Escribe una nota para registrar." |
| A-21 | Ficha del Deal y Inbox → Registrar abono | usabilidad | "Registrar abono" se ofrece en En gestión y en Agendado (Inbox, "Lo mío que necesita atención"), donde el motor lo rechaza: el closer llena el formulario entero antes de que se lo digan. Esconderlo donde no aplica, o avisar antes. | 155 | resuelta · 2-oct (155): `aceptaAbono` en `lib/deals/etapas.ts` responde para la reja y las dos pantallas |
| A-22 | Ficha del Deal → Alertas | cambio | Al agendar una cita para hoy a las 4 p. m. (eran las 2:40), sale en rojo "La llamada de hoy no tiene resultado" antes de que la llamada ocurra. El "no value" debe esperar a que pase la hora. | 155 | resuelta · 2-oct (155): entra la llamada cuya HORA ya pasó (Mani: hora pasada + título) |
| A-23 | Ficha del Deal → Llamadas | cambio | Se aceptó el Grain de una cita fechada el 5-oct (futura) y el deal pasó a Atendido. Una llamada que no ha pasado no debería poder marcarse como ocurrida. | 155 | descartada · 2-oct: el link de Grain no trae fecha y Mani prefiere confiar en el closer antes que poner una reja |
| A-24 | Registrar abono → mensaje de sobrepago | cambio | "El abono (497.01 USD) supera el saldo del deal (497.00 USD)": punto decimal, contra el contrato de `lib/format.ts` (coma decimal). | sin ticket | resuelta 2-oct (O2-d, Alejo): el mensaje usa `usd` de `lib/format.ts` ("USD 497,01"); test en `abonos-del-deal` |
| A-25 | Ficha del Deal → Alertas en Ganado Pago Parcial | aclaración | "Otra ruta: Contactado / Calificado / Atendido / Compromiso Verbal" son las vueltas del sistema al anular el abono (A1), no rutas del closer. Se leen como opciones. | 155 | resuelta · 2-oct (155): "Para avanzar" muestra solo flechas que no son del sistema (Mani) |
| A-26 | Inbox → "Llamadas de hoy sin resultado" | aclaración | Lista llamadas del 8 al 25 de septiembre bajo el título "de hoy". O el título dice "pasadas sin resultado", o la lista se limita a hoy. | 155 | resuelta · 2-oct (155): la lista se titula "Llamadas que ya pasaron sin resultado" y conserva las viejas (Mani) |

## Recorrido 4 · 2-oct · ticket 153 (closer `mani.closer` y gerente, base local resembrada con A-19)

Las 18 que faltaban. Pasaron: 2, 3, 7, 9, 11, 16, 21, 23, 24, 25, 27, 29, 32 y 33. La 15, la 16 y la 24 se repitieron sobre
deals **no históricos** (`req-*`): ahí el área sí se exige y A1 sí baja de Completo a Parcial. Con hallazgo: la 4 y la 5 (la lista
estaba vieja contra el ADR 0071, ya corregida), la 13 (A-27), la 24 sobre un histórico (A-30) y la 30 (la prueba describía otra
pantalla, ya corregida). La 28 no se pudo: el seed no deja ningún "se perdió en el Calendly". Consola: solo ruido de entorno
(logins contra la base vieja, el websocket del reinicio, los 404 de la 32) y A-32.

| Id | Pantalla | Tipo | Anotación | Destino | Estado |
|---|---|---|---|---|---|
| A-27 | Ficha del Deal → Alertas | cambio | Un deal pasado a Atendido sin Grain muestra "Sin Grain" en la fila de la llamada, pero el bloque de Alertas no dice nada. La prueba 13 (ADR 0066) espera la alerta en rojo en la ficha y la tarjeta. | 155 | resuelta · 2-oct (155): alerta roja "La llamada atendida no tiene el link de Grain." con `esAtendidaSinGrain` |
| A-28 | Ficha del Deal → Log de eventos | cambio | Ediciones que no son altas salen tituladas **"Deal creado"**: reclamar el deal, congelar el valor vendido al calificar y poner el área al comprometer. El que lee el log cree que el deal se creó tres veces. | 155 | resuelta · 2-oct (155): solo el primer grupo de un registro es "creado"; llenar un campo vacío después es "editado" |
| A-29 | Avisos de la ficha (toasts) | cambio | Al anular un abono el aviso dice "El deal volvió a compromiso_verbal." y "...a ganado_parcial.": el nombre interno de la etapa, no el de pantalla (`nombreDeEtapa`). | sin ticket | resuelta 2-oct (O2-d, Alejo): el aviso de anular usa `nombreDeEtapa` (por props, sin importar el motor al cliente) |
| A-30 | Anular abono sobre un deal histórico | aclaración | En un Completo histórico sin valor vendido, anular un abono no lo baja a Parcial: el saldo es desconocido y A1 no corre (`lib/deals/abonos.ts`). Los deals migrados (078) son históricos: o la migración les escribe valor vendido, o se acepta que anular sobre ellos no recalcula la etapa. Decisión de Mani antes del 078. | 078 | decidida (Mani, 2-oct): la migración intenta mapear el valor vendido desde la hoja; si la fila no lo tiene, queda nulo como rareza y se acepta el límite. Escrito en el 078, decisión 6 |
| A-31 | Ficha del Deal → Origen | cambio | "Fecha del envío" muestra la hora de ingesta (2 oct, 14:57), no la del envío (29 y 30 sep, que la ficha del lead sí muestra bien). | sin ticket | resuelta 2-oct (O2-d, Alejo): la ficha del deal lee `submissions.fecha_envio` (o la de llegada si falta, como la ficha del lead); test en `origen-del-envio` |
| A-32 | Página 404 (programa ajeno) | aclaración | La consola dice "Encountered a script tag while rendering React component" alrededor del 404. No rompe nada visible; hay que ubicar qué componente lo emite. | 155 | resuelta · 2-oct (155) sin cambio: lo emite el `<script>` inline de `next-themes` 0.4.6 (`ThemeProvider`) cuando el árbol se vuelve a montar en el cliente al 404; `scriptProps` solo agrega atributos, solo pasa en desarrollo y no rompe nada. Si molesta, se resuelve cambiando o actualizando la dependencia |
| A-33 | Ficha del Deal recuperado | usabilidad | Tras recuperar un Cierre perdido a En gestión, la cabecera sigue mostrando "Motivo del cierre: Sin dinero para invertir ahora". O se oculta fuera de Cierre perdido, o se rotula como "último motivo de cierre". | sin ticket | resuelta 2-oct (O2-d, Alejo): "Motivo del cierre" solo se muestra en Cierre perdido; el motivo viejo queda en el log |

## Recorrido 5 · 2-oct · onboarding de los closers nuevos (Mani en vivo, cuenta de closer en `dev:local`)

Mani le mostró el CRM a los dos closers nuevos con Michael. Prioridad que dejó: *"que el manejo comercial sirva
100%"*, súper intuitivo y estandarizado para que las métricas salgan solas. Decisiones en el ADR 0075 (A-34 a A-39)
y el ADR 0076 (A-40, propuesto).

| Id | Pantalla | Tipo | Anotación | Destino | Estado |
|---|---|---|---|---|---|
| A-34 | Ficha del Deal → Llamadas | cambio | Una re-agenda hablada con la persona lleva el link que sea (Meet, Zoom, Calendly), no solo de Calendly. | 156 | resuelta · cierra con 156 (marcado el 3-oct por la sesión central) |
| A-35 | Registrar abono | cambio | El comprobante no puede bloquear el abono: si no se tiene, el deal entra a Ganado igual y queda una alerta hasta pegarlo. | 156 | resuelta · cierra con 156 (marcado el 3-oct por la sesión central) |
| A-36 | Ficha del Deal → Alertas | cambio | Las alertas no van como franja encima del lead: son su propio recuadro. | 156 | resuelta · cierra con 156 (marcado el 3-oct por la sesión central) |
| A-37 | Ficha del Deal | cambio | Mover un deal pide mucha memoria. Una sección "Transición" con un botón por cada etapa a la que puede ir, con su tag; el botón abre el pop-up con lo necesario. | 156 | resuelta · cierra con 156 (marcado el 3-oct por la sesión central) |
| A-38 | Deals (Kanban) | cambio | Arrastrar una tarjeta a una etapa abre el MISMO pop-up de A-37. | 156 | resuelta · cierra con 156 (marcado el 3-oct por la sesión central) |
| A-39 | Deals (Kanban) | cambio | Un closer no ve todos los deals ni elige dueño: solo ve los suyos. | 156 | resuelta · cierra con 156 (marcado el 3-oct por la sesión central) |
| A-40 | Deal con llamada | cambio | Setter y closer son personas distintas con el mismo rol. Un deal con llamada es siempre de quien da la llamada; el setter queda con su crédito como marca, y el deal se queda con él hasta que la cita entra por Calendly. Riesgo: el lead agenda con otro correo. | 157 | resuelta · cierra con 157 (marcado el 3-oct por la sesión central) |
| A-41 | Regla de entrada | aclaración | Nicolás (closer nuevo): un parcial es "basura" para un closer; se recupera con retargeting del píxel de Meta, no con el setter. Michael: a los parciales se les da contacto automático (IA, Kapso), nunca una reunión. Mani: se deja como está (GC-27, ningún envío sin deal) hasta hablarlo con Michael y Gerencia. | sin ticket | ✅ cerrada (Mani, 2-oct): los parciales siguen abriendo deal en Potencial, como en 30X |
| A-42 | Reporte del día | cambio | Michael pide un mensaje diario por closer (agendadas, canceladas, efectivas, ventas, objeciones, sin fit). Lo arma el CRM, no el closer a mano. | 158 | en ticket (falta decidir cómo se registran las objeciones) |

### Lo que dejó la llamada fuera de la pantalla (operación, no código)

- **Programas nuevos:** los de Nicolás y Francisco. Hay que crearlos de punta a punta (`docs/operations.md` §2.1:
  programa, Calendly con round robin, formulario, fuente y secreto) **antes del lunes 5-oct**, que es cuando arrancan.
- **Accesos:** los dos closers nuevos mandan su correo; se dan de alta con membresía en su programa y cada uno
  asigna su cuenta de Calendly desde `/perfil` (ADR 0074).
- **Disponibilidad para el Calendly** (lo configura Michael): uno de 6 a 10 p. m. de lunes a jueves y desde las 5
  los jueves y viernes; el otro de 5 a 9 p. m.
- **Grabaciones:** Grain, como el resto de closers de Retia. El link va en la llamada al marcar que terminó.
- **Material:** el manual de operación comercial (154) más una versión corta solo con las 11 etapas.
- **Fuera del CRM:** pushes de Juanito (la noche antes, la mañana y minutos antes), WhatsApp Business para cada
  closer, el grupo "onboarding closers", la llamada de prueba con Andrea y la reunión del pitch con Nicolás Martínez.

## Recorrido 6 · 2-oct (noche) · notas de Mani probando el CRM + audit de la sesión central

| Id | Pantalla | Tipo | Anotación | Destino | Estado |
|---|---|---|---|---|---|
| A-43 | Ficha del Deal → Actividades y Transición | cambio | El formulario de Actividades siempre abierto estorba. Una sola tarjeta de Transición con botones para cambiar de etapa y para registrar lo que no cambia de etapa (contacto, intento, nota, pendientes); cada botón abre su pop-up. | 162 | resuelta · 3-oct (162, `cp-20261003-1`) |
| A-44 | Ficha del Deal → Transición | cambio | Los botones de etapa tienen un cuadro gris alrededor. Solo el botón redondo del color de la etapa, todos del mismo ancho (el del nombre más largo). | 162 | resuelta · 3-oct (162, `cp-20261003-1`) |
| A-45 | Ficha del Deal → Llamadas y tab Calls | cambio | No se distingue la cita activa de las reagendadas, canceladas o tenidas. Clic en una llamada (ficha o Calls) abre su detalle con link y demás; en Calls, con botón "Ir al deal" en vez de navegar al deal. | 163 | resuelta · 3-oct (163, `cp-20261003-1`) |
| A-46 | Mi día | cambio | Un landing por closer: su perfil, sus programas, sus deals en tarjetas con filtros, sus llamadas, sus students. Decidido: `/mi-dia` pasa a "Mi espacio"; el Inbox sigue como cola compartida del programa. Cierra la pregunta de A-05. | 164 | resuelta · cierra con 164 (marcado el 3-oct por la sesión central) |
| A-47 | Cohortes | cambio | ¿Cómo funciona Próxima cohorte? Se debe poder crear la siguiente (C{n+1}). Decidido: botón del administrador; el CRM pone el código. | 165 | resuelta · 3-oct (165, `cp-20261003-1`) |
| A-48 | Registrar abono → plataforma | aclaración + cambio | ¿La plataforma es por programa? ¿Dónde se configura? Sí, por programa (ADR 0034), en `/ajustes/catalogos` o al crear un enlace de pago; no se ve en ningún lado y un programa sin plataformas muestra el selector vacío. | 166 | resuelta · 3-oct (166, `cp-20261003-1`) |
| A-49 | Próxima cohorte (regla) | bug | La ficha dice que se retoma con un contacto desde el inicio de ventas de la destino, pero `lib/deals/actividades.ts` la retoma con cualquier contacto y muda el deal a una cohorte que no ha empezado. | 165 | resuelta · 3-oct (165, `cp-20261003-1`) |
| A-50 | Pop-up de Próxima cohorte | bug | El selector de cohorte destino ofrece toda cohorte no cerrada, incluida la del deal; el servidor la rechaza después de llenar el pop-up. | 165 | resuelta · 3-oct (165, `cp-20261003-1`) |
| A-51 | Usuarios → `closer_id` | cambio | `closer_id` identifica operaciones y es texto a mano. Decidido: la identidad es `users.id` (la pone la base, única, string); el abono pasa a FK y un usuario nuevo no necesita `closer_id`; el texto se retira tras el corte. | 167, 159 | en ticket |

### Principios que salen del recorrido

Reglas de UI que aplican a toda pantalla, no a una. El 075 las usa como criterio de revisión.

- **P-1 · El CRM trae el contexto, el usuario no lo busca (A-12).** Cuando el sistema sospecha algo
  (un duplicado, una llamada que podría ser de un deal, un deal sin producto, un lead que volvió a
  llenar el formulario), muestra **el candidato concreto y la razón**, y la acción para resolverlo en el
  mismo lugar. Un aviso que obliga a abrir otra pantalla y buscar a mano no está terminado. A-03 es el
  mismo principio aplicado a las llamadas sueltas.
- **P-2 · Nada crece sin tope y nada se apila (A-06).** Paginado o limitado; las subsecciones se eligen,
  no se recorren.

## Recorrido 7 · 3-oct · Mani (gerente y "como closer") + audit de la sesión central

Diecinueve notas de Mani y el audit del repo que las acompañó. El principio que las ordena es el ADR 0077: cada dato
vive en la pantalla de su objeto, y lo que no se usa se quita. Reparto en `docs/plan-reparto.md` §4, ola O3.

| Id | Pantalla | Tipo | Anotación | Destino | Estado |
|---|---|---|---|---|---|
| A-52 | Ficha del Deal → Transición | cambio | No se sabe qué hace cada botón de "Registrar" (Contacto, Intento, Nota, Próxima cohorte) ni qué implica. Cada uno dice en una línea qué registra y qué mueve, sacado del motor y no escrito a mano. | 168 | resuelta · cierra con 168 (marcado el 3-oct por la sesión central) |
| A-53 | Ficha del Deal → Llamadas | cambio | La llamada no se ve clicable (sin hover). No se entiende "Completar fecha" (anota cuándo OCURRIÓ, no la cita), "Pegar Grain" ni "No se dio". No se distingue la cita activa de las viejas. El link de la cita (`calls.link_calendly`, ya guardado) no sale en ninguna parte, ni en el detalle. | 168 | resuelta · cierra con 168 (marcado el 3-oct por la sesión central) |
| A-54 | Detalle de llamada → Closer y Setter | cambio | "Sin closer" en una cita de Calendly. Audit: la llamada nace sin `closer_user_id` a propósito (`lib/calendly/colgar-llamada.ts`). Decidido: el closer de la llamada es SIEMPRE el host emparejado por su cuenta de Calendly; el setter, el dueño anterior (ADR 0076). Explicarlo en el manual. | 169 | resuelta · cierra con 169 (marcado el 3-oct por la sesión central) |
| A-55 | Ficha del Deal → Alertas | cambio | El fondo amarillo y rojo se ve feo y "Otra ruta" con desplegable no sirve. Tres franjas: Urgente (rojo), Alertas (amarillo, solo las de verdad) y Transición (verde, a dónde puede ir y qué le falta). ADR 0077 punto 6. | 168 | resuelta · cierra con 168 (marcado el 3-oct por la sesión central) |
| A-56 | Ficha del Deal → bloques | cambio | Subir "Lead y contactos" a donde está Origen; después Origen y Perfil. | 168 | resuelta · cierra con 168 (marcado el 3-oct por la sesión central) |
| A-57 | Toda la app | cambio | No hay forma de volver a la pantalla de la que se venía. | 174 | resuelta · cierra con 174 (marcado el 3-oct por la sesión central) |
| A-58 | Ficha del Deal → Editar | cambio | El descuento se edita en Facturación. La fecha de seguimiento sale de Editar. Menos texto de descripción. | 168 | resuelta · cierra con 168 (marcado el 3-oct por la sesión central) |
| A-59 | Pendiente Seguimiento | aclaración + cambio | ¿Existe la etapa Seguimiento? No: es un pendiente (ADR 0070), como en 30X ("Interesado" se queda en Atendido con próximo contacto). Decidido: se llama **Próximo contacto**, se pide solo en la transición, llega prellenado a +2 días hábiles y solo acepta fechas futuras; vencido = alerta amarilla. | 168 | resuelta · cierra con 168 (marcado el 3-oct por la sesión central) |
| A-60 | Calls | cambio | Las llamadas no se ven clicables (sin hover). | 170 | resuelta · cierra con 170 (marcado el 3-oct por la sesión central) |
| A-61 | Filtros (toda la app) | cambio | El filtro se aplica solo al elegir y salir del desplegable, sin botón "Filtrar"; siempre hay "Quitar filtros". Un componente para todas las listas. | 170 | resuelta · cierra con 170 (marcado el 3-oct por la sesión central) |
| A-62 | Calls e Inbox | cambio | El closer ve SOLO sus llamadas, como en Deals (ADR 0075). Audit: `llamadasDelPrograma` no filtra por dueño y Calls muestra las sueltas. El Inbox es el único lugar compartido (llamadas y deals sin dueño). | 170, 169 | resuelta · cierra con 170, 169 (marcado el 3-oct por la sesión central) |
| A-63 | Ajustes → Programas | bug | Memorable quedó inactivo y no se puede editar: "Editar" solo sale en programas activos y activarlo exige formulario y token. Registro muerto. | 171 | resuelta · cierra con 171 (marcado el 3-oct por la sesión central) |
| A-64 | Ver como closer | cambio | "Como closer" no se ve nada porque usa las membresías del developer (cero). Decidido: elegir a qué closer ver, en solo lectura. | 172 | resuelta · cierra con 172 (marcado el 3-oct por la sesión central) |
| A-65 | Personas | cambio | Personas se va (A-11); Leads la reemplaza. Adelantado a la ola O3. | 170 | resuelta · cierra con 170 (marcado el 3-oct por la sesión central) |
| A-66 | Mi perfil | cambio | Pocos datos, `closer_id` todavía visible y sin Calendly por programa. Todo lo del usuario vive en su perfil (Mi espacio). Lo que el closer edita: su cuenta de Calendly por programa; el nombre y la foto vienen de Google. | 172 | resuelta · cierra con 172 (marcado el 3-oct por la sesión central) |
| A-67 | Perfil y Equipo → cuenta de Calendly | cambio | El desplegable muestra solo el correo, ofrece solo las cuentas libres de la organización y se guarda (y verifica) al elegir. | 169 | resuelta · cierra con 169 (marcado el 3-oct por la sesión central) |
| A-68 | Leads | cambio | Toggle arriba a la derecha entre tarjetas y vista tabla tipo hoja (filas delgadas, celdas y columnas); el elegido se marca con un tono más claro. | 170 | resuelta · cierra con 170 (marcado el 3-oct por la sesión central) |
| A-69 | Handoff del setter | cambio | No hay cómo verificarlo. Recrear el caso en local con una cita de Calendly simulada y firmada, repetible. | 169 | resuelta · cierra con 169 (marcado el 3-oct por la sesión central) |
| A-70 | Tab Programa y Ajustes | cambio | Todo lo del programa va en la tab Programa: formularios (Fuentes), token de Calendly y lo demás en un pop-up desde "Editar". Ajustes → Programas y Fuentes desaparecen. | 171 | resuelta · cierra con 171 (marcado el 3-oct por la sesión central) |
| A-71 | Plataformas y links de pago | cambio | Plataformas en Programa y links en Recursos: desconectado. Todo en Programa: crear plataformas, asociarles links; los closers los copian desde Recursos. Audit: ya es una tabla, no un enum; solo falta moverlo. | 171 | resuelta · cierra con 171 (marcado el 3-oct por la sesión central) |
| A-72 | Ajustes → Catálogos | aclaración + cambio | Mucho que mantener. Audit: Orígenes del lead no lo lee ninguna métrica (se retira); Motivos y Áreas los usa el motor y la atribución (se quedan); Recursos se crea libre en su tab, sin categorías. | 171, 173, 175 | resuelta · cierra con 171, 173, 175 (marcado el 3-oct por la sesión central) |
| A-73 | Salud del CRM | cambio | Se llama Webhook Health; muestra las últimas 25 y pagina bajo demanda. | 173 | resuelta · cierra con 173 (marcado el 3-oct por la sesión central) |
| A-74 | Canales | aclaración | ¿Se crean solos? No (ADR 0077 punto 4): los crea quien `manejaPauta` (Paid Trafficker, gerente, developer) con un clic desde el par sin canal. El builder estandariza los links. | 173 | resuelta · cierra con 173 (marcado el 3-oct por la sesión central) |
| A-75 | Membresías | aclaración + cambio | ¿Qué es una membresía? El permiso de un usuario para trabajar en un programa, y donde vive su cuenta de Calendly de ese programa. Hoy se asigna escondida en Ajustes → Usuarios; pasa a la sección Equipo del programa. | 171 | resuelta · cierra con 171 (marcado el 3-oct por la sesión central) |
| A-76 | Toda la app | cambio | Bajar el sobrediseño y la complejidad de operación; centralizar lo que va junto. ADR 0077. | 168-175 | resuelta · cierra con 168, 175 (marcado el 3-oct por la sesión central) |

| A-77 | Ficha del Deal → Transición | cambio | La diferencia entre "Mover a" y "Registrar" no es clara: si mueve la etapa no es Registrar. "Para avanzar" hace la tarjeta muy grande: va en el pop-up de cada transición. | 176 | resuelta · cierra con 176 (marcado el 3-oct por la sesión central) |
| A-78 | Ficha del Deal → Llamadas | cambio | Un botón para cada cosa estorba. El link de Grain (grabación y transcripción) es un campo siempre visible; los botones se van y queda uno, "Resultado" (show, no show, etc.). | 176 | resuelta · cierra con 176 (marcado el 3-oct por la sesión central) |
| A-79 | Ficha del Deal → Registrar | aclaración + cambio | ¿Hacen falta tantos botones? ¿Qué llenan? Llenan Actividades (contacto, intento, nota): cuentan para la alerta de tres intentos (161) y el aviso de estancado. Decidido: un solo "Registrar actividad"; lo que mueve la etapa pasa a Mover a y los pendientes a "Dejar en espera". | 176 | resuelta · cierra con 176 (marcado el 3-oct por la sesión central) |
| A-80 | Ficha del Deal → Facturación | aclaración + cambio | ¿En qué etapas se abona? En Contactado, Calificado, Atendido, Compromiso Verbal y Ganado Pago Parcial (`aceptaAbono`). Fuera de ellas el botón se ve deshabilitado con la razón, y cada acción dice qué cambia. | 176 | resuelta · cierra con 176 (marcado el 3-oct por la sesión central) |
| A-81 | Ajustes | cambio | Lo que se mudó a Programa y Mi espacio deja tarjetas obsoletas en Ajustes: se quitan. | 173 | resuelta · cierra con 173 (marcado el 3-oct por la sesión central) |

- **P-3 · Cada dato vive en la pantalla de su objeto (A-76, ADR 0077).** Programa, Perfil, Deal y Lead; Ajustes solo
  lo que no es de ningún objeto. Antes de agregar una pantalla, un campo o un catálogo, se busca qué quitar.

## Recorrido 8 · 3-oct (noche) · Mani usando el CRM + audit de la sesión central

Diez notas de Mani y un hallazgo del audit. Reparto en `docs/plan-reparto.md` §4, ola O4.

| Id | Pantalla | Tipo | Anotación | Destino | Estado |
|---|---|---|---|---|---|
| A-82 | Deals (Kanban) | cambio | La página no hace scroll infinito: es fija, el tablero hace scroll horizontal y cada etapa por dentro (como HubSpot). Al pie de cada etapa, dos cifras: **potencial** (valor vendido, o el ticket base de la cohorte si no hay; todas las etapas) y **confirmado** por abonos. | 181 | resuelta · 4-oct (cp-20261004-1) |
| A-83 | Deals (Kanban) | cambio | Ordenar por fecha de creación o de actividad, más reciente o más viejo primero; filtrar por cohorte, con la activa por defecto. | 181 | resuelta · 4-oct (cp-20261004-1) |
| A-84 | Deals (Kanban) | cambio | Toda la tarjeta abre el deal, con hover; hoy solo el nombre. | 181 | resuelta · 4-oct (cp-20261004-1) |
| A-85 | Ficha del Deal → Transición | aclaración + cambio | "Los deals solo avanzan." Ver la respuesta: hay retrocesos, pero no hay cómo corregir un clic equivocado. Decidido: **corregir el último movimiento** (si lo hizo una persona), con motivo, el mismo pop-up para todos, y en el Kanban la etapa de corrección en rojo. | 182 | resuelta · 4-oct (cp-20261004-1) |
| A-86 | Toda la app | cambio | La regla del tablero para todo: página fija, el scroll dentro de cada sub-sección; decidir por pantalla si se reacomoda, pasa a sub-página o a pop-up. | 185 | en ticket |
| A-87 | Mi espacio | cambio | Fuera Mis llamadas, Mis deals y Mis students (repiten las tabs). Mi espacio agrupa alertas y lo que necesita atención, y las métricas del closer con hoy, semana, mes y cohorte, por programa o en total. | 183 | resuelta · 4-oct (cp-20261004-1) |
| A-88 | Programa | aclaración | "Sin fuente principal" con dos formularios, y qué hace "Rehacer webhook". Ver la respuesta. Los textos se arreglan en el 185. | 185 | en ticket |
| A-89 | Ficha del Deal → Transición | cambio | Mucho texto sin jerarquía, botones sueltos a media tarjeta (Cierre perdido, No asistió o canceló), fuera "Camino principal". Dos columnas (mover · registrar), botones de un tamaño estándar, la tarjeta más baja. | 182 | resuelta · 4-oct (cp-20261004-1) |
| A-90 | Leads, Mi espacio y Deal | aclaración + cambio | ¿Quién decide los posibles duplicados? Ver la respuesta. Que el closer los vea como alerta en Mi espacio y en el deal, y decida ahí: el mismo deal o dos deals. | 183, 184 | resuelta · 4-oct (cp-20261004-1) |
| A-91 | Ficha del Lead | cambio | Cada envío es un desplegable estándar clicable entero, con hover, que muestra las respuestas; el deal asociado también es una tarjeta clicable. | 184 | resuelta · 4-oct (cp-20261004-1) |
| A-92 | Separar un posible duplicado | bug | 🩸 Audit: `separarCorreo` crea el lead nuevo sin deal, contra GC-27 (ningún envío se queda sin deal). Sin error. | 184 | resuelta · 4-oct (cp-20261004-1) |
| A-93 | Leads y Mi espacio → Posibles duplicados | cambio | La lista es un scroll infinito (73 en producción). Paginar y que no crezca. | 186 | resuelta · 4-oct (cp-20261004-1) |
| A-94 | Posibles duplicados | cambio | Un closer solo decide los posibles duplicados de SUS deals; hoy decide y ve los del programa entero. | 186 | resuelta · 4-oct (cp-20261004-1) |
| A-95 | Leads, Calls, Inbox, Students | cambio | La pantalla fija va a esas cuatro tabs; Mani reorganiza antes cómo se muestra la información en cada una. | 185 | en ticket |
| A-96 | Mi espacio → Mis métricas | bug | Sale error y pide recargar. Causa: la cuenta no tiene `closer_id` y Mis métricas lo exigía (choque del 167 con el 183). | fix-up O4 (Kiro, rama `o4-fix-closer`) | resuelta · 4-oct (cp-20261004-1) |


## Recorrido 9 · 4-oct · Mani: la pantalla fija como estándar del CRM

| Id | Pantalla | Tipo | Anotación | Destino | Estado |
|---|---|---|---|---|---|
| A-97 | Inbox | cambio | Aún no es pantalla fija. Las pestañas mezclan llamadas y deals y sus nombres no dicen qué muestran: dos barras (Llamadas y Deals), nombres claros y una línea que explique cada pestaña. | 193 | resuelta · 4-oct (cp-20261004-5) |
| A-98 | Programa | cambio | Crece sin fin con el equipo y lo demás: pantalla fija y el contenido agrupado en pestañas con la barra del Inbox. | 194 | resuelta · 4-oct (cp-20261004-6) |
| A-99 | Recursos | cambio | Pantalla fija. | 195 | resuelta · 4-oct (cp-20261004-6) |
| A-100 | Ajustes (cada tarjeta) | cambio | Las pantallas que abre cada tarjeta no son pantalla fija y no tienen cómo volver a Ajustes. | 196 | resuelta · 4-oct (cp-20261004-5) |
| A-101 | Dashboard | cambio | Pantalla fija y las métricas agrupadas en pestañas con la barra del Inbox, para ver junto lo relacionado sin saturar. | 197 | resuelta · 4-oct (cp-20261004-6) |

## Recorrido 11 · 6-oct · Mani: que lo nuevo avise

Los cambios hoy suceden sin que sea evidente cuándo algo cambió o es nuevo. Este recorrido agrega señales
personales que se consumen al verlas, sin abrir otra pantalla.

| Id | Pantalla | Tipo | Anotación | Destino | Estado |
|---|---|---|---|---|---|
| A-102 | Mi espacio → Necesita atención | decisión + cambio | La cancelación de una llamada necesita una alerta propia. Va como novedad no leída arriba y conserva `Urgente` hasta que el closer la vea; después baja al historial gris. | 201 | en ticket |
| A-103 | Deals (Kanban) | cambio | Un Deal nuevo para su dueño lleva resalte morado Tinta y badge `Nuevo` hasta que ese dueño abre la ficha. No se marcan los históricos; asignar o reasignar enciende la señal. | 201 | en ticket |
| A-104 | Mi espacio → Necesita atención | cambio | Los cambios de Calendly (cita nueva, reagenda, cancelación, no-show y corrección) van en una cola personal arriba: no leídos primero, leídos grises debajo; abrir o marcar vista los consume. La cancelación conserva urgencia explícita. | 201 | en ticket |
| A-105 | Leads, Deals, Calls, Students, Dashboard, Recursos | cambio | Los filtros y la búsqueda ocupan mucho más alto que la lista. Una sola pieza reutilizable para búsqueda, filtros y orden, en una fila compacta: lo más usado a la vista, el resto en "Filtros · n", conteo y filtros activos en una línea; las pestañas quedan aparte como navegación. | 202 | resuelta · cierra con 202 |

## Recorrido 12 · 7-oct · Mani: el programa no cambia el lugar

| Id | Pantalla | Tipo | Anotación | Destino | Estado |
|---|---|---|---|---|---|
| A-106 | Selector de programa | bug | Cambiar de programa debe conservar la pestaña y la subpestaña en la que se está. Desde que las subpestañas viven en `?seccion=`, el selector conservaba el objeto pero volvía a su primera sección. | 204 | resuelta · 7-oct |

## Recorrido 13 · 8-oct · Mani + Claude: sueltas tras el reinicio y la barra

| Id | Pantalla | Tipo | Anotación | Destino | Estado |
|---|---|---|---|---|---|
| A-107 | Leads, Deals, Calls, Students, Dashboard, Recursos, Migración, Bitácora | cambio | La barra tiene de todo y cada pestaña la arma distinto. Debe ser buscar, un botón de Filtros y otro de Ordenar, igual en todas; los filtros activos se ven como chips debajo. | 207 | en ticket |
| A-108 | Inbox → Sin deal | cambio | Una suelta de alguien que nunca envió el formulario (solo agendó) no tiene salida. Debe poder crear el deal (plantilla básica) o asociarse a uno existente, y conservar la host como dueña. | 205 | en ticket |
| A-109 | Inbox → Sin deal | cambio | Si después llega el formulario del mismo correo, la suelta debe colgarse sola del deal, sin duda. | 206 | en ticket |
| A-110 | Deals, Leads | usabilidad | Cambiar el orden o un filtro no muestra nada mientras carga: en producción tardó más de 2 s y parecía que no había funcionado. | 207 | en ticket |
| A-111 | Deals | bug | El filtro por defecto "Cohorte activa" está aplicado pero escondido en el popover y no cuenta en "Filtros · n". | 207 | en ticket |

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

**A-85 · ¿Los deals solo avanzan?** No del todo. Hoy hay seis caminos hacia atrás (`lib/deals/etapas.ts`):
Compromiso Verbal vuelve a Atendido, Contactado o Calificado con motivo de retroceso (RETRO); cualquier etapa abierta
va a Cierre perdido (P) y de ahí se recupera a En gestión o Agendado (R); Atendido vuelve a Agendado si tiene un
pendiente (E9); y al anular un abono el sistema devuelve el Ganado (A1, A2). Lo que no existe es **corregir un
movimiento equivocado**: perder y recuperar mete un "no" del cliente que nunca pasó, y anular es para un deal que no
debió existir (manual §8). Decidido con Mani: corregir el último movimiento hecho por una persona, con motivo; lo del
sistema se corrige anulando su causa (ticket 182, ADR 0078).

**A-88 · Fuente principal y "Rehacer webhook".** Los dos formularios de ComunicArte funcionan: Typeform recibió 289
envíos (el último hoy) y Dapta 11 (el último el 1-oct), cada uno con su secreto. "Sin fuente principal" no dice que
estén mal: dice que **ninguno está marcado como principal con su URL pública**, que es el que el CRM usa para generar
los links de captación (ADR 0068, ticket 092). Pasa en los tres programas. Se arregla en la tab Programa: editar el
formulario, pegar su URL pública y marcarlo como principal (para ComunicArte hay que elegir: ¿Typeform o Dapta?).
"Rehacer webhook" vuelve a crear la suscripción de Calendly del programa con el token guardado
(`conectarCalendly`): sirve si las citas dejaron de llegar o si se cambió el token. Pasa a llamarse "Reconectar
Calendly" (185).

**A-90 · ¿Quién decide un posible duplicado?** Hoy, quien trabaja el programa (closer con membresía activa) o quien
administra, solo desde la tab Leads (ADR 0035 y 0060). Son dos cosas distintas: **"N envíos"** son reenvíos del mismo
correo y no piden decisión; **"posible duplicado"** es un correo nuevo que llegó con un teléfono conocido, y esa sí.
Confirmar deja una persona y un deal; separar crea un lead nuevo, y desde el 184 también su deal (hoy no lo crea: A-92).

## Recorrido 14 · 9-oct · Claude (base local): la ola de la reunión del 8-oct

Recorrido de 209, 210, 211 y 145 con `dev:local`, como gerente, closer y Customer Success (sesiones separadas por
subdominio). Funcionan: columnas de respuestas en tarjetas y tabla, recordadas al recargar; setter por defecto con
rastro; "Asignarme todos"; aviso de solape y cambio de cohorte con nota; el CS aterriza en Students, marca y quita
onboarding, y Leads, Deals, Ajustes y un programa ajeno le quedan cerrados. Forjada la acción de onboarding sobre un
deal de otro programa: rechazada y la base sin moverse.

| Id | Pantalla | Tipo | Anotación | Destino | Estado |
|---|---|---|---|---|---|
| A-112 | Programa → Equipo | bug | A un Customer Success le salía el selector de cuenta de Calendly. | 145 | arreglado el 9-oct |
| A-113 | Ajustes → Usuarios | cambio | El selector de rol mostraba el valor crudo (`customer_success`, `paid_trafficker`) en vez de la etiqueta. | 145 | arreglado el 9-oct |
| A-114 | Students (celular) | usabilidad | En 390 px la columna Onboarding queda fuera de la pantalla: el CS, cuya única acción es esa, tiene que desplazar la tabla. Proponer tarjetas en celular o la columna Onboarding junto al nombre. | — | abierta |
| A-115 | Students (CS) | usabilidad | Para el CS los nombres siguen en morado aunque ya no son enlaces: parecen clicables. | — | abierta |
| A-116 | Inbox → Por settear | usabilidad | "Asignarme todos" toma N deals de una, sin confirmar. Proponer "Vas a tomar N deals" antes. | 210 | abierta |
| A-117 | Leads (tabla) | usabilidad | El botón "Mostrar respuestas del formulario" se desplaza con la tabla cuando hay columnas de más. | 209 | abierta |
