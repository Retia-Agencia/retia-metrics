---
id: 339
etapa: deals
serves: "ADR 0113 (abono adicional con nota opcional) · reporte de Michael Castellanos del 28-oct: Maru no pudo registrar un 1:1 de ComunicArte"
depends: []
status: todo
---

# 339 — Abono adicional: lo que se vende aparte del programa

## Por qué

La reja del sobrepago rechazó un 1:1 de USD 1.431 sobre un deal con saldo de USD 797: el CRM solo sabe recibir plata
contra el ticket. El ADR 0113 decide que lo vendido aparte entra como **abono adicional** del mismo deal: suma a la
caja y no toca saldo, valor vendido, etapa, ventas, meta ni comisión.

## Alcance

- **Migración** (la aplica la sesión principal, nunca un agente): `pgEnum` `concepto_abono` (`ticket`, `adicional`),
  columna `abonos.concepto` not null default `ticket`, y `abonos.nota` text nulo. Sin backfill: todo lo existente es
  `ticket`.
- **`saldosDeDeals`** (`lib/queries/saldo.ts`): suma solo concepto `ticket`. Sigue siendo la única respuesta.
- **`registrarAbono`** (`lib/deals/abonos.ts`): con concepto `adicional` se salta congelar el valor vendido, la reja
  del sobrepago, la comparación de moneda contra el saldo y el movimiento de etapa; acepta un deal cerrado
  (Completo o Cierre Perdido) pero nunca uno anulado. Todo lo demás igual: dueño del deal, plataforma activa,
  comprobante, rastro, programa sacado del deal.
- **Pantalla:** en el registro del abono, un interruptor "Es aparte del programa (1:1, otro producto)" y, si está
  prendido, el campo de nota opcional. En la ficha del deal y en la lista de la caja, el adicional se distingue
  (etiqueta y su nota). El registro de un adicional tiene que estar disponible también en un deal Completo, donde
  hoy no hay acción de abono. Tinta (`docs/structure.md` §9).
- **Caja:** sigue sumando todos los abonos vigentes; la lista detrás de la cifra muestra el concepto. Revisar que
  ninguna consulta de `lib/queries/` que cuente "pagado" o "abonado" lea `abonos` sin pasar por el saldo.
- **Docs:** `docs/metricas.md` §1.5 (caja incluye adicionales; saldo no), y `docs/overview.md` §11 (vocabulario:
  abono adicional).

## Tests

- `saldo-centralizado`: un adicional no cambia el saldo; la reja y la pantalla siguen dando la misma cifra.
- `abonos-del-deal`: un adicional mayor que el saldo se registra; no congela valor vendido ni mueve etapa; un deal
  Completo lo acepta; uno anulado no; un deal de otro programa no se cuela por el input.
- La caja del dashboard incluye el adicional y la lista detrás de la cifra lo muestra.

## Abierto (Gerencia, ADR 0113)

- ¿El 1:1 paga comisión? ¿Cuenta para la meta? Mientras no se decida, no.

## Done cuando

- Maru puede registrar el 1:1 de su caso con nota, en escritorio y a 375 px, y el saldo del deal del programa sigue
  en USD 797.
- Acción forjada: un closer que no es dueño del deal recibe 403 y la base no se mueve.
