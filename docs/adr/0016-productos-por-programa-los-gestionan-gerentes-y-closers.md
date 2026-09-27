# 0016 — Los productos de cada programa los crean y editan gerentes y closers

**Fecha:** 2026-09-16 · **Reescrito:** 2026-09-27 (el producto es el ticket del deal desde el ADR 0037;
suma la decisión del 19-sep sobre recursos y plataformas) · **Estado:** aceptado

Un programa no vende una sola cosa: el programa completo, la reserva de cupo, la mentoría 1:1, y cada
precio con descuento que el equipo usa (ComunicArte 797, 697, 627, 557, 397; Tactical 1.500, 1.350,
1.200, 1.000, 900, 800, 400).

## Decidimos

- **`productos` cuelga del programa**, con nombre, precio de lista, moneda y `activo`.
- **Cada precio que el equipo use es un producto.** El deal apunta a su producto
  (`deals.producto_id`) y **ese precio es el ticket**: no existe un "precio del contrato" aparte.
- **Los gestionan gerentes y closers.** El closer es quien se topa primero con "necesito vender algo
  que no está en la lista" en medio de una llamada, y esperar a un gerente frena la venta. Un closer
  solo gestiona productos de los programas donde tiene membresía activa
  (`exigirAccesoAlPrograma`, `lib/catalogo/acceso-programa.ts`); quien administra, de cualquiera.
- **La misma regla, desde el 19-sep, para recursos y plataformas de pago:** un closer crea recursos
  de sus programas (nunca uno global, sin programa) y puede crear plataformas de pago, que no tienen
  programa (ADR 0034).

**Esto no contradice el ADR 0003:** la disjunción decide el acceso a rutas; la ruta de productos
simplemente declara los dos roles.

## Consecuencias

- Como un closer crea productos, `change_log` es lo que permite saber quién creó cada uno.
- Un producto con deals no se borra, se desactiva (ADR 0026).
