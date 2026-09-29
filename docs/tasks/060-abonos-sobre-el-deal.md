---
id: 060
etapa: E4
serves: "plan v2 §6 etapa 4 · tarea E4-4 · ADR 0013, ADR 0024, ADR 0037"
depends: [057, 045]
status: done
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
  sobrepago contra lo que el closer ve. ⚠️ **(22-sep) El modulo y el test se borraron con `sales`
  en el corte 0020:** este ticket los RECREA, no los modifica. Recuperalos del historial
  (`git show 722a47f^:lib/queries/saldo.ts`) como punto de partida.
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

- [x] El primer abono mueve a Abonado y el que deja saldo 0 mueve a Completo, **por el motor**.
- [x] Ningun movimiento de etapa por dinero se escribe fuera de `lib/deals/etapas.ts`.
- [x] `tests/saldo-centralizado.test.ts` verde.
- [x] Anular el abono que cerro el deal lo saca de Completo, con su fila de historial.
- [x] Un sobrepago sigue bloqueado por la misma reja de siempre.

## Kiro

Si, con revision: aqui se cruzan dinero y etapas.

## Cierre (28-sep, sesión 43) — decisiones de Mani

- **D3:** se mantiene: Abonado ocupa el cupo del lead (un segundo producto espera a que se complete el pago).
- **Anular y volver:** Completo → Abonado (A2) si queda saldo; sin abonos vigentes, a la etapa de donde vino
  antes de pagar (A1, `etapaALaQueVuelve`: mira Abonado **y Completo**, porque un pago único va directo a
  Completo). Sin historial (migración) vuelve a **Compromiso Verbal**.
- **A1 y A2 ya no piden motivo del catálogo:** su razón es el motivo en texto de la anulación del abono
  (ADR 0026, obligatorio). Cambió `lib/deals/etapas.ts` (ADR 0056 y `structure.md` §3.1 lo dicen).
- Sin producto no hay abono (422). Todo en USD (otra moneda es 400). El monto es lo que pagó el cliente.
  Una promoción o cortesía es OTRO producto, no un descuento: no hay `precio_contrato`.
- Rejas: solo `trabajaLeads` y dueño (o administrador) registra; el gerente no. Sobrepago 422 con la cifra de
  `saldosDeDeals`; el deal se bloquea `for update`. Desde Pendiente Setteo, Agendado, Re-agenda o Próxima
  Cohorte se rechaza (409): no hay flecha a pagar. Quien anula (ADR 0026 p.5): administrador cualquiera;
  closer solo lo suyo y con la cohorte activa.
- El comprobante lo exige el motor solo cuando el abono MUEVE el deal (a Abonado o a Completo): sin él, se
  deshace el abono entero. El comprobante con foto sigue siendo el 035.
