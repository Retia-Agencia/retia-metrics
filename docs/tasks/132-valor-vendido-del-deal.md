---
id: 132
etapa: NC1
serves: "ADR 0065 puntos 1, 2, 3 y 6 · comercial.md R-3, GC-09, GC-13"
depends: []
status: todo
---

# 132 — El valor vendido del deal: lo escribe el closer y de él sale el saldo

## Objetivo

Que cada venta diga lo que de verdad se vendió. El closer lo escribe; el saldo, el Completo automático y el
contratado lo leen de ahí, no del producto.

## Por qué

Gerencia, 30-sep: *"no crees varios productos"*, y el valor vendido va en 0 por defecto *"para que tenga que
cambiarlo siempre"*. Hoy el precio sale de `productos` y **0 de 157 deals** tienen producto: el saldo de
todos sale `null` y el contratado no existe. 🩸 Sin la reja, una venta sin valor cuenta USD 0 de contratado
y su primer abono queda como sobrepago, sin ningún error.

## Alcance

- **Dentro:** migración aditiva `deals.valor_vendido_usd numeric(10,2)` nulo (la genera y aplica la sesión
  principal, con `SET lock_timeout = '5s'`; `deals` es tabla caliente). Un `CHECK (valor_vendido_usd >= 0)`.
- **Dentro:** `lib/queries/saldo.ts` (y nadie más): precio = `valor_vendido_usd`; `sinSaldoPorque` cambia
  `sin_producto` por `sin_valor_vendido`. `tests/saldo-centralizado.test.ts` sigue comparando la reja del
  abono con la pantalla.
- **Dentro:** requisito nuevo del motor `valor_vendido` (`lib/deals/requisitos.ts`): `> 0` en toda flecha a
  Abonado o Completo (las mismas que hoy piden `area_declarada`), con mensaje "Falta el valor vendido".
  Históricos exentos (ADR 0059), como el 121. Reemplaza al requisito `producto` en esas flechas.
- **Dentro:** T14, T17 y T18 (Completo automático) miden el saldo contra el valor vendido.
- **Dentro:** el campo en los formularios que hoy piden producto ("¿Cómo terminó?", abono, Editar deal, el
  selector del Kanban al soltar en una venta): numérico en USD, **arranca en 0** en la pantalla y se guarda
  `null` si nadie lo tocó. Un 0 nunca se manda como valor.
- **Dentro:** editar el valor vendido después de la venta (`editarDeal`), con rastro (`editarConRastro`, ADR
  0042), por el dueño, gerente o developer (`trabajaLeads`/`esAdministrador`, nunca un `rol ===` a mano), y
  **rechazado si queda por debajo de lo abonado vigente** (mensaje con las dos cifras).
- **Dentro:** el contratado del dashboard (`vendidosEn` y vecinos) suma `valor_vendido_usd`.
- **Fuera:** retirar `productos` y `producto_id` (134). La comisión (133). El descuento contra el ticket base
  (134, porque necesita el ticket de la cohorte decidido). Llenar los históricos (078, lote 2).

## Done cuando

- [ ] Mover a Abonado o Completo sin valor vendido se rechaza con "Falta el valor vendido"; con valor, pasa.
      Un deal histórico pasa sin él.
- [ ] El saldo de un deal con valor 797 y un abono de 500 es 297 en la ficha y en la reja del abono (el test
      comparativo muerde si se separan).
- [ ] Bajar el valor vendido por debajo de lo abonado se rechaza y la base no se mueve; subirlo deja una fila
      en `change_log`.
- [ ] Un formulario enviado sin tocar el campo guarda `null`, no 0 (test sobre la acción).
- [ ] Recorrido visual de los cuatro formularios, abriendo cada uno, con la consola abierta.

## Codex

Sí, esfuerzo `high` (dinero). La migración la genera y aplica la sesión principal.
