---
id: 402
etapa: plataforma
serves: "Auditoría 385 F3-19 · ADR 0058 · ADR 0127"
depends: []
status: todo
---

# 402 — Retención de entregas y notificaciones

Hijo del [385](./385-mcp-integridad-de-tools-de-metricas.md) (plan F7 en [`docs/auditoria-datos-2026-11/f7-plan.md`](../auditoria-datos-2026-11/f7-plan.md)). Reglas: ADR 0115.

## Por qué

`sobres_crudos` (22 MB, 8.015 filas) solo purga las rechazadas a los 90 días; `notificaciones_calendly` tiene 1.112 de 1.115 sin leer y sin retención. No urge: es crecimiento, no cifra falsa.

## Alcance

**Cubre:** F3-19.

**Archivos calientes** (donde chocan dos sesiones): `lib/ingesta/`, cron de purga, `lib/calendly/`.

**Migración:** Ninguna prevista (purga por job). ADR 0127 con la política (cuánto se conserva y por qué).

## Fuera

Lo que pertenece a otro hijo del 385 (ver `docs/auditoria-datos-2026-11/f7-plan.md` §1: una causa, un ticket). Este ticket no migra conceptos del registro que no toca.

## Done cuando

- [ ] Política escrita y aplicada por un job con test; el crudo de una entrega procesada con firma válida no se pierde antes del plazo (regla de AGENTS.md: nunca perder un envío con firma buena).
- [ ] Regla N8 (ADR 0115): la fila de `docs/metricas.md`, el vocabulario de `overview.md` §11 y el ADR afectado quedan reescritos en el mismo commit, título e índice incluidos.
