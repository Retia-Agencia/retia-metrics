---
type: note
origen: fusión de dos notas del second brain de Mani
updated: 2026-09-20
fusionado: 2026-09-21
---

> **Nota de fusión.** Este archivo junta dos notas del vault que reconstruían lo mismo el mismo día
> (2026-09-20, leyendo los dos Sheets completos y los `.gs` de Apps Script) y decían, en buena
> parte, lo mismo:
> - `mani_vault/02 Projects/retia/notebook/flujo-de-leads-retia.md` — el recorrido completo de un
>   lead, de punta a punta (anuncio → formulario → setteo/agenda → llamada → venta → cartera →
>   atribución), con el mapa a las entidades del CRM.
> - `mani_vault/02 Projects/retia/notebook/flujo-closers-retia-sheets.md` — el mismo tramo inicial
>   (captación → llamada), pero con la evidencia sacada directo del código de los `.gs`: quién
>   escribe cada columna, por qué, y con qué bugs.
>
> **Dónde son más *accurate* una que la otra:** donde se solapan, la segunda es la más confiable
> porque cada afirmación cita su prueba en el código o en los datos (timestamps, conteos de filas,
> el incidente real de los 462 leads perdidos), mientras que la primera, para esa misma parte, ya
> se apoyaba en la segunda ("el detalle, con la evidencia, está en flujo-closers-retia-sheets"). La
> primera aporta lo que la segunda no cubre: venta, cartera, atribución y el mapa a entidades del
> CRM. Este archivo usa la primera como columna vertebral y mete la evidencia de la segunda donde
> corresponde, sin repetir cifras que ya coinciden. Los `[[wikilinks]]` no resuelven aquí.
>
> Los originales siguen intactos en el vault (no se tocaron); si más adelante quieres que la fusión
> también viva allá, dilo y se reemplazan por una nota consolidada con redirect.

# Flujo de un lead en Retia (estado actual, previo al CRM)

Cómo se mueve hoy un lead desde que ve un anuncio hasta que es estudiante, tal como funciona en los
dos Google Sheets de closers (De Cero a Tactical Investor y ComunicArte). Es el "antes" que el CRM
reemplaza. Reconstruido el 2026-09-20 leyendo los Sheets completos y los seis `.gs` de Apps Script
de cada uno (copia en `work/retia/apps-script-sheets/`; de ComunicArte no hay `.gs` propios, su
hoja se ve como una copia anterior y más simple del mismo sistema de Tactical). Lo que sale de los
datos o del código está marcado como hecho; lo que es inferencia o pregunta abierta, como tal.

Vocabulario del CRM (repo `retia-metrics-mani`, ADR 0012 a 0034): **people** (el lead),
**calls** (llamadas), **sales** (ventas), **abonos** (pagos), **cohorte**, **source** (la hoja de
donde sale un programa). Los estados del lead se guardan **como vienen de la hoja**, no como enum
(ADR 0032).

De Cero a Tactical Investor (sheet): https://docs.google.com/spreadsheets/d/1DBKL4zwWWeJppe-6mzpJ4jT1G6MdEmT1Dd_uMiNBNwc/edit?pli=1&gid=1626851764#gid=1626851764
ComunicArte (sheet): https://docs.google.com/spreadsheets/d/1NN6rlZXJJcgvWXYsbP99vLt9aj7FXVPd6ep4ULAcK54/edit?pli=1&gid=406073709#gid=406073709

## 1. Recorrido en una vista

```
Anuncio o contenido orgánico
   └─ Typeform del programa (uno por programa, con UTM)
        └─ Pestaña cruda del Sheet ("intake": una fila por envío)
             └─ Script (cada 10 min) escribe Estado y copia la fila
                  ├─ 🗑️ Descartado ................ fin (salvo re-registro)
                  ├─ 📅 Con Calendly (Juanito) ..... el lead agendó solo, no se copia a pestaña
                  │        └─ llamada con un closer
                  │             └─ el closer la registra a mano en "Registro de llamadas"
                  │                  ├─ cierra ──► "Estudiantes <cohorte>" ──► cartera si paga a cuotas
                  │                  └─ no cierra ► follow up / reagenda / rechazo / próxima cohorte
                  └─ 📞 Setteo No Calificado ..... califica en intención pero no agendó
                           └─ un closer o setter le escribe por WhatsApp (trazas de Kapso)
                                └─ si agenda, entra al mismo camino de llamada
```

