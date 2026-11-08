---
id: 396
etapa: plataforma
serves: "Auditoría 385 F3-11 · ADR 0022 · ADR 0125"
depends: []
status: todo
---

# 396 — Cohortes: solape decidido

Hijo del [385](./385-mcp-integridad-de-tools-de-metricas.md) (plan F7 en [`docs/auditoria-datos-2026-11/f7-plan.md`](../auditoria-datos-2026-11/f7-plan.md)). Reglas: ADR 0115.

## Por qué

Hay dos solapes de ventana en el mismo programa (Tactical C2 y C3 el 28 y 29-sep; Confianza C1 y C2 del 16 al 20 de noviembre) y ninguna restricción ni regla escrita de a qué cohorte va una venta de un día compartido.

## Alcance

**Cubre:** F3-11.

**Archivos calientes** (donde chocan dos sesiones): `lib/db/schema.ts`, `docs/adr/0022-*`, `docs/metricas.md` (cohorte).

**Migración:** M7, condicional: solo si Mani no permite el solape (`EXCLUDE`; requiere `btree_gist`, a verificar que Supabase lo permita y que el flujo de migraciones de este repo lo aplique). ADR 0125, o enmienda al 0022 si se permite.

## Fuera

Lo que pertenece a otro hijo del 385 (ver `docs/auditoria-datos-2026-11/f7-plan.md` §1: una causa, un ticket). Este ticket no migra conceptos del registro que no toca.

## Done cuando

- [ ] Decisión de Mani escrita: ¿se permite el solape de cohortes? Si se permite: regla de qué cohorte toma una venta del día compartido, en el diccionario y con test.
- [ ] Si no se permite: las dos parejas corregidas con ok de Mani y `EXCLUDE` aplicado.
- [ ] Regla N8 (ADR 0115): la fila de `docs/metricas.md`, el vocabulario de `overview.md` §11 y el ADR afectado quedan reescritos en el mismo commit, título e índice incluidos.
