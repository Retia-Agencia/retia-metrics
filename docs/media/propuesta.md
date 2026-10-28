# Media en el CRM: la visión (v2, 26-oct-2026)

> **Qué es.** El norte del subproyecto de media: lo que se quiere lograr, cómo se ve cuando funciona, cómo
> cabe en el CRM y qué tan bien se sostiene cuando se mira con ojo crítico. **No es el plan de
> implementación**: ese sale en otra sesión, acotado y con grill, construido sobre este documento.
> Fuentes: las tres sesiones del 20-oct (F1, F2, F3, en [`crudo/`](./crudo/)), el daily del 26-oct (F4) y las
> respuestas de Mani del 26-oct (R). La [`extraccion.md`](./extraccion.md) sigue siendo el detalle de lo que se
> dijo; donde choca con esto, manda esto.
>
> **v1 → v2.** La v1 dejaba el cockpit afuera como servicio (ya no sirve a 30X ni EstadoX: se migra), pedía
> pegar el transcript a mano (el link de Grain ya lo trae, §3.2) y trataba los insights como una lista
> ponderada. La v2 pone en el centro la **escalera de conversión** y el **emparejamiento con el origen**.

---

## 1. El norte

Dos frases lo dicen. Michael (F4): *"que toda la información esté en un solo sitio, y que con esa información se
puedan alimentar todos los procesos, y que vaya funcionando solo, sin tanta intervención humana"*. Y el criterio
que decide: *"el objetivo de Retia finalmente es vender"*.

Para media eso significa dos cosas, que son los dos componentes:

1. **Saber qué contenido vende**, con la venta como verdad, y que eso decida qué se produce después.
2. **Que el pipeline de media no viva en la cabeza de nadie**: que el sistema diga qué toca, qué falta y qué se
   atrasó, para producir sin improvisar ni reaccionar.

### Los principios con que se juzga todo lo que se construya

| Principio | Qué exige | De dónde sale |
|---|---|---|
| No asumir | Cada regla del pipeline la define media; tech no inventa ni un plazo ni un paso | F3 (*"no inventar ninguna regla"*), F4, R |
| Nada rígido | Plazos, recurrencias, tipos de contenido, estados, volúmenes, CTAs: datos que se editan, no código. El sistema **flexibiliza la estandarización**: propone el estándar y deja moverlo | R; ADR 0012 del repo |
| Sin nombres propios | Roles, no personas: coordinación de media, edición, creador, closer, gerencia. Quien ocupa cada rol es un dato | R |
| Crecer sin romperse | Un creador, un programa, un tipo de contenido o una persona nueva entra como dato, sin código | R; contrato C-1 de `docs/hub.md` |
| Migrar, no crear de cero | Lo que ya existe y media ya usa (el cockpit) se trae al CRM; lo nuevo se construye una vez | R |
| Frontera de programa | Lo que se aprende de las llamadas de un programa solo alimenta el contenido de ese programa | Regla dura del repo |

---

## 2. Lo que ya está decidido

| Tema | Decisión | Fuente |
|---|---|---|
| Dónde vive | **Todo en el CRM.** Media tiene su propia vista. El cockpit se migra al CRM: solo lo usa Retia | F4, R |
| Dueños de media | La coordinación de media y la gerencia (hoy: Majo y Daniel Tovar). Las reglas del calendario son de coordinación de media | F4, R |
| Qué ve media de las llamadas | **Solo insights**, nunca el transcript | R |
| Cadencia del reporte de insights | Semanal | R, F1 |
| Grain | Se queda gratis; las closers pegan el link de cada llamada en la Call del CRM | F4 |
| Contenido que el creador publica por su cuenta | Cada creador tiene un link fijo con UTM que siempre usa | F2, F4, R |
| UTMs | Las genera el sistema, legibles (tipo, creador, fecha), primero para stories y luego para todo | F2, F4 |
| Meta de leads de stories | No hay por ahora: se compara contra el mejor | F4 |
| Paid media | Fuera: es otro equipo. Crear contenido para pauta sí entra | F4 |
| Pago al editor | No se mapea; solo "¿terminó de editar?" | F4 |
| Calificación de referentes | Fuego / producción dispendiosa / no sirve | F4 |
| Piloto | Un creador primero (acordado: Milena), pero diseñado para todos desde el día uno | R |
| Referente de producto para el componente 2 | Metricool | F4 |

---

## 3. Componente 1: la influencia de media sobre las ventas

### 3.1 La escalera de conversión

