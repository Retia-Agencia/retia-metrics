# Comercial: el norte que pidió Gerencia

> **Complemento de [`plan.md`](./plan.md), no reemplazo**, con el mismo molde que
> [`analytics.md`](./analytics.md). Mapea, punto por punto, la reunión del **30-sep-2026** con **Daniel
> Tovar** (Dani) y **Michael Castellanos** sobre el norte del CRM: qué se dijo, qué hay hoy en `main`, qué
> cambia, en qué ADR o ticket cae y qué falta preguntar. **Lo que pidió Gerencia es la fuente de verdad**
> (Mani, 30-sep): si choca con un ADR o un ticket vigente, el ADR o el ticket se reabre, no la reunión.
>
> 🎯 **PRIORIDAD (Mani, 30-sep): esto se ataca antes que cualquier otro frente del CRM.** Los pasos de §8
> son el trabajo que sigue; el tracker los lleva arriba de todo (`tasks/README.md`, "Norte comercial").
>
> **Estado: paso 1 de §8 hecho (el inventario).** Ningún ADR ni ticket se ha tocado todavía; cada cambio
> está listado en §2 y §3 para hacerlo paso por paso.
>
> Fuentes: el transcript que pegó Mani en la sesión del 30-sep (la fuente principal) y el resumen de
> Granola ("Reorganización del pipeline CRM Retia y configuración de Hotspot"). ⚠️ El resumen de Granola
> se equivoca en dos cosas: llama "HubSpot" al CRM de Retia ("configurar campos en HubSpot") y dice que el
> valor base por defecto es 0; lo que es 0 por defecto es el **valor vendido** de cada venta (GC-09). El
> estado del repo es el de `main` en `d233f41`.

Leyenda: ✅ ya existe o ya decidido · 🔄 existe y cambia · 🆕 nuevo · 🔴 falta decidir o preguntar ·
⚫ fuera de v1 o fuera del CRM · 🩸 choque con una decisión vigente.

---

## 1. Qué pidió Gerencia, en una frase

**Dos cosas.** (1) **La operación comercial se lleva al modelo de 30X:** las etapas del pipeline, y las
etiquetas y propiedades dentro de cada etapa, salen del HubSpot de 30X, *"guiarnos 100% de eso, porque
ya sabemos que abarcan todo el universo y que no se pisan entre ellas"*. (2) **Las métricas se toman del
dashboard "Gestión Comercial" de 30X como referencia, pero mucho más flexibles:** comparar cualquier
periodo contra cualquiera, superponer gráficas, entrar con clics hasta el detalle, y **número y
porcentaje siempre, en todo**. El fin es *"tener visibilidad de toda la operación"*: *"al final cuál es el
negocio, leer la data y gestionar accionables sobre eso y tomar decisiones"*.

Y un orden: **la v1 es comercial, sin marketing.** Dani: *"la versión 1 es hasta donde sabemos, como sin
marketing, como solamente la visual de comercial. Y con eso ya yo me muevo y ya después miraremos
marketing"*. Mani estimó 5 a 6 días para esa v1; el plan sigue sin fechas (Mani, 29-sep).

---

## 2. Lo que se reabre (los choques con lo vigente)

Cada fila es una decisión escrita que la reunión contradice. Ninguna se aplica sola: cada una baja a su
ADR o ticket en el paso 4 de §8.

