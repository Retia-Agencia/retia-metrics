# HubSpot de 30X: cómo se maneja un lead de punta a punta (leído por API, 1-oct-2026)

Lectura **solo por API y solo en lectura** del portal 50929115 ("30x"), con la Personal Access Key de
Alejo. No se movió ni se escribió nada en HubSpot. Sin datos personales de contactos: todo son conteos.
Tampoco hay nombres ni correos del equipo de 30X: los owners van por su rol o su id de HubSpot.

- **Este documento** es el recorrido: qué pasa con un lead, quién mueve cada etapa, qué llena el closer,
  qué hacen las automatizaciones y qué dicen los datos.
- **`hubspot-30x-catalogo.md`** es el anexo completo, sin resumir: los 22 pipelines con cada etapa, su
  id, probabilidad y conteo de hoy; **todas** las propiedades propias de 30X (deals 345, contactos 117,
  empresas 17, más las de llamadas, reuniones y notas) con **todas sus opciones y cuántos registros
  tienen cada valor**; las propiedades de fábrica que se usan; los owners y las asociaciones.
- Complementa a `docs/comercial.md` §4 y §9, que salieron de pantallazos. Los conteos de AI Second Brain
  cuadran con los pantallazos (76 · 86 · 1.021 · 2 · 7.107 · 653 · 55 · 3 · 8 · 191 · 588).

## 1. Qué se pudo leer y qué no

La llave se canjea por un token de usuario (`POST /localdevauth/v1/auth/refresh`). Sus permisos:
`crm.objects.{deals,contacts,companies,owners}.read`, `crm.schemas.{deals,contacts,companies}.read` y
CMS. Con eso:

| Se pudo | No se pudo (403) |
|---|---|
| Pipelines y etapas, por la API **legacy** `crm-pipelines/v1` (la v3 rechaza tokens de usuario) | **Los workflows de Automation** (v2, v3 y v4): piden el scope `automation` |
| Todas las propiedades de deals, contactos, empresas, llamadas, reuniones, notas, tareas y WhatsApp, con sus opciones | Los **objetos Lead** (sí sus pipelines), formularios, listas, secuencias |
| Deals, contactos, actividades y owners; búsquedas y conteos | Productos, line items, cotizaciones, facturas, pagos, suscripciones |
| **El historial de cada propiedad con su fuente** (usuario, workflow, app, importación) | Equipos, usuarios y permisos; el layout de la ficha y sus botones |

Como los workflows no se pueden abrir, **se reconstruyeron desde el historial**: en 1.316 deals (los 60
modificados más recientemente de cada pipeline) se miró cada cambio de propiedad, quién lo hizo (usuario,
workflow o app) y qué había cambiado justo antes. Lo que sale de ahí (§5) es **inferido**: dice qué hace
cada workflow, no cómo está configurado ni todas sus ramas. Para leerlos de verdad hace falta una llave
con el scope `automation` (§10).

## 2. El mapa en una mirada

- **170.551 deals, 130.595 contactos, 30.371 empresas**, 20.661 llamadas, 21.393 reuniones, 578.964
  notas, 44.055 tareas y **440.796 mensajes de WhatsApp** registrados.
- **22 pipelines de deals, uno por programa** (en 30X un pipeline es un programa). Hay **cuatro moldes**:

| Molde | Pipelines | Etapas |
|---|---|---|
| **Venta B2C** (el principal) | 30X Executive Program, Ventas con LinkedIn, Instagram & Tiktok for Business, Fundraising School, LAB10 B2C, AI Sales, Sales Machine, AI for Executives, Operaciones con AI, AI for devs, AI Second Brain, Xtreme Growth AI, Next Fellowship, Estado X (11 etapas); Everybody AI, Negociacion y Free Sales Training (10: les falta En gestión) | Potencial → Registrado → En gestión → Contactado → Calificado → Agendado → Atendido → Compromiso Verbal → Ganado Pago Parcial → Ganado Pagado Completo · Cierre perdido |
| **Venta consultiva B2B** | B2B, LAB10 (10 etapas) | Discovery → Primer contacto realizado → Reunión agendada → Diagnóstico realizado → Solución definida → Propuesta enviada → Negociación → Pospuesto → Ganado · Perdido |
| **Multipliers** (venta con reserva, 14 etapas) | Multipliers | Potencial → En gestión → Contactado → Calificado → Reservado → Reunión agendada → Reunión ocurrida → En negociación → Aplazado → Compromiso verbal → Pagado Parcial → Ganado Pago Parcial → Ganado Pagado Completo · Cierre perdido |
| **Postventa** (los crea un workflow, no un formulario) | Multipliers · Cobranza (6), ONBOARDING MULTIPLIERS (9) | Cobranza: Mora detectada → Contacto de cobro → Compromiso de pago → Plan de pago → Recuperado · Incobrable / Castigo. Onboarding: Handoff recibido → Bienvenida agendada → Bienvenida realizada → Head Coach agendada → Head Coach realizada → Presentación enviada → Primera sesión agendada → Onboarding completo · Onboarding detenido / Baja |

- **El objeto Lead casi no se usa**: tiene el pipeline de fábrica (New → Attempting → Connected →
  Qualified · Disqualified) y uno propio, *Pipeline Multipliers (Lanzamiento)*: Potencial → En gestión →
  Contacto efectivo → Registrado webinar → Confirmación de webinar → Asistió a webinar. El trabajo vive en
  Deals.
- **Contactos**: lifecycle de fábrica. Hoy 99.873 Opportunity, 27.704 Customer, 3.025 Lead.
- **Totales**: 4.252 deals en una etapa ganada y 18.194 en una perdida; el resto está abierto.
  **24.735 deals no tienen owner.**

## 3. El recorrido de un deal B2C, paso a paso

Molde de 11 etapas, con AI Second Brain como ejemplo. "Quién" sale del historial (§1).

| # | Etapa | Prob. | ASB hoy | Cómo se entra | Quién mueve |
|---|---|---|---|---|---|
| 1 | **Potencial** | 20% | 76 | El formulario llegó **parcial** (Typeform `partial`): el lead empezó y no terminó, sin calidad | La app de ingesta (§6, app 34887894) crea el deal |
| 2 | **Registrado** | 20% | 86 | Formulario **completo** con Lead Quality **Low o Mid** | La app de ingesta |
| 3 | **En gestión** | 20% | 1.021 | Un workflow saca de Potencial y de Registrado en minutos (mediana 0–3 min) y los deja aquí para el setter | **Workflow** |
| 4 | Contactado | 40% | 2 | Casi nadie pasa por aquí (0–1% en los pipelines B2C) | Usuario |
| 5 | **Calificado** | 50% | 7.107 | Lead Quality **High** (formulario completo, o parcial que ya trae High): se le ofrece la agenda | La app de ingesta; o el bot desde En gestión |
| 6 | **Agendado** | 60% | 653 | Agendó en Calendly (formulario, bot Emma o link directo) | **App de agenda/bot** (42374132) o el closer |
| 7 | **Atendido** | 70% | 55 | El closer marca la reunión como *Terminada* | **Workflow**, disparado por el closer (§5, W3) |
| 8 | Compromiso Verbal | 80% | 3 | El closer, tras la reunión | Usuario, o la app de facturación |
| 9 | **Ganado Pago Parcial** | 100% | 8 | Pagó una parte (reserva o cuota) | App de facturación / pagos, o el closer |
| 10 | **Ganado Pagado Completo** | 100% | 191 | Pagó todo. También **nace aquí** cuando la compra entra directo por checkout | App de ingesta / pagos, o el closer |
| 11 | **Cierre perdido** | 0% | 588 | El closer o el bot, con motivo obligatorio de 7 opciones (§4) | Usuario, bot o workflow |

