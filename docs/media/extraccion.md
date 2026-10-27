# Media: la operación de contenido de Retia y su centralización

> **Qué es este documento.** La extracción del subproyecto de media ([índice](./README.md)): el mapa de la sesión "Creación Media Ops Machine" (martes 20-oct-2026) y de
> sus dos continuaciones: lo que se dijo, lo que se le pidió a Manu, lo que ya existe en el CRM y en el
> cockpit, la propuesta para gerencia y una evaluación crítica con roadmap inicial. Es el insumo de la
> sesión de roadmap y del daily con Michael Castellanos y Daniel Tovar. **No es todavía un plan
> aprobado**: §8 lista lo que hay que decidir antes de abrir tickets.
>
> Escrito el 26-oct-2026 desde los transcripts completos, no desde los resúmenes. Donde el resumen
> automático y el transcript difieren, manda el transcript.

---

## 0. Las fuentes y sus límites

| # | Fuente | Qué cubre | Límite que hay que saber |
|---|---|---|---|
| F1 | Wispr Flow, "Creación Media Ops Machine (Presencial Oficina)", 20-oct, 8:00 a 10:30 (Bogotá). Asistentes: Daniel Tovar (organizador), Michael Castellanos, Alejandro Carpa, María José Duarte (Majo), Daniela Rodríguez (Dani), Manu (remoto) | El método (MECE), el árbol orgánico / paid media y la primera mitad de stories de venta | La diarización falla: casi todo el texto sale atribuido a "María José Duarte". Por el contenido, quien facilita **no es Majo** (le habla a "Dani y Majo" en tercera persona y dice "Alejo y yo no estamos involucrados"). Sin fuente verificada de quién es: probablemente Daniel Tovar |
| F2 | Wispr Flow, "Story Production Workflow Planning", grabada el 24-oct desde el video que dejaron (sesión del 20-oct, después de que Manu salió) | Stories de venta completo (8 pasos), carruseles orgánicos y el inicio de reels / cockpit | Speakers sin nombre. Se corta en un "break de dos minutos" y repite un fragmento: **lo que se habló de reels después del break no está en F2** |
| F3 | `~/Downloads/2026-10-20_planificacion-calendario-de-contenido-y-reels-organicos.md` (Grain, 13 min, capturado por Michael) | Reels orgánicos en el cockpit y **las reglas del calendario del equipo** | Speaker 1 / Speaker 2 sin nombre (Speaker 2 es de media: habla de "el flujo de Dani" en tercera persona, o sea que es Majo). **El archivo termina a mitad de frase** ("Pues o sea, deberíamos como tener"): falta el final |

**Orden probable (inferencia):** F1 → F2 → F3, todo el 20-oct. F3 retoma "calificaciones fuego y producción", que es donde F2 se corta.

**Dos "Dani".** Daniela Rodríguez (media) y Daniel Tovar (gerencia). En F2, "Dani nos avisó que vamos a tener lanzamiento" es casi seguro Daniel Tovar; "el flujo de Dani" en F3 es Daniela. Cuando el texto no lo deja claro, este documento lo dice.

**Personas que aparecen:** Majo y Dani (media, operan el cockpit y las cuentas); Alejandro "Alejo" Carpa; Luisca / Luis K (grabación con teleprompter); Diego y su equipo (edición; se le paga y se le recibe cobro); creadores Milena "Mile", Rosario "Rochi", Francisco, Juan Pablo "Juanpa / Pablo" y Vieira (cliente activo del cockpit).

---

## 1. El overview: qué problema se está resolviendo

### 1.1 El dolor

La operación de media **reacciona**: se apagan incendios en vez de prever. Textual de la apertura: que la operación *"cada vez tenga rutinas más establecidas, apalancadas de recordatorios, que podamos hacer desde tech"*, para que *"sea más fácil operar varias cuentas al tiempo"* y no *"estar reaccionando todo el tiempo como si fuera un incendio"*.

Lo que se vio en las tres sesiones, agrupado:

1. **Todo depende del criterio y la memoria de cada persona.** Los ángulos de las historias salen de la creatividad de cada una; la parrilla de Francisco existe porque él la pidió y *"no fue bajo un criterio específico"*; el dinamismo en las grabaciones de Mile y Rochi se metió porque la cuenta de Mile se estancó, *"cuando hay ganas"*. Cuando algo funciona no se vuelve proceso para todos.
2. **El loop de aprendizaje no existe en orgánico.** Con pauta se usa lo que vendió para producir más; con historias *"eso nunca lo hemos hecho"*.
3. **No se puede medir qué historia vendió.** Un mismo link con UTM todo el mes, guardado en las notas del celular. Una historia dura 24 h y se solapa con la del día siguiente; el conteo de Instagram no cuadra con el del botón y sacarlo es manual.
4. **Lo que no depende del equipo se persigue a diario.** Fotos y videos de los creadores llegan tarde; *"todos los días: ¿ya la puedes subir?"*.
5. **Los creadores ponen sus propios links sin UTM** (Juanpa) y a veces bajan historias.
6. **La herramienta tiene fricciones que nadie reporta.** En el cockpit se revisa por transcript con solo la carátula; la calificación es subjetiva; el guion limpio a veces sale en inglés o peor que el crudo. *"Ustedes lo sufren todos los días y no alzan la mano."*
7. **La agenda del equipo choca sola.** Grabaciones (dependen de Luisca y del creador), revisiones de Diego, scripts y carruseles compiten sin reglas escritas.

### 1.2 El objetivo

