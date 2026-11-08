---
id: 393
etapa: hub
serves: "Auditoría 385 H-05, H-20, H-21, F2-06 · ADR 0024 · ADR 0115 N1, N2"
depends: [392]
status: todo
---

# 393 — Dinero: una sola suma

Hijo del [385](./385-mcp-integridad-de-tools-de-metricas.md) (plan F7 en [`docs/auditoria-datos-2026-11/f7-plan.md`](../auditoria-datos-2026-11/f7-plan.md)). Reglas: ADR 0115.

## Por qué

El mismo conjunto de ventas se suma varias veces: `contratadoDelRango` y `dineroDeVentas` (`vista-dashboard.ts` 233, 260), la suma de la lista (`metricas-con-filas.ts:369,374`) y los componentes (`hoy/dinero.tsx:30`, `secciones.tsx:73`, `tabla-de-origen.tsx:41`). Students trata la venta sin valor distinto del Hub (F2-06, latente: hoy 0 ventas sin valor). Requiere el ok de Mani sobre qué hace Students con una venta sin valor vendido (el Hub la excluye; Students suma su abonado).

## Alcance

**Cubre:** H-05, H-20, H-21, F2-06.

**Archivos calientes** (donde chocan dos sesiones): `lib/queries/dinero-de-ventas.ts`, `saldo.ts`, `dashboard.ts`, `vista-dashboard.ts`, `metricas-con-filas.ts`, `estudiantes-totales.ts`, `components/dashboard/hoy/dinero.tsx`.

**Migración:** Ninguna.

## Fuera

Lo que pertenece a otro hijo del 385 (ver `docs/auditoria-datos-2026-11/f7-plan.md` §1: una causa, un ticket). Este ticket no migra conceptos del registro que no toca.

## Done cuando

- [ ] `dineroDeVentas` es la única suma; ningún componente suma una lista de ventas; ningún `sum(abonos.monto)` fuera de `saldo.ts` (el guardián de `saldo-centralizado` ya lo vigila).
- [ ] Test de paridad con el caso que las haría divergir: una venta sin valor vendido, en Hub, Students y lista.
- [ ] Los números dorados de dinero no cambian.
- [ ] Regla N8 (ADR 0115): la fila de `docs/metricas.md`, el vocabulario de `overview.md` §11 y el ADR afectado quedan reescritos en el mismo commit, título e índice incluidos.
- [ ] Registro: ficha de `comision` y `cupos_con_caja` en `lib/metricas/registro.ts` y su línea borrada de `lib/metricas/pendientes.ts` con `TOPE_DE_PENDIENTES` bajado.
