---
id: 404
etapa: hub
serves: "Auditoría 385 H-12, H-19, C-16 del 30-oct · ADR 0115 N1, N2 · ADR 0030"
depends: [391, 392, 393]
status: done
---

# 404 — Closer: una pregunta y una definición (fase B)

Hijo del [385](./385-mcp-integridad-de-tools-de-metricas.md) (plan F7 en [`docs/auditoria-datos-2026-11/f7-plan.md`](../auditoria-datos-2026-11/f7-plan.md)). Reglas: ADR 0115. Viene de partir el [391](./391-closer-una-pregunta-y-un-dato.md): aquí va la fase de **código**.

## Por qué

"Closer" significa tres cosas (quien tomó la llamada, el dueño del deal, quien registró el abono) y hay dos columnas de identidad por llamada y por abono (texto y FK). `embudoPorCloser` repite inline los cinco `count ... filter` de `embudoDelRango`.

## Alcance

**Cubre:** H-12, H-19, C-16 del 30-oct. Una sola definición de "closer" por métrica, documentada, y `embudoPorCloser` construido sobre `embudoDelRango`. Va después del 392 y el 393 porque comparten `dashboard.ts` y `metricas-filtros.ts`, y después del 391 para que el comparativo ya no muestre closers fantasma.

**Archivos calientes:** `lib/queries/dashboard.ts`, `lib/queries/metricas-filtros.ts` (`filtroLlamadas`, `filtroCierres`, `filtroCaja`), `lib/closers/identidad.ts`, `components/dashboard/operacion.tsx`.

**Migración:** ninguna.

## Fuera

La corrección de los datos huérfanos y el `CHECK` de venta con dueño: son del [391](./391-closer-una-pregunta-y-un-dato.md).

## Done cuando

- [x] Cada métrica con closer declara en su ficha cuál de los tres criterios usa; el comparativo dice el criterio.
- [x] Test: `embudoPorCloser` suma lo mismo que `embudoDelRango` sin filtro (paridad N2).
- [x] Regla N8 (ADR 0115): la fila de `docs/metricas.md`, el vocabulario de `overview.md` §11 y el ADR afectado quedan reescritos en el mismo commit, título e índice incluidos.
- [x] Registro: ficha de las métricas con closer en `lib/metricas/registro.ts` y su línea borrada de `lib/metricas/pendientes.ts` con `TOPE_DE_PENDIENTES` bajado.

## Resultado (8-nov)

Las tres definiciones de «closer» quedan declaradas: llamadas, shows y agendas por **quien tomó la llamada**; ventas, comisión, vendido, recaudado y por cobrar por **el dueño del deal**; caja por **quien registró el abono** (`criterioDeCloser` en la ficha, `lib/metricas/registro.ts`; texto visible en `lib/criterios-de-closer.ts` y bajo el título del comparativo). `embudoPorCloser` comparte con `embudoDelRango` los conteos de llamadas (`conteosDeLlamadas`) y el filtro `filtroLlamadas`; Codex olvidó el `leftJoin` de `deals` que esos conteos necesitan y lo agregué (los tests de paridad lo cazaron). Test de paridad: `tests/closer-una-pregunta.test.ts`. Las métricas basadas en llamadas (agenda, show) no están en el registro todavía: su ficha llega con el 403.
