---
id: 256
etapa: hub
serves: "docs/hub.md O5 · el ADR que sale del 255 · ADR 0067"
depends: [255, 250]
status: todo
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
