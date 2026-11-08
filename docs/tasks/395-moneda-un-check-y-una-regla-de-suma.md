---
id: 395
etapa: plataforma
serves: "Auditoría 385 F3-12 · AGENTS.md (nunca convertir moneda en silencio) · ADR 0124"
depends: [388]
status: todo
---

# 395 — Moneda: un `CHECK` y una regla de suma probada

Hijo del [385](./385-mcp-integridad-de-tools-de-metricas.md) (plan F7 en [`docs/auditoria-datos-2026-11/f7-plan.md`](../auditoria-datos-2026-11/f7-plan.md)). Reglas: ADR 0115.

## Por qué

`moneda` es texto libre en seis tablas; solo `objetivos` tiene `CHECK`. Comunicarte tiene gasto en COP (890 filas) y en USD (126, desde el 23-oct) en el mismo programa. Regla de AGENTS.md: nunca convertir moneda en silencio.

## Alcance

**Cubre:** F3-12.

**Archivos calientes** (donde chocan dos sesiones): `lib/db/schema.ts`, `lib/pauta/convertir-gasto.ts`, `lib/queries/saldo.ts`.

**Migración:** M6 (`CHECK` de `moneda`, después del 388 y de verificar los datos de hoy). ADR 0124.

## Fuera

Lo que pertenece a otro hijo del 385 (ver `docs/auditoria-datos-2026-11/f7-plan.md` §1: una causa, un ticket). Este ticket no migra conceptos del registro que no toca.

## Done cuando

- [ ] `CHECK` de `moneda` en `abonos`, `eventos_meta`, `enlaces_pago`, `cuotas_pactadas` (USD), `gasto_pauta` y `cuentas_publicitarias` (COP o USD), validado contra los datos de hoy.
- [ ] Test: una suma que mezcla monedas no compila o devuelve error; el caso Comunicarte COP más USD cuadra.
- [ ] Caso adversarial de F2 con abono en otra moneda y TRM, sobre base sembrada (producción no tiene ninguno).
- [ ] Regla N8 (ADR 0115): la fila de `docs/metricas.md`, el vocabulario de `overview.md` §11 y el ADR afectado quedan reescritos en el mismo commit, título e índice incluidos.
