---
id: 381
etapa: hub
serves: "Recorrido de Mani por Hub › Comercial (5-nov) sobre el 379 · weekly con Daniel Tovar (3-nov, docs/hub.md §0, G-8, G-9, G-14) · contrato de entendimiento (docs/structure.md §9) · ADR 0109 · ADR 0115 (N1, N3, N5)"
depends: [379]
status: en main
---

# 381 — Hub › Comercial: datos confiables, una sección por pregunta y el Info único

## Por qué

Mani, 5-nov, recorriendo Comercial ya con el 379 en main: el formato mejoró pero **los datos no cuadran** y la
pantalla sigue con texto sin jerarquía. La medición contra producción (5-nov, solo lectura, últimos 30 días) explica
las dos cosas.

### Lo medido

1. 🩸 **"Completo" y "parcial" clasifican por el PRIMER envío, no por si la persona completó.** En los programas de
   Typeform el parcial llega antes que el completo y abre el deal (`deals.submission_origen_id`), así que el deal
   queda "de un parcial" aunque la persona termine el formulario minutos después:

   | Programa | Deals "de parcial" | De esos, el lead SÍ completó |
   |---|---|---|
   | Comunícate con Confianza | 735 (de 745) | 469 |
   | Comunicarte | 688 | 470 |
   | Tactical Investor | 647 | 434 |

   En Comunícate con Confianza quedan **10 deals "completos" y 0 agendaron**, y las 127 agendas aparecen como "de
   parcial". Ningún envío parcial trae la cita (0 de 2.314 tienen Calendly): la agenda llega siempre con el completo.
   La tasa "de los deals completos agendó" y el reparto por origen son, hoy, ruido. Es el "números random" del
   recorrido. Vive en `filtroDealsDesde` / `filtroDealsDesdeQueAgendaron` (`lib/queries/metricas-filtros.ts:402`).
2. 🩸 **El % show y el % cierre se calculan sobre una minoría de las citas.** Citas ya ocurridas (30 días) que siguen en
   `resultado = 'agendada'` (nadie marcó qué pasó): Comunicarte 267 de 330, Tactical 289 de 364, Comunícate con
   Confianza 40 de 132. Casi todas con el deal parado en Agendado. Las ventas sí tienen su llamada marcada (17 de 25,
   11 de 14, 7 de 7), así que lo que falta marcar son sobre todo las citas que **no** vendieron: el % cierre sale
   inflado y "No cerró" sale corto. Es la regla N3 sin cumplir: la cifra se muestra completa con medio dato. El "321
   sin resultado" del recorrido es esto, y hoy es una insignia chica.
3. **El embudo mezcla universos.** En `components/dashboard/operacion.tsx` la barra de Agendadas cuenta todas las
   agendas creadas en el periodo y el % que tiene encima es "de los deals completos"; la barra de Shows cuenta
   llamadas con show y el % es sobre el grupo de citas ocurridas. El % entre dos barras no es el cociente de las
   barras, y por eso "no dice de dónde se pierden".
4. **"Cómo cerró" no es una etiqueta: se calcula al leer** (`escalonDeDeal`, `lib/queries/escalera.ts:115`). Nadie
   lo analiza ni sale del transcript: cerró en la llamada = el primer abono es del mismo día (Bogotá) que la última
   llamada con show anterior al pago; con seguimiento = después; no cerró = tuvo show y no hay venta. Depende entero de
   que la llamada esté marcada (punto 2). **La ficha del deal no lo muestra**: solo la lista del Hub.

### Lo que pidió Mani

- Un solo botón **Info** por pestaña con todo el "Cómo se calcula" (como en Hoy, `components/hub/info-de-pagina.tsx`),
  y en ninguna tarjeta un plegable suelto. Para todas las pestañas, cuidando que la barra del encabezado ya está llena.
- Un solo formato por dato: si hay barra, no repetir el número en un cuadro debajo.
- Menos texto: cada tarjeta con un título corto, un número que manda y nada de frases tipo "54 % de 480 deals de los
  que llegaron". El periodo se dice una vez arriba, no en cada tarjeta.
- Todo lo de un closer en **una sola sección de closers**, no repartido por tarjeta.
- Las etapas en sus **dos caminos**: el del setter (Registrado → En gestión → Contactado → Calificado → venta sin
  llamada) y el de la llamada (Agendado → Atendido → Compromiso → Ganado). Hoy van en una sola lista y cambian de
  formato a mitad de la tarjeta.
- Fuera el desplegable "ver cifras por semana" y el bloque de "% que agendaron, completos y parciales, por semana";
  la gráfica de deals contra agendas se queda (pasos y mes, valor por punto).

## Decisiones

