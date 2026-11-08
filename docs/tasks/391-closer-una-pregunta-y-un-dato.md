---
id: 391
etapa: hub
serves: "Auditoría 385 H-12, H-19, F3-05, F3-07 · ADR 0115 N1, N2 · ADR 0030 · ADR 0122"
depends: [392, 393]
status: todo
---

# 391 — Closer: una pregunta y un dato

Hijo del [385](./385-mcp-integridad-de-tools-de-metricas.md) (plan F7 en [`docs/auditoria-datos-2026-11/f7-plan.md`](../auditoria-datos-2026-11/f7-plan.md)). Reglas: ADR 0115.

## Por qué

"Closer" significa tres cosas (quien tomó la llamada, el dueño del deal, quien registró el abono) y hay dos columnas de identidad por llamada y por abono (texto y FK). `embudoPorCloser` repite inline los cinco `count ... filter` de `embudoDelRango`.

## Alcance

**Cubre:** H-12, H-19, C-16 del 30-oct, F3-05 (3 abonos con `closer_id` texto sin usuario resoluble: closers fantasma en el comparativo), F3-07 (3 ventas vigentes sin `owner_user_id`, deals migrados de Comunicarte C3: la comisión no se puede atribuir).

Dos fases en el mismo ticket, porque una es de datos y otra de código:

- **Fase A (datos, sin código, puede ir en la ola 1):** corregir los 3 abonos y asignar dueño a las 3 ventas. Escritura de producción con el ok de Mani, por `crearConRastro`/`editarConRastro` y no por `UPDATE` a mano.
- **Fase B (código, después del 392 y el 393):** una sola definición de "closer" por métrica, documentada, y `embudoPorCloser` construido sobre `embudoDelRango`.

**Archivos calientes** (donde chocan dos sesiones): Fase B: `lib/queries/dashboard.ts`, `lib/queries/metricas-filtros.ts` (`filtroLlamadas`, `filtroCierres`, `filtroCaja`), `lib/closers/identidad.ts`, `components/dashboard/operacion.tsx`.

**Migración:** M3 (`CHECK` de venta con dueño en `deals`, después de la fase A; una venta anulada sin dueño sigue permitida). ADR 0122.

## Fuera

Lo que pertenece a otro hijo del 385 (ver `docs/auditoria-datos-2026-11/f7-plan.md` §1: una causa, un ticket). Este ticket no migra conceptos del registro que no toca.

## Done cuando

- [ ] Fase A: 0 abonos con closer sin usuario; 0 ventas vigentes sin dueño; cada escritura con su fila en `change_log`.
- [ ] `CHECK` aplicado y probado (una venta sin dueño se rechaza; una anulada sin dueño no).
- [ ] Cada métrica con closer declara en su ficha cuál de los tres criterios usa; el comparativo dice el criterio.
- [ ] Test: `embudoPorCloser` suma lo mismo que `embudoDelRango` sin filtro (paridad N2).
- [ ] Regla N8 (ADR 0115): la fila de `docs/metricas.md`, el vocabulario de `overview.md` §11 y el ADR afectado quedan reescritos en el mismo commit, título e índice incluidos.
- [ ] Registro: ficha de las métricas con closer en `lib/metricas/registro.ts` y su línea borrada de `lib/metricas/pendientes.ts` con `TOPE_DE_PENDIENTES` bajado.
