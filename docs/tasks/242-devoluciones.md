---
id: 242
etapa: dinero
serves: "Mani, 14-oct: debe haber manera de hacer devoluciones (A-149)"
depends: [240]
status: todo
---

# 242 — Una devolución se registra como devolución, no como abono anulado

## Por qué existe

Hoy el CRM no tiene el concepto de devolución (buscado en código y docs el 14-oct: no aparece). Lo único que hay es
**anular** un abono, y anular significa *"esto nunca pasó, fue un error de tecleo"* (ADR 0026, 0038): el abono sale de
todas las métricas como si la plata nunca hubiera entrado. Una devolución es otro hecho: **la plata sí entró y después
salió.** Si se registra anulando, la caja del mes del pago queda inflada hacia atrás, la venta desaparece en vez de
caerse, y la comisión y la conversión mienten. Nada de eso lanza un error.

## Lo que hay que decidir antes de construir (con Michael y Gerencia)

| # | Pregunta | Recomendación (Claude, 14-oct) |
|---|---|---|
| D-1 | ¿Cómo se registra? | Un movimiento **devolución** sobre el deal (monto, moneda, fecha, motivo, quién), no un abono negativo: un abono negativo se suma sin querer en cualquier `sum(monto)` y rompe la regla de que todo dinero derivado vive en `lib/queries/saldo.ts` |
| D-2 | ¿En qué fecha resta de la caja? | En la **fecha de la devolución**: los cierres contables son a fin de mes (GC-44) y el mes del pago ya se reportó |
| D-3 | ¿Qué pasa con el deal? | Devolución total → **Cierre perdido** con motivo; parcial → el deal queda donde está y el saldo se recalcula |
| D-4 | ¿Y la comisión del closer? | Se descuenta en el mes de la devolución (la comisión es % del valor vendido, ADR 0065) |
| D-5 | ¿Cuenta como venta? | Una venta devuelta en total deja de contar como venta desde la fecha de la devolución; el embudo muestra que se cayó |
| D-6 | ¿Quién puede registrarla? | Quien administra (gerente, developer), no el closer: es una salida de plata |
| D-7 | ¿Lleva soporte? | Sí: comprobante del reembolso como archivo o link, con la tabla `archivos` y el flujo de subida del 239 (ADR 0085) |
| D-8 | ¿Tope? | No se devuelve más de lo abonado vigente del deal; un centavo más se rechaza, igual que el sobrepago |

## Alcance (cuando D-1 a D-8 estén cerradas)

- Tabla de devoluciones colgando del deal, con el molde de rastro (`crearConRastro`) y anulación propia (una devolución
  mal tecleada también se anula, ADR 0026).
- La caja, el saldo, la comisión y las ventas la leen desde **un solo módulo** (`lib/queries/saldo.ts` y los
  universos de `metricas-filtros.ts`), con test comparativo como el de `tests/saldo-centralizado.test.ts`.
- La lista detrás de cada cifra (ADR 0067) muestra la devolución.
- Botón en la ficha (sección de pago) para quien administra.
- Un ADR nuevo: devolución ≠ anulación.

## Done cuando

- [ ] Registrar una devolución resta de la caja en su fecha, no en la del pago, y la caja del mes del pago no cambia.
- [ ] Una devolución total mueve el deal a Cierre perdido y deja de contar como venta desde esa fecha.
- [ ] Anular un abono sigue funcionando igual y sigue siendo otra cosa.
- [ ] No se puede devolver más de lo abonado vigente.
- [ ] Un closer no puede registrar una devolución (probado forjando la petición).
- [ ] El comprobante del reembolso se sube y se respalda en Drive como cualquier otro.

## Anotaciones

A-149.
