---
id: 405
etapa: hub
serves: "Auditoría 385 · decisión de Mani 8-nov (392) · ADR 0115 N3, N6"
depends: [392]
status: todo
---

# 405 — Alerta: un deal en Cierre Perdido con abonos vigentes

Hijo del [385](./385-mcp-integridad-de-tools-de-metricas.md). Reglas: ADR 0115.

## Por qué

Desde el 392 la ficha del deal y Students dicen "vendido" solo por la etapa. Un deal en Cierre Perdido que conserva abonos vigentes es una **inconsistencia** (plata cobrada sobre una venta perdida), no un caso de negocio: Mani, 8-nov. Hoy hay **0** en producción (medido el 8-nov, solo lectura), así que el trabajo es que, si aparece uno, se vea en vez de quedar callado.

## Alcance

**Cubre:** una bandera de integridad, de la misma familia que las banderas rojas del Pulso (`lib/queries/banderas-del-pulso.ts`: "atendido sin valor", "sin Grain"). Cantidad por programa, en el Pulso / Hub, y **su cifra abre su lista** (ADR 0067: el universo vive en `lib/queries/metricas-filtros.ts` y lo usan cifra y lista). Consulta en `lib/queries/` reutilizable (C-2), con `vigente(deals)` y `vigente(abonos)`; nada de SQL suelto en pantalla ni en `lib/mcp/`. Aparece en el MCP si la bandera existe en la app (misma fuente, sin copia, `docs/mcp.md`).

**Rótulo:** en palabras de negocio, sin ADR ni ids (N5): p. ej. "Cierre perdido con pagos registrados".

**Fuera:** impedir el movimiento en `moverEtapa` (decisión aparte: hoy una pérdida con abonos es alcanzable por la flecha P y por CORR).

**Archivos calientes:** `lib/queries/banderas-del-pulso.ts`, `lib/queries/metricas-con-filas.ts`, `metricas-filtros.ts`, `lib/metricas/registro.ts`, `docs/metricas.md`.

**Migración:** ninguna.

## Done cuando

- [x] Consulta única del universo (deal no anulado en `cierre_perdido` con al menos un abono vigente), usada por la cifra y por la lista.
- [x] La bandera sale en el Pulso por programa, con 0 explícito (no vacío) y abre su lista.
- [x] Test sobre base sembrada: con un abono vigente cuenta; con el abono anulado no; con el deal anulado no; otro programa no cruza.
- [x] Regla N8 (ADR 0115): fila en `docs/metricas.md`, vocabulario en `overview.md` §11 y registro tipado en el mismo commit.