Convertir la operación de media en **rutinas parametrizadas y calendarizadas, apoyadas en tecnología, que se pueden repetir igual para cada creador**, y que se miden contra los leads que traen. La frase que lo resume (F2): *"más que complejizarlo, es centralizar"*: que todo el pipeline de Majo y Dani se vea en un solo lugar, *"como ya sabemos que aquí pides, acá te entregan, cumpliste, no cumpliste, esto ya lo cargaste"*.

Lo que se busca, en sus palabras:

- **Predictibilidad de leads** (y por ahí, de ingresos). Es también como se le vende el método a los creadores.
- **Decidir con data y no con gusto**: *"un rol de marketing pasa de 'grabemos cosas bonitas' a 'estoy tomando decisiones con data'"*. Ejemplo: la regla del 20% para el CTA del carrusel (§3.4).
- **Que el sistema pregunte y el humano solo decida** lo que es suyo (ej.: el cruce pregunta si este mes hay lanzamiento y en qué proporción).
- **Iterar por pasadas**: primero *"que funcione la ruedita"*, después se pule. *"Si eso va a hacer que nos demoremos dos semanas más en salir con esto, prefiero no."*

### 1.3 El método (por qué importa para lo que se construya)

Se explicó el pensamiento estructurado de consultoría para armar el mapa:

- **Pasos:** entender (pregunta guía: *¿de qué manera podemos optimizar el proceso de social media?*), estructurar en 3 o 4 ramas, plantear hipótesis, analizar, sintetizar (máximo 3 ideas) y recomendar (posición, 2 o 3 razones, riesgos, *"¿qué hacemos el lunes?"*).
- **MECE** (mutuamente excluyente, colectivamente exhaustivo): nada se analiza dos veces, nada queda por fuera. Cinco formas de partir un problema: fórmula, proceso, segmentos, opuestos, actores.
- **Prueba de un buen árbol:** relevante, del tamaño justo, MECE, **en el idioma del equipo** (se dice *reel* y *carrusel*, nunca *post*), **accionable hasta que cada hoja se responda con un dato: cuánto demora y cuánto hay que producir**, y concluyente.

**Consecuencia para el software:** el modelo tiene que hablar ese vocabulario y guardar las dos magnitudes de cada hoja (duración y cantidad). Un calendario o una parrilla que no sepa "cuánto se demora sacar un carrusel" y "cuántos hay que producir al mes" no responde la pregunta que el método plantea.

---

## 2. El árbol de la operación (como quedó)

```
Social media (contenido audiovisual: equipo de media + editores + creador)
│   Fuera de alcance: landing pages
│
├── Orgánico  (se organiza por TIPO, y cada tipo se parte en orgánico / venta,
│   │          porque el momento de producción es el mismo)
│   ├── Reels ............ orgánico | venta (venta = "Frankenstein para orgánico": se graba otro CTA)
│   ├── Carruseles ....... orgánico | venta (venta: "por ahora no")
│   └── Stories .......... orgánico ("no nos importa ahorita") | VENTA ← lo único desglosado completo
│
└── Paid media (hasta hoy el equipo solo dice en las grabaciones "aplica estos anuncios")
    ├── Estáticos (carruseles y estáticos quedan en una sola categoría)
    ├── Frankenstein (reel orgánico que funcionó + final nuevo con CTA de venta)
    ├── Ads con teleprompter (requieren a Luis K)
    ├── Ads en selfie (nuevos: que los creadores sepan grabarse solos)
    └── BSL
```

**Estado del desglose:** Stories de venta ✅ completo · Carruseles orgánicos ✅ · Reels (orgánico y venta) 🟡 parcial (F2 y F3) · Calendario del equipo 🟡 (F3, cortado al final) · Stories orgánicas ⬜ · Carruseles de venta ⬜ (decidido no hacerlos aún) · **Paid media ⬜ completo** · El cobro y pago a Diego ⬜ (se anunció al inicio y no se cubrió).

La publicación orgánica de los creadores hoy es libre; *"en una siguiente pasadita vamos a tener que definirles qué día pueden subir cosas"*.

---

## 3. Cada proceso, con sus reglas

### 3.1 Stories de venta: los 8 pasos

**Hoy (F1):** se intercala. Juanpa sube casi todos los días; con Mile y Rochi un día ellas suben con link y otro día el equipo sube una estática; con Francisco igual, más una parrilla que alterna estáticas y videos por temática. Los ángulos salen de clases (transcripts con IA en lanzamientos), de guiones virales ya grabados, de IA y de referentes de historias (estos solo para la estructura). Ante "cada cliente es distinto", la respuesta fue: *"la psicología humana es la misma"*; si algo funciona, se aplica a todos.

**El proceso nuevo (F2):**

