---
id: 019
fase: F1
serves: "ADR 0013 — pagos posteriores a la venta"
depends: [018]
status: done
---

# 019 — Registrar un abono sobre una venta existente

## Objetivo
Un closer registra que una persona pagó otra parte de una venta ya cerrada, sin crear un cupo
nuevo.

## Alcance
- Dentro: `registrarAbono(session, { saleId, fecha, monto, moneda, plataformaId, comprobanteUrl? })`
  en `lib/mutations/abonos.ts`, con su esquema zod.
- Dentro: `saldoDeVenta(saleId)` en `lib/queries/ventas.ts`.
- Fuera: la UI (003).

**Resuelto al implementar (17-sep):** la nota del sobrepago va a `change_log`
(`tabla = "abonos"`, `campo = "sobrepago"`, con el `userId` que confirmo), en el mismo lote
atomico que el abono. `abonos` no tiene columna de notas y no hacia falta una migracion para
esto: `change_log` ya es la bitacora de la app y responde exactamente lo que hay que poder
responder ("quien confirmo esta venta con saldo negativo y contra que saldo").

Tambien salieron dos piezas compartidas con el ticket 002, que ahora las usa en vez de su copia:
`closerDeLaSesion` (`lib/auth/closer.ts`, ADR 0011) y `exigirPlataformaActiva`
(`lib/abonos/plataforma.ts`). El `programId` del abono se hereda de la venta y no se le pide al
llamador.

## Done cuando
- [x] Rechaza un abono que deje la venta con saldo negativo, salvo confirmación explícita (se
      registra la nota del sobrepago).
- [x] Rechaza una moneda distinta a la de la venta sin conversión silenciosa. Todo abono es en
      USD (Michael, 16-sep). Si el pago entró en COP, **el closer lo convierte al registrarlo** (Mani,
      16-sep): el sistema recibe el monto ya en USD y nunca convierte por su cuenta.
- [x] `closerId` sale de la sesión; puede ser distinto al closer de la venta (se guarda quién
      registró).
- [x] Tests: abono normal, abono que completa, sobrepago, moneda distinta.