| # | Lo vigente | Lo que dijo Gerencia | Se reabre |
|---|---|---|---|
| 🩸 R-1 | Las **once etapas** de Retia (Pendiente Setteo, En Contacto, Agendado, Re-agenda, Atendido, Seguimiento, Compromiso Verbal, Abonado, Completo, Próxima Cohorte, Cierre Perdido) y su tabla de transiciones | Las etapas son las de 30X, con sus etiquetas y propiedades por etapa (§4) | ADR 0037, 0056; `structure.md` §3; tickets 043-047, 103, 104 (hechos: el cambio va en tickets nuevos) |
| 🩸 R-2 | **No hay Atendido sin Grain** (requisito del motor, T10 y T7; ticket 044 y 058) | Se puede pasar a Atendido sin Grain, pero con *"una alarma así re roja"* y un conteo de cuántos no tienen transcript | ADR 0037 (requisito), 044, 058; `plan.md` §4.2 |
| 🩸 R-3 | **El precio sale del producto** (ADR 0016, ticket 017); un producto por precio | *"No crees varios productos"* por cada descuento. Cada venta lleva un **valor vendido** que el closer escribe, **0 por defecto** | ADR 0016; 017, 060, 074; `plan.md` §4.2; `overview.md` §4 y §5 |
| 🩸 R-4 | **Comisión = monto fijo por venta** (`programs.comision_por_venta_usd`: 80 y 100 USD; Alejo, 29-sep; ticket 062) | **Comisión = porcentaje** del valor vendido. Se deja el porcentaje que hoy da los 80 sobre 797 y *"se va calculando solo"* | 062; `overview.md` §7 |
| 🩸 R-5 | La cartera se vigila con la **fecha límite de pago** (ADR 0053): vencida = saldo > 0 con la fecha pasada | En Ganado pago parcial se anota la **próxima fecha de pago**, y se ve una lista de toda la cartera por cobrar ordenada por esa fecha | ADR 0053, 061 |
| 🩸 R-6 | Onboarding = **una marca** (`onboarded_at`), **sin checklist**: está fuera de v1 (`overview.md` §8). Lo marca el closer dueño, gerente o developer (099) | **Cuatro pasos** marcados uno por uno, y un **perfil nuevo, Customer Success**, que solo tiene acceso a eso | `overview.md` §8; 063, 099; ADR 0003 (roles), molde del ADR 0052 |
| 🩸 R-7 | **Máximo una cohorte activa por programa**, garantizado por un índice (ADR 0005, 0022); la cohorte se asigna sola en el primer abono (063); `analytics.md` PT-64 deja "varias cohortes vendiendo" fuera | Durante la primera semana de la C2 se siguen vendiendo cupos de la C1 | ADR 0022; 063; PT-64 |
| 🩸 R-8 | Solo existe la **meta de la cohorte** (y su meta dinámica, 020) | Hay **dos metas: la del mes y la de la cohorte**, y la del mes sale de la de la cohorte (§5) | 020, 122, 124; ADR 0063 |
| 🩸 R-9 | El orden P1 pone la atribución y la pauta (paso 5) antes de los reportes (paso 6) | La v1 es comercial, sin marketing | `plan.md` §5; `plan-reparto.md`; tickets 119, 120, 123, 125 |
| 🩸 R-10 | Los estados de llegada abren el deal en Pendiente Setteo o Agendado (ADR 0061, ticket 117, sin construir) | Los estados iniciales son **Potencial** (no calificado), **Calificado** (calificado sin agenda) y **Agendado** (calificado con agenda) | ADR 0061; 117, 118 |
| 🩸 R-11 | La migración de las pestañas de gestión ya tiene su mapeo de categorías a etapas (077, 080; ensayo pendiente del 078) | Dani dice a qué etapa, propiedad y etiqueta va cada categoría (*"pásalos acá, todos los de esta"*) | 078, 080; ADR 0059. **El `--aplicar` del 078 espera a R-1 y a QD-2** (meter ahora los deals viejos en las once etapas obliga a migrarlos dos veces, y la deshacedora del 127 solo sirve si nadie trabajó encima) |
| 🩸 R-12 | Una API propia para herramientas externas está fuera de v1 (`overview.md` §8) | Después de v1: un MCP del CRM con herramientas por perfil | `overview.md` §8 (sigue fuera de v1, cambia de "no" a "siguiente") |

---

## 3. El grid: punto por punto

Columnas: lo que se dijo · lo que hay hoy · qué cambia · dónde cae · estado. Los IDs siguen el orden de
la reunión dentro de cada bloque.

### A. El pipeline y la migración

| ID | Lo que se dijo | Hoy | Qué cambia | Dónde | Estado |
|---|---|---|---|---|---|
| GC-01 | Las etapas del CRM salen 100% de las del HubSpot de 30X: *"abarcan todo el universo y no se pisan"* | 11 etapas propias (`deals.etapa`, `pgEnum`) | El enum, la tabla de transiciones, los requisitos, el Kanban, el Inbox, el embudo y toda consulta que nombre una etapa | R-1 · §4 | 🔴 falta leer HubSpot (paso 2) |
| GC-02 | Dentro de cada etapa hay **etiquetas y propiedades** que hay que entender y respetar | Motivos en 4 listas (ADR 0056), resultados de llamada (ADR 0015), "¿Cómo terminó?" con 6 botones | Probable: una etiqueta por etapa como catálogo (fila, ADR 0012) y propiedades exigidas por etapa | R-1 | 🔴 paso 2 |
| GC-03 | Una etapa nuestra sin equivalente en 30X **se le pregunta a Dani**: *"toda la gente que está pendiente de setteo, ¿dónde la meto?"* | · | Lista de etapas sin equivalente en §4, para Dani | §7 QD-1 | 🔴 |
| GC-04 | Los requisitos para mover un deal (lo que Mani había definido) se mantienen, remapeados | Requisitos por flecha (044, 103) | Se reescriben sobre las etapas nuevas | R-1 | 🔄 |
| GC-05 | La migración de lo que está regado en las hojas de Tactical: Dani dice a dónde va cada categoría | Mapeo de categorías en 077/080; 078 sin aplicar | El mapeo se rehace contra las etapas de 30X con las respuestas de Dani | R-11 · QD-2 | 🔄 🔴 |
| GC-06 | Limpiar las discrepancias del histórico **ahora**, *"aprovechamos que estamos chiquitos"* (en 30X llegaron *"20 millones de discrepancias"* a HubSpot) | Rarezas de la migración a la vista (`/ajustes/migracion`, 080) | Las rarezas se resuelven con Dani antes de aplicar, no después | 078, 080 · QD-2 | 🔄 |
| GC-07 | La fecha de creación del deal es la del envío del formulario (lead = "contacto" de HubSpot) | `deals.created_at` = cuando se escribió la fila; el deal guarda su envío de origen (`submission_origen_id`) | Verificar que la ficha y las métricas lean la fecha del envío de origen, y qué fecha llevan los deals migrados | 074, 078 | 🔴 verificar |
| GC-08 | La misma persona en dos programas son dos leads aparte: *"aquí no aplica, está bien que sea como aparte"* | Llave `(programa, correo)` (ADR 0043) | Nada: Dani lo ratificó | · | ✅ |