**La regla de entrada, medida** (cómo nace cada deal creado por la app de ingesta, en la muestra):

| Nace en | Formulario | Lead Quality | Deals |
|---|---|---|---|
| Potencial | parcial | sin calificar | 295 |
| Registrado | completo | Low (102) o Mid (39) | 141 |
| Calificado | completo o parcial | **High** | 136 |
| Ganado Pagado Completo / Pago Parcial | sin formulario | — | 103 (compra directa) |

Así, **Potencial y Registrado no son un orden de avance sino dos puertas de entrada**: el que no terminó
el formulario y el que lo terminó sin calificar alto. Las dos van solas a En gestión. **Calificado es la
puerta del lead bueno**, y por eso concentra 7.107 de 9.790 deals en ASB: el calificado que nunca agendó se
queda ahí. Esto contesta parte de la QD-1 de `comercial.md`.

**Cuánto tarda** (deals creados desde el 1-abr; mediana del tiempo en la etapa): En gestión, de minutos a 3
horas según el programa; **Agendado, de 1,2 a 6 días** (es la espera hasta la reunión); Compromiso Verbal,
de horas a 4 días; Ganado Pago Parcial hasta 11 días en Sales Machine y Ventas con LinkedIn. **De cada 100
que entran, entre 13 y 25 llegan a Agendado, entre 2 y 9 a Atendido y entre 1 y 7 ganan.** La tabla por
pipeline está en el catálogo, §1.

## 4. Lo que llena el closer: los "botones" de la ficha

El layout de la ficha no tiene API. Lo que sí se ve es **qué propiedades escriben las personas a mano**
(fuente `CRM_UI` en el historial) y con qué valores. Ese es el formulario real del closer:

**Después de la reunión**

| Propiedad | Valores (con cuántos deals lo tienen hoy) |
|---|---|
| **Estado de agenda** (`agenda_status`) | Programada 20.624 · Terminada 8.611 · Cancelada 4.647 · No asistió 3.103 · Reprogramada 188. *Programada* la pone un workflow; el closer pone el resto. **Terminada dispara el paso a Atendido** |
| **Cambios en agenda** (`agenda_change`) | Descartar 2.084 · Intento de contacto 1.459 · Reprogramar 931 |
| **Resultado de reunión completada** (`meeting_result_completed`) | No interesado 1.392 · Interesado 1.061 · Comprometido 497 · Reservado 316 · Interesado - debe consultarlo 309 · Interesado - problema de fecha o cohorte 134 · No interesado - no es el momento 86 · Interesado - falta presupuesto 68 · No interesado - precio 49 · Reunión no efectiva 43 · Sin capacidad de pago 35 · No calificado 32. **Son las "etiquetas de Atendido" de la reunión con Dani** (QD-4) |
| Próximo contacto (acuerdo) | Fecha. 5.530 deals |
| **Tipo de Pago** (`tipo_pago`) | Contado 2.133 · Financiado 1.134 · Cortesía MP 167 · Aplazado 138 · Perdido 131 · Canje 12 |
| Fecha de pago pactada | Fecha. 720 deals |
| **Origen del deal** (`origen_del_deal`) | Agendamiento 1.480 · Pauta 806 · Pauta Meta 569 · Lead magnet propio (Typeform) 284 · Referido de cliente 160 · Venta B2B / corporativa 116 · Contacto propio del comercial 106 · Evento o Masterclass propio 78 · Base de datos / reactivación 76 · No sé 64 · Orgánico Instagram / contenido 64 · Pauta Google / YouTube Ads 19 · LinkedIn 9 · YouTube orgánico 1 (+1 opción sin uso). Lo escribe el closer o la app de facturación |
| Estado de negociación | Revisando propuesta 37.306 (**es el valor por defecto**, no una decisión) · Descartado 696 · Pago comprometido con fecha 112 · Sin respuesta - en seguimiento 25 · Reservado 23 · Esperando aprobación de tercero 23 · Negociando precio o plan de pago 21 · Pagando a cuotas 14 · Perdido - precio 8 · Aplazado a una fecha 3 |
| Valor pagado / pendiente | Números en USD. 249 deals |

