# 0065 — El valor vendido lo escribe el closer; el ticket base es de la cohorte y la comisión es un porcentaje congelado

- **Estado:** aceptado · 1-oct-2026 (Mani, `/grill-with-docs` del lote 1 del norte comercial). **Reemplaza
  el ADR 0016** en lo que dice del precio (el producto ya no es el ticket del deal; la parte de recursos y
  plataformas de pago sigue vigente) y **el punto 2 del ADR 0037** (el precio sale del producto). Cambia la
  regla de la comisión del ticket 062 (monto fijo vigente).
- **Relacionadas:** ADR 0024 (una sola definición del dinero derivado), ADR 0026 (vigencia), ADR 0042
  (rastro de toda escritura), ADR 0048 (la comisión no se suma entre programas), ADR 0053 (acuerdo de pago).
- **De dónde sale:** reunión con Gerencia del 30-sep (`docs/comercial.md` R-3, R-4, GC-09 a GC-13, QM-1,
  QM-2).

## Contexto

Hasta hoy cada precio con descuento era un producto (ADR 0016) y el deal apuntaba a uno. Gerencia lo
descartó: *"no crees varios productos"* por cada descuento. Cada venta lleva lo que de verdad se vendió, y
lo escribe el closer. En producción, el 1-oct, **ningún deal de 157 tiene producto** y hay tres precios que
contestan la misma pregunta: `programs.ticket_usd`, `cohorts.precio_usd` y `productos.precio_lista`.

La cohorte ya cambia de precio: la C1 de ComunicArte se vendió a USD 697 y la C2 a 797. Un ticket en el
programa reescribiría hacia atrás la meta en cash y el descuento de una cohorte cerrada el día que suba el
precio.

## Decisión

1. **Valor vendido.** Cada deal lleva `valor_vendido_usd`, **siempre en USD**. En la base es `null` mientras
   nadie lo escribe; en la pantalla el campo arranca en **0** para obligar a cambiarlo (lo que pidió Dani).
   `null` es "sin escribir", nunca un precio: así un cupo vendido de verdad a 0 (una cortesía, QD-9) sigue
   siendo posible sin confundirse con un olvido.
2. **Es obligatorio al entrar a venta.** `moverEtapa()` exige `valor_vendido_usd > 0` en toda flecha a
   **Abonado o Completo**, como exige hoy el área declarada. Los deals históricos quedan exentos en el motor
   (ADR 0059).
3. **Se puede editar después de la venta**, con rastro (ADR 0042), por el dueño del deal, el gerente o el
   developer, y **nunca por debajo de lo ya abonado**: es la misma reja del sobrepago, del otro lado.
4. **Ticket base = `cohorts.precio_usd`.** Es contra lo que se mide la meta en cash (cupos × ticket) y el
   descuento de cada venta. `programs.ticket_usd` deja de decidir nada: queda solo como valor por defecto al
   crear una cohorte, o se retira (lo decide el ticket).
5. **`productos` se retira**, con `deals.producto_id`. Los enlaces de pago que apuntan a un producto quedan
   con producto nulo, que ya es válido.
6. **Las cifras derivadas leen el valor vendido, en `lib/queries/saldo.ts` y en ningún otro lado:**
   - **Saldo** = valor vendido − abonado vigente. Sin valor vendido, el saldo es `null` con la razón
     `sin_valor_vendido` (reemplaza a `sin_producto`). Con abonos en otra moneda, `null` como hoy.
   - **Completo automático** (T14, T17, T18) = saldo en cero contra el valor vendido.
   - **Contratado** = suma del valor vendido de las ventas. Lo leen el dashboard y el ROAS.
   - **Descuento** = ticket base de la cohorte del deal − valor vendido, en número y %. Sin cohorte, `null`.
7. **Comisión = porcentaje del valor vendido, congelado en la venta.** El programa lleva su
   `comision_porcentaje` vigente; al **entrar a venta por primera vez**, `moverEtapa()` copia ese porcentaje
   al deal. La comisión del deal = valor vendido × porcentaje congelado, calculada (nunca se guarda el
   monto: si el valor vendido se corrige, la comisión lo sigue). Cambiar el porcentaje del programa solo
   toca las ventas nuevas. Sin porcentaje cargado, la comisión es `null`, no 0. Por programa, nunca sumada
   (ADR 0048). Los números de cada programa son dato, no diseño: los da Dani (QD-5; hoy 80/797 = 10,04% y
   100/1.500 = 6,67%).

## Lo que queda abierto

- **Deals históricos sin valor vendido** (los que traiga el 078 en Abonado o Completo): Mani, 1-oct, se
  llenan con el ticket de su cohorte. Si quedan marcados como *estimados* se decide con el equipo comercial
  al aplicar la migración (lote 2, ticket 078), porque fueron ellos quienes los cerraron.

## Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| Ticket base en el programa | Subir el precio de la C3 cambia hacia atrás la meta en cash y el descuento de la C1 (697 contra 797, medido) |
| Guardar 0 en la base como "sin escribir" | Una cortesía real a 0 sería indistinguible de un olvido |
| Valor vendido opcional, solo como alarma | Una venta sin valor cuenta USD 0 de contratado y un abono queda como sobrepago, sin error |
| Comisión con el porcentaje vigente | Es plata que se le paga a personas: una cifra de septiembre no puede moverse en noviembre |
| Comisión sobre lo recaudado | No es lo que dijo Gerencia: *"si vendiste a 600, no te voy a dar los mismos 80"* |
| Dejar `productos` como catálogo opcional | Sería una segunda fuente de precio que nadie usa (0 de 157 deals) |
