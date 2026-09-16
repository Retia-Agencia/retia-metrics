---
id: 019
fase: F1
serves: "ADR 0013 — pagos posteriores a la venta"
depends: [018]
status: todo
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

## Done cuando
- [ ] Rechaza un abono que deje la venta con saldo negativo, salvo confirmación explícita (se
      registra la nota del sobrepago).
- [ ] Rechaza una moneda distinta a la de la venta sin conversión silenciosa. Todo abono es en
      USD (Michael, 16-sep). Si el pago entró en COP, **el closer lo convierte al registrarlo** (Mani,
      16-sep): el sistema recibe el monto ya en USD y nunca convierte por su cuenta.
- [ ] `closerId` sale de la sesión; puede ser distinto al closer de la venta (se guarda quién
      registró).
- [ ] Tests: abono normal, abono que completa, sobrepago, moneda distinta.
