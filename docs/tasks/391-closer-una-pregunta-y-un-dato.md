---
id: 391
etapa: hub
serves: "Auditoría 385 F3-05, F3-07 · ADR 0030 · ADR 0122"
depends: []
status: todo
---

# 391 — Closer: los datos huérfanos (fase A)

Hijo del [385](./385-mcp-integridad-de-tools-de-metricas.md) (plan F7 en [`docs/auditoria-datos-2026-11/f7-plan.md`](../auditoria-datos-2026-11/f7-plan.md)). Reglas: ADR 0115. Se partió en dos el 7-nov: este es la fase de **datos**; la de código es el [404](./404-closer-una-pregunta-y-una-definicion.md).

## Por qué

Hay 3 abonos con `closer_id` (texto) sin usuario resoluble, que aparecen como closers fantasma en el comparativo (F3-05), y 3 ventas vigentes sin `owner_user_id`, deals migrados de Comunicarte C3, cuya comisión no se puede atribuir (F3-07).

## Alcance

**Cubre:** F3-05 (los 3 abonos) y F3-07 (las 3 ventas). Escritura de producción con el ok de Mani, por `crearConRastro`/`editarConRastro` y no por `UPDATE` a mano. Sin código de métricas: puede ir en la ola 1.

**Archivos calientes:** ninguno de métricas (solo la escritura de datos y `lib/db/schema.ts` para el `CHECK`).

**Migración:** M3 (`CHECK` de venta con dueño en `deals`, después de corregir los datos; una venta anulada sin dueño sigue permitida). ADR 0122.

## Fuera

Una sola definición de "closer" por métrica y `embudoPorCloser` sobre `embudoDelRango`: es el [404](./404-closer-una-pregunta-y-una-definicion.md).

## Done cuando

- [ ] 0 abonos con closer sin usuario; 0 ventas vigentes sin dueño; cada escritura con su fila en `change_log`.
- [ ] `CHECK` aplicado y probado (una venta sin dueño se rechaza; una anulada sin dueño no).
- [ ] Regla N8 (ADR 0115): la fila de `docs/metricas.md`, el vocabulario de `overview.md` §11 y el ADR afectado quedan reescritos en el mismo commit, título e índice incluidos.
