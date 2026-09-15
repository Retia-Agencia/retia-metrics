---
id: 004
serves: "spec §5 criterios 2 y 3"
status: todo
---

# 004 — Consultas del dashboard: cierres, tasas y caja con filtros

## Objetivo
Existe una función que, dado un programa y un rango de fechas, devuelve cierres, tasas y caja
agrupados por closer, lista para pintar el dashboard.

## Alcance
- Dentro: `lib/queries/dashboard.ts` con una función que agrupa `calls`/`sales` por `closerId`
  dentro de un `programId` y un rango de fechas (hoy, esta semana, o un rango custom).
- Fuera: no incluye la UI (ticket 005).

## Done cuando
- [ ] Devuelve cierres, caja recaudada y tasa de cierre por closer.
- [ ] Un filtro de "hoy" y uno de rango custom dan resultados correctos contra datos de prueba.
- [ ] Filas con `origen="sheets"` y `origen="app"` se suman juntas sin lógica especial.

## Notas
Depende del ticket 001 (el campo nuevo debe existir aunque esta consulta no lo use todavía).
