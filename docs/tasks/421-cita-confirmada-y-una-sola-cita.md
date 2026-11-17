---
id: 421
etapa: comercial
serves: "docs/diseno-cifra-y-pauta.md §7.1 (DM-8) · Q-2 y Q-3 de docs/paid-media-excels-2026-11-10.md · D-C del audit (docs/audit-hub-2026-11-10.md §8) · Mani, 10-nov"
depends: []
status: todo  # 17-nov: DM-8 aprobada; espera el ok de Mani para la migración
---

# 421 — Una sola cita con estados, y la cita confirmada

**DM-8 aprobada (Michael, 17-nov: «Si, cita confirmada así»)** con los estados Agendada, Confirmada, Realizada, No asistió, Reagendada, Cancelada. Falta la D-C del 403. Lleva migración (estado Confirmada): **no se genera hasta el ok de Mani**.

## Alcance

1. `/grill-with-docs` sobre DM-8: estados de la cita (Agendada → Confirmada → Realizada / No asistió / Reagendada / Cancelada),
   las cinco métricas del §7.1 con su fecha, y "llamada" fuera del vocabulario de métricas.
2. ADR nuevo o enmienda (N8): `overview.md` §11, `metricas.md`, fichas.
3. Estado nuevo **Confirmada**: el closer lo marca cuando el lead dice que va (migración, cola de la sesión principal).
4. Métrica "Confirmadas" (de las citas del día) en Hoy y en Comercial.

## Done cuando

- [x] DM-8 confirmada por Michael, 17-nov (Paid Media no la objetó; la pregunta iba a Michael).
- [ ] Ok de Mani a la migración del estado Confirmada.
- [ ] ADR, diccionario y vocabulario en el mismo commit.
- [ ] El closer confirma una cita desde la ficha del deal; la métrica abre su lista.