### B. El dinero: valor vendido, comisión y cartera

| ID | Lo que se dijo | Hoy | Qué cambia | Dónde | Estado |
|---|---|---|---|---|---|
| GC-09 | Cada venta lleva su **valor vendido**, que el closer escribe; **por defecto 0**, para que tenga que cambiarlo siempre | El precio viene del producto (`productos.precio_usd`) | Un valor vendido por deal, obligatorio y sin prellenar; el saldo, el contratado, el ROAS y "abono igual al precio" (T14, T17) pasan a leerlo | R-3 | 🆕 |
| GC-10 | Los descuentos no son productos: *"vas a crear un montón de productos distintos que nada que ver"* | Productos por programa (ADR 0016, 017) | 🔴 qué queda de los productos (QM-1) | R-3 | 🔴 |
| GC-11 | El **ticket base** del programa va en USD: *"está perfecto"* | Hay tres precios: `programs.ticket_usd`, `cohorts.precio_usd` y `productos.precio_usd` | Decidir cuál es el ticket base de la meta en cash (§5) y retirar los que sobren | R-3 · QM-2 | 🔴 |
| GC-12 | **Comisión = porcentaje** del valor vendido; el porcentaje de hoy (80 sobre 797) se mantiene. *"Si vendiste a 600, no te voy a dar los mismos 80"* | Monto fijo por venta (062) | `programs.comision_porcentaje` (o como se llame) y `lib/queries/comision.ts` sobre el valor vendido | R-4 | 🔄 |
| GC-13 | **Valor vendido, cash collected y cartera**: lo vendido (797), lo que pagó en la llamada (500) y la resta, que por defecto es cartera | Precio, abonos y saldo (`saldo.ts`) | Solo cambia de dónde sale lo vendido (GC-09); la caja y el saldo ya son así | `saldo.ts` | ✅ con GC-09 |
| GC-14 | En **Ganado pago parcial** se anota la **próxima fecha de pago** | Fecha límite de pago (ADR 0053) | 🔴 si es la misma columna con otro significado o una nueva (QM-3) | R-5 | 🔄 🔴 |
| GC-15 | Una **lista de toda la cartera pendiente, ordenada por fecha**: *"que no sea un esfuerzo para el closer pensar cuándo tiene que cobrar"* | Cartera **vencida** (061) en el Inbox | La lista completa (vencida y por vencer), por fecha, con saldo y dueño | R-5 | 🆕 |
| GC-16 | Un calendario de cartera y notificaciones de cobro | Fuera de v1 (`overview.md` §8) | Nada en v1: Dani lo dijo *"eso ya es después"* | · | ⚫ siguiente |
| GC-17 | Sentarse con 2 o 3 closers por aparte para entender los abonos (*"2 o 3 fuentes de información"*) | · | Tarea de Mani, antes de cerrar GC-14 y GC-15 | §8 | 🔴 |

### C. Llamadas, Calendly y Grain