| Paso | Qué es | Reglas y números |
|---|---|---|
| 1. Fuente de información | Transcripts de **clases** y de **llamadas de venta** | De las llamadas, prioridad a las que **pagaron en la llamada**; se complementa con las vendidas por **follow-up** (*"si el 80% de las ventas viene de follow-up, eso también es un gran insight"*). De ahí se sacan **dolores, deseos y objeciones** más repetidos. Ejemplo de ángulo probado: *"lloro cuando hablo"*. Tiene que llegar **por default**, sin pedirlo. Se reutiliza "la fuente del mes pasado" |
| 2. Formato | Banco de **estructuras** de historias que venden | Dos entradas: un agente (Grok Bot u otro) que recorre las stories de los referentes desde las cuentas de nicho y las transcribe en estructura (*"historia 1 dijo esto, historia 2 esto"*), y pantallazos manuales que el equipo sube durante el mes. Look **orgánico con fotos reales**, no historias "hechas en Canva" como las de EstadoX: es una ventaja de Retia. Extraer patrones de la parrilla del referente (qué CTA usa los martes) = siguiente pasada |
| 3. Cruce | Temas × estructuras, **con un botón** | Teórico 10 × 10 = 100; real ~5 o 6 × 5 o 6 = ~30 al mes. Sale **15 secuencias estáticas + 15 scripts de video** (un script = los textos de una secuencia unidos). Antes de cruzar pregunta: **¿el CTA es de llamada o de lanzamiento, y en qué proporción?** (los lanzamientos se saben 1 o 2 meses antes; ej.: media semana de lanzamiento en un mes de 4 = 12,5%) y mezcla por default **link y comentar (ManyChat)**. Pasada posterior: **niveles de conciencia** (el prompt lo deja listo el facilitador) |
| 4. Producción audiovisual | Pedir el material al creador | **10 selfies + 15 videos en selfie** por creador al mes (la cuenta inicial fue 20 selfies con distintos outfits: 10 secuencias × 3 a 4 fotos, con la mitad repetidas). También sirven clips con texto. **Golden rule: la secuencia abre y cierra con la cara del creador** (rompe el scroll; en medio, algo de experiencia: un video, gente anotando) |
| 5. Edición | Recortar inicio y fin, texto y link | Una sola sentada al mes (Majo y Dani lo prefieren así). Todo queda **encarpetado** y listo |
| 6. Parrilla | Una carpeta por día | La plataforma funciona *"como si fuera un drive"*: a diario se descarga la carpeta del día |
| 7. UTM | **Una UTM distinta por día, generada sola** | Ej.: "Historias Milena, día 1, enero". La parrilla muestra *"link para hoy"* y marca muy visible si el CTA del día es **link** o **ManyChat** (en ManyChat la UTM va en el botón y hay que cambiarlo ese día) |
| 8. Publicar | Una secuencia (3 a 6 historias, según el formato) o un video al día | **Entre las 12:00 y la 1:00**, con marca de **"ya publiqué"**. Si no se marca, alerta roja |

**El calendario del mes (fechas relativas al cierre, en días hábiles):**

| Cuándo | Qué |
|---|---|
| Durante el mes | El agente junta formatos; el equipo sube pantallazos; comercial deja los transcripts |
| **30 − 6 hábiles** (empezó como "el último lunes del mes") | Corte de fuentes, cruce, y solicitud de fotos y videos a los creadores. *"El pipeline debería decir: hoy es 30 − 6, estas son tus tareas de hoy"* |
| 30 − 3 | Presionar lo que no ha llegado. **A los creadores se les da un plazo 2 o 3 días antes del real** |
| 30 − 0 | Fecha real de entrega |
| **Día 1 del mes, en la mañana** | **Golden rule: sin grabaciones.** Majo y Dani editan todas las historias del mes (4 a 5 h) |

**Medición (F2):**

- Dashboard para quien coordina: **% de cumplimiento** de publicación, **leads por historia** (rastreados por la UTM) en distintos periodos, y qué historias funcionaron para repetirlas.
- **Semáforo relativo**: verde / amarillo / rojo calculado contra **la mejor historia** (*"si la mejor me trajo 10.000, ese es mi techo"*), un techo que se mueve.
- **"El creador no dejó"**: se marca en la parrilla cuando el creador no deja publicar o baja la historia, y se pregunta por qué. *"Son 30 publicaciones al mes y solo dejaste publicar 10: así cómo vamos a vender."* Lo no usado queda de banco para el mes siguiente.
- **Control de links, primera pasada:** un solo link con UTM para cada creador, para cuando publique por su cuenta. Mide de paso si el método le gana a la improvisación del creador. La UTM diaria para el creador queda para después (*"por ahora no los jodamos"*).
- **Banco de fotos con alarma** (*"tienes 10 fotos este mes"*); si no llegan, se toman fotos en las grabaciones.

**Cómo se le vende al creador:** *"vamos a tener más predictibilidad de la cantidad de leads a lo largo del mes, y eso repercute en tus ventas"*. Pendiente una sentada con Milena y Rosario, con el diagrama. Decisión abierta: si Milena sigue publicando sola (hoy le funciona) o el equipo publica todo.

### 3.2 Carruseles orgánicos

- **Hoy:** solo Milena, uno a la semana en vez de un reel (*"ha funcionado full"*), sacado del referente más viral; Majo lo publica el sábado en la mañana. Rochi: uno. Vieira: ninguno.
- **Decisión:** **un carrusel orgánico por semana por creador**, intercalando **un viral del propio creador** (cada 15 días, cuando hay) y **un referente gringo**.
- **Tiempo:** 20 min con plantilla (Majo) a 1 h (Dani).
- **Cuándo:** miércoles en la mañana, sagrado, sin grabaciones; se publica el jueves. ⚠️ **Contradicción entre fuentes:** F2 dice *una hora* (se discutió 9, 10 y 11 a.m.; el resumen dice 11 a.m.); F3 dice *medio día desde las 11, unas 4 horas* para carruseles.
- **CTA:** "sígueme" por default. Cambia a **"comenta la palabra"** si en lo corrido de **al menos las últimas 3 semanas** los leads de stories van **20% o más por debajo de la meta**. La regla la ve Majo sola en el dashboard: no depende de que alguien le diga.
- Aprobación previa del creador: abierta, depende de cada uno (Milena revisa; Juanpa no lo va a leer).
- Carruseles de venta: **por ahora no**, hasta tener diseñador o más tiempo.

### 3.3 Reels (orgánicos y de venta)

**El flujo de hoy (F2 y F3):**

1. Entran referentes **manuales** (links del grupo de WhatsApp de referentes, pegados en el cockpit) y **automáticos** (una corrida de 20 a 30 min).
2. Se califican (🔥 / 👍 / 👎). Los manuales se califican todos buenos, porque ya se vieron.
3. Los top van a una **colección por creador**, se **limpia el guion** (quitar lo propio del creador, adaptar a la voz) con un botón, y se genera el documento.
4. Revisión uno a uno → documento para grabar con el teléfono. Se marcan como grabados.

