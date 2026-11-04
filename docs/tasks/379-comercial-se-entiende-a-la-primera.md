---
id: 379
etapa: hub
serves: "Recorrido de Mani por Hub › Comercial (4-nov) · weekly con Daniel Tovar (3-nov) · contrato de entendimiento (docs/structure.md §9) · ADR 0067 · ADR 0109 · ADR 0115 (N3, N5)"
depends: [372]
status: en main
---

# 379 — Hub › Comercial se entiende a la primera

## Por qué

Mani, 4-nov, en Hub › Comercial de Comunícate con Confianza, closer Nicolás, C1 desde el inicio: "sigue horrible".

1. **Todo pesa igual y todo es tabla y texto.** El embudo es una tabla de cinco columnas con un párrafo de tres líneas
   debajo; ninguna cifra manda.
2. **Datos vacíos a la vista.** Con un closer elegido, Registros y Deals creados salen "—" en todas las columnas
   (N3: nacen del formulario, no se atribuyen a un closer) y las columnas Comparación y Cambio salen "—" porque no
   hay comparación. Son filas y columnas enteras que no dicen nada.
3. **Conversión por etapa no dice dónde se perdieron ni dónde se quedaron.** Muestra cuántos llegaron a cada paso y
   el %, pero no cuántos siguen abiertos en ese paso ni cuántos se perdieron ahí. Tiempo en etapa igual, y los dos
   viven dentro del plegable "Diagnóstico", que Mani no quiere.
4. **Ventas por escalón** es lo que pidió Daniel Tovar el 3-nov y no explica cómo se calcula, desde cuándo, con
   qué fecha ni dónde ver el sustento. Daniel nombró tres tipos de cierre (weekly, transcript): *"las que se cerraron
   durante la llamada, las que no se cerraron en la call sino que ya después el closer haciendo follow-up les vendió, y
   las que de verdad no se cerraron"*. Hoy la tarjeta muestra siete escalones en una tabla con calor.
5. **Trazabilidad:** la lista que abre cada cifra es la prueba de todo lo que se ve; tiene que alcanzarse desde cada
   número y cada segmento visual.

## Decisiones

- **D1. Los tres de Daniel arriba, los siete abajo.** La tarjeta abre con los tres grupos de Daniel, sobre los deals
  con una llamada atendida (es la pregunta de Daniel: qué pasó con cada llamada):
  - **Cerró en la llamada** = escalón 1.
  - **Cerró con seguimiento** = escalones 2 + 3 (con los días hábiles medianos de la cita al pago).
  - **No cerró** = escalón 5.
  Aparte, en una línea con su cifra abrible: escalón 4 ("ventas sin llamada registrada": no hay contra qué medirlas,
  es un hueco de datos, se arregla cargando la llamada) y escalones 6 + 7 ("no llegaron a la llamada"). Los siete
  escalones siguen disponibles en "Ver los siete escalones" (detalle, plegado; abierto en PDF). **Ninguna fórmula
  cambia:** los grupos son sumas de celdas que ya calcula `cargarEscalera` (`lib/queries/escalera.ts`); el agrupamiento
  vive en una función pura nueva junto a `escalonDeDeal`, con su test, y `docs/metricas.md` (fila Ventas por escalón)
  y `docs/overview.md` §11 (vocabulario: "cerró en la llamada", "cerró con seguimiento", "no cerró") se actualizan en
  el mismo commit (N8). *Razón:* es la vista que pidió gerencia, sin perder el detalle del ADR 0109 que la sustenta.
- **D2. Las piezas visuales son compartidas.** `components/graficas/barras.tsx`: embudo horizontal con lo perdido
  entre pasos, barra apilada al 100 % y barras horizontales con número; SVG o divs con tokens de Tinta, sin ECharts,
  con tabla alternativa accesible, y cada segmento abre su lista como su número. El 378 (Hub › Hoy) reutiliza el
  embudo; no se hace una segunda versión. Si ya existe cuando se tome el ticket, se reutiliza y se extiende.
- **D3. Nada vacío:** con closer elegido el embudo empieza en Agendadas y lo dice en una línea; las columnas de
  comparación solo existen si hay comparación (contrato de entendimiento, punto 4).

## Alcance (en este orden de la pantalla)

1. **Cifras clave** (fila de 4, grandes): Agendadas, % show, % cierre, Agenda → venta. Cada una abre su lista y, si
   hay comparación, lleva su `Variacion`. Las tasas llevan su base en pequeño ("17 de 50").