**Al perder**

| Propiedad | Valores |
|---|---|
| **Motivo de Cierre Perdido** (`closed_lost_reason_category`) | Supera el tiempo estipulado para un contacto 4.026 · No existe una posibilidad real de compra 3.680 · No hace fit con el perfil deseado 1.537 · No está interesado 1.397 · No tiene el dinero 1.257 · Cambió de Programa 239 · Refund 41. 12.177 deals lo tienen, frente a 18.194 en una etapa perdida |
| Detalle de Cierre Perdido (`closed_lost_reason`) | Texto libre, 6.338 deals. El bot lo escribe solo: *"Detección automática (guarda 2)…"*, *"El lead pidió explícitamente que no le escriban"* |

**Calificación temprana** (setter, poco usada): Resultado del intento de contacto (Contacto logrado 723 ·
no logrado 505), Resultado del contacto logrado (Interesado 414 · No interesado 382 · Sin respuesta 189),
¿Resultado de la calificación? (Reunión agendada 430 · Descartado 372 · Interesado 207 · En negociación
89 · Reserva realizada 29), ¿Califica para el programa? (Sí 762 · No 119), ¿Posee el recurso para la
inversión? (Sí 596 · No 156). Ninguna pasa de 1.300 deals de 170.000.

**Multipliers tiene una escalera de cobro propia**: Nivel de contacto (1 · Comercial, y del 2 al 5 una persona
distinta por nivel, de más arriba cada vez; o No escalar) y su Resultado (No contestó · Aplazó a una fecha
· Comprometió pago con fecha · Sigue sin decidir · Perdido · Agendó reunión · Pagó). Y una casilla, *Pasar
a Onboarding (ya comienza)*, que dispara la creación del deal de onboarding (§5, W7).

**Las acciones de actividad** (los botones de la cabecera: Note, Email, Call, Task, Meeting, WhatsApp), con
lo que dicen las muestras de septiembre:

| Acción | Cómo se usa |
|---|---|
| **Call** | Llamadas por **HubSpot Calling** (VoIP, 78%), casi todas salientes. Disposiciones de fábrica: No answer 62% · Connected 12% · Busy 4% · Meeting booked 0,5% (Left voicemail, Left live message y Wrong number existen sin uso). Las propiedades de **Nua Talker** (otro marcador) existen y están vacías |
| **WhatsApp** | 440.796 mensajes registrados desde el CRM (canal `WHATS_APP`): es el canal principal, muy por encima de las llamadas |
| **Meeting** | 62% llegan por **sincronización de calendario** (Calendly / Google). Título con molde: *"Entrevista de Postulación Programa X 30X"*, *"Postulación X 30X — <closer>"*, *"Admisiones \| LinkedIn Sales \| 30X — <closer>"*, *"Agendamiento — <programa> — <closer>"*. El *outcome* de HubSpot casi no se usa (37% Scheduled, el resto vacío): **el resultado de la reunión vive en el deal, no en la reunión** |
| **Task** | 56% las crea un workflow (§5) y caen en una **cola de tareas**. Casi todas de tipo To-do; 86% siguen sin empezar |
| **Note** | 578.964 notas. Casi todas sin fuente (las escriben integraciones: transcripciones del bot, Kapso) |
| **Email** | El token no puede leer correos |

## 5. Las automatizaciones (reconstruidas del historial)

Cada fila es un patrón que se repite en la muestra: el efecto que deja Automation y lo que pasó justo antes.
Los nombres son descriptivos, no los de HubSpot.