**En el sheet el estado es una pestaña.** Mover un lead de estado es copiar su fila a otra hoja. En
el CRM eso pasa a ser un campo `stage` y las pestañas pasan a ser vistas.

## 2. Etapas

### 2.1 Captación y formulario

Cada programa tiene su Typeform. Trae ocho preguntas: nombre, correo, WhatsApp, ingreso mensual,
motivación, urgencia, situación profesional y **si está dispuesto a invertir el precio del programa**
(1.500 USD en Tactical, 697 USD en ComunicArte), más cinco UTM (`source, medium, campaign, term,
content`), la fecha de envío (`Submitted At`, **el reloj de la celda va en UTC, cinco horas
adelante de Bogotá**, confirmado) y un `Token` por envío. Además llegan filas parciales aparte con
el mismo token (ver "Parciales y duplicados"); no está verificado qué mecanismo las escribe.

El formulario **bifurca**: solo quien pasa el umbral de ingreso y dice que sí puede pagar ve el paso
"Agenda aquí tu entrevista" (Calendly). El umbral vive en Typeform, **no en el Sheet**: Tactical
ingreso de 3.000 USD o más (dato observado: los 345 con Calendly ganan 3.000+); ComunicArte desde
~1.000 USD (observado, no confirmado). **Confirmado leyendo el código de Tactical**: el `.gs` no usa
el ingreso para nada — al sheet solo le importan tres cosas: si respondió el pago, si dijo "no tengo
recursos", y si trae link de Calendly. La regla de los 3.000 USD la aplica el Typeform, antes de que
la fila llegue al Sheet.

### 2.2 Intake crudo

El Sheet recibe una fila por envío en la pestaña cruda (`De Cero a Tactical Investor` en Tactical,
`New form` en ComunicArte). En ComunicArte hubo un formulario anterior (`Forms viejo`, 20 al 22 de
julio) con redacción distinta.

### 2.3 Clasificación (automática, cada 10 minutos)

Un script lee las filas nuevas y escribe la columna `Estado` (solo si estaba vacía). **Quién pone el
`Estado`, con prueba en los datos** (no es Typeform, como parecía a primera vista): el código dice
que lo escribe `procesarLeadsNuevos()` cada 10 minutos, y el script **salta** toda fila que ya
traiga `Estado`. Tres pruebas independientes lo confirman: (a) en Tactical, las 152 filas de Setteo
y Descartado revisadas entre el 16 y el 20 de septiembre traen sello de copia a los pocos minutos de
llegar; (b) los sellos caen en minutos terminados en 8 (`17:08`, `18:28`, `19:38`), el ritmo del
disparador de 10 minutos; (c) si Typeform escribiera `Estado`, esas filas no se habrían copiado a su
pestaña. Lo que sí decide Typeform es quién ve el Calendly (§2.1). Prueba fácil para confirmar en
vivo: mandar un lead de prueba y mirar la columna Q apenas caiga.

Reglas, en orden (idénticas en Tactical y ComunicArte — ComunicArte no tiene ingreso en el código
tampoco):

1. No respondió la pregunta de pago: **🗑️ Descartado**. Razón `Duplicado - respuesta parcial` si el
   mismo `Token` tiene otra fila con pago (Typeform guarda respuestas parciales como filas aparte
   con el mismo token); si no, `Respuesta incompleta`.
2. Respondió "no cuento con los recursos": **🗑️ Descartado**, razón `Sin recursos`.
3. Trae link de Calendly: **📅 Con Calendly (Juanito)**. No se copia a ninguna pestaña; queda en la
   hoja cruda. "Lo maneja Juanito."
4. Todo lo demás: **📞 Setteo No Calificado**. Se copia a la pestaña Setteo, deduplicado por correo
   o teléfono (8+ dígitos). Si ya estaba, se marca "Ya estaba" y **no se agrega**: la re-inscripción
   no genera evento ni conserva su UTM nuevo.