**Lo que se le pidió cambiar (detalle en §4):** vista previa del video con sonido al lado del transcript; calificación casi binaria (fuego / bueno pero necesita más producción / malo, sin "dedo arriba") porque el 🔥 de Dani no es el 🔥 de Majo; un banco de "difíciles de producir" para probar formatos dinámicos (Luisca con estabilizador después de 3 h de teleprompter); guion limpio que salga siempre en español y mejor que el crudo; rutina de **~30 referentes nuevos por creador al mes** (el día 2, si no es miércoles ni día de grabación), porque *"llega un momento en que los referentes se acaban"*.

**Reels de venta:** salen del mismo momento de grabación; son un Frankenstein para orgánico (se graba otro CTA). No se desglosó más.

### 3.4 El calendario del equipo (F3): las reglas

El pedido: **un calendario del mes con todos los eventos, que se reacomoda solo cuando Majo cambia una fecha de grabación**, y que tenga *"la menor cantidad de días en rojo"* (choques). Instrucción explícita a Manu: **no inventar ninguna regla**; ante una duda o excepción, preguntarle a quien habla (Speaker 1 de F3).

| # | Regla | Detalle |
|---|---|---|
| R1 | **Grabaciones lunes y viernes** | Prioridad 1. Dependen de Luisca y del creador. Las fechas se cambian a mano |
| R2 | **Revisión de reels: máximo 1 h al día** | Se empezó en 4 h y se corrigió: Dani revisa 3 videos en 30 min |
| R3 | **Revisión de Diego: 5:00 a 5:30 p.m., todos los días** (Majo y Dani) | Golden rule. Diego sube comentarios hasta las 4:00 para no corregir a las 5. Si choca con una grabación: justo después de la grabación o al día siguiente temprano |
| R4 | **Daily del equipo** | 8:00 a 8:30 o 8:30 a 9:00 a.m. ⚠️ El transcript dice las dos |
| R5 | **Miércoles: carruseles** | Desde las 11, unas 4 h dejando el almuerzo (⚠️ contradice la 1 h de F2) |
| R6 | **Día de scripts: martes o jueves** que no choque con nada de lo anterior (ni día 1 del mes, etc.) | ~3 h por creador (lo que más demora es la corrección). Respeta el daily y deja 3 a 4 p.m. para dejarle listos los ajustes a Diego a las 4. Cada persona tiene 3 o 4 creadores (9 a 12 h): se reparten 2 el martes y 2 el jueves |
| R7 | **El evento de scripts va atado a su grabación** | Nunca después de la grabación; si choca, se mueve antes |
| R8 | (de F2) **Día 1 del mes sin grabaciones**: historias del mes | 4 a 5 h en la mañana |
| R9 | (de F3) **Día 2 del mes: ~30 referentes nuevos por creador** | Si no es miércoles ni grabación |

---

## 4. Lo que le pidieron a Manu (puntual)

Agrupado por dónde viviría. "Quién lo pidió" es el facilitador salvo que se diga otra cosa.

### 4.1 Al CRM

| # | Pedido | Cita | Fuente |
|---|---|---|---|
| M1 | **Perfil para Majo y Dani en el CRM** | *"Manu, también clave que ya le creemos un perfil a Majo y a Dani en el CRM"* | F2 |
| M2 | **Los transcripts de las llamadas suben solos al CRM al terminar la llamada** (hoy las closers suben el Grain a mano) | *"deberían subirse automáticamente después de acabar la llamada al CRM"* | F2 |
| M3 | **Que se sepa si la venta fue en la llamada o por follow-up** | *"ahí los vendedores mismo marcan si se vendió durante la llamada o después"* | F2 |
| M4 | **Reporte de las llamadas cerradas con el análisis de dolores, deseos y objeciones más repetidos**, que llegue por default a Majo y Dani | F1: *"todas las semanas"*. F2: *"el último día del mes"*, luego al corte (30 − 6). ⚠️ Cadencia sin cerrar | F1, F2 |
| M5 | **Leads por historia, cumplimiento y semáforo relativo** en un dashboard | §3.1 | F2 |
| M6 | **Meta de leads de stories** y la regla del −20% en 3 semanas | Implícito: la regla del carrusel la necesita y hoy no existe esa meta | F2 |
| M7 | **El CRM en el celular** | *"golden rule: tener la aplicación en el celular"*, para bajar las carpetas del día directo al teléfono | F2 |

### 4.2 Al cockpit (pipeline de contenido)

| # | Pedido | Fuente |
|---|---|---|
| M8 | **Vista previa con reproducción automática y sonido** al lado del transcript (*"como Netflix con los tráilers"*); pasar de un video a otro fácil | F2, F3 |
| M9 | **Calificación binaria**: fuego / necesita más producción (banco aparte) / malo. Sin 👍 | F2 |
| M10 | **Guion limpio confiable**: siempre en español, y no peor que el crudo. *"Puedes revisarlo y nos dices qué es lo que pasa"* (queda pendiente) | F3 |
| M11 | **Rutina de ~30 referentes nuevos por creador al mes** | F3 |
| M12 | **Agente que recorre las stories de los referentes** (Grok Bot, Claude en Chrome u otro) desde las cuentas de nicho, y averiguar si cuesta | F1, F2 |
| M13 | **Un lugar para subir los pantallazos manuales** de historias: subirlos a la plataforma o mandarlos por WhatsApp y que pasen solos. *"Manuel, ahí hay que ver qué es más fácil"* | F2 |
| M14 | **El cruce con un botón**: 15 secuencias + 15 scripts, con las preguntas de CTA (llamada / lanzamiento, proporción; link / ManyChat). **Los prompts los arma Manu con el facilitador**; el de niveles de conciencia lo deja listo el facilitador | F2 |
| M15 | **La parrilla del mes**: carpetas por día descargables, UTM del día generada sola, marca de CTA link / ManyChat, "ya publiqué", "el creador no dejó", alarma del banco de fotos | F2 |
| M16 | **El pipeline de tareas de Majo y Dani**, calendarizado con las fechas relativas (30 − 6, 30 − 3, día 1) y su cumplimiento | F2 |
| M17 | **El calendario del equipo** que se arma solo con las reglas de §3.4 y se reacomoda al mover una grabación | F3 |
| M18 | **Un link con UTM por creador** para cuando publique por su cuenta | F2 |

