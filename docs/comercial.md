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
> **Estado: pasos 1 y 2 de §8 hechos; pasos 4 y 5 hechos para el lote 1 (1-oct):** ADR 0065, 0066 y
> 0067; tickets 132 a 141 (lote 1) y 142 a 148 (lote 2, bloqueados). QM-2 cerrada.
> **Paso 3 contestado por Mani (1-oct, §7.0)**; quedan QM-10 a QM-12 y el manual de Alejo (QD-8). **Paso 6
> hecho (1-oct)**: el orden vigente vive en `plan-reparto.md` §4 (etapas NC1 y NC2).
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
| GC-01 | Las etapas del CRM salen 100% de las del HubSpot de 30X: *"abarcan todo el universo y no se pisan"* | 11 etapas propias (`deals.etapa`, `pgEnum`) | El enum, la tabla de transiciones, los requisitos, el Kanban, el Inbox, el embudo y toda consulta que nombre una etapa | R-1 · §4 | ✅ las 11 etapas leídas (§4); 🔴 las reglas de movimiento esperan el manual de gestión comercial (QD-8) |
| GC-02 | Dentro de cada etapa hay **etiquetas y propiedades** que hay que entender y respetar | Motivos en 4 listas (ADR 0056), resultados de llamada (ADR 0015), "¿Cómo terminó?" con 6 botones | Probable: una etiqueta por etapa como catálogo (fila, ADR 0012) y propiedades exigidas por etapa | R-1 · §9.2 | 🔴 las etiquetas vistas están en §9.2; cuáles son obligatorias, QD-4 y QD-8 |
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
| GC-10 | Los descuentos no son productos: *"vas a crear un montón de productos distintos que nada que ver"* | Productos por programa (ADR 0016, 017) | ✅ QM-1 (Mani, 1-oct): un **ticket base por programa**; descuentos y pagos van en cada deal | R-3 · §9.6 | 🔄 |
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
| GC-30 | La referencia es el dashboard **"Gestión Comercial"** de HubSpot de 30X (*"los otros están dañados"*): tomar pantallazos y preguntar *"si fueras un gerente comercial, ¿cómo las mejorarías para tener información más analizable?"* | Dashboard por programa (064, 093, 089); 095 sin construir | Inventario de sus gráficas en el paso 2, cada una con su versión mejorada | 095 · §9.7 | ✅ inventario en §9.7 |
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
| GC-52 | *"Fecha corte, cortesías"* (nota de Mani al final) | Cortesías: DP-15 / PQ5 abierta | No salieron en lo leído de HubSpot (ni en la tarjeta ni en la ficha del deal) | §7 QD-9 | 🔴 QD-9 |
| GC-53 | Lo que falta, según la reunión: correcciones del pipeline, la parte visual, la API de marketing y consolidar las métricas | 34 tickets abiertos según Mani | Este documento es el insumo para rehacer esa lista | §8 | · |

---

## 4. El pipeline de 30X contra el nuestro (leído el 1-oct)

Leído en el tablero de Deals del HubSpot de 30X (pipeline "AI Second Brain", 9.767 deals, pantallazos
de Mani del 1-oct; §9.1). **Once etapas, en este orden y con estos nombres exactos.** La probabilidad es
la que HubSpot usa para el "weighted amount" de cada columna. La columna "La nuestra" sigue siendo una
**lectura**, no un mapeo: lo decide Dani (paso 3), y **las reglas para pasar de una etapa a otra no están
en HubSpot**: Mani las espera en un manual de gestión comercial de 30X (QD-8).

| # | 30X | Prob. | Deals hoy | La nuestra más cercana | Lo que se vio · la duda |
|---|---|---|---|---|---|
| 1 | Potencial | 20% | 76 | (no existe: hoy es Pendiente Setteo) | Estado inicial del no calificado (GC-28). 🔴 **"Potencial" es también una etiqueta** que aparece en deals de Registrado, En gestión, Contactado, Ganado Pagado Completo y Cierre perdido (§9.2): ¿qué significa cada una? (QD-1) |
| 2 | Registrado | 20% | 86 | (no existe) | ¿Qué la distingue de Potencial? Las dos tienen la misma probabilidad (QD-1) |
| 3 | En gestión | 20% | 1.008 | Pendiente Setteo con dueño, o En Contacto | La columna más llena de las tempranas. ¿Qué la distingue de Contactado? (QD-1) |
| 4 | Contactado | 40% | 2 | En Contacto | Casi vacía (2 deals): ¿se usa de verdad o se salta? |
| 5 | Calificado | 50% | más de 7.100 (el número se corta) | (no existe) | Estado inicial del calificado sin agenda (GC-28). Con 7.100 de 9.767 parece la etapa donde cae todo lo que entra; 🔴 confirmar con Dani |
| 6 | Agendado | no se vio | no se vio | Agendado | Fuera de los dos pantallazos del tablero |
| 7 | Atendido | no se vio | no se vio | Atendido | Fuera de los pantallazos. Sus etiquetas, según la reunión: *"interesado, debe consultarlo"*, *"interesado, problema de fecha o corte"*, *"no calificado"* (QD-4) |
| 8 | Compromiso Verbal | 80% | 2 | Compromiso Verbal | Etiquetas vistas: ALTO VALOR, Obsoleto |
| 9 | Ganado Pago Parcial | Won (100%) | 8 | Abonado | HubSpot lo cuenta como **ganado**, igual que nosotros (venta = Abonado o Completo, ADR 0037). La próxima fecha de pago (GC-14) no aparece en la tarjeta |
| 10 | Ganado Pagado Completo | Won (100%) | 191 | Completo | 🩸 Hay deals ganados con **Amount: $0**: el valor vendido que nadie escribió. Es justo lo que GC-09 evita obligando a escribirlo |
| 11 | Cierre perdido | Lost (0%) | 585 | Cierre Perdido | Sus etiquetas frente a nuestros motivos de pérdida (104); en las tarjetas solo se vio POTENCIAL y NURTURING |

