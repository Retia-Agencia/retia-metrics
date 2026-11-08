---
id: 403
etapa: hub
serves: "Auditoría 385 H-29 · docs/contrato-metricas-y-datos.md §8 · ADR 0120"
depends: [397, 389, 390, 391, 404, 392, 393, 351, 355]
status: todo
---

# 403 — Registro tipado completo y diccionario generado

Hijo del [385](./385-mcp-integridad-de-tools-de-metricas.md) (plan F7 en [`docs/auditoria-datos-2026-11/f7-plan.md`](../auditoria-datos-2026-11/f7-plan.md)). Reglas: ADR 0115.

## Por qué

El ADR 0120 dejó un esqueleto con 5 conceptos y 35 pendientes. Cada hijo migra los suyos; este cierra el resto.

## Alcance

**Cubre:** H-29, contrato §8 puntos 1 a 4 (registro contra diccionario, un guardián por concepto, dorados ampliados, endurecer los guardianes).

**Archivos calientes** (donde chocan dos sesiones): `lib/metricas/registro.ts`, `pendientes.ts`, `docs/metricas.md` §3.0 y §3.1, `tests/registro-de-metricas.test.ts`.

**Migración:** Ninguna.

## Fuera

Lo que pertenece a otro hijo del 385 (ver `docs/auditoria-datos-2026-11/f7-plan.md` §1: una causa, un ticket). Este ticket no migra conceptos del registro que no toca.

## Done cuando

- [ ] `PENDIENTES_DE_REGISTRO` vacío y `TOPE_DE_PENDIENTES` en 0; el trinquete se retira o queda en 0.
- [ ] §3.1 de `docs/metricas.md` sin las columnas que ya genera §3.0.
- [ ] Números dorados ampliados a gasto y ROAS, semáforo y CSV, sobre base sembrada.
- [ ] Un guardián por concepto que hoy no lo tiene: show y ocurrió, cita sin resultado, lead y registro, agenda, "sin UTM".
- [ ] Funciones inexistentes o sin llamador de H-29 (`tasaDelDia`, `hechos/abono.ts`, `hechos-embudo.ts`, `embudoPorCanal`, `dealsPerdidosPorMotivo`, `periodoAnterior`, `colorDeCupos`) borradas o con su llamador.
- [ ] Regla N8 (ADR 0115): la fila de `docs/metricas.md`, el vocabulario de `overview.md` §11 y el ADR afectado quedan reescritos en el mismo commit, título e índice incluidos.
