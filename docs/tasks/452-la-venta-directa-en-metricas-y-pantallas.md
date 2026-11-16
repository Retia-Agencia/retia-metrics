---
id: 452
etapa: metricas
serves: "ADR 0133 punto 7 · N1 a N9"
depends: [451]
status: todo
---

# 452 — La venta directa se lee como tal en el Hub, Students y Deals

## Qué
Que una venta directa cuente donde debe y no ensucie lo de los closers: venta y caja de la cohorte sí; tasa de cierre,
comisión y ranking de closers no. En Students y en la ficha del deal se lee "Venta directa".

## Dónde mirar
`lib/metricas/registro.ts` (registro de métricas y sus guardianes) · `lib/hub/` · `app/(app)/p/[programa]/students/page.tsx:211`
(hoy pinta "Sin dueño") · "Deals sin dueño" (`lib/metricas/registro.ts:867`): una venta directa no es un pendiente de
reclamar · `docs/metricas.md`.

## Cómo
1. Una sola pregunta central "¿es venta directa?" (vendida, sin dueño, con abono de pasarela), con su gemela SQL.
2. Recorrer cada métrica del registro que filtre por dueño o closer y decidir su trato con la regla del punto 7.
3. Abrir las pantallas tocadas y hacer clic en lo que se abre (convenciones del repo).

## Done cuando
- [ ] Test por cada métrica que cambia, con un deal de venta directa en el fixture.
- [ ] "Deals sin dueño" no cuenta ventas directas.
