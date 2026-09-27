# 0013 — Caja y ventas son dos métricas: cada pago es una fila (`abonos`)

**Fecha:** 2026-09-16 · **Reescrito:** 2026-09-27 (el abono cuelga del deal desde el ADR 0037) ·
**Estado:** aceptado

## El problema

Un solo número de "monto abonado" por venta no describe la operación. Un pago del 15-sep que
completaba un cupo cerrado el 31-ago suma a la caja del 15-sep, pero no suma un cupo nuevo. Con un
solo número por venta, la caja por día es imposible de calcular y el segundo pago sobrescribe o se
pierde.

## Decidimos

- **Cada pago recibido es una fila de `abonos`**, colgada del deal (`abonos.deal_id`), con su fecha,
  monto, moneda, plataforma, comprobante (link o foto, ADR 0017) y quién lo registró.
- **Caja recaudada** = suma de los abonos vigentes cuya **fecha del abono** cae en el rango, aunque el
  deal sea de antes.
- **Ventas** = conteo de deals en **Abonado o Completo** (ADR 0037). Nunca se deriva de los abonos ni
  al revés.
- **Pagado completo** = la suma de los abonos llega al precio del producto del deal. Es un derivado
  (ADR 0024), nunca una columna.
- **Moneda:** los abonos van en **USD** (Michael, 16-sep). Si el pago entró en COP, el closer lo
  convierte al registrarlo; el sistema no convierte solo, y la moneda va siempre al lado del número.
- **Sobrepago:** un abono que dejaría el saldo negativo se rechaza salvo que el closer lo confirme de
  forma explícita, y la confirmación queda en el rastro (ADR 0042).
- **La etapa la mueve la plata:** registrar un abono pasa el deal a Abonado, y a Completo cuando el
  saldo llega a cero (ADR 0037); anular un abono recalcula la etapa.

## Por qué

Una venta contada entera y cobrada a medias infla el ROAS y la recuperación del CAC. Son dos números
distintos y así se muestran.
