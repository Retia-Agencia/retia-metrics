---
id: 398
etapa: hub
serves: "Auditoría 385 H-25 a H-28, F2-07 · ADR 0115 N8"
depends: []
status: done
---

# 398 — Diccionario y documentos al día

Hijo del [385](./385-mcp-integridad-de-tools-de-metricas.md) (plan F7 en [`docs/auditoria-datos-2026-11/f7-plan.md`](../auditoria-datos-2026-11/f7-plan.md)). Reglas: ADR 0115.

## Por qué

El diccionario y los docs describen cosas que el código ya no tiene o no describen lo que existe. Las filas nuevas de métricas con nombre ya fijado esperan al 397 en lo que toca rótulos.

## Alcance

**Cubre:** H-28 (unas 22 métricas sin fila: Students, cartera vencida, cortesías, descuento, perdidos por motivo, banderas del pulso, alertas, ventas por cohorte, Inbox, calidad del lead, entre otras), H-25 (`metricas.md:422` dice que la cartera no existe y el código la mantiene), H-26 (`pauta-interina.ts:23-26` cita `analytics.md` §6, ya historia), H-27, F2-07 (AGENTS.md y ADR 0048 dicen 5 correos en dos programas; hoy son 49), comentarios que aún nombran `estados_llegada`, y la constante `'High'` de `lead_quality` documentada como frontera (F3 §3.2).

**Archivos calientes** (donde chocan dos sesiones): `docs/metricas.md`, `docs/overview.md` §11, `AGENTS.md`, `docs/adr/0048-*`.

**Migración:** Ninguna.

## Fuera

Lo que pertenece a otro hijo del 385 (ver `docs/auditoria-datos-2026-11/f7-plan.md` §1: una causa, un ticket). Este ticket no migra conceptos del registro que no toca.

## Done cuando

- [x] Toda métrica visible tiene fila en el diccionario o está marcada como retiro pendiente con su ticket.
- [x] Ningún doc contradice al código en cartera, cifra de correos o fórmulas de Pauta (grep).
- [x] `docs/manuales/mapa-crm.html` regenerado si cambia overview §4 (regla de AGENTS.md).
- [x] Regla N8 (ADR 0115): la fila de `docs/metricas.md`, el vocabulario de `overview.md` §11 y el ADR afectado quedan reescritos en el mismo commit, título e índice incluidos.

**Cierre 9-nov:** commit `61a81e8a` (filas nuevas en `docs/metricas.md`, §11 de `overview.md`, AGENTS.md y ADR 0035/0043). `grep` sin contradicciones en cartera y correos; `mapa-crm.html` no aplica porque solo cambió overview §11, no §4.
