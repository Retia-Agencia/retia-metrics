---
id: 390
etapa: hub
serves: "Auditoría 385 F3-02, F2-05, F2-04 · ADR 0115 N3, N6"
depends: [353]
status: todo
---

# 390 — Captura del resultado de la cita

Hijo del [385](./385-mcp-integridad-de-tools-de-metricas.md) (plan F7 en [`docs/auditoria-datos-2026-11/f7-plan.md`](../auditoria-datos-2026-11/f7-plan.md)). Reglas: ADR 0115.

## Por qué

`calls.resultado` es `NOT NULL DEFAULT 'agendada'`, así que "agendada" y "no sé qué pasó" son el mismo valor. 730 citas pasadas siguen así (610 de octubre); en octubre solo 158 de 784 tienen resultado. Los % de show y de cierre salen sobre el 15 a 20 % restante y el Hub los marca "parcial". Es de captura, no de fórmula (F2-05). El 353 ya dejó el predicado en `lib/deals/resultados-de-llamada.ts` y unificó Inbox y bandera. A verificar antes de abrir: si F2-04 (la cita suelta sin resultado no cuenta como "por marcar" y las de deals ya cerrados quedan fuera: Confianza 34 contra 38) sigue vigente tras el 353; si no, queda solo la captura.

## Alcance

**Cubre:** F3-02, F2-05, F2-04 (residuo tras el 353), C-02 del 30-oct (cobertura del resultado).

**Archivos calientes** (donde chocan dos sesiones): `lib/deals/resultados-de-llamada.ts`, `components/` de acciones de llamada, `lib/queries/inbox.ts`, `lib/mi-espacio/notificaciones.ts`.

**Migración:** Ninguna, por decisión de F3 §1: "sin resultado" se deriva (`agendada` con `fecha_agenda` pasada).

## Fuera

Lo que pertenece a otro hijo del 385 (ver `docs/auditoria-datos-2026-11/f7-plan.md` §1: una causa, un ticket). Este ticket no migra conceptos del registro que no toca.

## Done cuando

- [ ] Decisión de Mani registrada: ¿la cita suelta sin resultado cuenta como "por marcar"?
- [ ] Un mecanismo de captura que empuje al closer a marcar (recordatorio en Mi espacio o la bandeja, con conteo por closer); no una reja que bloquee, porque un cobro real no se frena por un dato de configuración (misma lógica del ADR 0034).
- [ ] La cobertura sube medida: citas pasadas sin resultado por semana antes y después, por programa.
- [ ] El Hub dice "parcial" con base y faltan en toda razón que dependa del resultado (cierra con el 351).
- [ ] Regla N8 (ADR 0115): la fila de `docs/metricas.md`, el vocabulario de `overview.md` §11 y el ADR afectado quedan reescritos en el mismo commit, título e índice incluidos.
- [ ] Registro: ficha de `citas_pendientes` y `llamadas_sin_resultado` en `lib/metricas/registro.ts` y su línea borrada de `lib/metricas/pendientes.ts` con `TOPE_DE_PENDIENTES` bajado.
