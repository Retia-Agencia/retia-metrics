# 0013 — Los abonos son una tabla propia, separada de las ventas

**Fecha:** 2026-09-16

`sales.montoAbonado` guarda un solo numero por venta. La operacion real no funciona asi: el
reporte diario del 15 de septiembre registra que Maryce Lopez pago USD 750 ese dia para completar
un cupo cerrado el 31 de agosto. Ese pago suma a la caja del 15 de septiembre, pero no suma un
cupo nuevo. Con un solo numero por venta, la caja por dia es imposible de calcular y el segundo
pago sobrescribe o se pierde.

**Decidimos crear la tabla `abonos`**: cada pago recibido es una fila con su venta, fecha, monto,
moneda, plataforma de pago, link opcional al comprobante y el closer que lo registro.

- **Caja recaudada** = suma de `abonos.monto` en el rango de fechas, por moneda.
- **Ventas cerradas** = conteo de `sales` en el rango. Nunca se deriva de los abonos.
- Una venta esta **pagada completa** cuando la suma de sus abonos llega al precio del contrato.
  `sales.esPagoCompleto` pasa a ser derivado; el ticket 018 decide si se elimina o se mantiene
  como cache.

Esto refuerza la restriccion ya existente ("caja recaudada y ventas cerradas son dos metricas
separadas"): ahora cada una tiene su propia tabla.

## Consecuencias

- `sales.montoAbonado` se deja de escribir desde la app. Las filas existentes (si las hay) se
  migran a un abono cada una en la misma migracion del ticket 018.
- Registrar una venta crea la venta **y su primer abono** en la misma transaccion (ticket 002).
- Existe una accion aparte para registrar un abono sobre una venta ya existente (ticket 019).

## Enmienda 2026-09-17 (ticket 018): `sales.esPagoCompleto` se elimina

El ticket 018 resolvio la pregunta que este ADR habia dejado abierta: **`sales.esPagoCompleto` se
elimina, no queda como cache.** Todo derivado es un calculo (la venta esta pagada completa cuando
la suma de sus abonos llega al precio del contrato), nunca una columna cache que se pueda
desincronizar. Al momento del cambio habia 0 filas en las ramas `dev` y `production` y ningun
codigo de la app leia la columna. La migracion 0008 la borra (`DROP COLUMN es_pago_completo`) y,
en el mismo paso, copia cada `sales.montoAbonado` no nulo a un abono (`origen = 'sheets'`,
INSERT...SELECT idempotente).
