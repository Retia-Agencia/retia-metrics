---
id: 002
fase: F1
serves: "spec §5 criterio 1"
depends: [018]
status: done
---

# 002 — cohorteActiva() y la mutación de registro nativo

## Objetivo
Existe una función que devuelve la cohorte activa de un programa, y una función que guarda una
llamada escrita por un closer autenticado y, si cerró, su venta y su primer abono.

## Alcance
- Dentro: `lib/queries/cohortes.ts` con `cohorteActiva(programId)`.
- Dentro: `lib/mutations/registro.ts` con `registrarLlamada(session, input)`. Inserta en `calls`
  con `origen="app"`, `closerId` copiado de `session.user.closerId` (ADR 0011) y `cohortId` de
  `cohorteActiva`. Guarda `origenId`, `motivoId` y `fechaSeguimiento` según el resultado.
- Dentro: si `resultado === "cerrada"`, inserta en `sales` (producto, precio del contrato) y en
  `abonos` (monto, moneda, plataforma, fecha, `comprobanteUrl` opcional) en **la misma
  transacción**.
- Dentro: un esquema zod único `registroLlamadaSchema` que exige los campos según el resultado
  (tabla del ADR 0015).
- Fuera: la UI (003) y el enforcement de rol, que hace quien la invoque con `requireRole`.

## Done cuando
- [x] `cohorteActiva` devuelve `null` si no hay cohorte activa, sin reventar; `registrarLlamada`
      rechaza con mensaje claro en ese caso.
- [x] Rechaza si `session.user.closerId` es null.
- [x] Rechaza `reagendada` o `compromiso_pago` sin `fechaSeguimiento`, y `perdida` sin `motivoId`.
- [x] Si el resultado no es `cerrada`, no toca `sales` ni `abonos`.
- [x] Si falla el insert del abono, no queda ni la venta ni la llamada (transacción).
- [x] Tests: llamada sin cierre, con cierre y abono, closer sin `closerId`, validaciones por
      resultado, sin cohorte activa.

## Notas
ADR 0010, 0011, 0013, 0015. El producto y la plataforma deben existir y estar activos.
