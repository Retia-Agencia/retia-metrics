---
id: 004
fase: F2
serves: "spec §5 criterios 2 y 3"
depends: [018, 020]
status: done
---

# 004 — Consultas del dashboard

## Objetivo
Funciones que, dado un programa y un rango de fechas, devuelven lo que pide el reporte diario de
Retia, listas para pintar.

## Alcance
- Dentro: `lib/queries/dashboard.ts` con, para el rango: agendas, llamadas realizadas (con
  show), % de show, ventas, % de cierre, caja recaudada por moneda (suma de `abonos` por
  `abonos.fecha`, ADR 0013), compromisos de pago abiertos.
- Dentro: los mismos números por closer y por origen del lead; conteo por motivo.
- Dentro: vista de cohorte: meta, vendidos, faltan, días hábiles restantes, meta dinámica y
  cumplimiento contra la meta lineal (usa 020).
- Dentro: leads del rango contra `metaLeadsDia`.
- Fuera: la UI (005).

## Done cuando
- [x] Un abono de hoy sobre una venta del mes pasado suma a la caja de hoy y no suma una venta.
- [x] Filas `origen="sheets"` y `origen="app"` se suman sin lógica especial.
- [x] Nunca se suman programas distintos entre sí.
- [x] Tests con datos de prueba para "hoy", "esta semana" y un rango custom. Los números de C1 de
      `docs/agents/handoff.md` sirven de validación donde apliquen.