No todas las llamadas enseñan lo mismo. La que se paga en la llamada dice *qué convence*; la que paga a los diez
días dice *qué objeción hubo que resolver*; la que no compra dice *qué no alcanzó*. Por eso no basta con una
lista de insights: hay que **jerarquizar a cada lead por qué tan rápido y qué tan lejos llegó**, y leer todo lo
demás a través de esa escalera.

| Escalón | Qué es | Cómo se sabe (sin pedirle nada nuevo a nadie) |
|---|---|---|
| 1. Pagó en la llamada | Primer abono el mismo día hábil de la cita | Abonos y citas que ya están en el CRM |
| 2. Pagó rápido después | Primer abono a pocos días | Ídem; el corte de "pocos" es un dato, no un número fijo |
| 3. Pagó con seguimiento largo | Primer abono tras varios toques de seguimiento | Abonos + actividades del deal |
| 4. Atendió y no compró | Llamada atendida, deal en Cierre Perdido o sin abono | Etapas del deal |
| 5. Agendó y no se presentó | Cita sin asistencia | Llamadas |
| 6. Dejó datos y no agendó | Envío sin cita | Envíos |

La escalera **se deriva** de lo que el CRM ya registra; la mide una sola función y la usan todas las vistas, como
el saldo. Lo que hay que validar con datos reales es que "mismo día de la cita" de verdad represente "pagó en la
llamada"; si no cuadra, ahí sí se le pide la marca a la closer (F2 la mencionó).

Lo que sale de aquí ya es útil antes de cualquier IA: **qué porción de las ventas cierra en la llamada y cuál por
seguimiento** (F1: *"si el 80% viene de follow-up, eso también es un gran insight"*), y a cuántos días.

### 3.2 El emparejamiento con el origen

Cada lead ya trae su origen: el anuncio (por `utm_id`), la campaña, el link del closer, y con este subproyecto, la
pieza de contenido o el link fijo del creador. Cruzar **origen × escalón** es lo que dice qué sirve y qué no:

```
                      pagó en llamada  pagó rápido  seguimiento  no compró  no se presentó  no agendó
anuncio A                   ███            █            ░           ██            █             ███
stories del creador X       █              ██           ██          █             ░             ██
link fijo del creador X     ██             ░            █           ░             ░             █
sin UTM                     ...
```

Un origen que trae muchos leads pero se queda abajo en la escalera llena agenda sin vender; uno que trae pocos pero
cierra en la llamada vale más de lo que su volumen dice. Esa es la vista completa de la influencia de media sobre
las ventas, y es la misma pregunta que hoy el Hub responde para la pauta, extendida al contenido orgánico.

**La transcripción no requiere pagar Grain.** Se verificó el 26-oct con un link real: la página pública del link
que la closer ya pega trae el transcript completo, con hablantes y tiempos, sin iniciar sesión. El CRM puede
leerlo desde el link. ⚠️ No es una API documentada: si Grain cambia su página, se rompe sin aviso. Hay que tratarlo
como una fuente frágil, con alarma cuando una lectura falla, y con el pago de Grain como plan B.

### 3.3 Qué se aprende de cada llamada

De cada transcript, una sola lectura con IA guarda en la llamada:

- **Dolores, deseos y objeciones**, con la cita textual (F1, F2).
- **El nivel de conciencia** con que llegó el lead: desde "sé que me pasa algo" hasta "sé que quiero a este
  creador" (F2). El más caliente es el que más compra.
- **Lo que el lead dice que vio**: *"vi tu video de…"*. Es la única forma de ver la influencia de contenido que no
  dejó UTM (§3.6).
- **Objeciones que el contenido pudo haber resuelto antes**: logística, horarios, precio. F1 lo dijo así:
  *"aclararle las objeciones desde la parte más alta del funnel, y no que llegue hasta la llamada"*.

Todo se lee **ponderado por el escalón**: un dolor que repiten los que pagaron en la llamada pesa más que uno que
repiten los que no compraron. A media le llega cada semana, por programa, solo el resumen.

### 3.4 Cómo vuelve a media

1. **El cruce**: insights × formatos (el banco de estructuras que media alimenta) × el CTA que media decide
   (llamada o lanzamiento, en qué proporción; link o comentario). Sale el contenido del mes como piezas, listas
   para el pipeline del componente 2 (F2).
2. **La cobertura**: el ideal de F1 es *"ya subí de esto, ya subí de esto"*: cada dolor fuerte tiene contenido
   publicado. El sistema muestra qué ángulos importantes no se han trabajado.