**Lo que trae cada tarjeta del tablero:** nombre del deal con el molde **`<Nombre> | <Programa> | <Mes
Año de la cohorte>`** (ej. *"Ivan | AI Second Brain | Nov 2026"*), Amount, Deal owner, Create date (y
Close date en las cerradas), las etiquetas, el contacto asociado y la última actividad (*"a minute ago"*,
*"2 months ago"*). Al pie de cada columna, el total y el ponderado. Dos de esas cosas ya existen aquí (el
dueño y la cohorte); el nombre compuesto no hace falta guardarlo: se **deriva** del lead, el programa y la
cohorte (ADR 0024).

**Las nuestras sin etapa en 30X**, que hay que preguntarle a Dani (QD-1): **Pendiente Re-agenda**,
**Seguimiento** y **Próxima Cohorte**. Lectura: en 30X podrían ser etiquetas (*"interesado, problema de
fecha o corte"* se parece a Próxima Cohorte, y NURTURING a Seguimiento), pero eso lo dice Dani, no esta
tabla.

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

### 7.0 Respuestas de Mani a las QD (1-oct)

Mani las contestó en la sesión del 1-oct, en nombre del equipo comercial. Lo que sigue abierto quedó como
**QM-10 a QM-12** al final de la lista de Mani.

| QD | Respuesta (Mani, 1-oct) | Qué cambia | Estado |
|---|---|---|---|
| QD-1 | Lo que hace cada etapa ya está leído en [`insumos/hubspot-30x-workflow.md`](insumos/hubspot-30x-workflow.md) §3: **Potencial y Registrado son dos puertas de entrada** (parcial sin calidad; completo Low o Mid), un workflow los lleva a **En gestión** (la cola del setter), **Calificado** es la puerta del High, **Contactado** casi no se usa en B2C. Pendiente Re-agenda, Seguimiento y Próxima Cohorte: Dani dijo que **son estados dentro del deal, no etapas** | El 142 tiene su definición de etapas. Cómo se modela un "estado dentro del deal" es **QM-10** | ✅ etapas · 🔴 QM-10 |
| QD-2 | De las hojas hay solo dos destinos: **descartados y setteo → la cola del setter** (los descartados se recuperan con un envío masivo por Kapso, fuera del CRM: la mayoría son muy viejos) y **cerrados → ganado, en su cohorte, como estudiantes**. Con las etapas de 30X | Propuesta a confirmar: cola del setter = **En gestión**; cerrados = **Ganado Pago Parcial** o **Ganado Pagado Completo** según su saldo. El mapeo del 077/080 se rehace así en el 142 | 🟡 confirmar |
| QD-3 | Ya decidido en el **ADR 0069**: parcial sin calidad → Potencial; completo Low o Mid → Registrado; High → Calificado; agendó → Agendado | Nada nuevo | ✅ |
| QD-4 | Toda propiedad obligatoria que falte es **alerta roja**, sin grados: algo de una etapa anterior quedó sin llenar | El 143 y el 128 usan un solo nivel para "le falta algo"; cuáles son obligatorias por etapa sale del manual (QD-8) | ✅ |
| QD-5 | **Esos**: ComunicArte **10,04%** (80 sobre 797), Tactical **6,67%** (100 sobre 1.500) | Dato del 133; se carga por programa, no cambia el diseño | ✅ |
| QD-6 | Cinco días hábiles seguidos por debajo, **configurable**. "¿Umbrales de qué?": las métricas con umbral son las de la meta y el semáforo (DP-24); falta la lista | El 147 deja de estar bloqueado por el número; la lista de métricas es **QM-11** | 🟡 |
| QD-7 | El precio se elige **al crear el programa**; no se carga ahora. La configuración de la app (programas, precios, cohortes) **la hacen los usuarios según su rol**, no el equipo de desarrollo. Lo que sí se hace al final: un **manual de uso del CRM por rol**, enlazado dentro del CRM | Ticket nuevo **149** (manual por rol), al cierre de v1 | ✅ |
| QD-8 | El manual de gestión comercial **lo escribe Alejo** (Alejandro Dávila), con lo que ya leyó del HubSpot de 30X | Tarea de docs del carril de Alejo en NC1 (`plan-reparto.md`); el 142 lo espera. Borrador: [`manual-gestion-comercial.md`](./manual-gestion-comercial.md) | 🟡 Alejo |
| QD-9 | **"Corte" es Cohorte**, y ese es el nombre que se usa. Cortesía: un deal con **100% de descuento** (no cubre nada del valor), o una persona creada **directo como estudiante**, sin deal | Cuál de las dos es **QM-12** | 🔴 QM-12 |
| QD-10 | Las etiquetas de 30X **no se usan**. Solo **Lead Value** y **Lead Quality**, las que calcula el formulario | El 143 se encoge: sin catálogo de etiquetas, solo propiedades por etapa | ✅ |
| QD-11 | Si no cuadran es problema de 30X: los pantallazos eran referencia de qué sirve para Retia | Se cierra sin acción | ✅ |
| QD-12 | Nivel de Contacto se define en Retia **por la actividad del lead**: va a la pantalla de entrada de cada closer (deals que no ha movido, actividad vieja), como se habló con Dani. **Lead Quality** es la etiqueta que llega con el envío y se muestra en el deal | La pantalla de entrada del closer es el hub de Mi día (071, 075; A-05); Lead Quality en la ficha (139) | ✅ |

### 7.1 Las preguntas, como se hicieron

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
- **QD-8:** el **manual de gestión comercial** de 30X (Mani lo espera): cuándo y cómo se pasa de cada etapa
  a la siguiente, qué tiene que tener el deal para entrar, y quién lo mueve. Sin él, los requisitos de
  GC-04 no se pueden reescribir.
- **QD-9:** qué son **"fecha corte"** y **"cortesías"** y dónde viven: no salieron ni en las tarjetas, ni en
  la ficha del deal, ni en el dashboard (GC-52), y en el transcript (`insumos/reu-danieltovar.md`) son
  solo la nota de Mani al final, sin explicación. Una pista: en esa reunión **"corte" se usa por
  "cohorte"** (*"cada deal tiene su corte"*, *"eso es por corte"*, y la etiqueta *"interesado, problema de
  fecha o corte"*), así que "fecha corte" puede ser la cohorte o la fecha de inicio a la que va el deal,
  que aquí ya existen (`deals.cohort_id`, la ventana de venta del ADR 0022). "Cortesías": lectura, cupos
  regalados que cuentan como cupo y no como cash (DP-15 / PQ5). Las dos son lecturas, no datos.
- **QD-10:** las **etiquetas de deal** que se ven en las tarjetas (POTENCIAL, NURTURING, DESATENDIDO, ALTO
  VALOR, Obsoleto): la lista completa, qué significa cada una, quién la pone (a mano o un workflow), y si
  "POTENCIAL" etiqueta es lo mismo que "Potencial" etapa (§9.2).
- **QD-11:** las dos parejas de cifras del dashboard que no cuadran en el mismo mes (§9.7): CONTRATADO / MES
  dice 1.303.466 en septiembre y "$ contratado mes" 103.055; RECAUDO / MES dice 973.617 y "$ Recaudo mes"
  74.478. ¿Qué filtran sus "Filters (n)", y en qué moneda están? Y las CUPOS de las dos gráficas mensuales
  difieren en febrero a abril (127 contra 154, 345 contra 372, 212 contra 234).
- **QD-12:** qué hacen **NIVEL DE CONTACTO** (una sección de la ficha que se esconde por lógica condicional)
  y **Lead Quality** (High) en la operación: ¿alguien decide algo con ellos? (GC-29 dice que nadie mira el
  puntaje).

**A Mani** (técnicas o de producto):

- **QM-1:** ✅ **Mani, 1-oct: un ticket base por programa; los descuentos y los pagos se aplican en cada
  deal.** No hay varios productos por programa. En 30X hay un producto por programa y cohorte (175, con SKU
  tipo `aisecondbrain_noviembre_2026`, §9.6); aquí la cohorte ya es del deal, así que el SKU no hace falta.
  Lo que queda por decidir en el paso 4: si la tabla `productos` se retira o se queda como una fila por
  programa (GC-10).
- **QM-2:** ✅ **Mani, 1-oct: el ticket base es el de la cohorte** (`cohorts.precio_usd`; la C1 de ComunicArte fue 697 y la C2 797) y `productos` se retira (ADR 0065). Lo que sigue es la pregunta original: cuál es el **ticket base**: `programs.ticket_usd` o `cohorts.precio_usd` (hoy existen los dos).
  Recomendación: el de la cohorte, porque la meta en cash es de la cohorte y el precio puede cambiar entre
  cohortes (GC-11). ⚠️ Mani dijo *"un ticket base por programa"* (1-oct), lo que inclina a
  `programs.ticket_usd`; pero 30X fija el precio por cohorte (un producto por mes). Confirmar cuál de los
  dos quiso decir.
- **QM-9:** la ficha del deal de 30X muestra **Deal Insights** y **Deal Score** generados con IA (riesgos,
  metas del comprador, resumen; §9.3). En la reunión no hay un pedido de "insights": no aparece en el
  transcript (`insumos/reu-danieltovar.md`) ni en Granola. ¿Entra en v1, o es del MCP de después
  (GC-51)? Recomendación: **después**; en v1 la ficha muestra los datos y las alertas (128), que son
  deterministas.
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
- ✅ **QM-10 (1-oct, de QD-1), cerrada por el [ADR 0070](./adr/0070-re-agenda-seguimiento-y-proxima-cohorte-son-pendientes-del-deal.md):** son **Pendientes** del deal (enum nullable, a lo sumo uno), el deal se queda en su etapa y `moverEtapa()` escribe los dos. La pregunta original: Pendiente Re-agenda, Seguimiento y Próxima Cohorte son **estados dentro del
  deal** (Dani). ¿Qué son en la base: una propiedad del deal con su lista (fila de catálogo, ADR 0012), que
  convive con la etapa? ¿Y en qué etapa de 30X queda el deal mientras tiene uno de esos estados? Se decide con
  `/grill-with-docs` antes del 142, porque cambia el enum y la tabla de transiciones.
- **QM-11 (1-oct, de QD-6):** la lista de métricas que llevan umbral y alerta por persistencia (147).
  Recomendación: las del semáforo de la meta (DP-24) y nada más, para no inventar umbrales.
- **QM-12 (1-oct, de QD-9):** la cortesía, ¿deal con 100% de descuento o estudiante creado sin deal? 🩸 Las dos
  chocan con algo vigente: el ADR 0065 exige valor vendido **> 0** para entrar a Abonado o Completo, y un
  estudiante sale de un deal en venta (ADR 0037). Recomendación: **deal con valor vendido 0 y una marca de
  cortesía**, que la regla del 0065 acepte solo con esa marca: así cuenta como cupo, no como caja ni como
  venta en dinero, y deja rastro de quién la dio (DP-15 / PQ5).

---

## 8. Los pasos

Uno a la vez, y cada uno se cierra antes del siguiente (Mani: *"paso por paso para no perder ningún
detalle"*).

| Paso | Qué | Sale | Estado |
|---|---|---|---|
| **1** | El inventario de la reunión contra el repo | este documento | ✅ 30-sep |
| **2** | Leer el HubSpot de 30X, solo lectura: las etapas con su definición, las etiquetas y propiedades de cada una (cuáles son obligatorias), "fecha corte" y "cortesías" (GC-52), y el dashboard "Gestión Comercial" gráfica por gráfica, con pantallazos | §4 lleno; §9 (lo leído y el inventario de gráficas de GC-30); QD-8 a QD-12 y QM-9 | ✅ 1-oct, con pantallazos de Mani (Claude in Chrome no respondió). Lo que HubSpot no dice (reglas de movimiento, obligatorias, fecha corte, cortesías) quedó como pregunta |
| **3** | Las preguntas a Dani (QD-1 a QD-12) y a Mani (QM-2 a QM-9); Mani habla con 2 o 3 closers sobre abonos (GC-17) | §7 contestado | ✅ 1-oct, Mani (§7.0). Quedan QM-10 a QM-12 y el manual (QD-8, Alejo); falta GC-17 con los closers |
| **4** | Las decisiones, con `/grill-with-docs`: el pipeline de 30X (reemplaza partes del ADR 0037 y el 0056), el valor vendido y la comisión por porcentaje (ADR 0016), Atendido sin Grain, el rol Customer Success, la meta del mes, los periodos flexibles | ADR nuevos y enmiendas || ✅ lote 1, 1-oct: ADR 0065, 0066 y 0067. El lote 2 espera QM-10 y el manual (QD-8) |
| **5** | Los tickets: enmendar los vivos (117, 118, 078, 080, 122, 124, 089, 095, 128, 065, 069, 070, 071, 102, 062) y crear los nuevos | `tasks/` y el tracker || ✅ lote 1, 1-oct: enmendados 017, 044, 058, 060, 062, 072, 074, 089, 095 y 128; creados 132 a 149. Los del lote 2, cuando se desbloqueen |
| **6** | El orden: v1 comercial primero (R-9), y el cambio de etapas **antes** del `--aplicar` del 078. El 117 sigue: corrige el bug de Tactical (`analytics.md` §2.4) y su `etapa_entrada` se traduce en la misma migración que traduce `deals.etapa` | `plan.md` §5 y `plan-reparto.md` | ✅ 1-oct: etapas NC1 a NC3 en `plan-reparto.md` §4; desde el mismo día se trabaja por olas (ola O1) |

**Los dos lotes (Mani, 1-oct).** Los pasos 3 a 5 ya no van en serie para todo: el paso 3 espera a Dani, y la
mitad del trabajo no depende de él. Se parte en dos **lotes** por **dependencia**, no por persona. No es un plan
aparte: cada lote se reparte en las **olas** de [`plan-reparto.md`](./plan-reparto.md) §4 (desde el 1-oct; antes,
carriles por persona).

| Lote | Qué entra | Espera a | Carril |
|---|---|---|---|
| **Lote 1: ya, sin Dani** | (1) el dinero: valor vendido que escribe el closer (0 por defecto), ticket base por programa (QM-1; QM-2 por confirmar), comisión por porcentaje (el número de QD-5 se carga como dato, no cambia el diseño); (2) Atendido sin Grain como alarma y conteo (GC-20); (3) las reglas de pantalla: número y % siempre, selector de periodo A contra B con atajos relativos, clic hasta la lista (GC-34 a GC-38, §9.4); (4) crear un deal a mano (§9.1). Candidatos 3, 5, 8, 9, 11, 12 (sin las etiquetas), 13 y 14 de la lista de abajo: ninguno nombra una etapa | nada | Mani (motor, dinero, pantallas); la lista de Leads con filtros relativos toca el 072, de Alejo |
| **Lote 2: espera respuestas** | **Las etapas de 30X** (candidatos 1 y 2): enum, transiciones, requisitos, etiquetas por etapa y la traducción de deals, historial y estados de llegada **en una sola migración**; después el `--aplicar` del 078 y las secciones del dashboard (15), porque el embudo se cuenta por etapa. Y lo que espera otra respuesta: la próxima fecha de pago y la cartera (4), Customer Success (6), la meta del mes (7), las alertas por persistencia (10) | Etapas: QD-1 a QD-4, QD-8 (el manual) y QD-10. El 4: GC-17 y QM-3. El 6: QM-5. El 7: QM-6 y QM-7. El 10: QD-6 | Mani (motor, dinero) y Alejo (117, 078) |

En el lote 1, el paso 4 escribe los ADR de lo ya decidido (valor vendido y comisión, Atendido sin Grain, reglas de
pantalla) y el paso 5 crea esos tickets; los del lote 2 se crean **bloqueados** por sus preguntas. La
implementación la hace Codex ticket por ticket y la sesión principal revisa (`~/.claude/CLAUDE.md` §5).

**Tickets nuevos que salen de aquí** (candidatos; el número se asigna al crearlos en el paso 5):

1. Las etapas de 30X: enum, transiciones, requisitos y la traducción de los deals e historial existentes (R-1). → **142**
2. Las etiquetas y propiedades por etapa, y el "sin valor" como bandera roja (GC-02, GC-32). → **143**
3. El valor vendido que escribe el closer, en 0 por defecto, y la comisión por porcentaje (GC-09, GC-12). → **132, 133, 134**
4. La próxima fecha de pago y la lista de cartera por fecha (GC-14, GC-15). → **144**
5. Atendido sin Grain: se acepta, se marca y se cuenta (GC-20). → **135**
6. El rol Customer Success y el onboarding en cuatro pasos (GC-42, GC-43). → **145**
7. La meta del mes y la página de Metas: avance, deuda y las dos compensaciones (GC-44, GC-45). → **146**
8. Los periodos flexibles y las series superpuestas, con número y porcentaje siempre (GC-36 a GC-38). → **136**
9. Toda cifra lleva a su lista (GC-34, GC-35). → **137**
10. Las alertas por días seguidos bajo el umbral (GC-40). → **147**
11. Generación de deals y agendas contra el mes anterior (GC-33). → **138**
12. La ficha del deal reorganizada en los bloques de §9.3, con el origen crudo y el link de pago (enmienda el 074). → **139**
13. Crear un deal a mano desde la app (§9.3). → **140**
14. Filtros de fecha relativos en las listas: hoy, ayer, mañana, esta semana, este mes... sobre creado, última actividad y cierre (§9.4). → **141**
15. Las cuatro secciones del dashboard (§9.8); enmienda el 095. → **148**

---

## 9. Lo que se leyó en el HubSpot de 30X (paso 2, 1-oct)

Fuente: once pantallazos de Mani del 1-oct, sus notas y los transcripts en `docs/insumos/`
(`reu-danieltovar.md`, la reunión del 30-sep que mapea este documento; `reu-pauta.md`, la del 29-sep, que
ya está mapeada en `analytics.md`). Los pantallazos son de Mani porque Claude in Chrome no respondió en ninguno de los dos Chrome
conectados. **Solo lectura: nada se movió en HubSpot.** Lo que HubSpot no muestra (las reglas
para mover entre etapas, qué propiedad es obligatoria, "fecha corte", "cortesías") no se infiere: queda
como pregunta en §7.

**Lectura por API (1-oct, solo lectura), que completa los pantallazos:**
[`insumos/hubspot-30x-workflow.md`](insumos/hubspot-30x-workflow.md) cuenta el recorrido de un deal de punta
a punta: quién mueve cada etapa, qué llena el closer, los workflows reconstruidos desde el historial, las
integraciones y las etiquetas. [`insumos/hubspot-30x-catalogo.md`](insumos/hubspot-30x-catalogo.md) es el
anexo completo: los 22 pipelines con sus etapas y conteos, y todas las propiedades con sus opciones. Contesta
en parte la QD-1 (Potencial y Registrado son dos puertas de entrada, no dos pasos: formulario parcial frente a
completo con calidad baja o media) y la QD-4 (los resultados de la reunión atendida son la propiedad
*Resultado de reunión completada*, con 12 valores). Los nombres de las etiquetas y las reglas de los workflows
siguen sin leerse: la llave no tiene el scope `automation`.

### 9.1 Deals: el tablero

- Kanban por etapa (§4) con selector de **pipeline** arriba a la derecha. **En 30X un pipeline es un
  programa** (AI Second Brain, AI Sales, Sales Machine, Fundraising School...): es el mismo corte que aquí
  hace el programa, que es **frontera**, no filtro (ADR 0043). Nada que copiar.
- Vista tablero o tabla, y vistas guardadas como pestañas (*"My deals"*, *"Cierres sin atribuciones"*).
  La segunda es interesante: una vista guardada para encontrar ventas sin origen, que aquí es la cifra
  "sin UTM / sin clasificar" del dashboard (093).
- Filtros rápidos: **Deal owner, Create date, Last activity date, Close date** y "Advanced filters". Las
  fechas se filtran con periodos relativos (§9.4).
- Al pie de cada columna, total y ponderado por probabilidad. ⚫ El ponderado no se copia: aquí no hay
  probabilidad por etapa y una cifra "ponderada" sin calibrar se ve creíble y no significa nada. La
  conversión real entre etapas sale del historial (`deal_etapa_historial`).
- **Mani, 1-oct: se pueden crear deals a mano** (HubSpot tiene "Add deals"). Hoy un deal solo nace de la
  regla de ingesta (052) o de reaplicar. Crear uno a mano tiene que pasar por el mismo escritor y respetar
  el índice de un deal abierto por lead y programa (ADR 0037): el alta manual elige un lead existente o crea
  el lead primero, nunca un deal suelto.

### 9.2 Las etiquetas de los deals

Vistas en las tarjetas: **POTENCIAL** (amarilla), **NURTURING** (gris), **DESATENDIDO** (roja), **ALTO
VALOR** (azul), **Obsoleto** (gris) y un sello **30X** en un ganado. Lectura de lo visto, sin decidir:

| Etiqueta | Dónde aparece | Lectura (por confirmar, QD-10) |
|---|---|---|
| POTENCIAL | Registrado, En gestión, Contactado, Ganado Pagado Completo, Cierre perdido | Calificación del lead que llegó, no la etapa: lo mismo que `lead_quality` / `lead_value` aquí (0041) |
| NURTURING | Potencial a Cierre perdido | El lead está en seguimiento de marketing (correos), no del closer |
| DESATENDIDO | Contactado | Nadie lo ha trabajado a tiempo. Aquí es una **alerta derivada** (128), no algo que se escribe |
| ALTO VALOR | Calificado, Compromiso Verbal, Ganado Pago Parcial | Contraparte de POTENCIAL: el lead bueno |
| Obsoleto | Compromiso Verbal | Un deal viejo que nadie cerró |

🔴 Cuáles son obligatorias por etapa no se ve en HubSpot (QD-4, QD-8). Lo que sí se decide aquí: una
etiqueta que el código puede calcular (DESATENDIDO, Obsoleto) se **deriva** y no se guarda (ADR 0024),
porque guardada envejece; una que es juicio del closer o del formulario es una fila de catálogo (ADR 0012).

### 9.3 El deal por dentro

Lo que muestra la ficha de un deal en 30X, de izquierda a derecha:

| Bloque | Qué trae | Aquí hoy (074 y 073) |
|---|---|---|
| Cabecera | Nombre, Amount, Close Date, Pipeline, Deal Stage; acciones Note, Email, Call, Task, Meeting | Cabecera, etapa por el motor, actividades (`contacto` o `nota`) |
| **ORIGEN** | UTM Campaign, UTM Medium, UTM Source (los tres *"(CRM)"*) y **Origen del deal** (*"Lead magnet propio (Typeform)"*) | El envío de origen está guardado (`submission_origen_id`); la ficha no muestra los UTM crudos |
| **Perfil de negocio** | Deal owner, **Lead Quality** (High), Empresa, Cargo, Producto Principal y su SKU, y las respuestas del formulario con prefijo *"30X ·"*: Disposición a invertir, Perfil profesional, Qué describe tu negocio (fit), Urgencia de empezar, decision_maker, Motivación | Las respuestas viven en el envío (`respuestas`), legibles en la ficha del lead (073, sin construir) |
| Pestañas centrales | Overview, Activities, **Billing**, Campañas, Whop (testing) | Pago y abonos en la misma pantalla (074) |
| Overview | NIVEL DE CONTACTO (se esconde por lógica condicional), **Deal Insights** (IA: riesgos, metas del comprador) y **Deal Score** (IA: resumen) | Las alertas del deal (128), deterministas |
| **Agenda** (derecha) | Owner del deal con su correo, programa con el *event-type* de Calendly, **link de agenda** con Copiar y Abrir (*"Powered by 30x Billing"*) | Las llamadas de Calendly cuelgan del deal (096); el link de agenda del closer no se muestra |
| Contacts | Nombre, cargo, correo, teléfono, LinkedIn, con copiar | El lead del deal, con sus contactos |

**Lo que Mani pidió para la ficha (1-oct)**, que es lo que el closer necesita a mano: el detalle del deal,
el lead (o los leads) asociado, **el origen con los datos crudos del envío**, las notas, la agenda y las
llamadas, **el log de eventos** del deal (qué se le aplicó, cuándo se movió), la **facturación con link de
pago**, la pregunta del origen del deal (es el origen declarado de DP-4, ticket 121: el closer lo elige
al cerrar, y solo cuenta en la burbuja "sin UTM · según el comercial"), el descuento, y las etiquetas de lead quality y lead value. Y
el cambio de fondo: **un ticket base por programa**, y los descuentos y los pagos se aplican en cada deal
(QM-1, R-3). La reorganización enmienda el 074 en el paso 5; el log ya existe como historial de etapas y
rastro (`change_log`, ADR 0042) y su pantalla es el 076.

### 9.4 Filtros de fecha relativos

HubSpot filtra Create date, Last activity date y Close date con periodos con nombre: hoy, ayer, mañana,
esta semana, este mes, etc. Aquí los rangos son fechas sueltas. La propuesta: **un solo selector de
periodo**, con los nombres relativos y el rango libre, que use la lista de deals, la de leads y el
dashboard (es el mismo control de GC-36), calculado en hora de Bogotá con `hoyEnBogota()` y nunca con la
zona del navegador.

### 9.5 Leads

La pestaña Leads de HubSpot es una **tabla tipo hoja**, con filtros por Lead stage, Lead Owner, Lead Type y
**Lead source** (Organic search, Paid search, Email marketing, Organic Social, Referrals...). En 30X está
casi sin uso (la vista filtrada mostró 0 leads): el trabajo vive en Deals. Aquí la base de leads es el 072
(en curso); lo que suma HubSpot es **filtrar por origen**, que aquí es el Canal y su Área (101), no una
lista fija como la de HubSpot.

### 9.6 Productos

Tabla con Name, Status, SKU, Tax Category y Unit price: **175 productos**, uno por programa y cohorte
(*"AI Second Brain · Nov · 2026"*, `aisecondbrain_noviembre_2026`). Mani, 1-oct: aquí **no** se copia;
cada programa lleva un ticket base y lo demás va en el deal (QM-1).

### 9.7 El dashboard "Gestión comercial", gráfica por gráfica

Filtros del tablero: **Equipo, Owner, Programa, Fecha de reunión** y "Advanced filters". Dos bloques con
título: VIEW GENERAL y GESTIÓN COMERCIAL. Ninguna gráfica dice qué hay en sus "Filters (n)" sin abrirla
(QD-11). Columna "Va a": la sección de §9.8 donde vive su versión mejorada.

| # | Gráfica | Qué mide | Periodo y comparación | Lo que se lee y el problema | Va a |
|---|---|---|---|---|---|
| 1 | CONTRATADO / MES | Valor total vendido y CUPOS por mes de cierre, ene a sep, dos líneas | Mes a mes, sin comparación; Filters (3) | Eje **logarítmico** (100 a 100M): los cupos y la plata en la misma escala aplastan la variación. Sep: 1.303.466 y 549 cupos | Dinero |
| 2 | $ contratado mes | Suma de Amount por fecha de cierre | *This month so far, daily*, contra el mes pasado; Filters (2) | El 1-oct solo se ve el punto del mes anterior (103.055). No cuadra con la #1 (QD-11) | Pulso |
| 3 | $ contratado mes - Clon | Lo mismo que la #2 en barras | Igual; Filters (3) | **Duplicada** con un filtro de más que no se ve | (se retira) |
| 4 | RECAUDO / MES | Recaudo y CUPOS por mes | Mes a mes por **Close date** | 🩸 El recaudo agrupado por la fecha de **cierre** del deal y no por la del pago. Aquí la caja va por fecha del abono (regla dura) | Dinero |
| 5 | $ Recaudo mes | Gross amount por **Payment date** | Mes en curso diario contra el pasado | Esta sí usa la fecha del pago; contradice a la #4 (74.478 contra 973.617, QD-11) | Pulso |
| 6 | FACTURACIÓN / COHORTE FUTURO | Valor vendido y número de deals por producto (SKU) | Sin periodo visible; Filters (3) | Lo vendido para cohortes que no han empezado. Log otra vez; SKUs *"tbd"* mezclados con meses | Dinero |
| 7 | Generación de deals | Deals creados por día | Mes en curso contra el pasado; Filters (1) | 4 contra 358: el día 1 contra el mes entero, cifra sin porcentaje | Operación |
| 8 | Reuniones agendadas (creación) | Reuniones por fecha en que **se agendaron** | Mes en curso contra el pasado | Mismo problema de lectura que la #7 | Operación |
| 9 | Reuniones agendadas (Ocurrencias) | Reuniones por fecha en que **ocurren** | Mes en curso contra el pasado | 89 contra 54. Junto a la #8 es la distinción correcta (agendar no es atender) | Operación |
| 10 | Agendas / semana | Deals con reunión por semana, apilados por closer | Semanas, incluidas las futuras; Filters (7) | Mezcla semanas pasadas con agendas futuras; la leyenda tiene 2 páginas de closers | Operación |
| 11 | Resultado de agendas por semana | Programada, Reprogramada, No asistió, 100% apilado | Semanal | **94% "Programada" en una semana que ya pasó**: el resultado nunca se cerró. Es el "no value" de GC-32 hecho gráfica | Pulso (bandera roja) y Operación |
| 12 | Agendas | Deals con reunión por día, apilados por closer | Diario; Filters (6) | Leyenda de 5 páginas: ilegible por closer | Operación |
| 13 | Resultado de agendas por día | Como la #11, por día | Diario; Filters (5) | Mismo 94% sin cerrar | Operación |
| 14 | Deals con agenda creados | Deals con agenda por pipeline (programa) | Esta semana contra la pasada | Las series se llaman **"39" y "40"** (números de semana) sin decirlo; sin porcentaje de cambio | Operación |
| 15 | Estado de agendas | Programada contra Reprogramada, barra 100% | Filters (7) | Repite la #11 sin periodo | (se funde con la #11) |
| 16 | % GANADOS / SHOW UP | Cierre sobre asistencia | Filters (7) | Vacía en el pantallazo | Operación |
| 17 | % GANADOS / SHOW UP / SE(mana) | Lo mismo por semana | Filters (7) | *"No data in this time frame"* | Operación |
| 18 | % GANADOS / SHOW UP / PROGRAMA | True / False por pipeline, 100% | Filters (7) | Porcentajes sin el número debajo (50% de cuántos) | Operación (por programa, lado a lado, ADR 0048) |

**Cómo las mejoraría, como gerente comercial.** Tres reglas para todas, que son las de la reunión, y una
mejora propia de cada una:

- **Periodo flexible (GC-36).** Toda gráfica toma el selector de §9.4: rango A contra rango B elegidos, más
  los atajos (semana pasada, semana 1 de este mes contra semana 1 del mes pasado, mismo día hábil del
  periodo anterior). Comparar *"this month so far"* el día 1 contra el mes entero (#2, #7, #8) es el error
  que esto quita: la comparación por defecto es **contra el mismo punto del periodo anterior**, que es lo
  que ya hace el comparativo de cohorte (DP-16).
- **Número y porcentaje siempre (GC-38).** Toda cifra lleva su variación (*"358 → 4, −99%"*), todo
  porcentaje lleva su base (*"50% de 12"*), y todo eje es lineal: una escala logarítmica (#1, #4, #6) no
  deja leer la variación de un vistazo, que es lo único que se busca en un daily.
- **Clic hasta el detalle (GC-34, GC-35).** Toda barra, punto o celda abre la lista de deals que la forman,
  con closer, etapa, antigüedad y enlace al deal.

| # | La mejora propia |
|---|---|
| 1 | Separar cupos y plata en dos gráficas, o dos ejes lineales; agregar la línea de meta del mes (§5) |
| 2, 5 | Acumulado del mes contra el acumulado del mes anterior **al mismo día hábil**, con la meta del mes como tercera línea y la deuda en número y % |
| 3, 15 | Se retiran: son copias. Una cifra, una definición (la regla de `saldo.ts`) |
| 4 | Recaudo por fecha del abono, siempre; al lado, la cartera por cobrar del mes por su próxima fecha de pago (GC-15) |
| 6 | Por cohorte y no por SKU (aquí no hay SKU), con meta de cupos de cada cohorte y su avance |
| 7, 8 | En una sola gráfica, con la razón agendas / deals creados como tercera serie: si los deals suben y las agendas no, llegan leads peores (GC-33) |
| 9 | Ocurridas contra atendidas: la diferencia es el no-show, en número y % |
| 10, 12 | Pasado y futuro separados (las futuras son agenda, no resultado); por closer como **comparativo** (filas), no como color apilado con leyenda de 5 páginas |
| 11, 13 | La porción "sin resultado" de una reunión que ya pasó es **roja** y abre la lista de esas llamadas con su closer (GC-32) |
| 14 | Las series con nombre (*"semana del 22-sep"*), y el cambio en % por programa |
| 16-18 | Un embudo por programa: agendas → ocurridas → atendidas → ganadas, cada paso en número y %; los programas lado a lado, nunca sumados (ADR 0048) |

### 9.8 Las secciones del dashboard (propuesta)

Mani propuso tres grupos (Operación comercial, Performance, Pauta). La propuesta son **cuatro**, por una
razón: Dani abre el dashboard en el daily delante de todos (GC-39), y esa pantalla tiene que contestar
*"¿vamos bien?"* sin clics; el análisis vive debajo. Esa primera sección es la página de Metas que pidió
Dani (GC-45), no una página más.

| Sección | Pregunta que contesta | Qué lleva | De HubSpot | Para v1 |
|---|---|---|---|---|
| **Pulso** (Metas) | ¿Vamos bien hoy? | Meta del mes y de la cohorte, avance, deuda y las dos compensaciones (§5); contratado y recaudo del mes contra el mismo punto del anterior; banderas rojas (sin resultado, Atendido sin Grain, sin valor, GC-20, GC-32); alertas por persistencia (GC-40) | 2, 5, 11 | Sí |
| **Operación comercial** | ¿Dónde se traba el embudo, y con quién? | Embudo por etapa en número y %; deals creados contra agendas (GC-33); agendas creadas, ocurridas y su resultado; show-up y cierre; comparativo entre closers (ADR 0023); tiempos entre etapas; motivos de pérdida | 7-10, 12-14, 16-18 | Sí |
| **Dinero** (Performance) | ¿Cuánto entró, cuánto falta y de qué cohorte? | Contratado (valor vendido), recaudo por fecha del abono, cartera por cobrar por próxima fecha (GC-15), descuento promedio (valor vendido contra ticket base), comisión, ventas por cohorte, la futura incluida | 1, 4, 6 | Sí |
| **Pauta y origen** | ¿Qué canal trae ventas y a qué costo? | Leads, agendas y ventas por canal, campaña y anuncio; sin UTM y sin clasificar (siempre las dos); CPL, **costo por agenda**, costo por venta, ROAS; paid contra orgánico superpuestos (GC-37) | (no hay en este dashboard) | No: después de v1 (R-9) |

Dos decisiones dentro de la propuesta: **el costo por agenda va en Pauta** aunque comercial lo mire, porque
necesita el gasto de Meta (119, 120) y en v1 no existe; y los filtros de todo el dashboard son los de
HubSpot menos "Equipo": **programa (frontera, con "todos" solo para sumas, ADR 0048), owner y periodo**,
porque aquí el equipo es el programa (GC-31).

### 9.9 Los pantallazos

Los once pantallazos **no se guardan en el repo**: cuatro traen datos personales de clientes de 30X
(nombres, correos, teléfonos) y los demás, cifras internas de 30X. Lo que sirve de ellos está transcrito
arriba sin datos personales. Si hacen falta como referencia visual, van a una carpeta privada de Mani, no
a git.