| ID | Lo que se dijo | Hoy | Qué cambia | Dónde | Estado |
|---|---|---|---|---|---|
| GC-18 | Al crear un programa: el link del formulario y el de Calendly (y su token) | Forms Link y token obligatorios (109) | Nada | 109 | ✅ |
| GC-19 | Calendly detecta agenda, reagenda y cancelación de cada programa | Webhook live en los dos programas (096) | Nada | 096 | ✅ |
| GC-20 | De Agendado a Atendido **sin Grain se puede**, con alarma roja y un conteo de cuántos no tienen transcript: *"deja que sí lo muevan porque a veces necesitan mover de una vez todo"* | El motor lo exige | El requisito se vuelve aviso: la flecha a Atendido se acepta sin Grain y el deal queda marcado; el conteo y la lista van al dashboard | R-2 | 🔄 |
| GC-21 | Traer la llamada de Grain sola (Grain tiene API) | El closer pega el link | Mani contestó *"que le dan manual"*: queda manual. 🔴 si la integración entra después de v1 (QM-4) | · | ⚫ 🔴 |
| GC-22 | Desde una llamada se abre su deal | Tab Calls (098) | Nada | 098 | ✅ |
| GC-23 | Cada closer tiene su cuenta de Calendly por programa | Vinculadas desde `/ajustes/usuarios` (096) | Configuración pendiente: Andrea en ComunicArte (falta mapearla; la cuenta sería la de Milena) | Ops | 🔴 Ops |
| GC-24 | ¿Qué tan probable es que se rompa? | Webhooks firmados, caja negra, salud (106, 110) | Solo se cae si se cae Supabase o Vercel. Ver GC-46 (respaldos) | · | ✅ |

### D. El lead, los duplicados y la calificación

| ID | Lo que se dijo | Hoy | Qué cambia | Dónde | Estado |
|---|---|---|---|---|---|
| GC-25 | Mismo correo = mismo lead; cada envío se guarda aparte porque *"puede ser una respuesta distinta"*; María del Mar no puede salir dos veces | Dedup por `(programa, correo)`; todos los envíos colgados del lead (ADR 0035, 0036) | Nada | · | ✅ |
| GC-26 | Que dos closers no contacten a la misma persona por dos envíos | Un solo deal abierto por lead y programa (índice); el envío nuevo se avisa al dueño | Nada | ADR 0037 | ✅ |
| GC-27 | **Ningún lead se descarta**: todos pasan a setteo o tienen agenda (cambio hecho con Alejo) | `descartado` desaparece para lo nuevo (ADR 0061, sin construir) | Nada nuevo; lo construye el 117 | 117 | ✅ decidido |
| GC-28 | Estados iniciales: **Potencial** (no calificado), **Calificado** (calificado que no agendó), **Agendado** (calificado que agendó) | La tabla `estados_llegada` (117) apunta a Pendiente Setteo o Agendado | Las etapas de entrada del 117 son las de 30X; 🔴 qué valor del formulario es "no calificado" y cuál "calificado sin agenda" (QD-3) | R-10 | 🔄 🔴 |
| GC-29 | El puntaje del Typeform (lo armó Alejo replicando 30X) y las etiquetas low/high: *"déjalo, pero nadie mira eso; todos miramos las etapas del pipeline"* | `score`, `lead_quality` y `lead_value` guardados como llegan (0041); el Setteo se ordena por score (070) | Mani: sirve para priorizar dentro de una misma etapa. Ordenar por score toda lista de una etapa, no solo el Setteo | 070, 069 | 🔄 menor |

### E. El dashboard y las gráficas