3. **El cierre del loop**: cada pieza publicada vuelve con sus leads y su escalera. *"Si esta historia vendió cinco
   cupos, hagamos otras tres de esas"* (F2).

### 3.5 Las decisiones que esto le permite a gerencia y a media

| Pregunta | Cifra que la responde | Decisión que cambia |
|---|---|---|
| ¿Qué ángulo vende más rápido? | Escalera por ángulo | Qué se produce el mes siguiente |
| ¿Qué origen trae leads que no compran? | Origen × escalón | Dónde se deja de poner esfuerzo |
| ¿El contenido está resolviendo objeciones antes de la llamada? | Frecuencia de objeciones de logística en las llamadas, mes a mes | Qué contenido de objeciones falta |
| ¿Qué tanto cierra en la llamada y qué tanto por seguimiento? | Ventas por escalón | Dónde reforzar: contenido o seguimiento comercial |
| ¿Se publicó lo planeado? | Cumplimiento por creador ("de 30, 25", F2) | La conversación con el creador |
| ¿El contenido propio del creador vende? | Escalera del link fijo del creador | Si se le estructura o se le deja libre |
| ¿Vamos bajo en leads? | Leads de stories contra el periodo anterior | Cambiar el CTA (la regla del carrusel de F2 queda lista para cuando haya meta) |

### 3.6 Crítica: dónde este componente puede mentir

1. **Atribución al último clic.** La UTM dice qué pieza capturó el lead, no cuál lo convenció. Alguien puede ver
   veinte historias y entrar por un anuncio. Mitigación: lo que el lead dice en la llamada que vio (§3.3) y no
   sobre-interpretar una sola pieza.
2. **Muestras pequeñas.** En los últimos 60 días hubo **49 deals con algún abono** en los tres programas (29, 18 y
   2), unos 25 al mes (consulta de solo lectura a producción, 26-oct). Con 30 historias al mes por creador, casi
   toda historia individual va a tener **cero ventas**. El aprendizaje tiene que agregarse por **ángulo, formato,
   creador y nivel de conciencia**, no por pieza; y los escalones intermedios (agendó, se presentó) dan señal antes
   que la venta.
3. **Lo que no es del contenido.** Qué tan rápido cierra un lead también depende de la closer y de la calidad con que
   llegó. Sin separarlo, se le atribuye al contenido el talento de una closer. Las vistas tienen que poder abrirse
   por closer y por calidad.
4. **La fuente depende de un hábito.** De las 82 llamadas con fecha pasada en 60 días, **54 tienen link de Grain
   (66%)**. Un tercio de las conversaciones se pierde hoy. La métrica de "atendidos sin Grain" ya existe; tiene que
   estar a la vista de quien gestiona a las closers.
5. **El link de Grain es una fuente frágil** (§3.2).
6. **Instagram no está en el CRM.** Vistas, toques y respuestas de una historia viven en Instagram. Sin eso, una
   historia sin clics es indistinguible de una que nadie vio. Traerlo exige permisos de Instagram que hoy no hay:
   queda como pregunta abierta, no como requisito del primer paso.
7. **El riesgo de no medir nada**: si la UTM se escribe a mano o el botón de comentarios no se actualiza a diario, la
   pieza pierde sus leads sin error. Por eso los links solo salen del generador y el sistema avisa cuando llegan
   leads con UTMs de contenido que no coinciden con ninguna pieza.

---

## 4. Componente 2: el pipeline de media, sin depender de la memoria

### 4.1 La regla para construirlo

Dos fuentes y nada más (R): **el pipeline tal como media lo describió** y **lo útil de Metricool**. Todo lo que no
salga de ahí se pregunta antes de construirse.

### 4.2 El pipeline como lo describió media

Por roles, sin nombres. Lo que está entre comillas son los ejemplos que dieron; **son datos de la plantilla, no
reglas del sistema**, y media los confirma o los cambia.

| Tipo de contenido | Pasos | Ejemplos de plazos y cadencias que dio media | Estado del desglose |
|---|---|---|---|
| Stories de venta | Fuente (insights) → formato → cruce → pedir material al creador → edición → parrilla por día → link del día → publicar y marcar "ya publiqué" | Pedir material el último lunes del mes, plazo al creador antes del real; día 1 del mes editar todo; publicar entre 12 y 1 | ✅ Completo (F2) |
| Carruseles orgánicos | Referente o viral propio → diseño con plantilla → publicar | Un día fijo de la semana, sagrado; un carrusel por semana por creador; CTA según cómo van los leads | ✅ Completo (F2, F3) |
| Reels orgánicos y de venta | Referentes (cockpit) → calificar → colección del creador → guion limpio → script → grabación → edición → corrección → publicar | Grabaciones dos días fijos; revisión de edición a diario a una hora fija; scripts antes de su grabación; referentes nuevos al inicio del mes | 🟡 Parcial (F2, F3): falta que media lo complete |
| Contenido para pauta | El mismo momento de grabación, con otro CTA | | 🟡 Mencionado, no desglosado |
| Stories propias del creador | Libres, con su link fijo | | ✅ Decidido (F4) |