| # | Workflow (inferido) | Disparador | Qué hace |
|---|---|---|---|
| W1 | **Paso a En gestión** | Deal nuevo en Potencial o Registrado, con owner ya asignado | Lo mueve a **En gestión** en minutos (420 casos en la muestra) |
| W2 | **¿Gestionado?** | Al crear el deal, y luego por fecha o actividad | Pone `gestionado = No` al nacer (todos los deals) y lo pasa a **Sí** cuando hay gestión; pone *Estado de la gestión = Al día*. Hoy: **145.137 No · 25.416 Sí**. Parece ser la base de la etiqueta DESATENDIDO (§7) |
| W3 | **Agenda** | El deal llega a Agendado (por Calendly, el bot o el closer) | Pone *Estado de agenda = Programada* y *Estado reunión = Futura*; cuando pasa la fecha, **Futura → Vencida**. Cuando el closer marca **Terminada**, mueve **Agendado → Atendido** (en Multipliers, Reunión agendada → Reunión ocurrida) |
| W4 | **Resultado de la reunión (Multipliers)** | El closer pone *Resultado = Comprometido* y el tipo de pago | Mueve **Reunión ocurrida → En negociación** |
| W5 | **Tareas de seguimiento** | No asistió / cancelada / estancada | Crea tareas en la cola `12621818`: *Contactar para reprogramar* (29% de las tareas de sept.) · *Reprograma la reunión* · *Es momento de decidir.. Reprogramar o descartar* · *Follow-up post-reunión: contactar para cerrar compromiso* · *Deal estancado en negociación. Decidir: nueva reunión, ajustar propuesta, o descartar* · *Follow-up negociación: el cliente lleva N días revisando propuesta* · *Reintento de contacto pendiente — <lead> \| <programa> \| <cohorte>* |
| W6 | **Posible agenda por WhatsApp** | El bot detecta intención de agendar en el chat | Crea la tarea *"Deal con posible agenda — revisa este deal y el inbox"* en otra cola (`12961531`) |
| W7 | **Onboarding Multipliers** | El closer marca *Pasar a Onboarding* | **Crea un deal nuevo** en ONBOARDING MULTIPLIERS, etapa Handoff recibido, con la responsable de onboarding como owner. La casilla *Onboarding · Migrado (control WF)* evita duplicarlo |
| W8 | **Cobranza Multipliers** | Un pago vence | **Crea un deal** en Multipliers · Cobranza, etapa Mora detectada, con el responsable de cobranza como owner; *Deal de cobranza creado (control WF)* evita duplicarlo. Aparte, por fecha, mueve *Estado de cartera* entre Al día, Por vencer y Vencido |
| W9 | **Escalera de cobro** | Cambia el Nivel de contacto | Limpia el *Resultado del nivel de contacto* para el siguiente nivel |
| W10 | **Cierre por vencimiento** | Reunión vencida sin resultado | Mueve **Agendado → Cierre perdido** (10 casos en la muestra) |

Además, las **reglas del pipeline** (no son un workflow: se configuran en el pipeline) ponen las
**etiquetas** del deal (§7), y las propiedades **calculadas** las mantiene HubSpot: *Fecha de reunión*,
*Días de mora (auto)*, *Saldo pendiente (auto)*, *Cohorte inmersivo*, *Programas ya adquiridos*, *Empresa*,
*Cargo*, *País*, *Email* y *Teléfono de contacto* (las fórmulas están en el catálogo).

## 6. Las integraciones: quién escribe sin ser persona

Las apps se ven por su id en el historial; el nombre se infiere de lo que escriben.