| ID | Lo que se dijo | Hoy | Qué cambia | Dónde | Estado |
|---|---|---|---|---|---|
| GC-30 | La referencia es el dashboard **"Gestión Comercial"** de HubSpot de 30X (*"los otros están dañados"*): tomar pantallazos y preguntar *"si fueras un gerente comercial, ¿cómo las mejorarías para tener información más analizable?"* | Dashboard por programa (064, 093, 089); 095 sin construir | Inventario de sus gráficas en el paso 2, cada una con su versión mejorada | 095 | 🔴 paso 2 |
| GC-31 | En HubSpot hay que filtrar por equipo y el equipo tiene que coincidir con el programa: aquí se optimiza | El programa es frontera y selector (ADR 0043, 0050) | Nada | · | ✅ |
| GC-32 | **"No value"**: un atendido sin la etiqueta de qué dijo en la llamada es bandera roja, y HubSpot no la muestra | El Inbox avisa la llamada de hoy sin resultado (071, 128); el dashboard no cuenta los atendidos sin resultado | El "sin valor" de cada propiedad exigida es una cifra visible con su lista | 128 · GC-02 | 🆕 |
| GC-33 | **Generación de deals y agendas contra el mes pasado**: *"si la generación de deals sube y los agendados no, no estoy trayendo leads calificados"* (deberían subir en proporción) | Serie con periodo anterior (089); registros vs agendas por canal (088, sin construir) | Una gráfica acumulada del mes, deals creados y agendas, contra el mes anterior, con la razón entre las dos | 088, 089 | 🆕 |
| GC-34 | Un dashboard general y **clic, clic, clic hasta la minucia** | El drill-down que existe es el de UTM (093): canal, campaña, content y term | Toda cifra abre la lista de deals que la forman | 095 | 🆕 |
| GC-35 | Ejemplo: clic en "no value" muestra el deal completo en fila, con su closer; después, una escala de color de lo más viejo a lo más nuevo | · | La lista del drill-down lleva closer, etapa, antigüedad y enlace al deal; el color por antigüedad, después | GC-34 | 🆕 · ⚫ el color |
| GC-36 | **Periodos flexibles**: *"yo poder decidir contra qué periodo quiero contrastar"*: la semana anterior, la semana 1 de este mes contra la semana 1 del mes pasado, solo la primera semana del mes; zoom in y zoom out. HubSpot solo deja *"one month ago"* | Comparativo fijo: periodo anterior del mismo largo y cohorte anterior en el mismo día hábil (DP-16) | Rango A contra rango B elegidos por el usuario, en llamadas y en todo | 089, 095 | 🔄 |
| GC-37 | **Superponer gráficas**: leads de paid contra leads de orgánico | Filtro por área (`?area=`, 089) | Varias series de una dimensión en la misma gráfica | 089, 095 | 🆕 |
| GC-38 | **Número y porcentaje siempre, en todas las gráficas**: *"me toca calcular en la cabeza... de una vez: bajó un 30%"* | No es una regla escrita | Regla de pantalla para todo el dashboard (va a `structure.md` §9 como contrato) | 095 · §9 | 🆕 |
| GC-39 | Dani dará los umbrales mientras lo usa en el daily comercial (*"si está por debajo de esto se levanta..."*); Mani entra a algunos dailies, donde el dashboard se abre delante de todos | Objetivos por cohorte (122, sin construir) | Los umbrales son filas (DP-23); se cargan a medida que Dani los dé | 122 · §8 | 🔴 Dani |
| GC-40 | **Alertas por persistencia**: una métrica caída un día, listo; caída 5 días seguidos, *"paila"* | Semáforo contra meta y aceptable (DP-24); alertas fuera de la app por decidir (A2) | Contar días hábiles seguidos por debajo del umbral y subir la alerta con eso | A2 · 122 | 🆕 🔴 QD-6 |

### F. Students y el perfil de Customer Success

| ID | Lo que se dijo | Hoy | Qué cambia | Dónde | Estado |
|---|---|---|---|---|---|
| GC-41 | Los pagados (parcial o completo) son estudiantes, cada uno en la cohorte de su deal | Students por cohorte (099) | Nada, salvo los nombres de etapa (R-1) | 099 | ✅ |
| GC-42 | **Perfil Customer Success**: solo marca el onboarding | Cuatro roles: closer, gerente, paid trafficker, developer | Un rol nuevo con su pregunta en `lib/auth/roles.ts` (molde del ADR 0052) y acceso solo a Students | R-6 | 🆕 |
| GC-43 | **Cuatro pasos de onboarding**: mensaje de bienvenida por WhatsApp interno, meterlo al grupo de WhatsApp, correo de bienvenida y dejarlo en Circle | `onboarded_at`, una sola marca | Cada paso con quién y cuándo; onboarding completo = los cuatro. 🔴 si los pasos son filas por programa (QM-5) | R-6 | 🆕 |

### G. Metas y cumplimiento (el detalle y las cuentas en §5)

| ID | Lo que se dijo | Hoy | Qué cambia | Dónde | Estado |
|---|---|---|---|---|---|
| GC-44 | Dos metas distintas en las gráficas: **la del mes y la de la cohorte**; *"nuestros cierres contables y financieros son a fin de mes, no cada 6 semanas"* | Meta de la cohorte y meta dinámica (020, 027) | La meta del mes, derivada (§5) | R-8 | 🆕 |
| GC-45 | **Una sola página de Metas / cumplimiento**: avance, deuda, las dos compensaciones, número y % | Panel de cumplimiento por área (124, sin construir) | La página de metas comerciales; el reparto por área de Pauta queda adentro como un corte más | 124 · nuevo | 🆕 |

### H. Plataforma, formularios y lo que sigue

