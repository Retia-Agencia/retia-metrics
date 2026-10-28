---
id: 336
etapa: media
serves: "Mani, 28-oct: que el pipeline de contenido deje de ser solo búsqueda y sea manejo de media, como Metricool · propuesta.md §4.3 y §4.4 · F4 (Manu: el cockpit ya tenía scoped pasar de búsqueda a management)"
depends: []
status: todo
---
# 336 — Scoping: el manejo de media dentro del CRM, con Metricool de referente

**No es la prioridad:** es un levantamiento, no construcción. Alimenta a los tickets 333 y 334 (estados, plantilla,
tareas, avisos, calendario), que siguen bloqueados por las preguntas a media.

## Por qué

El cockpit (`../pipeline-creacion-contenido`) nació como máquina de búsqueda de referentes, y su ciclo hoy se corta en
"grabado" (`outputs.estado` admite `publicado` y tiene 0 filas; `docs/media/extraccion.md` §5.2). El refactor grande
que ya estaba pensado para él (F4: *"convertirlo no solo en máquina de búsqueda de contenidos, sino de manejo"*; en el
cockpit solo quedó escrito como "mapear estados de Notion al ciclo de vida de `outputs`", `PLAN.md`) se hace ahora en
el CRM, porque el cockpit se migra (ADR 0111). Michael sugirió Metricool como referente (F4). La propuesta ya tiene una
primera tabla de qué tomar y qué no (§4.3); falta bajarla a lo que media hace de verdad.

Lo que hay que encontrar, antes que funciones: **los dolores, las desconexiones y los datos atípicos que cada persona
de media resuelve por su cuenta y no le cuenta a nadie.** Las sesiones mostraron varios: los links en las notas del
celular, la parrilla de Francisco que existe porque él la pidió, el dinamismo en las grabaciones de Mile y Rochi
*"cuando hay ganas"*, el guion limpio que sale en inglés, la cuenta de cuántas historias dejó publicar cada creador.
*"Ustedes lo sufren todos los días y no alzan la mano"* (F2).

## Alcance

- **Recorrido con coordinación de media** (sin construir nada): un día y un mes reales, herramienta por herramienta
  (cockpit, Drive, WhatsApp, notas del celular, Instagram, ManyChat, Excel de Alejo). Por cada cosa que hacen: qué
  hacen, cuánto se demora, cuántas veces, dónde queda el dato y quién más se entera. Las hojas del árbol se responden
  con un dato (método de F1: cuánto demora y cuánto hay que producir).
- **Inventario de lo que se hace por fuera**: atajos personales, hojas propias, recordatorios, cifras que alguien lleva
  a mano y nadie más ve. Cada uno con su dolor y con la desconexión que tapa.
- **Metricool, función por función**, contra ese inventario: qué resuelve un dolor medido, qué es nice-to-have y qué no
  aplica. Parte de la tabla de `docs/media/propuesta.md` §4.3 y la corrige con lo levantado.
- **Salida**: un documento en `docs/media/` (inventario + mapa contra Metricool + qué se propone llevar al CRM), y las
  respuestas que necesitan 333 y 334. Las preguntas 1 a 3 de la propuesta §7 se pueden levantar en el mismo recorrido.
- **Fuera:** construir pantallas o reglas. Nada de lo levantado se vuelve regla sin que media lo confirme (propuesta
  §4.1: no asumir).

## Done cuando

- El inventario de lo que media hace por su cuenta está escrito, con tiempos y cantidades, y revisado por coordinación
  de media.
- El mapa contra Metricool dice, para cada función que se propone, qué dolor del inventario resuelve.
- 333 y 334 pueden partirse en tickets con lo levantado, o el documento dice qué falta.