| App | Qué es (inferido) | Qué escribe |
|---|---|---|
| **34887894** | **Ingesta de formularios** (Typeform → HubSpot), la puerta principal | Crea contacto y deal: pipeline, nombre (*"<Nombre> \| <Programa> \| <Mes Año>"*), **owner (lo asigna la app)**, amount, etapa de entrada (§3), Lead Quality y Lead Score, tipo de envío (Completa / Parcial), los UTM, Media · Canal y Subcanal, Price Tier, match de edición (*Exacto* / *Fallback por ciudad* / *TBD*). También crea los deals ganados de compras directas |
| **42374132** | **Bot setter "Emma" + Calendly** | La cadencia de WhatsApp (*Contacto (Emma)*), *Atendido por el bot*, *Agendado por el bot*, *Pasó a asesor*, los `calendly_*`, *Origen de la agenda* (Formulario 2.392 · Sin determinar 390 · Emma 253 · Link directo 124); mueve a **Agendado** y a **Cierre perdido** con motivo |
| **43257309** | **30X Billing** (la tarjeta "Powered by 30x Billing" de la ficha) | Grupo *Auditoría 30X*: Última acción (Invoice creada 1.149 · Deal creado 628 · Re-facturada a empresa 45 · a persona 5), Creado por y Modificado por (correo del closer), Origen del deal, descuentos; crea deals desde la app |
| **42990541** | **Pagos y retro-atribución** | Valor pagado, valor pendiente, plan de pago, reserva pagada, estado de cartera; vuelve a calcular Media · Canal; mueve etapas de Multipliers (Reservado → Pagado Parcial) |
| 16228553 | Cobranza | Estado de cartera = Vencido |
| 39613773 | Checkout (Stripe / Whop) | Crea deals con plataforma de pago y *Program Track* |
| 11217553 | Otra integración de creación de deals | Deals con *Next step* |

**La cadencia del bot Emma** (`recontacto_emma`, 9.174 deals): Toque 1 (+5 min) → Toque 2 (+1 h) → Toque 3
(+6 h) → 1er Contacto (0 d) → 2do (+1 d) → 3er (+2 d) → 4to (10 d), con salidas **Live** 2.294 (el lead
respondió), **Closed** 167, **Follow Up Agotado** 1.658, **Bloqueo Meta** 942, **Error Número** 383 y
*Pausado — esperando ventana de WhatsApp* 447. El bot atendió 11.988 deals y agendó 2.482.

## 7. Las etiquetas del deal

`hs_tag_ids` lo escriben las **reglas del pipeline** (fuente `PIPELINE_SETTINGS`): son condiciones
configuradas en cada pipeline, no un workflow ni algo que el closer pone. El token no ve los nombres de las
etiquetas, solo sus ids, así que **el nombre es una hipótesis** por el perfil de los deals que la tienen
(muestra de 1.316) y los nombres vistos en pantallazos (POTENCIAL, NURTURING, DESATENDIDO, ALTO VALOR,
Obsoleto, 30X):

| Id | Deals en la muestra | Perfil | Hipótesis |
|---|---|---|---|
| 25397323 | 420 | Lead Quality **High** (266 de 302 con calidad); Agendado, Calificado, Atendido | **ALTO VALOR** |
| 25397324 | 404 | Quality Low/Mid; En gestión, Potencial, Registrado | **POTENCIAL** |
| 25397333 | 711 | Quality Low o vacía; 82% *gestionado = No* | DESATENDIDO u Obsoleto |
| 22455943 | 381 | Mezcla; mucha Potencial y ganados viejos | ¿Obsoleto? |
| 22455955 | 60 | Tocado por el bot, *4to contacto* de Emma | **NURTURING** |
| 22455957 | 60 | Quality High con reunión Futura | ¿Caliente / reunión próxima? |
| 25397556 | 100 | **100% gestionado = Sí** y al día; Recuperado, ganados, en negociación | ¿Gestionado / al día? |
| 22455942, 22455944, 25397313 | 16, 4, 10 | B2B (Discovery); Atendido; postventa | Sin lectura |

Para cerrarlo basta un pantallazo de *Configuración → Objetos → Deals → Pipelines → Etiquetas* de un
pipeline, o una llave con permiso de pipelines.

