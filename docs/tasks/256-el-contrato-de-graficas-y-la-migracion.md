---
id: 256
etapa: hub
serves: "docs/hub.md O5 · el ADR que sale del 255 · ADR 0067"
depends: [255, 250]
status: en main
---

# 256 — El contrato de gráficas y la migración de las que existen

## Objetivo

Que toda gráfica del Hub salga de una pieza propia sobre la librería elegida, con las reglas escritas una vez, y que
las gráficas hechas a mano se reemplacen.

## Alcance

- **Dentro:** el contrato en `structure.md` §9 (sistema de diseño): cuándo va cada tipo (línea para tendencia, barra
  para comparar, nunca torta para más de tres partes), ejes lineales con cero, número y % en el tooltip, la comparación
  dicha en palabras (251), la meta como línea, la frescura del dato, la tabla alternativa, colores solo de Tinta.
- **Dentro:** una o dos piezas en `components/` que envuelven la librería con ese contrato (no se usa la librería
  suelta en una pantalla); `SeriesLineales` se reemplaza y se borra cuando nadie la use.
- **Dentro:** migrar las gráficas que existen en el Hub (Dinero, Comercial, deals contra agendas) a la pieza nueva.
- **Dentro:** una fila nueva en la tabla de Contratos de `AGENTS.md`: "Cómo se dibuja una gráfica".
- **Fuera:** gráficas nuevas de otros tickets (las hacen ellos con la pieza).

## Done cuando

- [ ] Ninguna pantalla importa la librería directo; un guardián lo verifica, mordido en los dos sentidos.
- [ ] Las cifras de cada gráfica migrada son las mismas que antes (recorrido comparando).
- [ ] `npm run build` y `npm run test:humo` en verde; recorrido en claro, oscuro y 375 px.

---

## Enmienda 14-oct: la librería es ECharts (ADR 0091)

- Se instala `echarts` en versión exacta con este ticket (ADR 0006); **no** `echarts-for-react`.
- La pieza de `components/graficas/` es un envoltorio propio sobre `echarts/core` (`init`, `setOption`, `resize`,
  `dispose`), con registro explícito de las series que se usan, el tema de Tinta resuelto con `getComputedStyle` y
  reaplicado al cambiar el modo, renderizador SVG por defecto, módulo `aria` y tabla alternativa. Se carga con
  `next/dynamic` solo donde hay gráfica.
- **El requisito de interacción es el tooltip al pasar el mouse** (Mani, 14-oct): día, valor, contra qué se compara y
  el cambio en número y %. El teclado por punto no es requisito, y el clic en un punto para abrir el dato queda para
  después (ticket aparte si se pide); la cifra sigue abriendo su lista desde fuera de la gráfica.
- **Sin "A" ni "B" en ninguna gráfica**: el tooltip usa el vocabulario de "Comparar con" del 251. Si el 251 no ha
  llegado cuando se migre, la pieza recibe el texto de la comparación como prop y no lo arma con letras.
- Referencia: el prototipo de ECharts del 255 (commit `f28ba57`, rama borrada) resolvía tokens, tooltip con número y
  % y clic a la lista; no se rescata tal cual, porque usaba `echarts-for-react`.
