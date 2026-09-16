---
id: 018
fase: F1
serves: "ADR 0013, 0015, 0016; spec §6"
depends: [012, 017]
status: todo
---

# 018 — Esquema del registro: resultado ampliado, abonos y referencias a catálogos

## Objetivo
La base puede guardar todo lo que el registro de llamadas y ventas necesita.

## Alcance
- Dentro: `resultado_llamada` suma `cancelada` y `compromiso_pago` (`ALTER TYPE ... ADD VALUE`).
- Dentro: `calls` suma `fechaSeguimiento`, `motivoId` (FK `motivos`), `origenId` (FK `origenes`).
- Dentro: `sales` suma `productoId` (FK `productos`, nullable para filas viejas de Sheets).
- Dentro: tabla `abonos` (`saleId` FK con `onDelete: restrict`, `programId`, `fecha`, `monto`,
  `moneda`, `plataformaId`, `comprobanteUrl`, `closerId`, `origen`, `createdAt`) con índices por
  (`programId`, `fecha`) y por `saleId`.
- Dentro: en la misma migración, cada `sales` con `montoAbonado` no nulo genera un abono
  (contar antes: probablemente 0 filas, porque las fuentes de ventas están inactivas).
- Dentro: `abonos.moneda` vale `USD` por decisión de Michael (16-sep). Se mantiene la columna para
  que la moneda siga visible al lado del número; el esquema zod solo acepta `USD` por ahora.
- Dentro: decidir y documentar si `sales.esPagoCompleto` se elimina o queda como cache (ADR 0013).
- Dentro: actualizar `docs/agents/context.md` si aparece un término nuevo.
- Fuera: las funciones que escriben (002, 019).

## Done cuando
- [ ] La migración corre limpio contra una rama de Neon o una base local, no contra producción.
- [ ] `npm run typecheck` limpio.
- [ ] Un test de esquema verifica los valores del enum contra la tabla del ADR 0015.