### 4.3 Lo que anotó Manu (sus notas de la sesión) y queda como pregunta

Grain: cómo integrarlo · ManyChat: para qué lo usan, ¿se integra por API? · prompts para crear scripts · qué métricas de las stories con UTM sirven · el cockpit de búsqueda *"se puede convertir en manejador de contenido"*.

---

## 5. Lo que ya existe (y cuánto del pedido cubre)

### 5.1 En el CRM (este repo)

| Pieza | Dónde | Qué cubre del pedido |
|---|---|---|
| Roles `gerente`, `closer`, `developer`, `paid_trafficker`, `customer_success` | `lib/db/schema.ts` (`rolEnum`), preguntas en `lib/auth/roles.ts` | M1: **no hay rol de media**. Hay que agregarlo con su pregunta (como `manejaPauta`, ADR 0052), nunca un `rol === "media"` suelto |
| `calls.link_grain` y la métrica "atendidos sin Grain" | `lib/queries/sin-grain.ts` (ADR 0066, ticket 135) | M2: el CRM **ya sabe qué llamada tiene Grain**, pero guarda el link, no el transcript |
| Abonos con fecha, caja y saldo en `lib/queries/saldo.ts`; "lo que pagó en la llamada" ya es concepto (`docs/comercial.md` GC-13) | `lib/deals/abonos.ts` | M3: **"pagó en la llamada" se puede DERIVAR** (abono vigente el mismo día de la cita) en vez de pedirle a la closer otra marca. Hay que validarlo con datos |
| Un solo generador de links con UTM, derivado y no guardado | `generarLink` en `lib/atribucion/link-de-captacion.ts` (ADR 0024, 0051) | M15, M18: la UTM del día **tiene que salir de aquí**. La regla del repo prohíbe un segundo generador |
| El área y el canal salen de una regla | `resolverCanal` en `lib/atribucion/canal.ts` (ADR 0087) | Las stories ya llegan como `instagram rosario` / `milena` con `stories`, `manychat`, `storiesfijadas` (`docs/analytics.md`, `docs/hub.md`): **ya caen en Orgánico** |
| Leads por UTM | `submissions` + `utmsDelEnvio` + Hub › Origen (248) | M5: **leads por historia es una agregación sobre el hecho envío** (contrato C-2 de `docs/hub.md` §8), no una tabla nueva |
| Semáforo de WhatsApp | ADR 0089, `lib/reporte-whatsapp/` | ⚠️ **Choque de nombre**: "semáforo" ya significa otra cosa en el repo. El de historias necesita otro nombre en `docs/overview.md` §11 |
| Metas del mes y de la cohorte, Hub | `docs/hub.md`, `docs/metricas.md` | M6: hay metas comerciales; **no hay meta de leads de stories** |

### 5.2 En el cockpit (`../pipeline-creacion-contenido`)

Next.js + Supabase propio + n8n, **multi-tenant**: clientes `retia`, `estadox`, `30x`, con "voces" (creadores) y aislamiento por RLS (`docs/agents/plan-multi-tenant.md`). Pantallas: Curar (feed, colecciones, referentes, voces, sugeridos, descartes, históricos), Transcribir, Entender, Operar (corridas), Ajustes (motor, equipo, rendimiento).

| Pieza | Qué cubre del pedido |
|---|---|
| Feed con calificación `🔥 / 👍 / 👎` (`apps/dashboard/domain/feed.ts`) | M9 se cambia aquí |
| Guion limpio, tabla aparte del crudo (ADR-074) | M10: el crudo es la transcripción literal traducida (ADR-009); el limpio es una capa derivada. El bug del inglés hay que diagnosticarlo con casos reales |
| Colecciones (ADR-073), marca de grabado por video (ADR-069, ADR-070) | Es el primer paso del "manejador de contenido": **el ciclo hoy se corta en "grabado"**. `outputs.estado` admite `publicado` desde la `001` y tiene 0 filas: **la publicación no existe todavía** |
| Descubrimiento de referentes (ADR-020) y búsqueda por temática con Virlo (ADR-102) | M11: la rutina de 30 referentes por creador se apoya aquí |
| Etiquetas de rendimiento por vistas por día (ADR-104) | Pendiente de la decisión del piso de 500k (reunión del 21-oct) |

**Lo que no existe en ninguno de los dos:** transcripts de llamadas, análisis de dolores / deseos / objeciones, banco de formatos de historias, cruce, parrilla, publicación, calendario del equipo, rol de media, meta de stories.

---

## 6. Propuesta para gerencia

### 6.1 La tesis

**Retia ya tiene las dos mitades del loop, pero no se hablan.** El CRM sabe qué se vende, quién pagó en la llamada y qué UTM trajo cada lead. El cockpit sabe qué contenido se buscó, se aprobó y se grabó. La centralización que se pidió es **cerrar ese loop**: lo que vende en las llamadas alimenta el contenido, y el contenido se mide contra los leads que trae. Todo lo demás (parrilla, calendario, alertas) es la rutina que lo hace repetible.