| ID | Lo que se dijo | Hoy | Qué cambia | Dónde | Estado |
|---|---|---|---|---|---|
| GC-46 | *"Estamos confiando plenamente en que [Supabase] nunca se va a caer"* → *"súper importante revisar el tema de los backups"* | S1 abierta: el plan gratis no tiene respaldos | Nada nuevo: S1 sigue urgente y la reunión no la cerró | `plan.md` §7 S1 | 🔴 |
| GC-47 | Un programa con **dos formularios activos a la vez** para migrar a Dapta sin perder lo que entra por el link viejo; *"se puede meter info de más formas, no solo de Typeform"* | ADR 0064 y tickets 131 y 130 (creados el 30-sep) | Nada | 131, 130 | ✅ |
| GC-48 | Los formularios de los programas nuevos se hacen en Dapta | `docs/dapta/` (ComunicArte y Memorable) | Nada | 130 | ✅ |
| GC-49 | Programas nuevos de comunicación: **Memorable en Instagram** (Nicolás Martínez, USD 1.200), **Francisco** (USD 800, o 600 porque *"la gente va a pedir descuento"*), **Majo** (psicología, USD 500). Un solo *"knowledge de cómo vender programas de comunicación"* con tres enfoques | Un programa es una fila (K5, ADR 0012) | Configuración, sin código. 🔴 el precio de Francisco (QD-7) | Ops | 🔴 Ops |
| GC-50 | **Meta Business Manager**: el siguiente paso después de lo comercial; falta sacar el token de la API de cada portafolio (Tactical assets y ComunicArte) | 119 y 120 esperan el token | Bajan de prioridad por R-9; el token se sigue pidiendo | 119, 120 | 🔄 orden |
| GC-51 | Después de v1: el CRM con **su MCP**, herramientas por perfil, conectado al second brain y a WhatsApp, para *"gestionar accionables de una vez"* (escribirle a Anderson si las agendas caen). Dani: *"nosotros podemos lanzar sin esto"* | Fuera de v1 | Sigue fuera de v1, anotado como lo siguiente | R-12 | ⚫ siguiente |
| GC-52 | *"Fecha corte, cortesías"* (nota de Mani al final) | Cortesías: DP-15 / PQ5 abierta | Propiedades de HubSpot por mirar en el paso 2 | §8 | 🔴 paso 2 |
| GC-53 | Lo que falta, según la reunión: correcciones del pipeline, la parte visual, la API de marketing y consolidar las métricas | 34 tickets abiertos según Mani | Este documento es el insumo para rehacer esa lista | §8 | · |

---

## 4. El pipeline de 30X contra el nuestro (borrador para el paso 2)

