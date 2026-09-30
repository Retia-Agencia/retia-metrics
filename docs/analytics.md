# Analytics: lo que Pauta necesita del CRM

> **Complemento de [`plan.md`](./plan.md), no reemplazo.** Mapea, requisito por requisito, la reunión con
> Pauta del **29-sep-2026** (Anderson, César y el equipo de tráfico) al alcance del CRM: qué pidieron, cómo
> lo resuelve el CRM, qué dato necesita, en qué ticket y etapa cae, y qué se decidió. Existe como archivo
> propio para no saturar el plan. Mandan sobre él los ADR (**0061, 0062 y 0063** nacen de esta sesión) y los
> tickets; el estado de cada ticket vive solo en [`tasks/README.md`](./tasks/README.md), el orden para dos
> personas en [`plan-reparto.md`](./plan-reparto.md) y las decisiones abiertas en `plan.md` §7 (lista
> única). Si algo aquí contradice un ADR o un ticket, gana el ADR o el ticket y este documento se corrige.
>
> Fuentes: el transcript de la reunión, las notas de Mani en Granola ("Dashboard de atribución y metas de
> cohorte para CRM"), las cuatro capturas que mostró Anderson (§1.2), las respuestas de Mani en la sesión
> del 29-sep y lo **medido** esa noche en producción, en Typeform y en la hoja de Tactical (§2), solo con
> lecturas salvo el parche de §2.4.

Leyenda: ✅ decidido (con quién y cuándo) · 🟡 propuesta de esta sesión, falta el ok de alguien ·
🔴 falta decidir · 🩸 dato medido que cambia el plan · ⏳ el dato no se puede reconstruir después.

---

## 1. Qué pidió Pauta, en una frase

**El CRM no es solo donde trabajan los closers: es de donde tienen que salir, sin armar nada a mano, las
métricas y el análisis de toda la operación, empezando por lo que Pauta hoy reconcilia a mano cada día
(Meta, la hoja de ventas y Calendly).** Anderson: *"con esas dos vainas me conformo"* (el panel de
atribución y el de costos por etapa), y como tercera, el cumplimiento diario de la cohorte.

Mani, 29-sep: el CRM también es visibilidad de métricas y analítica de la operación completa. La operación
(leads, deals, llamadas, abonos) sigue viviendo en el CRM, porque las métricas salen de ahí con filtros.

### 1.1 Lo dicho en la reunión, con sus números

| Tema | Lo que dijeron | Números |
|---|---|---|
| Reparto por canal | la meta de la cohorte se reparte 60% paid y 40% orgánico (así está en 30X) | hoy: 52 paid, 26 Instagram, 3 sin atribución, 1 TikTok y 2 o 3 ventas que no aparecen en la hoja de leads |
| Costo por agenda | *"cuando habla de 'mil' es COP"* (nota de Mani) | hoy ~118.000 COP; **aceptable 80.000; meta 60.000** |
| Agendas de paid por día | 720 llamadas para 60 cupos (12 llamadas por venta); 60% paid = 432; en ~30 días | **meta 15 al día, aceptable 10** (18 para cerrar una semana antes); hoy ~15 |
| Costo por llamada | bajó | de ~200.000 a ~100.000 COP |
| ROAS | por corte (cohorte) | corte de julio 1,97, "0,30 puntos sobre contrato" |
| Meta de la próxima cohorte | "de aquí al 10 de noviembre el 100% son 60 cupos"; ComunicArte "60 igual" | Tactical C3: clases el 10-nov, venta desde el 30-sep |
| UTM | *"la verdad absoluta es el UTM"*; medium `paid_social` fijo para paid; el ID del anuncio *"te sirve para hacerlo cliqueable"*; el term es el placement (~20 ubicaciones); *"Meta pone el resto automático"* | plantilla en §3, DP-2 |
| Origen del deal | el closer pregunta siempre "¿cómo nos conociste?" al cerrar y elige el origen; **solo sirve cuando no hay UTM** y va como burbuja aparte: *"yo no creo en lo que hacen los comerciales"* | ~20% de las ventas sin atribución |
| Grain | analizar transcripciones para atribuir es *"carísimo"*; más breve que el comercial pregunte | fuera (ya estaba fuera, `overview.md` §8) |
| Sin UTM | *"todo el que llegue sin UTM genera una alerta"*, para revisar el link antes de que se llenen más | ejemplo: 10 sin UTM el mismo día por un post |
| Embudo del formulario | qué porcentaje inicia, pasa datos de contacto, sigue | Typeform: §2.3 |
| Calendly abandonado | 73% de quienes llegan al Calendly son calificados; si no agenda, alerta y llamarlo *"en 2 o 5 minutos"* | Typeform: 43% (Tactical) y 51% (ComunicArte) de quienes ven el Calendly no agenda |
| Costo del orgánico | definir cuánto cuesta el orgánico al mes para sacar sus costos | *"prioridad 2 o 3, pero en el radar"* |
| Canales | paid, orgánico, y dentro del orgánico LinkedIn, Substack, YouTube...: *"son orgánico con la única diferencia del canal"* | · |
| API de Meta | Anderson la crea y la comparte; *"es por portafolio, te toca crear varias"* | · |
| MVP | Mani: el MVP básico para la reunión con Alejo y Dani; los dashboards, esta semana. Tres roles: gerente, pauta y closers | sin fecha en este documento (Mani, 29-sep: *"no pongas fechas, solo hacerlo"*) |

### 1.2 Las cuatro capturas de referencia

No se copian: se adaptan a lo que el CRM ya tiene.

| # | Qué es | Lo que se toma |
|---|---|---|
| 1 | **Panel de Atribución y Ventas de 30X** (`dashboards.30x.com/funnel-media`): filtros de fecha, canal (Ads, Orgánico, Sin atribución), cliente (nuevo o recurrente), programa, cohorte, pago, red, subcanal, fuente, tipo, formato, autor y campaña. Cinco KPI con su % vs periodo anterior y su reparto por canal: ventas contratadas, recaudado, número de ventas (+ cortesías, + "sin invoice cargada"), agendas y leads. "Calidad de la traza": % de deals por nivel N3 creativo, N2 campaña, N1 canal, N0 sin traza. Composición de ventas por semana y ventas por programa | KPI por área con su reparto y comparativo; calidad de la traza; composición en el tiempo; ventas por programa en "todos los programas" |
| 2 | **Adpulze, Campaign Dashboard**: ad profit (revenue − inversión), revenue, inversión, ROAS; llamadas totales, calificadas, confirmadas, con show, ventas; costo por llamada, por calificada, por confirmada, por show y por venta; embudo; objeciones (Ghosting, Partner, Price) con "oportunidad"; pestaña Attribution con el embudo por campaña, conjunto y anuncio | costos por etapa, embudo, árbol de Meta con embudo y ROAS por fila; objeciones como ranking de motivos |
| 3 | **HubSpot de 30X, vista "Cierres / UTM"**: por deal ganado, `utm_content` (nombre del anuncio), `utm_id`, `utm_source` (`ig`, `fb`), `utm_medium` (`paid_social`), `utm_term` (`Instagram_Stories`, `Facebook_Mobile_Feed`). Una fila orgánica (`instagram / reel`, content = código del post, term `crece30x_reel_17ago26`). 🩸 Una fila con las macros **sin expandir** (`{{ad.name}}`, `{{ad.id}}`, `{{site_source_name}}`, `{{placement}}`) | la plantilla de UTM de paid (DP-2) y la macro sin expandir como centinela (DP-21) |
| 4 | **"Cierre por canal"** (artifact de Claude de 30X, CDMX 5-oct): vendidas 39/70, cumplimiento 56%, faltan 31; por canal: Paid 27/36 (EN RUTA), Orgánico 9/24 (ATRASADO), Referidos 2/10 (ATRASADO), Cortesías 14 (SIN META, no cuentan para la meta, sin canal 1). Por canal: faltan, ventas/día requeridas, agendas faltantes, agendas/día requeridas. "Brecha de agendas" (paid necesita 36/día y trae 6). Proyección: meta, cerradas, faltan, ventas/día, conversión agenda→venta, agendas para el 100%, agendas faltantes, agendas/día, ritmo actual | el panel de cumplimiento de la cohorte por área (PT-40 a PT-47) |

---

## 2. Lo medido el 29-sep (hechos que cambian el plan)

### 2.1 Los UTM que llegan hoy 🩸

- **Pauta de Retia hoy:** `facebook / cpc / {{campaign.name}}`, con el **conjunto** en `utm_content` y el
  **anuncio** en `utm_term` (p. ej. content `De_Cero_a_Tactical_Investor_Nuevos_Ads`, term
  `Jptactical_FKT3_Invite`). Es **distinto** de la plantilla de 30X (§3, DP-2), donde content es el anuncio
  y term el placement. Sin `utm_id` ni `fbclid`.
- **`utm_content` y `utm_term` SÍ llegan, pero no están en sus columnas:** viven en `submissions.respuestas`
  (6.911 envíos de la hoja y los 101 del webhook), porque la columna promovida estaba marcada "sin leer".
  Ninguna pantalla los ve hoy.
- **20 envíos traen la macro sin expandir** `{{campaign.name}}` como campaña (10 por programa).
- Pares `utm_source / utm_medium` reales (envíos completos): ComunicArte `facebook/cpc` 1.633,
  `direct/organic` 633, `instagram rosario|milena` con `linktree`, `stories`, `manychat`, `storiesfijadas`,
  `dm`; `leadmagnetdiagnostico/pdf`, `whatsapp rosario/chat`, `fb/paid`. Tactical `facebook/cpc` 1.475,
  **sin UTM 789**, `instagram` con `manychat`, `stories`, `linktree`, `storiesfijadas`, `dm`,
  `storiesmanychat`; `tiktok/linktree` 178, `youtube/linktree` 21, más filas de prueba (`prueba`, `test`).
  El catálogo de canales del 101 se siembra con esto.
- **Sin UTM sigue alto en Tactical:** 11 de 53 envíos del webhook (~21%) al 29-sep.
- `ad_spend`: 0 filas. Cohortes en la base: solo C1 y C2 de cada programa; **C3 no existe todavía**
  (Tactical vende C3 desde el 30-sep).

### 2.2 Los Typeform

- Campos ocultos de los dos: `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`. **No
  hay `utm_id`**: si Meta lo manda, Typeform lo descarta. ⏳
- Variables: `estado`, `score`, `tag_lead_quality`, `lead_value`, `hvm_points`, `hvm_tier`.
- **Los valores del scoring** (leídos de la lógica): `score` arranca en 0 y resta 100 por cada respuesta que
  descalifica (ingreso bajo, "no cuento con los recursos", "no es prioridad"); `hvm_points` suma por ingreso
  (10, 20, 30) y experiencia (10, 20); `hvm_tier` A+ (≥45), A (≥30), B (≥15), C; `lead_value` MUY ALTO VALOR,
  ALTO VALOR, VALOR MEDIO o BAJO VALOR (de `hvm_points` y el signo del score). **`tag_lead_quality` es solo
  `High` o `Low`, y `High` se pone al salir del Calendly**: en la práctica High = agendó por el formulario.
- La pregunta de Calendly es **obligatoria** en los dos. El webhook está suscrito solo a respuestas
  completas (`form_response`); los parciales ya se mandan a las demás integraciones (la hoja).
- Quién ve el Calendly: el que no cae en un salto a la página de gracias (ingreso bajo, "no cuento con los
  recursos" o "no es prioridad").

### 2.3 El embudo del formulario, según Typeform (histórico acumulado)

| | Tactical | ComunicArte |
|---|---|---|
| Visitas / respuestas completas | 5.132 / 3.111 (68,5%) | 5.982 / 2.708 (51,9%) |
| Vieron la 1ª pregunta / abandonaron ahí | 7.977 / 3.342 | 11.967 / 6.718 |
| Abandonaron entre el WhatsApp y el Calendly | ~758 | ~1.414 |
| **Vieron el Calendly / abandonaron ahí** | **823 / 358 (43%)** | **889 / 456 (51%)** |

El endpoint `insights/{form}/summary` de Typeform da esto por pregunta (vistas y abandonos), agregado y
**sin canal**. Por verificar: si acepta un rango de fechas.

### 2.4 🩸 El bug de Tactical y el parche del 29-sep

- **El Typeform de Tactical perdió sus reglas de `estado` el 29-sep entre 11:26 y 11:40** (Bogotá), en la
  misma edición que agregó el scoring (`score`, `tag_lead_quality`, `lead_value` aparecen desde las 12:21).
  ComunicArte las conserva. La API de Typeform no dice quién editó.
- Efecto: el CRM solo sube a `con_calendly` un envío que llega como `setteo_no_calificado` con link de agenda
  (`estadoConAgenda`, `lib/ingesta/adaptador-typeform.ts`). Sin `estado`, **ningún envío de Tactical abrió
  deal entre las 11:40 y el parche**: 23 envíos, 9 de ellos con cita, que quedaron como llamadas sueltas.
- **La hoja no se rompió:** su columna Estado la escribe su Apps Script (con emojis), no la variable del
  Typeform. Los closers siguieron viendo los leads nuevos en Setteo.
- ✅ **Parche aplicado el 29-sep (~20:19, ok de Mani):** una regla en el Typeform de Tactical pone
  `estado = setteo_no_calificado` a todos (coherente con DP-8: descartado desaparece). Respaldo del form
  antes del cambio en el scratchpad de la sesión; verificado que el form quedó igual más esa regla, webhook
  intacto. **Confirmado con envíos reales** (20:30 y 20:35: llegaron con `setteo_no_calificado`, traían
  cita y abrieron su deal en Agendado). Falta **reprocesar los 23** con la regla nueva (ticket
  117, con el ok de Mani en ese momento).

---

## 3. Las decisiones de esta sesión

Cada una baja a su ADR o ticket; aquí va el resumen para leer el grid.

| # | Decisión | Por qué | Queda en |
|---|---|---|---|
| DP-1 | ✅ **El anuncio entra.** La llave es `utm_id = {{ad.id}}`; conjunto y campaña salen del árbol de Meta. Reabre lo que el ADR 0045 dejó fuera el 21-sep | Pauta: saber qué creativo vende es *"vital"*. El id del anuncio no cambia (el nombre sí, y se repite con "- Copia") y desde él la API de Meta da todo el árbol y el gasto | ADR 0062 · 116, 120 |
| DP-2 | ✅ **La pauta de Meta define sus UTM con macros; el CRM las recibe como llegan.** Plantilla (Mani, 29-sep): `utm_source={{site_source_name}}&utm_medium=paid_social&utm_campaign={{campaign.name}}&utm_content={{ad.name}}&utm_term={{placement}}&utm_id={{ad.id}}`. El builder del CRM queda para orgánico y el link del closer | Pauta ya lo hace así y Meta llena las macros por anuncio; un link del builder pegado en Meta perdería eso. Enmienda el ADR 0051 | ADR 0062 · 092, 101 |
| DP-3 | ✅ **El gasto de Meta entra por su API**, por anuncio y por día, con un token por portafolio **guardado en la base** (patrón del ADR 0057). Un solo escritor del gasto: la API y, para otras plataformas, la captura manual | Sin gasto no hay ROAS ni costos; hoy se cruza a mano. En la base porque un portafolio nuevo es una fila (ADR 0012) | ADR 0062 · 119, 120 |
| DP-4 | ✅ **Origen declarado por el closer:** elige el **área** (paid, orgánico, referido u otro) al llevar el deal a Compromiso Verbal, Abonado o Completo; el motor lo exige. **Nunca se mezcla con el UTM:** solo alimenta la burbuja "sin UTM · según el comercial" | Pauta: el UTM es la verdad; lo del comercial es un tercer punto. Un clic, en el momento en que ya se pregunta | ADR 0062 · 121 |
| DP-5 | ✅ **La meta de la cohorte se reparte por área en cupos enteros**; el % se deriva. La suma no pasa la meta; lo no repartido se ve "sin asignar"; una venta sin atribución cuenta para la meta total y para ningún área | Se declaran cupos (36/24/10 en la captura 4): el % esconde un redondeo. No choca con el ADR 0023: se reparte por canal, nunca entre closers | ADR 0063 · 122 |
| DP-6 | ✅ **Llamada calificada = llamada que ocurrió de un lead cuyo `lead_value` está en el conjunto "calificado" del programa** (por defecto MUY ALTO y ALTO VALOR; es una fila, no código). Además, el embudo se parte por `lead_value` | Mani: el scoring del formulario manda. `tag_lead_quality` no sirve (High = agendó: mediría el umbral contra sí mismo). Partir por `lead_value` contesta si el scoring acierta | ADR 0063 · 123 |
| DP-7 | ✅ **ROAS y ad profit sobre ventas contratadas**, cruzados con la **TRM de la cohorte, visible** al lado. Los costos por etapa, en la moneda de la cuenta (COP) | Es el "ROAS sobre contrato" de Pauta. La TRM a la vista no es conversión silenciosa (regla dura de moneda) | ADR 0063 · 067, 123 |
| DP-8 | ✅ **El Estado de llegada lo manda el formulario en la variable `estado` (se sigue llamando así para no romper nada), y una tabla por programa mapea cada valor a su etapa de entrada y prioridad.** Valores: `setteo_no_calificado` (completó sin pasar por el Calendly), `con_calendly_sin_agenda` (va hacia el Calendly; llega en el parcial previo) y `con_calendly` (lo sube el CRM al leer el link de la cita, como hoy). **`descartado` desaparece para lo nuevo:** *"todo el que llene el form es potencial de contacto"* (Mani). Un valor vacío o desconocido no se adivina: lead sin deal, visible y contado | Mani: que el CRM no piense; un programa o un valor nuevo es una fila, no código. Reemplaza el ADR 0054 | ADR 0061 · 117 |
| DP-9 | ✅ **Dos puntos de envío parcial:** el que ya existe tras el WhatsApp y uno nuevo justo antes del Calendly; el webhook se suscribe a `form_response_partial`. El parcial del WhatsApp (sin estado) = lead sin deal, visible en Leads como "abandonó el formulario". El parcial previo al Calendly (`con_calendly_sin_agenda`) abre el deal en Pendiente Setteo con **prioridad alta**; si llega la completa con cita, el motor lo pasa solo a Agendado | Es el único momento en que se sabe algo de quien abandona en el Calendly (hoy se pierde entero). Parcial y completa comparten token: no duplican persona ni deal | ADR 0061 · 117 |
| DP-10 | ✅ **"Se perdió en el Calendly"**: deal en Pendiente Setteo con estado `con_calendly_sin_agenda` y sin su completa **a los 5 minutos** (configurable en la fila del estado) sale urgente arriba del Inbox. Se calcula al leer, **sin cron**. El aviso fuera de la app va con el mecanismo de alertas A2 | Antes de 5 minutos la persona sigue eligiendo hora; es lo que dijo Anderson | ADR 0061 · 118 |
| DP-11 | ✅ **Un registro es un token, no una fila:** el parcial y la completa del mismo envío cuentan una vez | Si no, quien agenda contaría dos veces y el CPL saldría barato sin error | ADR 0063 · 088, 093, 123 |
| DP-12 | ✅ **El paid trafficker ve el Dashboard de sus programas menos el comparativo entre closers y la comisión**; sigue sin ver deals, llamadas ni abonos sueltos | ROAS y ad profit necesitan los ingresos; el ADR 0052 lo dejaba sin caja | enmienda ADR 0052 · 102 |
| DP-13 | ✅ **Llamada confirmada: fuera de esta ola.** No hay fuente del dato en el CRM (la confirmación la hace Juanito, afuera) | · | PT-26 |
| DP-14 | ✅ **Costo del orgánico: al radar**, con el diseño anotado (un gasto por área y mes, mismo escritor que el de Meta). Mientras no haya costo, orgánico dice "sin costo", nunca $0 | Pauta lo dijo prioridad 2 o 3 | PT-59 |
| DP-15 | 🔴 **Cortesías:** hay que preguntar si Retia las da. Si sí: un producto con la marca `es_cortesia` (precio 0) que ocupa cupo en Students y no cuenta como venta ni para la meta. Un producto de precio 0 sin la marca contaría como venta | La captura 4 las excluye de la meta | `plan.md` §7 (C) |
| DP-16 | ✅ **Comparativos:** cada KPI contra el periodo anterior del mismo largo **y** contra la cohorte anterior en el mismo día hábil de su ventana | Adpulze y 30X muestran el primero; Anderson pidió el segundo | 089, 095 |
| DP-17 | ✅ **Sin UTM: un contador visible, sin umbral** ("hoy llegaron N sin UTM"), con la lista; las macros sin expandir, aparte | Mani: conteo en general que se pueda ver | 093 |
| DP-18 | ✅ **Pantallas:** el **Dashboard** lleva los KPI por área, los costos por etapa y el cumplimiento de la cohorte; la tab **Campañas** lleva el árbol de Meta (campaña, conjunto, anuncio) con el embudo y el ROAS por fila, y el builder para orgánico | Como Adpulze (Dashboard + Attribution) sobre la navegación del ADR 0050 | 123, 124, 125 |
| DP-19 | ✅ **Orden: lo antes posible, sin fechas** (Mani). Primero lo que no se puede reconstruir (§7, ola 0) | Un `utm_id` o un parcial que no se capturó hoy no existe mañana | §7 · `plan-reparto.md` |
| DP-20 | ✅ **Parche interino de Tactical** (§2.4), hecho | · | §2.4 |
| DP-21 | ✅ (regla existente) **Una macro sin expandir (`{{...}}`) es un centinela, no un dato**: se guarda como llegó (ADR 0004), pero el emparejador la trata como ausente en ese nivel y la cuenta aparte | `AGENTS.md`: *"un centinela no es un dato, y el que se cuela no falla: miente"* | 085, 116 |
| DP-22 | ✅ (medido) **Qué significan `utm_content` y `utm_term` lo declara el canal:** en `paid_social` content = anuncio y term = placement; en el `facebook / cpc` histórico de Retia content = conjunto y term = anuncio | Es la regla del ADR 0051 (un solo módulo lo interpreta, mirando el canal) aplicada a lo medido | 101, 085 |
| DP-23 | ✅ (Mani, 29-sep) **Los objetivos de Pauta son datos por cohorte:** una tabla `objetivos` (cohorte, área opcional, métrica, meta, aceptable). Los cupos por área de DP-5 son filas de ella. La métrica es un tipo en el código; los valores, filas | Llena el hueco del umbral que el 090 dejó vacío, con los primeros valores reales (§1.1). Mani no lo votó explícito | ADR 0063 · 122 |
| DP-24 | ✅ (Mani, 29-sep) **Semáforo:** ≥ meta, `exito` ("en ruta"); entre aceptable y meta, `alerta`; peor que aceptable, `peligro` ("atrasado"); en costos, menor es mejor. Para cupos se compara lo vendido contra lo esperado a la fecha (meta × día hábil ÷ total) | Es la regla de la captura 4 escrita; la validan Pauta y Gerencia | 122, 124 |
| DP-25 | ✅ (Mani, 29-sep) **`campanas` y `utm_patron` (084) se reducen:** la campaña de paid sale del árbol de Meta (por `utm_id`, o por el nombre exacto y único para lo histórico); la de orgánico se agrupa por el texto crudo de `utm_campaign`. Sin patrones ni especificidad, P2 queda sin objeto | Con un canal único por par y un id de Meta único, el empate que el 0045 temía no puede ocurrir; el patrón era para cruzar con un gasto cargado como texto, y ese gasto ya no existe | ADR 0062 · 084, 085 |

---

## 4. El grid: requisito por requisito

Carril: **M** Mani (motor, dinero, consultas del dashboard y pantallas de trabajo) · **A** Alejo (entradas,
integraciones, ingesta, webhooks) · **Ops** configuración o una persona, sin código · **—** fuera.
Estado: ✅ ya existe en `main` · 🟢 decidido y con ticket · 🟡 falta un ok · 🔴 falta decidir · ⚫ fuera o
radar.

### A. Entrada del lead y el formulario

| ID | Qué pidieron | Cómo lo resuelve el CRM | Dato | Ticket | Carril | Estado |
|---|---|---|---|---|---|---|
| PT-01 | Que ningún lead que llene el formulario se quede sin trabajar | La etapa de entrada sale de la variable `estado` por una tabla por programa; `descartado` desaparece para lo nuevo | `estados_llegada` (tabla), `submissions.estado_hoja` (texto como llegó) | 117 | A | 🟢 |
| PT-02 | Saber quién llegó al Calendly y no agendó | Punto de envío parcial antes del Calendly, con `estado = con_calendly_sin_agenda`; el webhook recibe `form_response_partial` | parcial en `submissions` (`es_parcial`) | 117 · Ops (Typeform) | A · Ops | 🟢 |
| PT-03 | Alerta: llamarlo en 2 a 5 minutos | Urgente arriba del Inbox a los N minutos sin completa (defecto 5, en la fila del estado); calculado al leer | `estados_llegada.alerta_minutos` | 118 | M | 🟢 |
| PT-04 | Aviso fuera de la app a los comerciales | WhatsApp o correo: el mecanismo único de alertas (A2) | · | A2 (`plan.md` §7) | — | ⚫ |
| PT-05 | Qué datos se obtienen de quien se cae en la agenda (nota de Mani) | Todo lo respondido hasta el punto parcial: nombre, correo, WhatsApp, respuestas, UTM y, por verificar, variables (`lead_value`) | el parcial | 117 (verificar el payload con el primer parcial real) | A | 🟡 |
| PT-06 | Los que abandonan tras dejar el WhatsApp | Lead sin deal, en la tab Leads con filtro "abandonó el formulario"; cuentan en el embudo | parcial 1 | 072, 117 | A | 🟢 |
| PT-07 | Arreglar Tactical (sin estado desde el 29-sep, 11:40) | Parche en el Typeform (hecho) y reproceso de los 23 envíos con la regla nueva | · | §2.4 · 117 | Ops · A | ✅ parche · 🟢 reproceso |
| PT-08 | Embudo del formulario: inició, pasó contacto, siguió... | Por pregunta y agregado: API de Insights de Typeform. Por canal: desde el parcial 1 (dejó datos), completó, llegó al Calendly, agendó | Insights (en vivo, sin guardar) + envíos | 126 | A (API) · M (sección) | 🟢 |
| PT-09 | Un registro no se cuenta dos veces | Registro = token distinto; parcial + completa = uno | · | 088, 093, 123 | M | 🟢 |

### B. Atribución: de dónde vino cada lead y cada venta

| ID | Qué pidieron | Cómo lo resuelve el CRM | Dato | Ticket | Carril | Estado |
|---|---|---|---|---|---|---|
| PT-10 | Separar siempre paid, orgánico y sin atribución (y referidos) | El **área** del envío, derivada de su canal (ADR 0043): Pauta = paid, Media = orgánico, Comercial = referidos. Nombre visible de cada área: 🔴 lo decide Gerencia (las áreas son filas) | `areas`, `canales` | 083, 101, 085 | M | 🟢 |
| PT-10b | Los canales del orgánico que nombró Pauta: Instagram, TikTok, YouTube, LinkedIn, Substack (*"son orgánico con la única diferencia del canal"*) | Cada uno es una fila del catálogo de canales, área orgánico, cuando aparezca su par de UTM; hoy hay `instagram`, `tiktok` y `youtube` | `canales` | 101 | M | 🟢 |
| PT-11 | Las dos cubetas de huérfanos | **Sin UTM** y **sin clasificar**, siempre separadas, con conteo y % (ADR 0045). El "sin atribución" de 30X es la suma de las dos | · | 085, 093 | M | ✅ decidido · 🟢 |
| PT-12 | La plantilla de UTM de paid | DP-2. El catálogo de canales incluye `fb`, `ig`, `an`, `msg`, `th` con `paid_social` (Pauta) y los pares históricos (`facebook/cpc`) | `canales` | 101 · Ops (Meta) | M · Ops | 🟢 |
| PT-13 | UTM del orgánico (30X usa `instagram / reel`, content = código del post) | El builder del CRM los genera para orgánico y closers | · | 092 | M | 🔴 la convención la definen Pauta y Media (`plan.md` §7, F) |
| PT-14 | Qué creativo generó cada venta | `utm_id` → anuncio → conjunto → campaña, del árbol de Meta | `submissions.utm_id`, `pauta_objetos` | 116, 120 | A | 🟢 |
| PT-15 | Hacer el anuncio clicable | Link al anuncio en el Administrador de anuncios desde su id | · | 125 | M | 🟢 |
| PT-16 | Placement (historias, feed, reels...) | `utm_term` en el canal `paid_social`, como dimensión de filtro | `submissions.utm_term` | 116, 125 | A · M | 🟢 |
| PT-17 | Promover `utm_content`, `utm_term` y `utm_id` a sus columnas | Hoy viven en `respuestas`; se promueven y se rellenan desde ahí (misma fila, determinista) | migración | 116 | A | 🟢 |
| PT-18 | Macros sin expandir (`{{campaign.name}}`, `{{ad.name}}`) | Centinela: ausente en ese nivel, contado aparte (DP-21) | · | 085, 116 | A · M | 🟢 |
| PT-19 | La venta tiene un solo origen | El del envío que abrió su deal (ADR 0060, ya decidido); si el deal lo abrió el parcial, ese es su origen (misma sesión, mismo UTM) | `deals.submission_origen_id` | 115 | M | ✅ decidido · 🟢 |
| PT-20 | Origen del deal según el closer | Área declarada al llevar el deal a 6, 7 u 8; requisito del motor; solo en la burbuja "sin UTM · según el comercial" | `deals.area_declarada_id` | 121 | M | 🟢 |
| PT-21 | Que los closers lo anoten desde ya en la hoja | Columna seleccionable en las pestañas de gestión; si existe al corte, el importador la lleva a `area_declarada_id` | · | Ops (Mani/Dani con los closers) · 078 | Ops · A | 🟢 |
| PT-22 | Calidad de la traza (N3 creativo, N2 campaña, N1 canal, N0 sin traza) | Por venta, el nivel más profundo que resuelve su envío de origen | · | 123 | M | 🟢 |
| PT-23 | Ventas que no están en la hoja de leads (2 o 3) | Deal sin envío de origen: se cuenta y se ve como tal (ADR 0060), con su área declarada | · | 115, 121 | M | 🟢 |
| PT-24 | Tipo, formato y autor del creativo (filtros de 30X) | Formato: del tipo de creativo que da la API de Meta. Tipo y autor: 🔴 solo con una convención de nombres de anuncio acordada con Pauta; sin ella, fuera | `pauta_objetos.formato` | 120 | A | 🟡 formato · 🔴 tipo y autor |

### C. Embudo y costos (Adpulze)

| ID | Qué pidieron | Cómo lo resuelve el CRM | Dato | Ticket | Carril | Estado |
|---|---|---|---|---|---|---|
| PT-25 | Llamadas totales, con show y ventas, con su % | Ya existen en `lib/queries/dashboard.ts` (064); se parten por área, campaña y anuncio | · | 064 ✅ · 123 | M | 🟢 |
| PT-26 | Llamadas confirmadas | Fuera de esta ola (DP-13) | · | · | — | ⚫ |
| PT-27 | Llamadas calificadas | DP-6: show + `lead_value` en el conjunto del programa | `programs.valores_calificados` | 123 | M | 🟢 |
| PT-28 | ¿El scoring del formulario acierta? | Embudo partido por `lead_value` (y por `hvm_tier`): show, calificada, venta | · | 123 | M | 🟢 |
| PT-29 | Costo por llamada, por calificada, por show y por venta (CAC) | Gasto de Pauta ÷ el conteo de Pauta; regla del cero (ADR 0045): sin gasto, "sin pauta" | `gasto_pauta` | 123 | M | 🟢 |
| PT-30 | Costo por agenda y por lead | Igual; la agenda se ancla por el día en que se agendó (§6) | · | 123 | M | 🟢 |
| PT-31 | Revenue, inversión, ROAS y ad profit | Contratado (USD), gasto (COP), ROAS y ad profit con la TRM de la cohorte (DP-7) | · | 067, 123 | M | 🟢 |
| PT-32 | Embudo visual (llamadas → calificadas → show → ventas) | Sección del Dashboard | · | 123 | M | 🟢 |
| PT-33 | Todo por campaña, conjunto y anuncio | Tab Campañas: árbol de Meta con embudo, gasto, costos y ROAS por fila | · | 125 | M | 🟢 |
| PT-34 | Objeciones ("Ghosting", "Price") con su oportunidad | Ranking de motivos de pérdida (catálogo 104) con deals y ticket perdido estimado. No lo pidieron de palabra: sale de la captura 2 | `motivos` | 065 | M | 🟢 entra (Mani, 29-sep) |
| PT-35 | "Ad profit por etapa" de Adpulze | La semántica no está clara y nadie lo pidió | · | · | — | ⚫ |
| PT-36 | Presets de fecha (hoy, ayer, 7, 14 y 30 días, este mes, mes pasado, personalizado) | `lib/rangos.ts` tiene hoy, semana, mes, cohorte y personalizado; se suman los que faltan | · | 095 | M | 🟢 |
| PT-37 | Comparativo en cada KPI | DP-16 | · | 089, 095 | M | 🟢 |

### D. Pauta de Meta: la integración

| ID | Qué pidieron | Cómo lo resuelve el CRM | Dato | Ticket | Carril | Estado |
|---|---|---|---|---|---|---|
| PT-38 | Conectar la API de Meta (un token por portafolio) | Conexiones en la base (token secreto, patrón ADR 0057) y una o más cuentas publicitarias por programa, con su moneda y zona horaria leídas de Meta | `meta_conexiones`, `cuentas_publicitarias` | 119 | A | 🟢 · 🔴 PQ1 |
| PT-39 | El gasto por anuncio y por día | Sincronización diaria (cron diario, cabe en Hobby) más un botón "sincronizar ahora"; re-lee los últimos 7 días porque Meta ajusta el gasto hacia atrás; idempotente por (anuncio, día). "Última sincronización hace X" a la vista | `pauta_objetos`, `gasto_pauta` | 120 | A | 🟢 |
| PT-39b | Otras plataformas de pago (TikTok Ads, Google) | Captura manual por el mismo escritor del gasto | `gasto_pauta` | 067 | M | 🔴 no se sabe si pautan fuera de Meta (PQ1) |

### E. Metas y cumplimiento de la cohorte ("Cierre por canal")

| ID | Qué pidieron | Cómo lo resuelve el CRM | Dato | Ticket | Carril | Estado |
|---|---|---|---|---|---|---|
| PT-40 | Meta de la cohorte repartida por canal (60/40, 36/24/10) | DP-5 | `objetivos` (métrica cupos, por área) | 122 | M | 🟢 |
| PT-41 | Vendidas, cumplimiento y faltan, total y por área | Vendidos de la cohorte por el área de su envío de origen; los sin atribución, al total | · | 124 | M | 🟢 |
| PT-42 | Ventas por día requeridas | La meta dinámica que ya existe (020), por área | · | 124 | M | ✅ total · 🟢 por área |
| PT-43 | Agendas faltantes y agendas por día requeridas | Faltan ÷ conversión agenda→venta; ÷ días hábiles para agendar | · | 124 | M | 🟢 · 🔴 PQ3 (qué conversión y qué desfase) |
| PT-44 | Estado EN RUTA / ATRASADO | DP-24 | · | 124 | M | 🟢 |
| PT-45 | Ritmo actual y brecha ("paid necesita 36 al día y trae 6") | Agendas del área por día hábil en una ventana reciente contra lo requerido | · | 124 | M | 🟢 · 🔴 PQ3 (ventana) |
| PT-46 | Proyección ("a este ritmo cierran en 39 de 70") | Vendidos + ritmo de ventas × días hábiles restantes | · | 124 | M | 🟢 |
| PT-47 | Día a día de la cohorte: dejaron datos, completaron, agendaron, ventas, por área | Serie diaria por área; "inició" solo existe agregado (Insights), así que la primera columna por canal es "dejó datos" | · | 124, 126 | M | 🟢 |
| PT-48 | Objetivos diarios: agendas de paid (15 / 10), costo por agenda (60.000 / 80.000 COP), ROAS de contrato | Filas de `objetivos` por cohorte | `objetivos` | 122 | M | 🟢 · 🔴 PQ4 (valores) |
| PT-49 | Cortesías (no cuentan para la meta) | DP-15 | · | · | — | 🔴 |
| PT-50 | Crear la C3 de cada programa (meta 60) | Desde `/ajustes/programas`, con su ventana de venta (ADR 0022) | `cohorts` | Ops (gerente) | Ops | 🔴 urgente: Tactical vende C3 desde el 30-sep y la C3 no existe en la base |

### F. Pantallas, roles y reporte

| ID | Qué pidieron | Cómo lo resuelve el CRM | Dato | Ticket | Carril | Estado |
|---|---|---|---|---|---|---|
| PT-51 | Panel de atribución por área (captura 1) | Sección del Dashboard: los cinco KPI con reparto por área y comparativo; composición semanal por área | · | 123 | M | 🟢 |
| PT-52 | Filtros de 30X: programa, cohorte, red, campaña, pago, cliente nuevo o recurrente | En la URL (ADR 0023, 089). Red = `utm_source`; pago = plataforma o completo/abonado; recurrente = el lead ya tenía una venta antes | · | 089, 095 | M | 🟢 |
| PT-53 | Ventas por programa (número y monto) | Vista "todos los programas": solo lo sumable (ADR 0048) | · | 095 | M | ✅ decidido · 🟢 |
| PT-54 | Ventas "sin invoice cargada" | Ventas cuyo abono no tiene comprobante (cuando exista el 035) | · | 035 | A | ⚫ radar |
| PT-55 | Qué ve Pauta | DP-12 | · | 102 | A | 🟢 |
| PT-56 | Usuarios de Pauta (Anderson, César; Daniela Rodríguez entra full time) | Alta como `paid_trafficker` con membresía por programa | · | 102 · Ops | A · Ops | 🟢 |
| PT-57 | Reemplazar el reporte diario manual (Michael sale en octubre) | El Dashboard **es** el reporte; el PDF de un botón (021) toma lo mismo que pinta la pantalla | · | 021 | A | 🟢 |
| PT-58 | Frescura de los datos ("datos hace 5 h") | "Última sincronización de Meta hace X" y "último envío hace X" (107) | · | 120 | A | 🟢 |

### G. Radar y fuera

| ID | Qué | Por qué | Estado |
|---|---|---|---|
| PT-59 | Costo mensual del orgánico y sus costos por etapa | DP-14 | ⚫ radar |
| PT-60 | Analizar las transcripciones de Grain para atribuir | Caro; lo resuelve la pregunta del closer (PT-20) | ⚫ fuera (`overview.md` §8) |
| PT-61 | Llamada confirmada | DP-13 | ⚫ |
| PT-62 | Crear campañas en Meta desde el CRM | El CRM lee Meta, no la administra (ADR 0051 punto 3) | ⚫ fuera |
| PT-63 | Segmentos, sub-cuentas y demás menús de Adpulze | Nadie los pidió | ⚫ |
| PT-64 | Varias cohortes vendiendo a la vez (la captura 4 tiene una pestaña por ciudad) | En Retia hay como máximo una cohorte activa por programa, y lo garantiza un índice (ADR 0005, 0022). Si Retia llega a vender dos a la vez, es una decisión nueva, no un filtro | ⚫ fuera hasta que pase |

---

## 5. El modelo de datos que agrega esta ola

Todo lo configurable es una fila (ADR 0012) por el molde de `lib/catalogo/`; todo lo derivado se calcula
(ADR 0024). La migración de cada etapa la genera y aplica la sesión principal, leyendo el SQL (`AGENTS.md`).

| Pieza | Qué es | Ticket |
|---|---|---|
| `submissions.utm_id`, y `utm_content` / `utm_term` promovidas de verdad | texto como llegó; relleno desde `respuestas` en la misma migración | 116 |
| `estados_llegada` | por programa: `valor` (como lo manda el form), `etapa_entrada` (Pendiente Setteo, Agendado o ninguna), `prioridad`, `alerta_minutos` (nulo = sin alerta), `activo`. Índice único `(program_id, lower(valor))` | 117 |
| `deals.area_declarada_id` | FK a `areas`, nula; requisito del motor para entrar a 6, 7 u 8 | 121 |
| `meta_conexiones` | un portafolio: nombre y token (secreto: lo escribe una función, nunca vuelve en una lectura ni en `change_log`) | 119 |
| `cuentas_publicitarias` | `act_...` de Meta, programa, conexión, moneda y zona horaria (leídas de Meta), `activo` | 119 |
| `pauta_objetos` | el árbol de Meta: nivel (campaña, conjunto o anuncio), id de Meta único, id del padre, nombre, estado, formato del creativo | 120 |
| `gasto_pauta` | un solo lugar del gasto: fecha, monto, moneda, origen (`meta_api` o `manual`) y **exactamente un destino** (anuncio de Meta, o campaña o área para lo manual), por CHECK. Reemplaza `ad_spend` (vacía) | 120, 067 |
| `objetivos` | cohorte, área (opcional), métrica (tipo en el código: cupos, agendas por día, costo por agenda, costo por lead, ROAS...), meta, aceptable, moneda. Único por `(cohorte, área, métrica)` con `NULLS NOT DISTINCT` | 122 |
| `programs.valores_calificados` | los `lead_value` que cuentan como calificados; por defecto MUY ALTO y ALTO VALOR | 123 |
| (si hay cortesías) `productos.es_cortesia` | DP-15 | · |

Lo que **no** se guarda: el área de un lead (se deriva del canal), el ROAS, los costos, el cumplimiento, el
ritmo, la proyección, el estado "se perdió en el Calendly" y los comparativos.

---

## 6. Las fórmulas (una definición por métrica)

Todas por programa (el programa es frontera, ADR 0043); en "todos los programas" solo lo sumable (ADR
0048). Fechas de Bogotá. Cada fórmula vive en **un** módulo de `lib/queries/` y la importan la pantalla, el
PDF y cualquier otra consulta (ADR 0024).

| Métrica | Definición | Unidad | ¿Se suma entre programas? |
|---|---|---|---|
| Dejó datos | tokens con parcial 1 o completo, por fecha del primer envío | personas-envío | sí |
| Registro (completó) | tokens con envío completo, por su fecha (DP-11) | envíos | sí |
| Llegó al Calendly | tokens con estado `con_calendly_sin_agenda` o `con_calendly` | envíos | sí |
| Agenda | llamada vigente creada en el rango (`calls.created_at`: el día en que se agendó); una cita movida (T9) no cuenta dos veces | llamadas | sí |
| Llamada | llamada vigente cuya fecha de cita cae en el rango (el ancla del 064) | llamadas | sí |
| Show | llamada que ocurrió (`llamadaOcurrio`, ya centralizado) | llamadas | sí |
| Calificada | show de un lead con `lead_value` en `valores_calificados` | llamadas | sí |
| Venta | deal que entró a Abonado o Completo en el rango (064) | deals | sí |
| Contratado | Σ precio del producto de las ventas del rango (módulo de `saldo.ts`) | USD | sí |
| Recaudado (caja) | Σ abonos por su fecha (ADR 0013) | USD | sí |
| Gasto | Σ `gasto_pauta` por su fecha | moneda de la cuenta (COP) | sí, por moneda |
| Costo por X | gasto del área Pauta ÷ X del área Pauta; sin gasto o sin X, "sin pauta" (ADR 0045) | COP | no |
| ROAS | (contratado × TRM de la cohorte) ÷ gasto, con la TRM a la vista | razón | no |
| Ad profit | contratado − gasto ÷ TRM de la cohorte | USD | no |
| Calidad de la traza | por venta: N3 anuncio (su `utm_id` resuelve en el árbol), N2 campaña (id o nombre exacto único), N1 solo canal, N0 sin UTM; sin clasificar aparte | % de ventas | no |
| Cumplimiento por área | vendidos del área ÷ cupos del área; esperado = cupos × día hábil ÷ total | % | no |
| Requeridos | ventas/día = faltan ÷ días hábiles restantes; agendas faltantes = faltan ÷ conversión agenda→venta; agendas/día = agendas faltantes ÷ días hábiles para agendar | · | no |
| Ritmo y proyección | agendas (y ventas) del área por día hábil en la ventana reciente; proyección = vendidos + ritmo de ventas × días hábiles restantes | · | no |
| Sin UTM hoy | tokens completos sin `utm_source` del día; macros sin expandir aparte | envíos | sí |
| Origen declarado | ventas **sin UTM** agrupadas por `area_declarada_id` | deals | sí |
| Comparativo | la misma métrica con el rango anterior del mismo largo, o con la cohorte anterior en el mismo día hábil de su ventana | · | igual que la métrica |

Las métricas de pauta cuentan envíos; las de venta, deals con el origen del envío que los abrió (ADR 0060).

---

## 7. El orden (sin fechas, lo antes posible)

### Ola 0 · Lo que no se puede reconstruir: configuración, sin código ⏳

| # | Qué | Quién | Condición |
|---|---|---|---|
| O-1 | ~~Campo oculto `utm_id` en los dos Typeform~~ ✅ 29-sep (ok de Mani, por API, con respaldo; el resto del form sin cambios) | Ops | el webhook ya guarda todo en `respuestas` (ADR 0058): sirve desde el primer envío |
| O-2 | La plantilla de UTM de DP-2 en todos los anuncios de Retia | Pauta | **después** de O-1, o Typeform descarta el `utm_id` |
| O-3 | El token de la API de Meta por portafolio | Anderson | se guarda con el 119 |
| O-4 | Columna "origen del deal" en las pestañas de gestión | Mani o Dani, con los closers | desde ya |
| O-5 | Crear la C3 de cada programa con su ventana y meta (Mani, 29-sep: después, verificando bien las fechas) | gerente | antes de la primera venta de C3 |
| O-6 | ~~Confirmar el parche de Tactical con el próximo envío~~ ✅ 29-sep, 20:30 y 20:35 | Mani | §2.4 |
| O-7 | Punto parcial antes del Calendly, valor `con_calendly_sin_agenda` en `estado` y el evento `form_response_partial` en el webhook | Ops | **solo después del 117 en producción**: si el form manda el valor nuevo antes, el CRM no lo reconoce y se repite el bug de §2.4 |

### Ola 1 y ola 2: en qué etapa y carril cae cada ticket

El orden por etapas y carriles vive **solo** en [`plan-reparto.md`](./plan-reparto.md) §4; aquí va el
porqué del corte en dos olas.

- **Ya, en E5 (carril de Mani):** el 093 como **vista interina de Pauta** (registros, agendas y sin UTM por
  canal, campaña y anuncio, con lo que ya hay). Es lo primero que se entrega.
- **Ola 1 = E6, de dónde viene cada lead.** La mitad de arriba del embudo (envíos, agendas, gasto) ya vive
  en el CRM y **no depende del corte**: UTM completas (116), estados de llegada y parciales (117), la
  conexión y el gasto de Meta (119, 120), áreas, canales y emparejador (083, 101, 085, 087), área declarada
  (121), el urgente del Inbox (118), series con dimensiones (089) y el rol (102).
- **Ola 2 = E7 y E8, lo que cuesta y lo que vende.** Ventas, ROAS y cumplimiento necesitan las ventas en el
  CRM (hito B) o la migración de lo histórico: objetivos (122), embudo y costos (123), embudo del formulario
  (126), 088, 066, 067, 065; y en E8 el cumplimiento (124), la tab Campañas (125), 095, 090, el builder
  reducido (092, 086) y el resto.

---

## 8. Lo que ya estaba escrito y se corrigió

| Dónde | Decía | Queda |
|---|---|---|
| ADR 0045 punto 2 | conjunto y anuncio fuera de alcance | entran por `utm_id` (ADR 0062) |
| ADR 0051 puntos 1, 3, 4 y 5 | tres UTM se leen y dos se capturan; el CRM genera **todos** los links; crear una campaña escribe su patrón | paid: macros de Meta y árbol por API; builder para orgánico y closer (ADR 0062) |
| ADR 0052 puntos 2 y 4 | el trafficker carga el gasto y no ve caja | el gasto entra por API; ve el Dashboard menos closers y comisión |
| ADR 0054 | el form manda descartado, setteo o con calendly; el CRM traduce tres valores fijos | tabla de estados por programa; descartado sale (ADR 0061) |
| `lib/db/schema.ts`, comentario de `submissions.utmTerm` y `utmContent` | "deliberadamente sin leer... no hay hueco" | lo corrige el 116 (es código) |
| Ticket 093 | `utm_term` y `utm_content` en 0; anuncio fuera; lee `leads.utm_*` | están en `respuestas`; entran; lee envíos (ADR 0060) |
| Ticket 084 | tres campos de patrón, `ad_spend` por campaña y fecha | se reduce (DP-25 ✅); gasto en `gasto_pauta` por anuncio y día |
| Ticket 092 | builder v1 con catálogo de campañas creado en el CRM | builder solo para orgánico y closer |
| Ticket 067 | "Fuera: traer la inversión por API de Meta" | la API es la fuente principal |
| Ticket 090 | conjunto y anuncio fuera; umbral vacío | entran; primeros umbrales reales en `objetivos` |
| `overview.md` §4, §7, §8 y §11 | el trafficker "arma links sin estándar"; costo por agenda USD 20 / 100 (Daniel); desglose por anuncio fuera de v1 | al día con esta sesión |
| `structure.md` §2.1, §5, §6, §7 y §8 | Descartado = lead sin deal; convención de tres UTM; builder para todo | al día con esta sesión |
| `AGENTS.md` | restricción del UTM y contratos del Estado y del significado de los UTM | al día con los ADR 0061 y 0062 |

---

## 9. Lo que falta preguntar

Viven en `plan.md` §7 (la lista única); aquí solo el índice.

| # | Pregunta | A quién |
|---|---|---|
| PQ1 | ¿Una cuenta publicitaria por programa o una compartida? ¿Moneda (COP) y zona horaria (Bogotá) de cada cuenta? ¿Hay pauta fuera de Meta (TikTok Ads, Google)? | Pauta (Anderson) |
| PQ2 | ¿Cuándo aplican la plantilla de DP-2 en Retia? (después de O-1) | Pauta |
| PQ3 | Cómo sacan hoy la conversión agenda→venta de las agendas requeridas, qué ventana usan para el ritmo actual y cuántos días antes del cierre dejan de contar agendas | Pauta |
| PQ4 | Los objetivos de cada programa: agendas de paid por día, costo por agenda, costo por lead, ROAS de contrato (¿1,67?) y el reparto de cupos de C3 | Pauta y Gerencia |
| PQ5 | ¿Retia da cortesías? (DP-15) | Gerencia |
| PQ6 | La convención de UTM del orgánico y si quieren tipo, formato y autor del creativo (exige una convención de nombres de anuncio) | Pauta y Media |
| PQ7 | El nombre visible de cada área (paid, orgánico, referidos) | Gerencia |
| PQ8 | ~~Ok a DP-23, DP-24 y DP-25~~ ✅ 29-sep | Mani |

### 9.1 Respuestas del 29-sep (Mani)

| # | Respuesta | Queda en |
|---|---|---|
| PT-34 | ✅ Las objeciones **entran** (ranking de motivos de pérdida con su ticket perdido) | 065 |
| 126 | ✅ El token de la API de Typeform vive **en la base, en la fuente**, con las reglas del secreto del webhook; se carga en producción | 126 |
| PQ1 | ✅ **Una cuenta publicitaria por programa**, en **COP** y zona **Bogotá** (un token/API por portafolio). 🔴 Sigue: si pautan en TikTok Ads o Google | 119 |
| PQ2 | 🟡 Mani cree que Pauta ya usa la plantilla. ⚠️ Lo medido el 29-sep dice otra cosa: los envíos del webhook de ese día llegaron con `facebook / cpc` y sin `utm_id`. Se verifica con los próximos envíos | O-2 |
| PQ3 | ✅ **La tasa agenda→venta es un objetivo más de la cohorte** (se declara en `objetivos`, métrica `conversion_agenda_venta`). Cada agenda cuenta para la cohorte de su deal. ⚠️ Un deal recibe cohorte en su primer abono (063): una agenda cuyo deal aún no tiene cohorte se cuenta para la cohorte activa del programa el día en que se agendó. 🔴 Siguen: la ventana del ritmo actual y el desfase agenda→venta | 122, 124 |
| PQ4 | ✅ Se agrega **costo por venta (cierre)** a los objetivos. 🔴 Los valores de cada programa los da Pauta | 122 |
| PQ5 (antes PQ6) | 🟡 **Orgánico = lo que no es `paid_social`** (ni `closer`, que es referidos). **Sin UTM sigue siendo su propia cubeta**, nunca orgánico (ADR 0045). 🔴 Preguntar a Pauta si están de acuerdo, y cómo tratan el `facebook / cpc` histórico (el CRM lo pone en paid) | 101 |
| PQ7 | ✅ Las áreas se muestran como **paid, orgánico y referidos** | 083 |
| Cortesías | 🔴 Mani pregunta a Gerencia | DP-15 |
| Checkouts y sin UTM de Tactical | 🔴 Mani pregunta a Pauta | `plan.md` §7 |