```
  CRM (comercial)                                         Cockpit (contenido)
  llamadas + Grain ─► ¿pagó en la llamada? ─► dolores,     referentes ─► guion ─► grabado
                                              deseos,  ─►  formatos  ─► CRUCE ─► parrilla ─► publicado
                                              objeciones                            │ UTM del día
  leads por UTM ◄─────────────────────────────────────────────────────────────────────┘
  Hub: cumplimiento · leads por historia · semáforo relativo · regla del −20%
```

### 6.2 Arquitectura recomendada: dos sistemas, un loop, una puerta

| Opción | Qué es | A favor | En contra |
|---|---|---|---|
| A. Todo dentro del CRM | Se construye media como módulos de `retia-metrics` | Una app, un login, los leads ahí mismo | El cockpit es multi-tenant y sirve a **30X y EstadoX**: meterlo al CRM de Retia rompe eso o duplica el producto. Se reescribe lo que ya funciona y Majo ya usa |
| B. Dos sistemas sueltos | Cada uno crece por su lado | Nada se toca | Es justo el problema de hoy: no hay loop |
| **C. Dos sistemas con contrato (recomendada)** | El **CRM** es el registro de lo comercial y de la atribución; el **cockpit** pasa de buscador a **manejador de contenido** (producción, parrilla, publicación, calendario). Se hablan por **dos contratos** y comparten la puerta de entrada | Respeta lo construido y el multi-tenant; la atribución sigue teniendo **un solo generador de UTM** (regla dura del repo); cada equipo trabaja en su herramienta; la gerencia ve todo en el Hub | Dos apps que mantener; hay que cuidar que "centralizado" se sienta como un solo lugar (enlace cruzado, mismo login de Google, la vista móvil) |

**Los dos contratos (la pieza que hay que diseñar bien, porque todo lo demás cuelga de ahí):**

1. **CRM → cockpit: "la fuente de información del mes".** Por programa, los insights de las llamadas cerradas (dolores, deseos, objeciones, con su frecuencia y si vienen de pago en llamada o de follow-up). Respeta la frontera de programa: una historia de Milena se alimenta solo de las llamadas de su programa.
2. **Cockpit → CRM: "lo que se publicó".** Por día y creador, la UTM usada, el tipo (secuencia / video), el CTA (link / ManyChat), si se publicó y si "el creador no dejó". **La llave del cruce es la UTM**, generada por el CRM. Con eso el Hub calcula leads por historia, cumplimiento y semáforo sin que nadie copie números.

**Por qué esta es la base que escala:** un creador nuevo, un programa nuevo o un cliente nuevo de contenido (30X, EstadoX) entran como datos, no como código (ADR 0012, contrato C-1); la métrica de stories es una consulta más sobre los envíos (C-2); y el día que se quiera paid media o carruseles de venta, se agregan como tipos de contenido en la misma parrilla, sin otro sistema.

### 6.3 Qué gana cada rol

| Rol | Hoy | Con el sistema |
|---|---|---|
| Media (Majo, Dani) | Persigue fotos a diario, inventa ángulos, arma UTMs a mano, agenda a pulso | Una sentada al mes para producir, una carpeta por día con su link, tareas del día con fecha, el ángulo ya probado en ventas |
| Gerencia / producer | No sabe qué historia vendió ni si se publicó | Cumplimiento, leads por historia y semáforo en el Hub; las decisiones (CTA del carrusel) salen de una regla |
| Comercial (closers) | Sube el Grain a mano | El Grain se sube solo; su llamada exitosa vuelve como contenido que le trae leads más calientes |
| Creadores | Persecución diaria, links propios sin UTM | Un pedido al mes con fecha clara; una cifra de cuántos leads trajo su contenido |

---

## 7. Evaluación crítica: capacidades, esfuerzo y riesgos

Tamaño: **S** = días · **M** = 1 a 2 semanas · **L** = 3 semanas o más (estimación, sin fuente verificada: depende de las decisiones de §8 y de cuántas sesiones en paralelo).

