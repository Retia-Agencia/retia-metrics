---
id: 421
etapa: comercial
serves: "docs/diseno-cifra-y-pauta.md §7.1 (DM-8) · Q-2 y Q-3 de docs/paid-media-excels-2026-11-10.md · D-C del audit (docs/audit-hub-2026-11-10.md §8) · Mani, 10-nov"
depends: []
status: en curso  # 17-nov: fase 1 (dato, pantallas, deshacer y MCP) con la migración 0151 aplicada; falta la métrica Confirmadas
---

# 421 — Una sola cita con estados, y la cita confirmada

**DM-8 aprobada (Michael, 17-nov: «Si, cita confirmada así»)** con los estados Agendada, Confirmada, Realizada, No asistió, Reagendada, Cancelada. Falta la D-C del 403. **Diseño (Mani, 17-nov):** la confirmación es una columna aparte del resultado (`calls.confirmacion`, compartida con el 343), para que marcar Asistió nunca borre que el lead había confirmado; en pantalla se ve junto al resultado y se puede cambiar o quitar siempre.

## Alcance

1. `/grill-with-docs` sobre DM-8: estados de la cita (Agendada → Confirmada → Realizada / No asistió / Reagendada / Cancelada),
   las cinco métricas del §7.1 con su fecha, y "llamada" fuera del vocabulario de métricas.
2. ADR nuevo o enmienda (N8): `overview.md` §11, `metricas.md`, fichas.
3. Estado nuevo **Confirmada**: el closer lo marca cuando el lead dice que va (migración, cola de la sesión principal).
4. Métrica "Confirmadas" (de las citas del día) en Hoy y en Comercial.

## Done cuando

- [x] DM-8 confirmada por Michael, 17-nov (Paid Media no la objetó; la pregunta iba a Michael).
- [x] Ok de Mani a la migración (17-nov). Diseño: columna `calls.confirmacion` aparte del resultado, compartida con el 343; migración 0151 aplicada en producción el 17-nov.
- [ ] ADR, diccionario y vocabulario en el mismo commit.
- [x] El closer confirma, cambia o quita la confirmación desde el detalle de la llamada, la ficha del deal y las llamadas de hoy; queda en el historial, se deshace y el MCP la marca (`marcar_confirmacion`).
- [ ] Métrica «Confirmadas» (de las citas del día) en Hoy y Comercial, con su ficha y su lista (fase 2).
