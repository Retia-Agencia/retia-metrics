---
id: 060
etapa: E4
serves: "plan v2 §6 etapa 4 · tarea E4-4 · ADR 0013, ADR 0024, ADR 0037"
depends: [057, 045]
status: todo
---

# 060 — Abonos sobre el deal, y los dos movimientos que hace el sistema

## Objetivo

Que el dinero entre por el deal y que la etapa la mueva **el sistema**, nunca el closer a mano.

- **Primer abono con saldo > 0** → deal a **Abonado**.
- **`sum(abonos) >= precio_lista`** (saldo 0) → deal a **Completo**.

## Las reglas que no se tocan

- **Caja recaudada y ventas cerradas son dos metricas separadas** (ADR 0013). La caja del periodo
  es `sum(abonos)` **por fecha del abono**, aunque el deal sea de antes.
- **El saldo vive en UN solo modulo**, `lib/queries/saldo.ts` (ADR 0024). Este ticket cambia **de
  donde lee** (del deal y su producto, no de `sales`), **no que significa**.
  `tests/saldo-centralizado.test.ts` tiene que seguir verde: compara la reja que bloquea un
  sobrepago contra lo que el closer ve.
- **El ticket lo da el producto** (`deal.producto_id → producto.precio_lista`). No hay
  `precio_contrato`.
- **Moneda:** USD (spec §7). Si el pago entro en COP, lo convierte el closer al registrarlo; **el
  sistema no convierte solo** y la moneda va siempre al lado del numero.
- Un abono anulado (ADR 0026) **obliga a recalcular la etapa** (ADR 0038): si el deal estaba en
  Completo por ese abono, deja de estarlo. **Un Student que no pago es la cifra inflada de esta
  familia.**

## Alcance

- **Dentro:** la mutacion del abono sobre `deal_id`, los dos movimientos por `moverEtapa()`, el
  recalculo al anular, y `change_log`.
- **Dentro:** el selector de plataforma acotado al programa (ADR 0034) sigue siendo **proyeccion y
  no reja**: no se rechaza un cobro real por una plataforma sin vincular.
- **Fuera:** el comprobante como foto. Ese es el ticket **035**, que aterriza en esta etapa.
- **Fuera:** las cuotas pactadas (ticket 061).

## Done cuando

- [ ] El primer abono mueve a Abonado y el que deja saldo 0 mueve a Completo, **por el motor**.
- [ ] Ningun movimiento de etapa por dinero se escribe fuera de `lib/deals/etapas.ts`.
- [ ] `tests/saldo-centralizado.test.ts` verde.
- [ ] Anular el abono que cerro el deal lo saca de Completo, con su fila de historial.
- [ ] Un sobrepago sigue bloqueado por la misma reja de siempre.

## Kiro

Si, con revision: aqui se cruzan dinero y etapas.