2. **"¿Dónde se pierden los deals?"** — el embudo comercial como embudo de barras (Registros → Deals → Agendadas →
   Shows → Ventas), con el % del paso entre barras y lo perdido en cada paso como cifra abrible. Las citas pasadas sin
   resultado y "aún madurando" pasan a una insignia (`Badge variant`) con su cifra abrible, no a párrafos. Las reglas
   (completos contra parciales, grupo de citas ocurridas, base del % de cierre) van a "Cómo se calcula".
3. **"¿Cómo cierra cada llamada?"** — Ventas por escalón con D1: barra apilada al 100 % de los tres grupos, número
   y % de cada uno, días medianos del seguimiento, y por closer una barra apilada por fila (ranking por % cerró en la
   llamada). "Cómo se calcula" explica: universo (ventas del periodo + deals creados en él sin vender), qué fecha usa
   cada fila (venta o creación), qué es "mismo día" (Bogotá), el corte de pago rápido del programa y dónde se edita
   (Programa), y enlaza la lista de cada grupo.
4. **"¿Cómo va cada closer?"** — el comparativo con barra junto a % show y % cierre. Dinero con los tres nombres de
   Daniel (Vendido · Recaudado · Por cobrar) del módulo del 369, nunca "monto" ni "entró a caja" suelto.
5. **"¿En qué etapa se quedan y cuánto tardan?"** — fuera del plegable. Por etapa, una barra con tres tramos:
   **pasaron** al siguiente, **siguen aquí** (abiertos hoy en esa etapa) y **se perdieron aquí** (Cierre Perdido
   cuya etapa anterior fue esta), cada tramo abrible; al lado, el promedio de días en la etapa como barra horizontal.
   Los dos tramos nuevos se calculan en `lib/queries/embudo-etapas.ts` (función pura, test con un deal que avanza, uno
   que se queda y uno que se pierde, y la suma pasaron + siguen + perdidos = llegaron) y abren su lista por
   `lib/queries/embudo-con-filas.ts` (`tests/metricas-con-filas.test.ts`).
6. **Agendas por semana** como barras apiladas por semana (show, no-show, pendientes) por `components/graficas/`
   (ADR 0091), con la tabla como alternativa; las próximas agendas, una línea con su cifra abrible.
7. **Detalle de auditoría** (plegado en pantalla, abierto en PDF): sin dueño por antigüedad, abiertos por owner,
   motivos de pérdida y los siete escalones.
8. Todo párrafo explicativo que hoy está suelto pasa a su "Cómo se calcula" (`components/como-se-calcula.tsx`).

## Fuera de alcance

Cambiar cualquier fórmula del ADR 0109 o del embudo, otras pestañas del Hub (Hoy es el 378, Dinero su propia sesión),
la vista "todos los programas" más allá de que siga compilando y mostrando lado a lado (ADR 0048).

## Archivos

`components/dashboard/operacion.tsx`, `components/dashboard/escalera.tsx`, `components/graficas/barras.tsx` (nuevo),
`lib/queries/escalera.ts`, `lib/queries/embudo-etapas.ts`, `lib/queries/embudo-con-filas.ts`, y solo la rama
`seccion === "comercial"` de `app/(app)/p/[programa]/hub/page.tsx`. Las sesiones de Hoy y Dinero trabajan en paralelo:
no se tocan `hoy.tsx`, `reporte-diario.tsx`, `dinero*.tsx` ni sus ramas de `page.tsx`.

## Done cuando

- [ ] Con closer elegido no hay ninguna fila ni columna entera en "—"; sin comparación no hay columnas de comparación.
- [ ] Los tres grupos de Daniel suman sus escalones (test), y su "Cómo se calcula" enlaza la lista de cada grupo.
- [ ] Pasaron + siguen aquí + se perdieron aquí = llegaron, por etapa (test), y cada tramo abre su lista con el mismo
      número que muestra (`tests/metricas-con-filas.test.ts`).
- [ ] No queda el plegable "Diagnóstico"; ningún párrafo explicativo suelto.
- [ ] typecheck, lint, tests del cambio, `npm run build`; Rams `quick_review` de los componentes tocados; recorrido en
      claro, oscuro y 375 px con gerente y developer; `npm run test:humo` en escritorio.
- [ ] `docs/metricas.md` y `docs/overview.md` §11 al día (N8).