| # | Capacidad | Dónde | Tamaño | Depende de | Riesgo / lo que no se sabe |
|---|---|---|---|---|---|
| C1 | Rol de media y su pregunta en `lib/auth/roles.ts`; qué ve | CRM | S | Decidir qué ve (§8 D3) | Migración de enum; alcance por programa (ADR 0094) |
| C2 | Link con UTM por creador (M18) | CRM | S | Convención de UTM de stories (§8 D4) | Casi cero código: `generarLink` existe |
| C3 | Cockpit: vista previa con sonido, calificación binaria, navegación (M8, M9) | Cockpit | S a M | Qué pasa con las 🔥/👍 históricas (alimentan el aprendizaje, ADR-012) | Cambiar la calificación toca la señal de aprendizaje del motor |
| C4 | Diagnóstico del guion limpio en inglés (M10) | Cockpit | S | Casos reales de Majo | Puede ser el prompt o el idioma de entrada |
| C5 | Transcripts de Grain al CRM, solos (M2) | CRM | M | **API o webhook de Grain** y su plan (sin fuente verificada) | Datos personales de los leads; quién puede leerlos; costo |
| C6 | "Pagó en la llamada" derivado (M3) | CRM | S | Validar que el abono del mismo día lo representa | Si no cuadra, hay que pedir la marca a la closer (más trabajo para ellas) |
| C7 | Análisis de dolores / deseos / objeciones por programa (M4) | CRM | M | C5, C6; el prompt | LLM sobre conversaciones con datos personales; privacidad y costo |
| C8 | Banco de formatos: subida manual de pantallazos (M13) | Cockpit | S a M | D6 (plataforma o WhatsApp) | Por WhatsApp hay que montar un número y un flujo (Kapso / Juanito ya existen en Retia) |
| C9 | Agente que recorre stories de referentes (M12) | Cockpit | M | Cuentas de nicho; herramienta | **Riesgo alto**: Instagram exige sesión, puede bloquear la cuenta, y los términos de uso lo restringen. Empezar manual (C8) y medir antes |
| C10 | El cruce con un botón: 15 + 15, preguntas de CTA (M14) | Cockpit | M | C7, C8; los prompts con el facilitador | La calidad depende del prompt: hay que medirla con Majo, como se hizo con el guion |
| C11 | Parrilla del mes: carpetas por día, link del día, CTA link / ManyChat, "ya publiqué", "el creador no dejó", banco de fotos (M15) | Cockpit (UTM del CRM) | L | C2, contrato 2 | Es el centro del manejador de contenido. Almacenamiento de fotos y video (costo) |
| C12 | Pipeline de tareas con fechas relativas en hábiles (M16) | Cockpit | M | C11 | El día hábil ya tiene regla en Retia (festivos cuentan como hábiles, `AGENTS.md`) |
| C13 | Hub: leads por historia, cumplimiento, semáforo relativo, meta de stories y regla del −20% (M5, M6) | CRM | M | Contrato 2, D4, D7 | Necesita meta de leads de stories, que hoy nadie definió |
| C14 | Vista móvil (M7) | Ambos | S a M | Que el flujo diario sea bajar carpeta y marcar | Una app instalable desde el navegador evita las tiendas; sin fuente verificada de que alcance para bajar fotos al carrete en iPhone |
| C15 | Calendario del equipo con reglas que se reacomoda (M17) | Cockpit | **L** | Todas las reglas cerradas (hay contradicciones) | **El de más riesgo**: es un problema de agenda con restricciones; las reglas cambian y hay excepciones que solo sabe una persona. Empezar con las reglas como alertas de choque sobre un calendario que se llena a mano, y automatizar después |
| C16 | Rutina de 30 referentes por creador al mes (M11) | Cockpit | S | C12 | Costo de Apify / Virlo por creador |

**Lo que el material NO resuelve y frena el diseño:**

1. **Paid media no se desglosó.** Si es parte de la centralización, falta una sesión entera (Frankenstein, teleprompter, selfie, BSL, estáticos).
2. **Reglas que se contradicen** (§3.2, §3.4): duración del miércoles, hora del daily, cadencia del reporte.
3. **No hay meta de leads de stories**, y sin ella la regla del −20% y el semáforo no tienen contra qué medir.
4. **Quién es dueño de las reglas.** F3 dice *"me avisas a mí"*, y Speaker 1 de F3 está sin nombre. Si es Michael, su salida deja la regla sin dueño.
5. **El cobro y pago a Diego** se anunció y no se habló.
6. **Volumen real:** creadores por persona (3 o 4) × 30 historias + 4 carruseles + reels. Define almacenamiento y costo de IA.

### 7.1 Roadmap inicial (propuesta, para cerrar en la sesión de roadmap)

| Fase | Meta (cómo se sabe que salió) | Capacidades |
|---|---|---|
| **0. Esta semana** | Decisiones de §8 cerradas; Majo y Dani entran al CRM; cada creador tiene su link; el cockpit revisa con video y sonido | D1 a D8, C1, C2, C3, C4 |
| **1. El loop de ventas** | El primer reporte de dolores / deseos / objeciones de un programa, sacado de llamadas reales, en manos de Majo y Dani | C5, C6, C7 |
| **2. La máquina de stories (un creador piloto)** | Un mes completo de stories de un creador salido del cruce, publicado desde la parrilla con su UTM diaria | C8, C10, C11, C12 |
| **3. La medición** | En el Hub: cumplimiento y leads por historia del piloto, con su semáforo | C13, C14 |
| **4. Escalar y el resto del árbol** | Todos los creadores; carruseles con su regla; calendario con alertas de choque; agente de stories si C8 lo justificó | C9, C15, C16, carruseles, paid media |

El piloto de la fase 2 sigue la regla de la sesión (*"que funcione la ruedita"*) y la del repo (medir antes de reorganizar): un creador que ya funciona bien (Milena) da una base de comparación limpia.

---

## 8. Preguntas para el daily (con Michael y Daniel)

Cada una cambia lo que se construye. Recomendación entre paréntesis.

> **26-oct (F4, daily con Michael, y respuestas de Mani):** quedaron cerradas D1 a D12, D14 y D15; D13 queda para
> cuando concierna. **Lo cerrado cambia la arquitectura de §6.2**: todo se centraliza en el CRM y el cockpit se migra
> (ya no sirve a 30X ni EstadoX). La visión vigente está en [`propuesta.md`](./propuesta.md).

