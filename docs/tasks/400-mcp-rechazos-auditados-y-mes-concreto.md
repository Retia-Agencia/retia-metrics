---
id: 400
etapa: mcp
serves: "Auditoría 385 F5.4 · ADR 0119 · docs/mcp.md"
depends: []
status: done
---

# 400 — MCP: rechazos de validación auditados y mes concreto

Hijo del [385](./385-mcp-integridad-de-tools-de-metricas.md) (plan F7 en [`docs/auditoria-datos-2026-11/f7-plan.md`](../auditoria-datos-2026-11/f7-plan.md)). Reglas: ADR 0115.

## Por qué

El 7-nov una llamada falló porque el modelo mandó `periodo: "octubre"`; el esquema la rechazó antes del handler y no quedó en `mcp_llamadas`. Y el periodo no acepta un mes concreto.

## Alcance

**Cubre:** F5.4.

**Archivos calientes** (donde chocan dos sesiones): `lib/mcp/` (registro de llamadas, esquema de periodo), `lib/periodo.ts`.

**Migración:** Ninguna prevista. A verificar: si `mcp_llamadas` (`lib/db/schema.ts:2807`) necesita una columna para marcar el rechazo; si sí, entra a la cola como M8 con su ADR.

## Fuera

Lo que pertenece a otro hijo del 385 (ver `docs/auditoria-datos-2026-11/f7-plan.md` §1: una causa, un ticket). Este ticket no migra conceptos del registro que no toca.

## Done cuando

- [x] Todo rechazo de validación queda en la bitácora con quién, qué tool y qué campo falló (sin guardar datos personales).
- [x] `AAAA-MM` aceptado como periodo, con test en Bogotá y mes de 28, 30 y 31 días.
- [x] Test forjado: una llamada con `periodo` inválido deja una fila.
- [x] Regla N8 (ADR 0115): la fila de `docs/metricas.md`, el vocabulario de `overview.md` §11 y el ADR afectado quedan reescritos en el mismo commit, título e índice incluidos. `docs/mcp.md` actualizado.
