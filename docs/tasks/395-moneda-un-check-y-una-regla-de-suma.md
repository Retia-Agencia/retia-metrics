---
id: 395
etapa: plataforma
serves: "Auditoría 385 F3-12 · AGENTS.md (nunca convertir moneda en silencio) · ADR 0124"
depends: [388]
status: done
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

- [x] `CHECK` de `moneda` en `abonos`, `eventos_meta`, `enlaces_pago`, `cuotas_pactadas` (USD), `gasto_pauta` y `cuentas_publicitarias` (COP o USD), validado contra los datos de hoy.
- [x] Test: una suma que mezcla monedas no compila o devuelve error; el caso Comunicarte COP más USD cuadra.
- [x] Caso adversarial de F2 con abono en otra moneda y TRM, sobre base sembrada (producción no tiene ninguno).
- [x] Regla N8 (ADR 0115): la fila de `docs/metricas.md`, el vocabulario de `overview.md` §11 y el ADR afectado quedan reescritos en el mismo commit, título e índice incluidos.

## Notas de la entrega (9-nov)

- Migraciones 0126 y 0127 (ADR 0124), aplicadas en producción el 9-nov con `lock_timeout` de 5 s; los 8 `CHECK` de moneda están validados. Datos medidos antes: ninguna fila fuera de COP/USD.
- Decisiones de Mani (9-nov, en chat): `abonos` acepta COP o USD en la base (el zod sigue exigiendo USD). Como consecuencia `enlaces_pago` también (0127, lo cazó el CI en `tests/abonos-del-deal.test.ts`: la reja del abono compara la moneda del link con la del abono). `eventos_meta` y `cuotas_pactadas`, solo USD. `fotos_pauta` se incluyó aunque el ticket no la nombraba (guarda la moneda del gasto).
- El caso adversarial (abono en COP junto a USD, y gasto COP + USD con y sin TRM) está en `tests/moneda-check.test.ts`, sobre PGlite sembrado.
- La TRM se mantiene con el cron diario `/api/cron/pauta` (`leerTrm`). No existe conversión de abonos: un abono en COP deja el saldo de su venta en `null` (`moneda_distinta`) hasta que se decida esa conversión.
- CI verde en `ba15992b`.