| # | Pregunta | Por qué importa |
|---|---|---|
| D1 | ¿"Centralizar" significa **una sola app**, o **un solo lugar donde ver y operar** aunque sean dos herramientas conectadas? (Recomiendo lo segundo, §6.2) | Define la arquitectura entera |
| D2 | ¿El cockpit pasa a ser el manejador de contenido (parrilla, publicación, calendario)? | Es donde vive el 70% de lo pedido |
| D3 | Rol de media en el CRM: ¿qué ve? ¿Transcripts completos o solo los insights? ¿De qué programas? (Recomiendo insights, por programa, y transcripts solo a pedido) | Privacidad de los leads; frontera de programa |
| D4 | Convención de la UTM de stories: ¿qué campo lleva el día? (Recomiendo `utm_campaign`, porque `utm_content` y `utm_term` los lee solo el emparejador; va con ADR) | Sin esto no hay leads por historia |
| D5 | Grain: ¿qué plan tienen y quién es el dueño de la cuenta? ¿Se puede leer por API? | C5 entero |
| D6 | Pantallazos: ¿se suben a la plataforma o por WhatsApp? | C8 |
| D7 | ¿Cuál es la meta de leads de stories, por creador y por mes? | Semáforo y regla del −20% |
| D8 | Cadencia del reporte de ventas: ¿semanal (F1) o al corte del mes (F2)? | C7 |
| D9 | ¿Quién es dueño de las reglas del calendario y de las excepciones? (Sobre todo si Michael sale) | C15 |
| D10 | Miércoles de carruseles: ¿1 h o 4 h? Daily: ¿8:00 o 8:30? | Reglas del calendario |
| D11 | ¿Milena sigue publicando sola o el equipo publica todo? | Cumplimiento y control de links |
| D12 | Paid media: ¿entra en esta primera centralización? | Alcance y esfuerzo |
| D13 | ¿Hay presupuesto para Grok Bot u otra herramienta de scraping y para el almacenamiento de fotos y video? | C9, C11 |
| D14 | El cobro y pago a Diego: ¿se mapea también? | Alcance |
| D15 | Creador piloto para la fase 2 (recomiendo Milena) | Fase 2 |

---

## 9. Referencias: dónde está dicho cada cosa

Los transcripts completos están en [`crudo/`](./crudo/). Los temas se ubican por la frase que abre cada uno; F1 y
F3 además llevan minuto en el crudo, F2 no.

| Código | Archivo | Original |
|---|---|---|
| F1 | [`crudo/2026-10-20-media-ops-machine-wispr.md`](./crudo/2026-10-20-media-ops-machine-wispr.md) | [Wispr](https://notes.wisprflow.ai/shared/dXB-Sod89Utev7sCSPA7YtZLg5F2l0J7WFDzosaa2JA) |
| F2 | [`crudo/2026-10-20-story-production-wispr.md`](./crudo/2026-10-20-story-production-wispr.md) | [Wispr](https://notes.wisprflow.ai/shared/nR-x977LsjMWWIAEqLTgsS1AcX6vHuSxKd3YZ-xjbl8) |
| F3 | [`crudo/2026-10-20-calendario-reels-grain.md`](./crudo/2026-10-20-calendario-reels-grain.md) | [Grain](https://grain.com/note/8d2b60d7-edc0-46ea-8db3-c45f1d9d0cb4/S426U4RLVmLPfNb5hIQVFlRhYeyQoYmX532oYAHA) |

| Tema (sección de este documento) | Fuente | Dónde buscarlo |
|---|---|---|
| Objetivo: rutinas, recordatorios desde tech, varias cuentas sin incendios (§1.1, §1.2) | F1 | La apertura, antes del método |
| Método MECE, cinco formas de partir, prueba de un buen árbol (§1.3) | F1 | Primer tercio: ejercicios del banco, la ropa y la cafetería |
| Árbol orgánico / paid media, Frankenstein, landing fuera (§2) | F1 | "¿Qué frentes tenemos?" |
| Stories de venta hoy: intercalado, parrilla de Francisco (§3.1) | F1 | "¿En qué momentos se están produciendo esas stories de venta?" |
| El loop de las llamadas, pago en llamada vs follow-up, reporte por default (§3.1 paso 1, M4) | F1 | "Debería salir de las llamadas de venta que fueron exitosas" |
| Agente con sesión de Instagram (M12) | F1 | "Manu, ¿hay alguna forma de que Grokbot…" |
| Los 8 pasos, el cruce 15 + 15 (§3.1) | F2 | "Dentro de Venta y Stories, vamos a desmenuzarlo" |
| Transcripts al CRM, perfil de Majo y Dani (M1, M2, M3) | F2 | "Comercial nos debería mandar transcripts" |
| Niveles de conciencia (§3.1 paso 3) | F2 | "¿Qué es un nivel de conciencia?" |
| Fotos, videos, 30 − 6 y 30 − 3 (§3.1 pasos 4, calendario) | F2 | "Banco de fotos", "30 menos seis" |
| CTA de llamada o lanzamiento (§3.1 paso 3) | F2 | "¿Qué cambia cuando tenemos lanzamiento?" |
| UTM por día, ManyChat, app en el celular (§3.1 pasos 6 a 8, M7, M15) | F2 | "Falta parrillar y publicar" |
| Hora de publicación, "ya publiqué", dashboard, semáforo (§3.1 medición, M5) | F2 | "Estandaricemos hora de subida" |
| Un link por creador, "el creador no dejó" (§3.1 medición, M18) | F2 | "Tenemos que tener el control de los links" |
| Carruseles y la regla del −20% (§3.2) | F2 | "Orgánico carruseles y venta carrusel" |
| Reels: vista previa con sonido, calificación binaria (§3.3, M8, M9) | F2 | "Orgánico reels y venta reels… desde cero" |
| Guion limpio en inglés o peor que el crudo (M10) | F3 | [04:24] a [05:23] |
| 30 referentes por creador al mes (M11, R9) | F3 | [06:34] |
| Reglas del calendario R1 a R7 (§3.4) | F3 | [06:34] a [08:32] y lo que sigue, hasta el corte |
| Lo que ya existe en el CRM (§5.1) | Este repo | Las rutas de la tabla |
| Lo que ya existe en el cockpit (§5.2) | `../pipeline-creacion-contenido` | `ROADMAP.md`, `docs/adr/ADR-069`, `ADR-074`, `docs/agents/plan-multi-tenant.md` |
