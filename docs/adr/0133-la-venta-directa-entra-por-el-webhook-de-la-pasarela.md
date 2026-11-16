# 0133 — La venta directa entra por el webhook de la pasarela y cae en Students sin dueño

- **Estado:** aceptada · 16-nov-2026 (Mani respondió D1 a D6). Falta una sola cosa menor: la fecha límite de un parcial (D2).
- **Relacionadas:** ADR 0013 (caja y ventas separadas), ADR 0065 (el valor vendido lo escribe el closer: este ADR lo
  enmienda para la venta directa), ADR 0053 (acuerdo de pago y fecha límite), ADR 0035 (el lead y sus contactos),
  ADR 0029 (catálogo por molde), ADR 0058 (caja negra de webhooks), tickets 448 a 453,
  `docs/dapta/README.md` (lo medido de LiderArte el 16-nov), `docs/manual-gestion-comercial.md` D-9 (refund).

## Contexto

Desde noviembre, un formulario puede terminar en un checkout en vez de una agenda: LiderArte (Majo Sánchez, Dapta)
manda a Hotmart a quien escoge la oferta Black Friday (USD 99) o separar cupo (USD 49). Esas personas nunca hablan con
un closer ni con un setter. Hoy el CRM las trata como cualquier envío: nacen en Calificado o Registrado, sin dueño y
sin abono, y para entrar a Students alguien tendría que reclamarlas, inventarse una llamada y registrar el abono a mano.

Medido el 16-nov: 14 leads en LiderArte, todos sin dueño; los que fueron al checkout siguen en Calificado. La cohorte C1
tiene ticket base USD 149 y la oferta cobra USD 99.

Dos cosas que no se pueden hacer:

- **Leer el pago del outcome del formulario.** El outcome dice que la persona llegó al link de pago, no que pagó
  (casi todos los que llegaron eran pruebas del equipo). Inferir caja de ahí rompe el ADR 0013.
- **Emparejar por el id del envío.** Dapta solo pone respuestas de pasos en un `redirectUrl`; no expone el id.

## Decisión

1. **El pago lo confirma la pasarela, por webhook.** Cada pasarela es un proveedor de pagos en código (hoy Hotmart;
   Stripe se agrega igual cuando un programa lo use), y cada programa la conecta como una **fuente de pagos** con su
   secreto (Hotmart: el `hottok`, header `X-HOTMART-HOTTOK`). El cuerpo se guarda crudo antes de procesarse
   (ADR 0058) y la compra se procesa una sola vez por su id de transacción (`purchase.transaction`), aunque llegue
   repetida.
2. **La oferta dice qué se vendió.** El código de oferta de la compra (`purchase.offer.code`, el `off=` del link) se
   busca en los enlaces de pago vigentes del programa (catálogo existente, ADR 0017). El enlace dice programa, monto,
   moneda y plataforma. Una compra cuya oferta no está en el catálogo no se adivina: queda en revisión.
3. **El comprador se empareja con el lead del programa por correo normalizado y, si no, por teléfono.** Nunca se
   cruza a otro programa. Si no hay lead, **no se crea nada**: la compra alerta y espera en una bandeja de pagos sin
   emparejar hasta que alguien la asigne a un lead (D6).
4. **Si el deal ya tiene dueño, es una venta de ese closer**: entra el abono y el deal se mueve por las flechas de
   siempre (E6, E11, E12). Nada cambia para los closers.
5. **Si el deal no tiene dueño, es una venta directa.** Una flecha nueva del sistema (S4) lo lleva desde Potencial,
   Registrado o Calificado a Ganado Pago Parcial o Ganado Pagado Completo **sin exigir dueño**, con el abono que llegó.
   El valor vendido es el ticket de la cohorte con descuento 0 (D1, ADR 0065) y el saldo es ese valor menos lo abonado
   (D2): Completo solo cuando el saldo llega a cero. El descuento lo escribe gerencia después, si lo hubo.
   **El deal queda sin dueño para siempre** (D5): el dueño es quien procesó el deal, y aquí nadie lo hizo. Customer
   Success no es dueña de nada que no haya trabajado como closer o setter. La flecha pasa por `moverEtapa`, así
   que el evento Purchase de Meta y el aviso a Customer Success salen solos (`lib/deals/mover-etapa.ts:408`).
6. **El abono lo registra el sistema**, sin usuario, con origen `hotmart` y la referencia de la transacción. La base
   impide dos abonos con la misma referencia (ADR 0005).
7. **La venta directa se distingue en las métricas** como su propio origen comercial: cuenta como venta y como caja de
   la cohorte, no entra en la tasa de cierre ni en la comisión de ningún closer, y en Students se lee "Venta directa", no
   "Sin dueño".

## Decisiones (Mani, 16-nov)

- **D1. El sistema no adivina descuentos.** La venta directa entra con valor vendido = ticket de la cohorte (descuento
  0, ADR 0065). Si la venta iba con descuento, gerencia lo revisa con el link de pago que usó y lo escribe en el deal;
  al quedar el saldo en cero el deal pasa solo a Completo (`lib/deals/editar-deal.ts:148`, lógica que ya existe). Hasta
  esa revisión, una compra de USD 99 contra ticket de USD 149 se ve en Parcial con saldo de USD 50.
- **D2. El saldo es el valor vendido menos lo abonado.** El abono es lo que entró y el resto se calcula con base en eso.
  Separar con USD 49 deja saldo de USD 100. **Pendiente menor:** la fecha límite de pago que exige un parcial; mientras
  no se decida otra, el cierre de ventas de la cohorte.
- **D3. El abono es lo que pagó el estudiante**, en la moneda que reporta Hotmart, sin convertir.
- **D4. Un reembolso no decide solo.** El aviso de reembolso o contracargo deja el deal pendiente de una decisión
  humana, explícita y evidente: anular solo el abono, o pasar el deal a Cierre Perdido (lo más común). El CRM no
  escoge por nadie.
- **D5. La venta directa queda sin dueño para siempre.**
- **D6. Una compra sin lead alerta y espera en una bandeja**; nunca crea una persona sola.

## Consecuencias

- Una pasarela nueva es un proveedor en código y una fuente en la base: un programa nuevo con checkout no pide código.
- El ADR 0065 se conserva: el valor vendido sigue siendo el ticket de la cohorte; en la venta directa lo escribe el
  sistema en vez del closer.
- Una compra con descuento queda con saldo hasta que gerencia escribe el descuento; si nadie lo revisa antes de la
  fecha límite, aparece en cartera vencida. Hoy solo el dueño o un administrador editan un deal (`puedeTrabajarDeal`);
  una venta directa no tiene dueño, así que lo hace gerencia. Que Customer Success también pueda es una capacidad nueva
  que se decide aparte.
- Las reglas de requisitos por etapa (`lib/deals/requisitos.ts`) aceptan un deal ganado sin dueño solo cuando es venta
  directa; un deal de closer sigue exigiendo dueño.
