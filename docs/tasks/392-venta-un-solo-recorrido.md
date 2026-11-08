---
id: 392
etapa: hub
serves: "Auditoría 385 H-08, H-01 · ADR 0115 N1, N7"
depends: [351, 353]
status: todo
---

# 392 — Venta: un solo recorrido

Hijo del [385](./385-mcp-integridad-de-tools-de-metricas.md) (plan F7 en [`docs/auditoria-datos-2026-11/f7-plan.md`](../auditoria-datos-2026-11/f7-plan.md)). Reglas: ADR 0115.

## Por qué

El predicado es uno (`etapaVendida`) pero hay seis recorridos: `vendidosEn` y `ventasConDiaEn` son la misma consulta con otra proyección; `series-dinero.ts:71-76` vuelve a filtrar; `ficha-deal.ts:732` define "vendido" como abono o etapa; `ventasDelPrograma` no tiene rango; `cerradosEn` usa otra regla de reapertura; `tasas-del-grupo.ts:168` y `embudo-etapas.ts:379-386` reimplementan en memoria. Hoy dan lo mismo (F2); el riesgo es la divergencia futura, y es justo el error medido el 30-oct.

## Alcance

**Cubre:** H-08 y la mitad de código del caso 0 (H-01).

**Archivos calientes** (donde chocan dos sesiones): `lib/queries/metricas-filtros.ts`, `dashboard.ts`, `series-dinero.ts`, `tasas-del-grupo.ts`, `embudo-etapas.ts`, `ficha-deal.ts`, `escalera.ts`, `hechos/venta.ts`, `tests/venta-una-definicion.test.ts`.

**Migración:** Ninguna.

## Fuera

Lo que pertenece a otro hijo del 385 (ver `docs/auditoria-datos-2026-11/f7-plan.md` §1: una causa, un ticket). Este ticket no migra conceptos del registro que no toca.

## Done cuando

- [ ] Una función de venta con día; `vendidosEn` o `ventasConDiaEn` se borra (N7); grep limpio.
- [ ] Cada uno de los otros recorridos importa esa función o declara en su ficha por qué no (`cerradosEn` es otro concepto: Close date).
- [ ] "Vendido" de la ficha del deal sale del mismo predicado que Students y el Hub.
- [ ] Los números dorados de F0 y `tests/venta-una-definicion.test.ts` quedan idénticos; el test de la serie diaria coincide con `filtroCierres`.
- [ ] Regla N8 (ADR 0115): la fila de `docs/metricas.md`, el vocabulario de `overview.md` §11 y el ADR afectado quedan reescritos en el mismo commit, título e índice incluidos.
- [ ] Registro: ficha de `cupos_vendidos` y `llevamos` en `lib/metricas/registro.ts` y su línea borrada de `lib/metricas/pendientes.ts` con `TOPE_DE_PENDIENTES` bajado.