Cifras al 2026-09-20. Tactical: 3.949 filas, Descartado 2.071 (52%), Setteo 1.532 (39%), Con
Calendly 345 (9%). De los descartados de Tactical, 1.152 son parciales o duplicados y solo 919 son
"sin recursos" reales. ComunicArte: 2.247 filas, Descartado 1.024, Setteo 901, Con Calendly 322.

#### Parciales y duplicados (medido en Tactical, 2026-09-20)

Hay tres fenómenos distintos que hoy se mezclan bajo la palabra "duplicado".

1. **Entregas parciales, siempre antes de la completa.** 3.950 filas son 3.027 tokens. En 880 tokens
   hay dos filas: una **parcial** (sin la pregunta de pago, con `Submitted At` en placeholder
   `1/1/0001`) y, justo después en la hoja, la **completa**. Nunca al revés (916 parciales antes, 0
   después). Son 1.152 filas parciales: 916 tienen su completa y **236 quedaron huérfanas**, es
   decir alguien que empezó y se fue. La parcial ya trae correo (1.143) y teléfono (1.152). **193
   correos solo existen como parcial**: no son descartados por falta de recursos, son abandonos
   contactables.
2. **Re-envíos de la misma persona.** 245 correos enviaron más de un formulario completo (291
   envíos repetidos), con mediana de 8 días entre el primero y el segundo (p90: 45). Secuencias de
   estado: `Setteo > Setteo` 106, `Descartado > Descartado` 35, **`Descartado > Setteo` 29** (dijo
   que no tenía recursos y luego sí), **`Setteo > Calendly` 9** (estaba en la cola y terminó
   agendando), `Setteo > Descartado` 15. El script hoy ignora el segundo envío de Setteo ("Ya
   estaba"), así que esos movimientos no quedan registrados y el lead de la cola sigue "Pendiente"
   aunque ya agendó. Los closers lo descubren a mano: hay unas 50 notas tipo "Es duplicado. Ya había
   agendado".
3. **Identidad ambigua.** 37 teléfonos aparecen con más de un correo y 18 correos con más de un
   teléfono. Tactical deduplica por correo **o** teléfono, así que un teléfono compartido (familia,
   número de otra persona) puede suprimir a alguien distinto sin que nadie se entere.

Consecuencia de diseño: una fila del Sheet **no es un lead**, es una versión de un envío. Regla
natural: el envío se identifica por `Token`; dentro de un token gana la fila completa; la parcial es
un evento de "inició" y no un lead; y la persona se identifica por correo, con el teléfono como
pista que pide revisión humana. El script actual evalúa cada fila cuando la ve, cada 10 minutos, y
su regla de "duplicado" depende de que la hermana completa ya exista en ese instante. Si alguien
tarda más de una corrida en terminar el form, la parcial puede clasificarse como incompleta antes de
que llegue su completa. El CRM debe recalcular al llegar la hermana, no decidir una sola vez.

### 2.4 Setteo (outbound sobre quien no agendó)

Es una cola de leads que quieren pero no agendaron, o que pueden pagar solo con facilidades.
Columnas de gestión: `Estado gestión` (Pendiente, En proceso, Agendado, No interesado, Cerrado),
responsable (en ComunicArte, `Closer asignado`), fecha de contacto y hasta cinco notas `Registro`,
en texto libre. El contacto es por WhatsApp, con trazas de Kapso ("Contactado por Kapso", "Error al
contactar por Kapso"). Tactical: Pendiente 701, En proceso 633, Agendado 58, No interesado 11,
Cerrado 4 — solo la mitad tiene algún registro. Casi no cierra ventas directamente (4 y 3
"Cerrado"): su función es convertir en agenda.

**Reparto: round-robin ciego, con prueba en el código.** Cada lead nuevo de Setteo recibe
`Responsable` rotando entre `Andrea, Dana, Sebastian, Alejo` (lista fija `MIG.CLOSERS` en el `.gs`).
No mira carga, ni show rate, ni si el closer está activo. Jero, Maru y Michael aparecen como
responsables en la hoja pero no están en esa lista: se asignan a mano. En Tactical el responsable
está vacío en 857 de 1.409 filas — no es abandono: es un rescate del 05/09 (el código lo llama
"LEADS VIEJOS RECUPERADOS") más una época en que `Estado gestión` y `Responsable` estaban
intercambiadas. En ComunicArte, en cambio, **todas** las filas tienen "Closer asignado" (Andrea 366,
Juanjo 249, Dana 183, Maru 24): son **dos modelos de reparto distintos** entre los dos programas.

### 2.5 Agenda y llamada

Quien agenda por Calendly queda con estado `Con Calendly (Juanito)`. Los scripts dicen que "lo
maneja Juanito" (la automatización que atiende a los que agendan; su alcance no está en los Sheets,
no se leyeron sus scripts). El closer hace la llamada y **registra a mano una fila en `Registro de
llamadas`**: fecha, closer, lead, `Show` (Sí/No), `Cierre` (Sí/No), link (Calendly o Grain), notas
`Registro 1-5`, categoría y subcategoría si no cerró, y cartera.

Categorías de no cierre (dropdown): FINANCIERO (FIN-1, FIN-2), FIT/PRODUCTO (FIT-1 a FIT-3), FOLLOW
UP (FU-1 a FU-5), RECHAZO DIRECTO (RD-1) y PENDIENTE RE AGENDA (PRA). **Se usan poco**: en Tactical
hay 62 categorías puestas y solo ~19 subcategorías; el seguimiento real vive en texto libre ("follow
up programado martes", "pago 800 pendiente 700", "no contesta, 2 follow up").

Tactical: 184 llamadas registradas, show 55,4% (102), cierre 28,4% sobre shows (29). ComunicArte:
235 llamadas, show 43,8% (103), cierre 49,5% sobre shows (51). **Andrea hace la mayor parte de las
llamadas**: 125 de 189 filas en Tactical (66%), 194 de 256 en ComunicArte (76%). El resto: Dana,
Alejo, Sebastian, Maru, Juanjo.

### 2.6 Venta y estudiante

Cada cohorte tiene su pestaña de estudiantes. Una fila por venta: nombre y contacto, closer, precio,
tipo de pago (Total o Parcial), plataforma (MercadoPago, Hotmart, PayPal, Bancolombia, Binance,
Global66), factura electrónica, mail de onboarding, acceso a WhatsApp, acceso a la plataforma, link
de la llamada, origen (UTM y correo, ambos por `VLOOKUP` al correo) y pendientes de bonos. Desde
septiembre separan `Cash collected` de `Precio final`. La misma pestaña **calcula la comisión del
closer** (suma del precio por closer por un factor; en Tactical `=100/1500`). Los precios varían por
descuento: en ComunicArte 697 es el estándar, con 397, 557 y 627; en Tactical 1.500 con 1.200, 1.000,
900, 800 y 400.

### 2.7 Cartera

Lo que un estudiante queda debiendo vive hoy en cuatro lugares sin dueño: la columna `Cartera` del
registro de llamadas (texto libre, casi vacía: 2 filas en Tactical, 1 en ComunicArte); las notas
`Registro 1-2` ("pago 800 pendiente 700"); `Estudiantes`, con `Tipo de pago = Parcial` y, desde
septiembre, `Cash collected` contra `Precio final`; y la pestaña `Cartera por cobrar Hotmart` de
Tactical (3 personas con fecha en texto, sin monto, closer ni estado). Nada marca una cuota como
pagada. Quién cobra la segunda cuota **no está confirmado**.

### 2.8 Atribución

Cada lead trae sus UTM desde el form. En `Estudiantes`, la columna `Origen` es un `VLOOKUP` por
correo hacia la hoja madre que devuelve el UTM concatenado: es lo más cercano que hay a "de qué
anuncio vino esta venta", y **se rompe** si el correo se escribió distinto o las columnas se cruzan
(pasó en septiembre, con un `#REF!` en la comisión). El `ROAS` por cohorte se cuenta **a mano**. El
semáforo `🚨 Urgencias` mide registros y agendas por canal, **no ventas**.

## 3. Evidencia de código (Apps Script)

Fuente: los seis `.gs` de Tactical (`clasificacion.gs` el enrutador, `migracion.gs`, `tabla.gs`,
`panel.gs` + `panel_ui.html` el panel lateral de los closers, `dashboard_2.gs` Urgencias,
`estructura.gs` obsoleto en parte) y los seis de ComunicArte, pegados por Mani el 2026-09-20 y
guardados en `~/Desktop/mani/work/retia/apps-script-sheets/`. Esta sección es la más verificable de
toda la nota: cada punto cita su prueba.

**Bugs y agujeros, con la evidencia:**

- **`onEdit` pierde datos (probable, sin verificar en vivo).** Está escrito para el orden viejo de
  Registro (Categoría en la columna I). Hoy la columna I es `Registro 1`. Cada vez que un closer
  edita `Registro 1`, el script **borra el contenido de `Registro 2`** (columna J). En ComunicArte
  hay evidencia más fuerte: la columna I real es `Registro 2` y la J (la que se borra) es hoy la ex
  `Registro 3` con el encabezado pisado a "Subcategoría"; esa columna J tiene 27 valores con cosas
  como "pendiente onboarding". Prueba fácil: editar `Registro 1` (Tactical) o `Registro 2`
  (ComunicArte) en una fila con la siguiente columna llena y ver si se borra.
- **Los KPI ignoran al personal fuera de la lista fija.** `Dashboard Registros` solo suma closers de
  `MIG.CLOSERS`. Maru, Jero y "juanse" no cuentan en el resumen por closer — por eso el resumen dice
  151 llamadas y `_kpis` dice 184. En ComunicArte la lista del código sabe de `Juanjo, Dana, Andrea`
  pero el registro real tiene además a Alejo (19 llamadas) y Maru (11): **30 de 256 llamadas (12%)
  no aparecen en la tabla por closer**.
- **Cierres y shows solo cuentan el texto exacto `Sí`.** Un `si`, `Si` o `sí ` se pierde. En Tactical
  hay filas así.
- **`Estudiantes` en KPIs solo cuenta la hoja de Julio.** `_kpis` dice 35 estudiantes; con Septiembre
  son 56. En ComunicArte el script lee `Estudiantes ComunicArte`, que está **vacía** (los reales
  están en `Estudiantes Agosto` y `Estudiantes Septiembre`): por eso `_kpis` dice 0 y el registro
  dice 51 cierres.
- **KPI muertos:** `No calificados` y `Pipeline Financiado` están escritos con `0` fijo (restos de un
  esquema anterior).
- **Incidente real de pérdida silenciosa.** Entre el 27/08 y el 04/09 hubo **462 leads** etiquetados
  "Setteo" que nunca se copiaron a la pestaña, porque `migrarClasificacion()` reetiqueta la hoja
  madre pero no toca Setteo. Lo cubre ahora un reconciliador horario y una alerta por correo. Es la
  prueba viva de por qué el CRM debe tener ingesta idempotente con llave de identidad.
- **Zona horaria: ComunicArte la corrige y Tactical no.** Typeform escribe `Submitted At` en UTC.
  `dashboard_urgentes.gs` (ComunicArte) reinterpreta el reloj como UTC y lo pasa a Bogotá;
  `dashboard_2.gs` (Tactical) lee la fecha tal cual. **Confirmado con los datos**: el sello de copia
  usa la hora real de Bogotá y el `Submitted At` de la misma fila va cinco horas adelante (enviado
  `16/9 23:05`, sellado `16/09 18:08`). El semáforo de Tactical no corrige ese corrimiento: un lead
  de las 8 p.m. queda contado en el día siguiente. Esto pesa sobre la prioridad #1 de
  [[retia-ops]] (atribución): parte de la diferencia META vs FORMS puede ser este corte de día,
  porque Meta reporta por día del anunciante.
- **ComunicArte no tiene red de seguridad.** Sin reconciliador, sin sello `Copiado a`, sin dedupe
  por teléfono (solo por correo). Un lead sin correo pero con nombre se pierde en silencio si se
  copia a Setteo — el incidente de los 462 leads de Tactical es exactamente lo que este diseño no
  puede detectar.
- **Hay trigger horario que refresca `Urgencias`, y un `onOpen` que actualiza KPIs y abre el panel**
  cada vez que alguien abre el sheet. Los closers ven el panel al entrar; es su pantalla de inicio.

**Requisitos ya validados por uso** (lo que trae el panel lateral de los closers, línea base mínima
del CRM): "Mis leads" (los de Setteo asignados, con badge de gestión), resumen de KPIs, estudiantes
con semáforo de acceso a WhatsApp y a plataforma, gráficas de embudo, rendimiento por closer,
tendencia semanal y razones de no cierre, botones para saltar entre pestañas. La lista de Setteo es
una Tabla nativa de Sheets (filtran y ordenan).

**Pestañas de control (no operativas):** `🚨 Urgencias` (semáforo, se refresca cada hora, cuenta como
agendada toda fila con link de Calendly), `_kpis`, `Dashboard Registros` (resumen por closer,
estático en Tactical: fecha de 05/09), `ROAS` por cohorte (Tactical Julio: 12 ventas por Meta;
ComunicArte Agosto: 18 ventas, ROAS 3,97), `BK_*` (snapshots antes de correr el script) y
`_ListasDropdown`.

## 4. Mapas al CRM

### 4.1 Etapa del sheet → entidad del CRM

| Etapa hoy | Dato | Entidad del CRM | Nota |
|---|---|---|---|
| Fila del form | Identidad, respuestas, UTM, token | `people` (+ `people.raw`) | llave práctica: correo o teléfono |
| `Estado` de la hoja | Descartado, Setteo, Con Calendly, Cerrado | `people.estado` como texto | ADR 0032: se guarda tal cual; ojo con `Con Calendly` contra `Con Calendly (Juanito)` |
| Nota de setteo | Contacto por WhatsApp | (sin entidad hoy) | el CRM no gestiona WhatsApp (spec §2) |
| Fila de `Registro de llamadas` | Show, cierre, categoría, notas | `calls` con resultado (ADR 0015) | los resultados del CRM ya cubren agendada, show, no show, reagendada, cerrada, perdida |
| Fila de estudiantes | Precio, plataforma, onboarding | `sales` (ADR 0027: una venta sabe de qué llamada nació) | onboarding queda fuera de alcance |
| Cash collected y cartera | Cuotas | `abonos` (ADR 0013) | reemplaza las cuatro fuentes |
| Pestaña de estudiantes por cohorte | Cohorte | `cohorte` (ADR 0014) | hoy es nombre de pestaña |
| Hoja de cada programa | Origen de datos | `source` | ADR 0019: mapeo por encabezado |

### 4.2 Concepto HubSpot → artefacto del sheet hoy

| HubSpot | Hoy en el sheet | Nota |
|---|---|---|
| Contact | Fila del form (llave: correo) | dedupe hoy = "Duplicado - respuesta parcial" |
| Deal | No existe | nace cuando hay llamada agendada o venta directa; por programa y cohorte |
| Activity: llamada | Fila de Registro de llamadas | Show, Cierre, link, notas |
| Activity: contacto de setteo | Registro 1-5 en Setteo | texto libre, sin fecha por nota |
| Payment / cartera | Cash collected, Tipo de pago, Cartera | hoy repartido en tres lugares |
| Enrollment (estudiante) | Fila en Estudiantes por cohorte | onboarding y bonos son checklist |
| Owner / comisión | Columna Closer + fórmula de comisión | reparto distinto por programa |
| Pipeline stages | Pestañas | Descartado, Setteo, Calendly, y Registro/Estudiantes |

Nota de fusión: la tabla 4.1 responde "¿qué campo del CRM guarda este dato?"; la 4.2 responde "¿qué
objeto de HubSpot reemplaza esta pestaña?". Se dejan las dos porque contestan preguntas distintas
aunque compartan filas.

## 5. Lo que el flujo actual no captura (el CRM tiene que resolverlo)

1. **La fecha real de la llamada.** Los Sheets solo tienen la fecha de registro del form
   (`Urgencias` la usa como "agendada", y esa fecha viene del form, no de la cita). La fecha real
   solo existe en Calendly y en la columna Fecha que el closer escribe a mano. `Urgencias` cuenta
   una llamada como agendada si el registro trae link de Calendly, porque el link solo trae el UUID
   del invitado. El CRM necesita traerla de Calendly (API o webhook); falta la entidad "llamada
   agendada".
2. **Las ventas que no pasan por llamada registrada.** Tactical: 29 cierres en el registro frente a
   56 estudiantes. ComunicArte: 51 frente a 60. Jero aparece con 10 estudiantes y cero llamadas en
   el registro; Maru tiene 3 cierres en septiembre con 1 fila. Hipótesis: cierres por WhatsApp desde
   el setteo. **La verdad de "cuántas ventas" hoy está en Estudiantes, no en Registro.**
3. **No hay "deal".** Una venta es una fila en Estudiantes y una llamada es una fila en Registro,
   pero una persona puede tener varias llamadas (reprogramaciones), pagos parciales y cuotas. Ese es
   el objeto HubSpot que falta, y sin él tampoco hay ID de lead: todo se une por correo (`VLOOKUP`),
   y un typo rompe el vínculo (hay filas con WhatsApp y correo intercambiados, y un `#REF!` en la
   comisión de septiembre).
4. **Los cambios de estado no dejan historia.** El Sheet solo guarda el estado actual; no queda
   registro de cuándo pasó de Setteo a Agendado ni de quién lo movió.
5. **Los re-registros.** Si un lead ya estaba en Setteo y vuelve a llenar el form, se marca "Ya
   estaba" y se descarta la fila nueva, con su UTM y su fecha nuevos.
6. **La cartera como dato estructurado** (monto, fecha pactada, fecha pagada) — hoy en cuatro
   lugares sin dueño (§2.7).
7. **Persona única entre programas.** Nada une a alguien que aplicó a ComunicArte y a Tactical: son
   personas distintas para el sistema aunque sean la misma en la vida real.
8. **"Interesados próxima cohorte" está vacía en los dos sheets.** Existe la pestaña, pero esa
   intención vive como texto libre ("quiere para la próxima edición") y como PRA.
9. **Higiene de datos.** El mismo closer con varios nombres (`Andrea`, `Andrea `, `juanse`, `Juanjo`,
   `Jero`); Show/Cierre como `Sí`, `si`, `no `, `No`; fechas en tres formatos; KPIs muertos.
10. **Existe una segunda puerta, todavía vacía:** la pestaña `Lead Magnet Ruta` de Tactical tiene
    encabezados de un diagnóstico (Estado, Nivel, Puntaje, Ruta, `submission_id`) pero **cero filas
    de datos** (verificado 2026-09-20 22:30). El lead magnet ya entra al intake principal como canal
    `leadmagnetdiagnostico / pdf` (ver `_urg_data` de ComunicArte). Detalle en
    [[crm-retia-modelo-hubspot-scaffold]] §9.

## 6. Preguntas abiertas para Maru y Andrea

1. ~~¿Quién crea la fila en Registro de llamadas?~~ **Respondido por Mani (2026-09-20): a mano.** Y
   el script confirma que los Calendly no entran a ninguna pestaña; solo 53% de los Calendly de
   Tactical terminan con fila. Pregunta que queda: ¿cómo se enteran los closers de cada cita nueva —
   calendario, Juanito, grupo de WhatsApp?
2. ¿Qué es una venta que no pasa por una llamada agendada? (Jero, Maru, y los estudiantes sin fila
   en Registro.)
3. ¿Una reprogramación es fila nueva o se edita la misma?
4. ¿Quién decide el responsable de cada lead de setteo, y por qué Tactical deja 857 sin uno?
5. ¿Jero (Tactical) y Juanjo (ComunicArte) son setters? ¿Son la misma persona?
6. ¿Qué significa para ellas Categoría/Subcategoría, y por qué casi no se usa?
7. ¿Quién cobra la segunda cuota y cómo lo marcan?
8. ¿Cómo y cuándo se paga la comisión?
9. ¿Qué hacen con quien dice "próxima cohorte"?

## 7. Procedencia y límites

- No se ha visto el Typeform por dentro: la bifurcación de Calendly es inferida de los datos y
  confirmada por ausencia en el código (§2.1).
- No se leyeron los scripts de Juanito ni los de Kapso.
- Todo lo de la §3 es **inferencia desde el código y los datos**, no lo que dicen los closers —
  donde hace falta su versión, queda en la §6.
- Solo agregados; sin datos personales de leads.

## Related
[[flujo-de-leads-retia]] · [[flujo-closers-retia-sheets]] · [[dashboard-crm-closers-retia]] ·
[[crm-retia-modelo-hubspot-scaffold]] · [[retia]] · [[retia-ops]] · [[retia-metrics]] ·
[[Michael Castellanos]] · [[semaforo-30x-analisis]] · [[reportes-diarios-mike]]
