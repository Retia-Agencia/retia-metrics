# 0016 — Los productos de cada programa los crean y editan gerentes y closers

**Fecha:** 2026-09-16

Un programa no vende una sola cosa. En septiembre aparecieron la "Venta 1:1" de Comunicarte y la
"reserva de cupo con USD 400" del lanzamiento, ademas del programa completo a USD 797 o 697
(precio anterior respetado). Hoy el unico precio que conoce el sistema es `programs.ticketUsd` y
`cohorts.precioUsd`.

**Decidimos crear la tabla `productos`**, colgada del programa: nombre, precio de lista, moneda,
activo. Toda venta apunta a un producto (`sales.productoId`).

**Quien los maneja:** gerentes **y closers** pueden crear, editar y desactivar productos
(decision de Mani, 16 de septiembre). Es la unica entidad configurable que un closer puede
editar: el closer es quien se topa primero con "necesito vender algo que no esta en la lista" en
medio de una llamada, y esperar a un gerente frena la venta.

Esto **no** contradice ADR 0003: la disjuncion de roles decide el acceso a rutas; aqui la ruta de
productos simplemente declara los dos roles (`requireRole("gerente", "closer")`). Las demas
pantallas de `/ajustes` siguen siendo solo de gerente.

## Consecuencias

- Como un closer puede crear productos, el `change_log` (molde del ADR 0012) es lo que permite
  auditar quien creo cada uno.
- Un producto nunca se borra (ADR 0012): las ventas viejas siguen apuntando a el.
- `cohorts.precioUsd` se mantiene como referencia de la cohorte; el precio real de una venta es
  `sales.precioAplicadoUsd`.