## 8. Calidad del lead y atribución

- **Lead Quality** del deal: Low 68.026 · High 24.491 · Mid 10.505 (103.022 calificados). En el contacto
  existen además *Lead Calificación*, *data_quality* y un *HVM Tier* (A+ Ultra HVM · A · B · C).
- **Atribución en tres capas**: (1) los UTM crudos del formulario (`utm_*_crm`, más `utm_id` y los ids
  nativos de Meta: campaign, ad set, ad, `fbclid`, `fbp`, `fbc`); (2) **Media · Canal / Subcanal / Bucket**,
  calculados por la app (Meta 95.999 · Sin atribución 31.097 · Web/Directo 3.251 · LinkedIn 3.096 · …;
  Bucket: Sin atribución 52.655 · Ads 51.787 · Orgánico 23.015); (3) el grupo **Atribución multi-touch**
  con primer toque, último toque, el del formulario y el del checkout, cada uno con sus seis UTM, y el
  conteo de toques.
- **Origen del deal**: la pregunta que el closer contesta a mano (§4), aparte de los UTM.

## 9. Lo que dicen los datos

- **Propiedades creadas y sin uso**: Motivo de no avance, Setter asignado, Agendó a asesor, Motivo del
  descuento, Tipo de beca están en **0**. De 345 propiedades propias de deals, el catálogo marca cuáles
  tienen dato y cuánto.
- **El valor por defecto se lee como dato**: *Estado de negociación = Revisando propuesta* tiene 37.306
  deals porque es el valor inicial, no porque estén revisando una propuesta. *D0 Grupo WA = No*, igual.
- **24.735 deals sin owner** (14%). Y hay **12.177 deals con motivo de pérdida frente a 18.194 en una
  etapa perdida**: cerca de un tercio se perdió sin decir por qué.
- **La etapa Contactado no se usa en B2C** (0–1%): el contacto se registra en propiedades y en WhatsApp,
  no como etapa. En Multipliers sí (59%).
- **Tres etapas de Multipliers están mal codificadas en el propio HubSpot**: se guardaron como
  *"ReuniÃ³n agendada"*, *"ReuniÃ³n ocurrida"* y *"En negociaciÃ³n"* (doble UTF-8). El catálogo las copia
  tal cual, porque así las devuelve la API.
- **Quién mueve etapas a mano** (muestra): sobre todo el responsable de cobranza, la de onboarding, un
  puñado de líderes comerciales y los closers de cada programa. Los movimientos
  automáticos (apps y workflows) son unas cuatro veces los manuales (2.759 contra 637).
- Algunos pipelines (Fundraising School, Instagram & TikTok, Estado X, B2B, LAB10, LAB10 B2C, Everybody AI,
  Cobranza, Onboarding) **no tienen fechas de entrada por etapa** en HubSpot: fueron importados o migrados, y su embudo no se
  puede medir desde ahí.

## 10. Para leer lo que falta

Una Personal Access Key (o una private app) con estos scopes de **lectura** abre lo bloqueado:

| Scope | Qué abre |
|---|---|
| `automation` | Los workflows: disparadores, ramas, acciones y retrasos, con sus nombres |
| `crm.objects.leads.read` + `crm.schemas.leads.read` | El objeto Lead y sus propiedades |
| `crm.pipelines.orders.read` / token de app | Pipelines v3 con las **propiedades obligatorias por etapa** y los nombres de las etiquetas |
| `forms` | Los formularios de HubSpot (los de Typeform no están aquí) |
| `crm.lists.read` | Las listas y vistas guardadas |
| `e-commerce` | Productos, line items, facturas y pagos |
| `settings.users.teams.read` | Equipos (en 30X, equipo = programa) |

El layout de la ficha (qué propiedades se ven en cada sección y los botones de cabecera) no está en
ninguna API pública: eso queda en los pantallazos de `comercial.md` §9.3.