Lo que el pipeline necesita, en palabras de media: *"aquí pides, acá te entregan, cumpliste, no cumpliste, esto ya
lo cargaste"* (F2); un calendario que se reacomode cuando se mueve una grabación (F3); avisos cuando algo no llegó o
no se publicó (F2); y todo en el celular (F2).

### 4.3 Metricool: qué se toma y qué no

| Funcionalidad de Metricool | ¿Se toma? | Por qué |
|---|---|---|
| Calendario con vistas por día, semana y mes, filtros por red, estado y aprobación | ✅ | Es lo que pidieron en F3 |
| Estados de publicación (borrador, pendiente, publicado, con error) | ✅, con los estados que defina media | La pieza necesita estados |
| Flujo de aprobación con roles | ✅ | Revisión de guiones y de edición |
| Biblioteca de ideas sin fecha | ✅ | Es el banco de formatos y de referentes aprobados |
| Publicaciones recurrentes | ✅, como recurrencias de tareas | Es la plantilla del mes |
| Generador de UTM al planear | ✅, desde el generador del CRM | Pedido en F2 |
| Link en bio con analítica de clics | 🟡 Idea para el link fijo del creador | Mide lo que el creador publica solo |
| Tableros por campaña que juntan orgánico y pauta | ✅, por lanzamiento | Media mezcla CTA de llamada y de lanzamiento |
| Análisis de competidores | ✅, ya existe como el motor de referentes del cockpit | Se migra |
| Mejor hora para publicar | ⬜ Después | Necesita datos de Instagram que no hay |
| Publicación automática | ❌ | Media publica desde el teléfono y basta con marcar "ya publiqué". Publicar stories por API tendría que verificarse (sin fuente verificada) |
| Bandeja de mensajes y hashtags | ❌ | Nadie lo pidió |

