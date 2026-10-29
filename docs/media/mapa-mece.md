# Mapa MECE de la operación de media: el norte, lo que falta y cómo aplicarlo a los tickets

> **Qué es.** La lectura de las sesiones del 20-oct (F1 a F3), el daily del 26-oct (F4) y la revisión del 28-oct
> (F5, [`crudo/2026-10-28-daily-tech-2-transcript.md`](./crudo/2026-10-28-daily-tech-2-transcript.md)) con el método
> que la propia sesión enseñó (F1: MECE, "cada hoja se responde con un dato: cuánto demora y cuánto hay que
> producir"). Sirve para dos cosas: saber **qué datos le faltan a cada hoja** (y a quién se le piden) y saber **qué
> considerar al construir cada ticket**. Escrito el 29-oct-2026. Donde choca con el crudo, manda el crudo; donde choca
> con [`propuesta.md`](./propuesta.md), manda la propuesta.
>
> Los números y citas salen de [`extraccion.md`](./extraccion.md), que se escribió desde los transcripts completos
> (§3.1 stories, §3.2 carruseles, §3.3 reels, §3.4 calendario). Aquí no se repiten: se cruzan.

---

## 1. El norte (en tres líneas)

1. **Vender** es el criterio (F4, F5): el contenido se juzga por el escalón al que llegan los leads que trae, no solo
   por cuántos trae. "Más que el volumen, me interesa la calidad" (F5).
2. **El pipeline de media no vive en la memoria de nadie**: el sistema dice qué toca hoy, qué falta y qué se atrasó,
   con las reglas de media como **datos**, nunca como código (F1, F5: "nada hardcoded").
3. **Se construye en pasadas** (F1: "que funcione la ruedita"): medir primero, después migrar, después la fuente de
   insights, al final el pipeline completo. F5: "la parrilla full funcional es lo más complicado; no prometer".

### Cómo se juzga un cambio (la prueba MECE aplicada al software)

| Prueba de un buen árbol (F1) | Qué exige del CRM |
|---|---|
| Mutuamente excluyente | Cada pieza tiene **un** tipo, **un** creador, **un** programa: nada se cuenta dos veces entre tipos ni entre programas |
| Colectivamente exhaustivo | Todo lo que media produce cabe en un tipo del catálogo; lo que no cabe se ve (alarma), no se pierde. Hoy falta paid (fuera de alcance) y stories orgánicas (libres) |
| En el idioma del equipo | Se dice *reel*, *carrusel*, *historia*, *pieza*, *parrilla*, *golden rule*; nunca *post* ni jerga de CRM |
| Cada hoja con **duración y cantidad** | El modelo de la plantilla guarda las dos magnitudes de cada hoja (cuánto demora, cuánto hay que producir) |
| Concluyente | Cada pantalla termina en una decisión de media o de gerencia (§3.5 de la propuesta) |

---

## 2. El árbol, hoja por hoja: qué sabemos y qué falta

**Leyenda:** ✅ lo dijo media con número · 🟡 lo dijo con contradicción o sin número · ⬜ no se habló.
"Cantidad" = cuánto hay que producir. "Duración" = cuánto demora hacerlo. Las citas de reglas R1 a R9 son las de
`extraccion.md` §3.4.

| Hoja | Cantidad / mes | Duración | Cuándo | Quién (rol) | Hueco que cierra media |
|---|---|---|---|---|---|
| **Stories de venta · fuente y cruce** | ✅ ~30 por creador (15 secuencias + 15 scripts de video) | ⬜ lo que demora **revisar** el cruce | ✅ 30 − 6 hábiles | coordinación de media | Cuánto tarda revisar 30 propuestas y quién decide |
| **Stories · pedir material** | ✅ 10 selfies + 15 videos por creador | ⬜ plazo real que tarda el creador | ✅ pedir 30 − 6; presionar 30 − 3; real 30 − 0 | coordinación de media | Cuántos creadores por persona (F3: 3 o 4) y qué pasa si no llega |
| **Stories · edición** | ✅ las del mes de todos los creadores de la persona | ✅ 4 a 5 h (⬜ ¿por creador o en total?) | ✅ día 1, mañana, sin grabaciones | coordinación de media | Si las 4 a 5 h son por creador o por persona |
| **Stories · parrilla y publicar** | ✅ 1 secuencia o video al día por creador | ⬜ | ✅ entre 12:00 y 1:00 | coordinación de media | Cuánto demora el día (bajar carpeta, copiar link, publicar, marcar) |
| **Stories propias del creador** | libre | n/a | libre | creador | Decidido (F4): libres, con su link fijo |
| **Carruseles orgánicos** | ✅ 1 por semana por creador | 🟡 20 min a 1 h (F2) contra ~4 h el miércoles (F3) | 🟡 miércoles; se publica jueves (F2) pero hoy sábado | coordinación de media | **Contradicción**: duración y día de publicar |
| **Carruseles de venta** | decidido: solo cambiar el CTA del último slide, solo Milena (F4) | n/a | n/a | n/a | Nada |
| **Reels orgánicos · referentes** | ✅ ~30 nuevos por creador al mes | ⬜ curar y calificar | ✅ día 2 (si no es miércoles ni grabación) | coordinación de media | Cuánto demora calificar 30 y quién califica (el 🔥 cambia de persona) |
| **Reels · scripts** | ⬜ cuántos por creador y mes | ✅ ~3 h por creador (lo que más demora es la corrección) | ✅ martes o jueves, antes de la grabación (R6, R7) | coordinación de media | Scripts por grabación |
| **Reels · grabación** | ⬜ reels por sesión | ⬜ | ✅ lunes y viernes (R1) | creador + grabación | **Cuántos reels salen de una sesión** (define todo lo demás) |
| **Reels · revisión y edición** | ⬜ | ✅ revisión ≤ 1 h al día (R2); Diego 5:00 a 5:30 (R3) | ✅ a diario | coordinación + edición | Qué es "terminó de editar" (F4: solo binario) |
| **Reels de venta** | 🟡 "Frankenstein": otro CTA en la misma grabación | ⬜ | misma sesión | media | No se desglosó: sin número |
| **Contenido para pauta** | ⬜ | ⬜ | ⬜ | otro equipo | Fuera (F4: pauta es de César y Anderson). Solo "crear contenido para pauta" entra |
| **Equipo (reglas de choque)** | | | 🟡 daily 8:00 o 8:30 (R4) | todos | **Contradicción**: hora del daily |
| **Cobro y pago a Diego** | n/a | n/a | n/a | gerencia | Fuera (F4): solo estado binario de edición |

**Lo que este cuadro dice, en una frase:** de las 14 hojas, las de **stories de venta** están casi completas; las de
**reels** tienen las reglas del calendario pero no la **cantidad** (cuántos reels y scripts salen de una sesión); y
hay **tres contradicciones** que solo media puede cerrar (miércoles, publicación del carrusel, daily). Un "mes real"
de Majo y Dani llena exactamente esas celdas.

---

## 3. Qué se cerró el 28-oct (F5) y qué sigue abierto

| Tema | Estado | Lo dice | Dónde cae |
|---|---|---|---|
| Qué es "pago rápido" y "pago después" | **Abierto, es de gerencia**, y ya es un dato: `programs.corte_pago_rapido_dias`, editable en Programa (ADR 0109 punto 3). Falta el valor | F5 (Mani: "2 o 3 días", ejemplo, no decisión) | Pregunta 6; ticket 319 (listo) |
| Qué es alto, medio, bajo y casi nada en el mapa de calor | **Abierto, es de gerencia**: el 347 ya pinta calor continuo sin cortes escritos. Si gerencia quiere rótulos, son datos del programa | F5 (Michael) | 335, 347 |
| Calidad, no solo volumen | **Confirmado.** La vista debe mostrar la **forma** de cada origen (qué porción cae en cada escalón) al lado de su volumen | F5 (Michael) | 335 |
| El link de la pieza lleva el tipo de contenido | **Ya lo hace**: `utm_campaign = <tipo>_<creador>_<aaaammdd>` (ADR 0108). El ejemplo de la diapositiva era un ejemplo | F5 (Michael lo pidió) | 317 (listo) |
| Empezar a medir | **Compromiso: sábado 31-oct.** Lunes 2-nov se habla del paso 2 | F5 | 315 a 320 (en main) |
| Creadores no entran al CRM | **Confirmado**: reciben su link por WhatsApp una vez | F5 (Michael) | ADR 0110 |
| Closers pegan siempre el link de Grain | Confirmado como expectativa. Hoy 66% (propuesta §3.6) | F5 | 328, `sin-grain` |
| Lo que se extrae de cada llamada | **Lo define media**, no un prompt libre: "ustedes me dicen exactamente qué les gustaría extraer" | F5 (Mani) | 329 |
| Reporte semanal + aviso por WhatsApp | Confirmado, por programa | F5 | 330, 331 |
| **Darle vida al CRM: MCP, luego Juanito, luego IA** | **Orden acordado.** Meter IA dentro del CRM sale caro (API contra suscripción); cada quien usa su Claude por MCP | F5 | **Nuevo, sin ticket** (§5) |
| Las clases como fuente de ángulos | **Sí.** Michael las saca como MD; entran al banco de insumos con la etiqueta "clase de programa X" | F5 | 329, 338 (§4) |
| Tablero por lanzamiento (orgánico + pauta) | **Útil, no es prioridad.** Después del paso 5 | F5 | Pregunta 12 |
| Vistas de historias de Instagram en el CRM | **No por ahora.** El transcript es ambiguo ("las de media, pero no"): confirmar | F5 | Pregunta 7 |
| Peso de cada escalón en el resumen | Michael la piensa y responde. Se resuelve cuando se construya el reporte | F5 | Pregunta 10; 330 |
| ManyChat: cómo está montado y cómo se mide el lead que entra por "comenta la palabra" | Michael se la lleva (a Majo) | F5 | Pregunta 11; 334 |
| Presupuesto de IA y del agente de referentes | Después (pasos 2 y 3) | F5 | Pregunta 8 |
| Quién presenta el método a los creadores | **Sin respuesta**, nadie la tomó | F5 | Abierta, ver §4 |
| Paid media, pago a Diego | Fuera de alcance | F4 | n/a |

---

## 4. Insumos que faltan y dónde entran en el plan

### De gerencia (Michael y Daniel)

| # | Insumo | Bloquea | Prioridad |
|---|---|---|---|
| G1 | **Quién es el dueño de las reglas del calendario** si Michael sale (F4: Michael lo responde) | 334 (reglas como datos con dueño) | Alta: es un riesgo de continuidad, no de código |
| G2 | **Cuántos días hábiles es "pago rápido"**, por programa | La lectura de 319/320/335 con el número real (el código ya funciona con el default) | Media |
| G3 | Rótulos del calor (alto/medio/bajo/casi nada) si se quieren, o confirmar que basta el calor continuo | 335 | Baja |
| G4 | **Peso de cada escalón** al resumir insights | 330 | Media, cuando se construya |
| G5 | Meta de leads de stories (hoy se compara contra la mejor, F4) | La regla del −20% del carrusel (no construida) | Baja |
| G6 | Presupuesto de IA y almacenamiento de video/fotos | 329 (tope), 338 video | Media: el 329 pide el tope antes de correr |
| G7 | ¿Vistas de Instagram en el CRM? Confirmar el "no" | Nada hoy | Baja |
| G8 | **Habilitar a Alejo (closer) y Juanito para Alejo y Dana** | La adopción de Grain y los avisos (340 a 346, 331) | **Urgente (pedido de Michael, 28-oct)** |
| G9 | Que los closers de todos los programas usen el CRM y peguen Grain (Jero, Maru) | 328 → 329: sin llamadas con link no hay insights | Alta, es adopción |

### De coordinación de media (Majo y Dani)

| # | Insumo | Cierra | Bloquea |
|---|---|---|---|
| M-a | **Un mes real**: cada evento, duración, responsable (F5: "muy valioso"). Con el cuadro de §2 como plantilla de lo que se busca | Todos los ⬜ de §2 | 333, 334, 336 |
| M-b | **Pipeline de reels completo**, paso por paso, y cuántos reels salen de una grabación | Hojas de reels | 333, 334 |
| M-c | **Estados por los que pasa una pieza** | 333 | 333 |
| M-d | **Cerrar las tres contradicciones**: duración del miércoles, día de publicar el carrusel, hora del daily | R4, R5 | 334 |
| M-e | Lista de creadores con programa y cuenta (¿ya están cargados en producción?) | 316, 317 | 326 |
| M-f | **Qué se extrae de cada llamada**: la lista exacta de dolores, deseos, objeciones, y lo que quieran además | El esquema del 329 | 329 |
| M-g | **ManyChat**: quién cambia la palabra o el botón, cada cuánto y cómo se cuenta el lead | Pregunta 11 | 334 aviso del día |
| M-h | Qué es "terminó de editar" para Diego (binario) y quién lo marca | 333 | 333 |
| M-i | Ejemplos de contenido que vendió y que no, y por qué | Calidad del cruce | 332 |
| M-j | Cómo suben hoy los pantallazos y los crudos (plataforma o WhatsApp) | 337, 338 | 337, 338 |

### De Michael (aparte de gerencia)

- **Los transcripts de clases en MD**, con programa y nombre de la clase (F5). Entran por el banco de insumos.
- **Una sentada con Milena y Rosario** para presentar el método (F2). Nadie tomó "quién presenta" el 28-oct.

### Tuyos (Mani)

- Crear el usuario `closer` de Alejo; confirmar el de Dana (F5: Dana ya tiene, Alejo no).
- Activar Juanito para Alejo y Dana.
- Confirmar que el generador y los creadores están en producción para el compromiso del sábado 31-oct.
- Probar el 328 contra un link real de Grain (única pieza que lo deja en curso).
- Aprobar el traslado real del cockpit (322, pide tu ok) cuando quieras mover el paso 2.

---

## 5. Lo que cambia en el plan (qué se enmienda)

| Dónde | Cambio |
|---|---|
| **336** | Sube de "no es la prioridad" a **ruta crítica del paso 4**: es el levantamiento que llena §2 y desbloquea 333 y 334. Se hace con el cuadro de §2 como guion |
| **329** | Dos fuentes, no una: **llamada** (con su escalón) y **clase** (sin escalón, subida como MD con programa y nombre). Las citas se guardan con su escalón y **el peso se aplica al armar el reporte**, no al extraer: así cambiar los pesos (G4) no obliga a re-extraer |
| **331** | Reconciliar con el ADR 0114: hoy dice "el endpoint del semáforo gana un envío semanal"; la puerta nueva de avisos es la del 340. Un solo contrato, no dos |
| **335** | Mostrar la **forma** de cada origen (porción por escalón) junto al volumen, no solo el conteo (F5: calidad) |
| **Nuevo: MCP del CRM** | Paso 1 de "darle vida al CRM" (F5), antes de Juanito ampliado y de IA interna. Sin ticket todavía: pide grill y ADR (nueva puerta, ver consideraciones) |
| **Pregunta 9** de la propuesta (clases) | Respondida: sí, Michael las pasa como MD |
| **Preguntas 6, 10, 11** | Asignadas: 6 y 10 a gerencia (Michael piensa y responde), 11 a Michael con Majo |

---

## 6. Consideraciones al aplicar cada ticket

Salen de las hojas de §2 y de los principios de la propuesta §1. Son restricciones para quien implemente, no
alcance nuevo.

| Ticket | Qué tener presente |
|---|---|
| **319, 320, 335, 347** (escalera) | El corte "rápido" es un dato del programa y no hay número todavía: la vista **funciona sin él** y dice cuál usa. Muestra volumen y forma juntos. Con ~25 ventas al mes, nunca concluir por pieza: agregar por tipo, creador y ángulo (propuesta §3.6) |
| **326** (parrilla del día) | Su cantidad es 1 secuencia o video al día por creador; publicar 12:00 a 1:00; el día se ve en el teléfono. Distinguir **link** de **ManyChat**: con ManyChat el link del día no aplica y alguien debe cambiar el botón ese día (aviso, pregunta 11). "El creador no dejó" cuenta aparte. **Aceptación real: Majo y Dani reemplazan sus notas del celular**, no solo 375 px |
| **333, 334** (estados, plantilla) | No construir hasta M-a a M-d. Cada hoja guarda **cantidad y duración**. Fechas relativas en días hábiles de Retia (festivos cuentan; solo se excluyen sábado y domingo) con **dos fechas** (la que se le dice al creador y la real, 30 − 3 contra 30 − 0). Preguntar si "30" es fin de mes (F2 empezó con "el último lunes del mes"). Las reglas R1 a R9 arrancan como **alertas de choque** sobre un calendario que se llena a mano, no como autoagendado (C15). Cada regla con dueño (G1) |
| **328** (Grain) | Fuente frágil: alarma cuando falla la lectura. La adopción (G9) decide si hay datos |
| **329, 330** (insights) | Esquema estructurado definido por media (M-f), no un prompt abierto. Frontera de programa, citas sin datos personales, tope de gasto (G6). Clases y llamadas son fuentes distintas |
| **331** (aviso semanal) | Ver §5: reconciliar con 340. Activación de Juanito de los closers (G8) |
| **332** (agente del cruce) | Propone al banco, nunca crea piezas. La calidad se mide con Majo (M-i) |
| **337, 338** (formatos e insumos) | Aquí caen los MD de clases. Video espera G6 |
| **316, 317, 318** (creador, pieza, link) | El tipo ya va en el link. Verificar que el tipo sale del catálogo `tipos_pieza` (datos de media, no enum) |
| **324, 325, 327** (cockpit) | M8 (vista con sonido), M9 (calificación binaria), M10 (guion limpio en español, posible cambio de modelo), M11 (30 referentes). Calificar 🔥 depende de la persona: la calificación binaria con banco de "difíciles" |
| **MCP del CRM (nuevo)** | Cada persona entra **como ella misma**: mismo rol, mismo alcance de programas que la app. Solo lectura al comienzo. Usa las mismas consultas que la app (C-2), no SQL aparte. Nueva puerta que "nada de la app es público" no cubre: ADR y excepción nombrada en `AGENTS.md`. Sin tokens compartidos |

---

## 7. Prioridades (propuesta, para cerrar con Mani)

Orden por **qué desbloquea y cuánto cuesta esperar**, no por tamaño.

| # | Qué | Por qué en este lugar |
|---|---|---|
| **0** | Habilitar a Alejo y Juanito para Alejo y Dana | Michael lo pidió "cuanto antes"; sin ellos no hay llamadas ni avisos |
| **1** | Empezar a medir: generador en producción, creadores cargados, link fijo enviado a cada uno | Compromiso del sábado 31-oct. Un dato no capturado hoy no se recupera |
| **2** | Probar el 328 con Grain real y empujar la adopción (G9) | Cada semana sin links es una semana menos de insights. 66% hoy |
| **3** | **336: el mes real y el pipeline de reels con Majo y Dani** | Desbloquea 333 y 334; llena los ⬜ de §2; es lo que Michael ya iba a pedir |
| **4** | 322/323/324: el cockpit migra y media entra al CRM | Lunes 2-nov se habla del paso 2; M8 a M11 son quejas diarias de media |
| **5** | 329 → 330 → 331: insights, reporte semanal y aviso | Necesita M-f y G6; depende de 2 |
| **6** | MCP del CRM, después Juanito ampliado, después IA interna | Orden acordado en F5. Pide grill y ADR |
| **7** | 326 → 333/334: parrilla del día, estados y calendario | Parrilla del día primero (reemplaza las notas); el calendario completo "va a tocar iterar" (F5) |
| **8** | 335 y 332: origen × escalón y agente del cruce | Necesitan un mes de piezas con link y el reporte semanal |
| Después | Tablero por lanzamiento, agente de referentes de stories, presupuesto, vistas de Instagram | Michael: "no es prioridad", "paso dos, tres" |