Las etapas de 30X, como Dani las leyó en la reunión (*"potencial, registrado, en gestión, contactado,
calificado, agendado, atendido, compromiso verbal, ganado pago parcial, ganado pago completo y cierre
perdido"*). La columna del medio es una **lectura**, no un mapeo: lo confirma HubSpot (paso 2) y lo
decide Dani (paso 3).

| 30X | La nuestra más cercana | Duda |
|---|---|---|
| Potencial | (no existe: hoy es Pendiente Setteo) | estado inicial del no calificado (GC-28) |
| Registrado | (no existe) | ¿qué la distingue de Potencial? |
| En gestión | Pendiente Setteo con dueño, o En Contacto | ¿qué la distingue de Contactado? |
| Contactado | En Contacto | · |
| Calificado | (no existe) | estado inicial del calificado sin agenda (GC-28) |
| Agendado | Agendado | · |
| Atendido | Atendido | sus etiquetas: *"interesado, debe consultarlo"*, *"interesado, problema de fecha o corte"*, *"no calificado"*, y más que no se vieron |
| Compromiso verbal | Compromiso Verbal | · |
| Ganado pago parcial | Abonado | la próxima fecha de pago (GC-14) |
| Ganado pago completo | Completo | · |
| Cierre perdido | Cierre Perdido | sus etiquetas frente a los motivos de pérdida (104) |

**Las nuestras sin etapa en 30X**, que hay que preguntarle a Dani (QD-1): **Pendiente Re-agenda**,
**Seguimiento** y **Próxima Cohorte**. Lectura: en 30X podrían ser etiquetas dentro de Agendado o
Atendido (*"interesado, problema de fecha o corte"* se parece a Próxima Cohorte), pero eso lo dice
HubSpot, no esta tabla.

⚠️ Lo que no se pierde en el cambio, sea cual sea el mapeo: `moverEtapa()` sigue siendo el único
escritor, anulado sigue sin ser Cierre Perdido (ADR 0038), venta sigue siendo un deal en las dos etapas
de ganado, y el historial de etapa ya escrito se traduce en la misma migración (no se reescribe a mano).

---

## 5. Las metas, como las explicó Dani

**El ciclo.** Una cohorte se vende entre 5 y 7 semanas, idealmente 6. En la semana 7 empiezan las clases y
arranca el ciclo de venta de la siguiente cohorte.

**La meta de la cohorte** son cupos, y su cash sale solo: cupos × ticket. Ejemplo de Dani: 60 cupos ×
USD 2.000 = USD 120.000. Los cupos pueden cumplirse sin el cash, por los descuentos; *"por ahora"* importan
más los cupos, después el cash. Se define por cohorte en un panel: fecha de inicio y de cierre de ventas
y la meta (eso ya existe: `cohorts.meta_cupos` y la ventana de venta, 027 y ADR 0022).

**La meta del mes** sale de la de la cohorte, repartida pareja en su ventana. El ejemplo de Dani: 60 cupos
en 6 semanas = 10 por semana; septiembre tiene 4 semanas de esa ventana, así que la meta de septiembre son
40 cupos, o USD 80.000. Con más de una cohorte en el mes, la meta del mes es la suma de sus partes.

| Cuenta | Con el ejemplo (venta del 31-ago, 30 días hábiles, cierra el 9-oct) |
|---|---|
| Cupos por día hábil | 60 ÷ 30 = **2** (10 por semana de 5 días) |
| Meta de agosto | 1 día hábil × 2 = **2 cupos** |
| Meta de septiembre | 22 días hábiles × 2 = **44 cupos**, USD 88.000 |
| Meta de octubre | 7 días hábiles × 2 = **14 cupos** |

🔴 **QM-6:** Dani contó semanas (40 en septiembre); contado por día hábil, la regla de Retia de todo el
sistema, salen 44. Y dijo *"imagínatelo como una distribución normal"*, pero la cuenta que hizo es pareja,
no una campana. Se propone **pareja por día hábil**, que es lo que ya hace la meta lineal (020).

**El avance y la deuda.** Si la semana pide 10 (2 por día) y el miércoles se cierra con 3 en vez de 6, el
atraso es **3 cupos (50% de lo esperado)**. Siempre número y porcentaje.

**Las dos compensaciones**, que Dani quiere ver las dos:

| Vista | Pregunta | Con el ejemplo |
|---|---|---|
| En la semana | ¿cuánto hay que vender por día para no arrastrar la deuda a la semana siguiente? | faltan 7 en 2 días: **3,5 por día** en vez de 2 |
| En lo que queda de la cohorte | si la deuda se reparte en el tiempo que queda, ¿a qué ritmo hay que ir? (*"como el rate de cumplimiento"*) | si es el miércoles de la semana 1: faltan 57 en 27 días hábiles: **2,11 por día** |

La segunda es la meta dinámica que ya existe (020); la primera es nueva.

🩸 **Cohortes que se pisan (R-7).** Dani: el programa arrancó el 12, llegaron estudiantes nuevos esa
semana para la cohorte 1, *"entonces yo puedo meterlos y decir: durante la semana de inicio de la cohorte 2
terminé de vender unos cupos de la cohorte 1"*. Hoy hay una sola cohorte activa por programa y el primer
abono asigna esa. Se puede cambiar la cohorte de un deal (`cambiarCohorte`, 063), pero falta decidir
(QM-7): a qué meta del mes cuenta esa venta, y si la cohorte que asigna el primer abono se elige.

---

## 6. Lo que no es del CRM

| Qué | Por qué queda afuera |
|---|---|
| Juanito manda, junto al recordatorio, un video de ~15 s de la closer (*"Hola, recuerda que mañana..."*) | Juanito es el bot de recordatorios, fuera del CRM (`plan.md` §7 E). Necesita un refactor para mandar archivos; es otro proyecto |
| Conectar el MCP de Gmail | Configuración de Mani, no del CRM |
| La entrevista de Pau (general manager para JP) y la charla de inversiones | Otro tema de la misma grabación |

---

## 7. Lo que falta preguntar

**A Dani** (con el pipeline de HubSpot ya leído, paso 3):

- **QD-1:** dónde van **Pendiente Re-agenda, Seguimiento y Próxima Cohorte**, y qué distingue
  **Potencial, Registrado, En gestión y Contactado** entre sí (§4).
- **QD-2:** a qué etapa, propiedad y etiqueta va cada categoría de las hojas de gestión, y qué se hace con
  las rarezas del histórico (lo muy viejo, lo que ya estaba descartado) (GC-05, GC-06).
- **QD-3:** con el formulario nuevo (el puntaje de Alejo), qué respuesta es **no calificado** (Potencial) y
  cuál **calificado sin agenda** (Calificado) (GC-28).
- **QD-4:** qué etiquetas y propiedades son **obligatorias** en cada etapa: las que sin valor son bandera
  roja (GC-32).
- **QD-5:** el porcentaje de comisión de cada programa. Dani dijo *"mantener el porcentaje para los mismos
  80"*: en ComunicArte 80 sobre 797 es **10,04%**; en Tactical, 100 sobre 1.500 es **6,67%**. ¿Esos, o
  redondos? (GC-12).
- **QD-6:** de qué métricas son los umbrales, y cuántos días seguidos por debajo disparan la alerta (¿5
  para todas?) (GC-40).
- **QD-7:** el precio de Francisco: 800 o 600 (GC-49).

**A Mani** (técnicas o de producto):

- **QM-1:** ¿qué queda de los productos? Opciones: (a) se retiran y el programa lleva solo su ticket base;
  (b) se quedan como el *qué* se vendió (un programa con varias ofertas) y el precio deja de salir de
  ellos. Recomendación: **(b) si algún programa vende más de una oferta; si no, (a)**. Hay que mirar los
  productos cargados en producción (GC-10).
- **QM-2:** cuál es el **ticket base**: `programs.ticket_usd` o `cohorts.precio_usd` (hoy existen los dos).
  Recomendación: el de la cohorte, porque la meta en cash es de la cohorte y el precio puede cambiar entre
  cohortes (GC-11).
- **QM-3:** la próxima fecha de pago, ¿reemplaza a la fecha límite (ADR 0053) o vive al lado? Recomendación:
  **al lado**. La fecha límite es la promesa del Compromiso Verbal y mide la cartera vencida; la próxima
  fecha es la del siguiente cobro y ordena la lista (GC-14). Se cruza con lo que digan los closers (GC-17).
- **QM-4:** ¿la integración con la API de Grain entra después de v1 o no entra? (GC-21).
- **QM-5:** los cuatro pasos del onboarding, ¿fijos en el código o filas por programa? Recomendación:
  **filas por programa** (ADR 0012: el código no decide nada según cuál paso es; solo cuenta si están
  todos) (GC-43).
- **QM-6:** la meta del mes repartida **pareja por día hábil** (§5).
- **QM-7:** las ventas de una cohorte durante la ventana de la siguiente (§5, R-7).
- **QM-8:** ✅ en parte (Mani, 30-sep): **el norte comercial es la prioridad.** Sigue abierto qué hace el
  carril de Alejo mientras tanto con lo de pauta (119, 120, 125, 126): ¿se pausa o sigue en paralelo
  mientras no toque etapas ni dinero?

---

## 8. Los pasos

Uno a la vez, y cada uno se cierra antes del siguiente (Mani: *"paso por paso para no perder ningún
detalle"*).

| Paso | Qué | Sale | Estado |
|---|---|---|---|
| **1** | El inventario de la reunión contra el repo | este documento | ✅ 30-sep |
| **2** | Leer el HubSpot de 30X, solo lectura: las etapas con su definición, las etiquetas y propiedades de cada una (cuáles son obligatorias), "fecha corte" y "cortesías" (GC-52), y el dashboard "Gestión Comercial" gráfica por gráfica, con pantallazos | §4 lleno; el inventario de gráficas de GC-30 | 🔴 necesita el acceso de Mani |
| **3** | Las preguntas a Dani (QD-1 a QD-7) y a Mani (QM-1 a QM-8); Mani habla con 2 o 3 closers sobre abonos (GC-17) | §7 contestado | · |
| **4** | Las decisiones, con `/grill-with-docs`: el pipeline de 30X (reemplaza partes del ADR 0037 y el 0056), el valor vendido y la comisión por porcentaje (ADR 0016), Atendido sin Grain, el rol Customer Success, la meta del mes, los periodos flexibles | ADR nuevos y enmiendas | · |
| **5** | Los tickets: enmendar los vivos (117, 118, 078, 080, 122, 124, 089, 095, 128, 065, 069, 070, 071, 102, 062) y crear los nuevos | `tasks/` y el tracker | · |
| **6** | El orden: v1 comercial primero (R-9), y el cambio de etapas **antes** del `--aplicar` del 078. El 117 sigue: corrige el bug de Tactical (`analytics.md` §2.4) y su `etapa_entrada` se traduce en la misma migración que traduce `deals.etapa` | `plan.md` §5 y `plan-reparto.md` | · |

**Tickets nuevos que salen de aquí** (candidatos; el número se asigna al crearlos en el paso 5):

1. Las etapas de 30X: enum, transiciones, requisitos y la traducción de los deals e historial existentes (R-1).
2. Las etiquetas y propiedades por etapa, y el "sin valor" como bandera roja (GC-02, GC-32).
3. El valor vendido que escribe el closer, en 0 por defecto, y la comisión por porcentaje (GC-09, GC-12).
4. La próxima fecha de pago y la lista de cartera por fecha (GC-14, GC-15).
5. Atendido sin Grain: se acepta, se marca y se cuenta (GC-20).
6. El rol Customer Success y el onboarding en cuatro pasos (GC-42, GC-43).
7. La meta del mes y la página de Metas: avance, deuda y las dos compensaciones (GC-44, GC-45).
8. Los periodos flexibles y las series superpuestas, con número y porcentaje siempre (GC-36 a GC-38).
9. Toda cifra lleva a su lista (GC-34, GC-35).
10. Las alertas por días seguidos bajo el umbral (GC-40).
11. Generación de deals y agendas contra el mes anterior (GC-33).