Fuente de la lista de Metricool: [tutorial oficial](https://metricool.com/metricool-mega-tutorial/) (consultado el 26-oct).

### 4.4 Las piezas del sistema

Todas son datos que media edita; ninguna trae un valor escrito en el código.

- **La pieza de contenido**: el objeto que une los dos componentes. Tipo, creador, programa, estado, fechas, CTA y
  su link. Sus estados y sus tipos los define media.
- **El banco**: ideas sin fecha (referentes aprobados del cockpit, pantallazos de formatos, virales propios).
- **La plantilla de recurrencias**: lo que se repite cada mes o cada semana, relativo al calendario y en días
  hábiles, con duración, responsable y dos fechas cuando haga falta (la que se le dice al creador y la real).
- **Las tareas**: lo que generan la plantilla y las piezas, con su estado.
- **Los avisos**: lo vencido, lo que no llegó, lo no publicado, por la vista de media y por WhatsApp (el canal que
  ya usa el CRM).
- **El calendario y la parrilla del día**: vistas sobre lo anterior, pensadas también para el celular.
- **El registro de desviaciones**: cada vez que alguien mueve algo de la plantilla, queda cuándo y por qué. Es lo
  que permite flexibilizar sin perder el estándar: después se ve qué regla nunca se cumple y se cambia.

### 4.5 Crítica: dónde este componente puede fallar

1. **Si no le ahorra tiempo hoy, no se usa.** Media no es técnica (ADR 0077). Un calendario más que llenar es una
   carga, no una ayuda. Por eso arranca migrando lo que ya usan (el cockpit) y con la parrilla del día, que reemplaza
   las notas del celular, antes que el calendario completo.
2. **El pipeline de reels no está completo.** Construirlo sin que media termine de describirlo es asumir.
3. **Flexibilidad sin medida es improvisación con software.** Si todo se puede mover sin rastro, el sistema vuelve a
   depender de la memoria. El registro de desviaciones es lo que lo evita.
4. **Persecución de creadores**: el sistema puede avisar que algo no llegó, pero no puede hacer que llegue. El
   argumento para los creadores (F2: *"más predictibilidad de leads, y eso repercute en tus ventas"*) necesita la
   cifra del componente 1 para sostenerse.

---

## 5. Cómo cabe en el CRM

```
                        CRM (un solo sistema)
  ┌────────────────────── comercial ──────────────────────┐   ┌──────────── vista de media ────────────┐
  envíos (UTM) ─► deals ─► llamadas (+ Grain) ─► abonos      banco · cruce · piezas · plantilla ·
        │                        │                           tareas · avisos · calendario · parrilla
        │                  escalera + insights ─────────────► (solo insights)
        └──── origen × escalón ◄───────── pieza publicada (link del generador) ◄──┘
                        Hub: influencia de media en las ventas
  motor de referentes (migrado del cockpit) ─────────────────► banco
```

- **La migración del cockpit**: su motor (búsqueda de referentes, transcripción, traducción, guion limpio,
  calificación con su aprendizaje) y sus datos (creadores, referentes, colecciones, lo calificado) pasan al CRM. El
  cómo, con su orden y su riesgo, es del plan de implementación.
- **Lo que el CRM ya tiene y se reusa**: el generador de links con UTM, la regla que clasifica el origen, el Hub y
  sus listas detrás de cada cifra, la frontera de programa, el rastro de cada cambio, el reporte por WhatsApp, los
  días hábiles de Retia y el sistema de diseño.
- **Lo nuevo**: un rol de media con su vista; la escalera de conversión; los insights por llamada; la pieza y lo que
  cuelga de ella.

---

## 6. El orden de la visión

No son tickets: es la secuencia que tiene sentido, y por qué. El plan de implementación la vuelve tareas.

| Paso | Qué queda funcionando | Por qué en ese lugar |
|---|---|---|
| 1. Empezar a medir | Links con UTM por pieza y por creador; la escalera de conversión sobre los datos que ya hay | Un dato que no se capturó hoy no se recupera; y la escalera ya responde preguntas sin IA |
| 2. Media entra al CRM | Su vista con el cockpit migrado, el banco y la parrilla del día | Se adopta lo que ya usan; la parrilla reemplaza las notas del celular |
| 3. La fuente | Transcripts desde el link de Grain e insights ponderados por la escalera, el reporte semanal | Necesita semanas de llamadas acumuladas: si empieza tarde, el cruce espera |
| 4. El pipeline | Pieza con estados, plantilla de recurrencias, tareas, avisos y calendario, con el piloto | Necesita el pipeline completo descrito por media |
| 5. El loop | El cruce y la cobertura; origen × escalón en el Hub | Necesita 1, 3 y 4 |
| 6. Todos | Todos los creadores y tipos de contenido; agente de stories de referentes | Cuando el piloto mostró que gira |

---

## 7. Lo que falta saber (y lo que se le pide a media)

| # | Qué | A quién | Para qué |
|---|---|---|---|
| 1 | Un mes de ejemplo con todos los eventos reales, duración y responsable | Coordinación de media | La plantilla inicial |
| 2 | El pipeline de reels completo, paso por paso | Coordinación de media | §4.2 |
| 3 | Los estados por los que pasa una pieza | Coordinación de media | La pieza |
| 4 | La lista de creadores, programa y cuenta | Coordinación de media | Links y frontera |
| 5 | Ejemplos de contenido que vendió y que no, y por qué | Media con gerencia | Medir la calidad del cruce |
| 6 | El corte de "pagó rápido" en días | Gerencia | La escalera |
| 7 | ¿Se quieren datos de Instagram (vistas de historias) en el CRM? | Gerencia | §3.6, punto 6 |
| 8 | Presupuesto de IA y del agente de referentes | Gerencia, cuando concierna | Pasos 3 y 6 |
| 9 | ¿Las clases también son fuente de ángulos, además de las llamadas? ¿Se graban y dónde? | Gerencia y media | Una segunda fuente de insights (hoy el plan solo lee llamadas) |
| 10 | ¿Cuánto pesa cada escalón al resumir los insights? | Gerencia | El reporte semanal (ticket 330) |
| 11 | ¿Cómo está montado ManyChat, quién cambia la palabra o el botón y cómo se mide el lead que entra por "comenta la palabra"? | Coordinación de media | Que esos leads no lleguen sin pieza; el aviso del ticket 334 |
| 12 | ¿Se quiere un tablero por lanzamiento que junte orgánico y pauta? | Gerencia | Después del paso 5 |
| 13 | ¿Los formatos y crudos se suben solo por la plataforma o también por WhatsApp? | Coordinación de media | Tickets 337 y 338 |

**Siguiente paso:** una sesión de plan con grill sobre este documento, que lo vuelva ADRs y tickets.