- **D1 (aprobada por Mani, 5-nov). Un deal es "completo" si su lead tiene un envío completo en el programa hasta el fin del
  periodo; "parcial" si solo tiene parciales; "a mano" si no tiene envío.** Es lo que preguntó Daniel Tovar (*"si yo
  llené el formulario hasta la mitad, ¿me cuenta como un deal?"*): la pregunta es por la persona, no por el orden en
  que llegaron los webhooks. Una función en `lib/queries/metricas-filtros.ts` y su gemela TS (N1, N2: test con un
  lead que manda parcial y luego completo, que hoy cae como parcial). Se actualiza la fila de `docs/metricas.md` y el
  vocabulario de `docs/overview.md` §11 en el mismo commit (N8). La etapa de entrada (ADR 0069) no cambia.
- **D2 (aprobada por Mani, 5-nov). Las citas sin resultado no se inventan: se muestran como la cobertura de la tasa.** El %
  show y el % cierre dicen "parcial" con su base ("sobre 63 de 330 citas") cuando las citas sin marcar pasan del 10 %
  del grupo (N3, `lib/queries/` ya tiene la cobertura del 351 si está; si no, la calcula el embudo), y la alarma de
  citas sin marcar sube a la primera fila de la pestaña, con su cifra abrible y el closer dueño. No se cuentan como
  no-show.
- **D3. Secciones en el orden de las preguntas de Gerencia** (de arriba abajo):
  1. **Cifras clave**: Agendadas, % show, % cierre, Agenda → venta, con su base en pequeño y la alarma de D2.
  2. **¿Dónde se pierden?**: un embudo de un solo universo (los deals creados en el periodo: creados → agendaron →
     tuvieron show → compraron), donde cada % es el cociente exacto de las dos barras y lo perdido entre barras es la
     resta. Completos y parciales (D1) como un interruptor del mismo embudo, no como otra tarjeta.
  3. **¿Cómo cierra cada llamada?**: la barra apilada de los tres grupos de Daniel Tovar con número y %, una vez. Sin
     el cuadro repetido debajo. Ventas sin llamada y no llegaron a la llamada, una línea abrible.
  4. **¿Generamos deals que agendan?**: la gráfica de deals contra agendas tal como está; sin el desplegable ni el
     bloque semanal de completos y parciales.
  5. **¿Dónde se quedan y cuánto tardan?**: dos embudos de etapas, camino del setter y camino de la llamada, con el
     mismo formato (pasaron, siguen aquí, se perdieron aquí); los días en etapa como mediana con su unidad ("2 días
     hábiles"), y "—" cuando hay menos de 5 deals en la etapa.
  6. **Agendas por semana**: las barras apiladas (show, no-show, sin marcar, futuras), título corto con el rango de
     la semana ("27-oct a 31-oct").
  7. **Closers**: una sola sección, una fila por closer con todo lo medible en el periodo: agendas, % show, % cierre,
     agenda → venta, los tres grupos de cierre como barra apilada chica, citas sin marcar, Vendido · Recaudado · Por
     cobrar. Quien no tiene casos en una columna muestra "—", no una fila de texto. Sale de las tarjetas 3 y 4 la
     vista por closer.
  8. **Detalle de auditoría** (plegado, abierto en PDF): sin dueño, abiertos por owner, motivos de pérdida, los siete
     escalones.
  "¿Vamos a llegar?" (371) no se toca.
- **D4. El Info es UNO por pestaña y vive en la fila de pestañas del Hub**, al final a la derecha, no en la barra de
  filtros. Las cinco pestañas pasan sus secciones a `InfoDePagina`; cada sección de la página lleva un "?" que abre el
  Info en su apartado. `ComoSeCalcula` sale de Comercial (y de las demás pestañas del Hub en la medida que se migren
  a su Info; Pauta y Mi espacio pueden quedarse con el viejo hasta su ticket).
- **D5. La ficha del deal dice cómo cerró.** Una línea de solo lectura en la ficha ("Cerró en la llamada", "Cerró
  con seguimiento · 3 días hábiles", "No cerró", "Venta sin llamada registrada") calculada por `escalonDeDeal`, con un
  "?" a la misma explicación. Sin columna nueva ni migración.
- **D6. Formato**: un número que manda por tarjeta (`cifra`), una línea de contexto como máximo, cero frases de más
  de ocho palabras en el cuerpo. Todo lo demás al Info. Los colores de los tramos salen de los cinco tonos de
  `<Badge variant>` y de los tokens de Tinta, con leyenda una vez por gráfica.

## Fuera de alcance

Cambiar la fórmula del escalón (ADR 0109), la etapa de entrada (ADR 0069), Pauta (el escalón por anuncio es del 350),
Hoy y Dinero salvo mover su Info a la fila de pestañas.

## Archivos

`lib/queries/metricas-filtros.ts` (D1), `lib/queries/deals-contra-agendas.ts`, `lib/queries/vista-deals-contra-agendas.ts`,
`lib/queries/embudo-etapas.ts`, `lib/queries/embudo-con-filas.ts`, `components/dashboard/operacion.tsx`,
`components/dashboard/escalera.tsx`, `components/deals-contra-agendas.tsx`, `components/graficas/barras.tsx`,
`components/hub/info-de-pagina.tsx`, la fila de pestañas del Hub, la ficha del deal (D5), la rama `comercial` de
`app/(app)/p/[programa]/hub/page.tsx`, `docs/metricas.md`, `docs/overview.md` §11.

## Done cuando

- [x] D1: un lead con parcial y luego completo cuenta como completo (test); en Comunícate con Confianza los deals
      completos del último mes pasan de 10 a ~480. Medido el 5-nov: 10 → 482 (128 agendaron); Comunicarte 501 → 977, Tactical 396 → 836.
- [ ] Cada % del embudo es el cociente de las dos barras que une (test sobre la función que arma los pasos).
- [ ] D2: con más del 10 % de citas sin marcar el % show y el % cierre dicen "parcial" y su base; la alarma está en
      la primera fila y abre la lista.
- [ ] Las etapas en dos caminos con un solo formato; pasaron + siguen + se perdieron = llegaron, por etapa y camino.
- [ ] Una sola sección de closers; ninguna otra tarjeta tiene vista por closer.
- [ ] Ningún `ComoSeCalcula` en Comercial; el Info en la fila de pestañas abre en su apartado desde cada "?".
- [ ] La ficha del deal dice cómo cerró.
- [ ] typecheck, lint, tests del cambio, `npm run build`; Rams `quick_review`; recorrido en claro, oscuro y 375 px con
      gerente y developer; `npm run test:humo` en escritorio; `docs/metricas.md` y `docs/overview.md` §11 al día.
