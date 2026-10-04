---
id: 188
etapa: O6
serves: "ADR 0067; 148 (Lo que sigue, puntos 1, 2, 4, 6 y 13)"
depends: [148, 065]
status: todo
---

# 188 — Cada cifra del dashboard abre su lista: embudo por etapa y comparativo

## Por qué existe

El 148 dejó cifras sin clic, contra el ADR 0067: las del embudo por etapa (065) y las filas del comparativo entre
closers. Y dos detalles de la lista que se ven raros.

## Alcance

1. **Embudo por etapa:** métricas nuevas en `lib/queries/metricas-con-filas.ts` (abiertos por etapa y owner, sin
   dueño por antigüedad, entraron a cada paso, tiempo en etapa), con el universo de `lib/queries/embudo-etapas.ts`.
   Los ids no van en la URL: la lista se recalcula con la métrica, la etapa y el rango.
2. **Comparativo:** cada celda (agendas, shows, cierres, caja) abre su lista filtrada por ese closer, con el código
   opaco (`codigoDeCloser`). Si el 187 ya cambió las tasas, la celda abre el grupo del 187.
3. **La lista desde un dashboard sin comparación** no inventa un periodo B (`vistaDeLista`).
4. **Una sola etiqueta de closer** en el dashboard y sus listas (hoy el comparativo usa `coalesce(closer_id, nombre,
   email)` y las listas `closer_id`). La función vive en `lib/closers/identidad.ts`.
5. **Color por antigüedad en las listas (GC-35):** los tonos de `<Badge variant>` (Tinta), sin colores a mano.

## Done cuando

- Por cada métrica nueva, un test que compara la cifra contra todas las páginas de la lista (con anulados y otro
  programa en la base).
- Clic en cada celda del comparativo abre la lista del closer correcto; forjar el código de un closer de otro
  programa da 404 o lista vacía, nunca filas ajenas.
- Typecheck, lint, tests, `npm run build`; recorrido en `dev:local`.
