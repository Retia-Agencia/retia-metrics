# 0137 — Lo que se vende es un SKU, en una línea del deal; la cohorte deja de administrarse a mano

- **Estado:** aceptada · 19-nov-2026. **El punto 5, el producto del punto 1 y las enmiendas del cupo en el producto y de la comisión del programa como defecto los reemplaza el ADR 0139 (20-nov).** (Mani, grill del ticket 376). Nace del weekly con Daniel Tovar del 3-nov
  (`docs/weekly-2026-11-03.md` §Modelo de producto; transcripción `docs/reportes/weekly-2026-11-04-transcripcion.md:166-235`).
- **Reemplaza:** ADR 0113 (el abono adicional): el 1:1 deja de ser un abono sin producto y pasa a ser la venta de su SKU.
- **Enmienda:** ADR 0037 (la venta es el deal: sigue siéndolo, ver punto 6), ADR 0065 (el valor vendido lo escribe el
  closer: ahora por línea; y su punto 5, que retiró la `productos` del ADR 0016 por ser una segunda fuente de precio: la
  `productos` nueva no lleva precio, el precio vive en el SKU), ADR 0136 (el día de la venta: primer abono vigente de cualquier línea), ADR 0022/0123 (la
  ventana sigue siendo dato de la cohorte y sin solape, pero define sola cuál está activa).
- **Confirma:** ADR 0005 (la garantía vive en la base), ADR 0012 (catálogo por el molde), ADR 0013 (caja y ventas
  separadas), ADR 0026 (anular, no borrar), ADR 0043 y 0125 (el programa es frontera), DH-4 del 3-nov (líneas del deal,
  no varios deals por lead).

## Contexto

Daniel Tovar necesita ver qué compró cada persona: *"un producto contiene varios SKUs"* y *"que una persona que me haya
comprado Tactical Investor programa virtual C3, yo le pueda poner que también me compró Tactical Investor uno a uno C3"*
(transcripción `:170`, `:191`). Hoy no se puede: la cohorte del deal es el SKU implícito, el 1:1 entra como abono
`adicional` con una nota libre (ADR 0113) que ninguna métrica puede contar ni filtrar, y además gerencia tiene que
crear y **activar** cohortes a mano. Mani quiere que la única operación sea asignar SKUs a los deals, y que todo lo
demás (cohorte, precio, producto) se lea del SKU.

## Decisión

1. **SKU = programa × producto × cohorte, con precio.** Es la única entidad que se administra. Atributos: programa
   (prellenado con el programa de la vista), producto (texto libre), número de cohorte, precio de lista en USD
   y activo. **Cuenta como cupo** es del producto, no del SKU (enmienda del 19-nov, abajo). Si se quiere que un SKU diga más cosas, se agrega un atributo
   (una columna y su filtro), nunca se codifica en el texto del código.
2. **El código se arma solo**, en snake_case: `programa_producto_cohorte` (ej. `tactical_investor_virtual_c3`,
   `tactical_investor_uno_a_uno_c3`). Sale del slug del programa, del producto normalizado y de `c<N>`. Nadie lo
   teclea: así la nomenclatura es uniforme por construcción, que es lo que pidió Daniel Tovar (`:201-202`). Único
   en la base.
3. **Solo crean SKUs quienes `esAdministrador`** (gerente y developer), desde un botón que abre un popup en la vista del
   programa. El closer asigna, no crea (`:194-201`).
4. **El producto es texto libre**, normalizado al guardar (minúsculas, sin tildes, snake_case: "Uno a uno" y "uno a uno"
   son el mismo producto) y con autocompletar de los productos que ya existen en el programa. Por debajo es una fila
   propia por programa, para que el filtro Producto no se parta. Riesgo aceptado: "1:1" y "uno a uno" serían dos
   productos; lo controla que solo los admins crean.
5. **[Reemplazado por el ADR 0139.]** **La cohorte sigue existiendo, pero nadie la administra.** Nace con el primer SKU que nombra su número; si el número
   es nuevo, el popup pide las fechas de su ventana de venta. Se conserva porque es la dueña de la ventana sin solape
   (ADR 0123), de las metas y de la meta de leads por día, que son del ciclo y no del producto: un Virtual C3 y un 1:1 C3
   comparten ventana y meta. **"Activa" se deduce:** es la cohorte cuya ventana contiene hoy (a lo sumo una, ADR 0123).
   Desaparece el botón Activar y el estado `activo` escrito a mano.
6. **Ventas en dos niveles.** *Venta* sigue siendo el deal: un deal es venta cuando tiene al menos una línea con abono
   vigente; una persona convertida cuenta una vez en Ventas, conversión y cierre de ventas. *SKUs vendidos* cuenta
   líneas y es lo que se filtra por programa, producto y cohorte.
7. **Una línea se puede asignar en cualquier momento, pero solo vende con su primer abono.** Sin abonos, la línea está
   **propuesta**: se ve en la ficha del deal con su precio y el deal muestra el saldo por pagar de sus líneas, pero no
   suma a Vendido, Ventas, cupos ni comisión. Con su primer abono vigente entra a Vendido **por su valor vendido
   completo**, ese día (Bogotá). Recaudado = lo abonado a la línea; Por cobrar = valor vendido − recaudado.
   *Vendido no es la plata que entró: esa es Recaudado (glosario, `docs/overview.md` §El dinero).*
8. **El valor vendido es por línea:** toma el precio de lista del SKU al asignarse y el closer puede cambiarlo
   (descuento). Se guardan los dos, así el descuento se mide por SKU.
9. **Cupos y comisión.** Cupos de la meta = SKUs vendidos cuyo producto tiene **Cuenta como cupo**. La comisión es **por SKU** (enmienda del 20-nov, abajo):
   suma, por cada línea vendida, valor vendido × % de comisión congelado en la línea. Daniel Tovar valida estas dos reglas antes del corte 3; si las cambia, se
   enmienda este punto y no el modelo.
10. **Permisos del closer sobre un deal suyo:** asigna SKUs activos del programa del deal, edita el valor vendido y
    quita una línea mientras no tenga abonos. Una línea con abonos solo se anula (ADR 0026). Todo con rastro.
11. **Todo abono cuelga de una línea.** Desaparece el concepto `adicional`: el formulario de abono pregunta "¿Qué SKU
    está pagando?" entre las líneas del deal, o permite asignar una nueva ahí mismo.
12. **`deals.cohort_id` se queda, derivado y garantizado por la base.** Es la cohorte de la línea vendida más antigua
    con cupo (si no hay, la de la línea propuesta más antigua con cupo; si no hay ninguna, nulo). La escribe un solo
    lugar, el módulo de líneas, en la misma transacción, y un test de paridad lo vigila. Se retira cuando las lecturas
    migren a las líneas (ticket futuro, por partes); mientras tanto, lo que hoy funciona con la cohorte del deal no
    cambia.
13. **El SKU es del programa del deal** (FK compuesta, como el ADR 0125): un deal de ComunicArte no recibe un SKU de
    Tactical.
14. **La etapa sale de las líneas** (enmienda del 19-nov, abajo): cualquier abono vigente a cualquier línea lleva el
    deal a Ganado parcial; Ganado completo es cuando **todas las líneas vendidas** tienen saldo 0. Anular un abono
    recalcula.
15. **La venta sin abono del ADR 0136** (el deal que pasa a Ganado sin abono registrado) vende su línea con cupo, con
    Recaudado 0: así Vendido, Ventas y cupos siguen contando lo mismo que hoy. El 19-nov no hay ningún caso en
    producción.

### Enmienda del 19-nov-2026 (Mani): el cupo es del producto y nace apagado

**Cuenta como cupo** es un atributo del producto, **no** por defecto: solo cuenta el producto que un admin marca, y
pueden ser varios. Por qué: ocupar un cupo de la cohorte depende de qué se vende (el programa virtual lo ocupa en
todas las cohortes, un 1:1 en ninguna), no de la cohorte; ponerlo en cada SKU obliga a repetirlo y deja que dos SKUs
del mismo producto discrepen. Apagado por defecto, olvidar marcarlo subcuenta cupos (se nota en la meta); prendido,
cada 1:1 inflaría los cupos sin que nadie lo vea. La migración marca `programa_virtual` y deja `sin_clasificar`
sin marcar, así las cifras de hoy no se mueven.

### Enmienda del 20-nov-2026 (Mani): la cohorte se va; nada de "activa"

Al quitar el botón Activar se pierde un efecto suyo: mudar a la cohorte recién activada los deals en "Próxima
cohorte" (`mudarDealsDeProximaCohorte`). **No se reemplaza** (ni con un cron diario): Mani, "cohortes va a
desaparecer; nada de activo ni eso. La cohorte se va a manejar por los SKUs de los deals". Un deal que espera la
siguiente cohorte recibe el SKU de esa cohorte, asignado por el closer, y eso lo ubica. El 20-nov hay un solo deal en
"Próxima cohorte" (ComunicArte). La dirección queda fijada para un ticket posterior: la cohorte deja de ser una
entidad administrada y se lee de los SKUs; mientras exista la tabla, el punto 5 rige tal cual.

### Enmienda del 20-nov-2026 (Mani): la comisión es de cada SKU

Hasta hoy el % de comisión es del programa (`programs.comision_porcentaje`, ADR 0065 punto 7) y se congela en el deal
al venderse. Pasa a ser **de cada SKU**: el popup lo prellena con el % del programa, que se queda como **valor por
defecto**, y el admin lo ajusta (un 1:1 puede pagar distinto que el programa virtual). Se congela en la **línea** con su
primer abono vigente, igual que hoy en el deal, para que cambiar el % del SKU no reescriba ventas pasadas. Comisión del
deal = suma de valor vendido × % congelado de cada línea vendida. Migración: cada línea existente toma el % que ya
tenía congelado su deal (las cifras de hoy no se mueven); el SKU `sin_clasificar` lleva 0 % hasta que Mani cree el SKU
real. Por qué: Mani, "se le ajusta a cada SKU"; el programa como defecto evita teclear el % en cada SKU nuevo.

### Enmienda del 20-nov-2026 (Mani): el SKU es el objeto completo; cupo y comisión viven en él

Mani: "los SKUs van a reemplazar todo". El SKU es la fila que se administra con formato estándar: código =
programa + nombre del SKU + `c<N>`, precio de lista, **% de comisión** y **cuenta como cupo**, los dos marcados en el
popup de creación. Esto **reemplaza la enmienda del 19-nov que ponía el cupo en el producto**: `productos` queda solo
como nombre que agrupa SKUs para el filtro Producto, y `skus.cuenta_como_cupo` (apagado por defecto) y
`skus.comision_porcentaje` nacen en la migración 0153 (no se había aplicado en producción). La base comisionable del
deal excluye las líneas vendidas de SKUs con 0 % (`lib/queries/comision.ts`), ya no el slug `sin_clasificar`.

Migración: el SKU virtual de cada cohorte cuenta como cupo y toma el % actual del programa. Los adicionales de
ComunicArte (el 20-nov son 3 abonos de 1.431 USD, el 1:1 con Rosario) nacen en su producto real `1_1_con_rosario`,
sin cupo y con 0 % ("los 1:1 no tienen comisión por ahora"); `sin_clasificar` queda solo como respaldo de otros
programas. Lo que sigue en un ticket aparte, después del PR 53: retirar `cohorts` como entidad (el SKU lleva `c<N>`),
`programs.ticket_usd` y `programs.comision_porcentaje`, y no crear ni activar cohortes. Mientras tanto la C3 de
Tactical Investor cierra ventas el 15-dic-2026 como puente (cambio por el molde, con rastro).

### Enmienda del 19-nov-2026 (Mani): la etapa del deal sale de sus líneas

Hasta hoy solo el abono `ticket` movía la etapa (`lib/deals/abonos.ts`, `destinoDespuesDelAbono`) y el adicional
nunca. Con todo abono colgado de una línea esa distinción no existe: **cualquier abono vigente a cualquier línea deja
el deal en Ganado parcial, y Ganado completo es cuando todas sus líneas vendidas quedaron en saldo 0.** Las líneas
propuestas (sin abono) no cuentan: una propuesta que nunca se paga no puede tener al deal en parcial para siempre, y
si más adelante recibe su primer abono pasa a vendida y el deal vuelve a parcial hasta pagarla. Por qué: Mani, "un
ganado completo es cuando ya todos los productos asociados se pagaron"; contar solo las vendidas es coherente con el
punto 7 (una propuesta no es venta).

### Enmienda del 27-nov-2026 (Mani): con el primer pago, todas las líneas del deal cuentan

Reemplaza la excepción de las propuestas del párrafo anterior. **Mientras el deal no tiene abonos, sus líneas son propuestas
y no venden. Desde su primer abono vigente, toda línea vigente del deal es vendida**, tenga o no abonos propios: Ganado
completo es cuando todas quedaron en saldo 0 (o con sobrepago); si alguna debe, Ganado parcial. Una sola definición:
`esLineaVendida` (`lib/deals/lineas.ts`); saldo, comisión, dinero de ventas y Students la siguen. Asignar, quitar, anular o
cambiar el valor de una línea en un deal con abonos recalcula la etapa (por `moverEtapa`) y congela la comisión.

Por qué: Mani, "completo solo es cuando ya todos los SKUs del deal se pagaron". El caso que motivó la excepción (la
propuesta predeterminada de nacimiento que nadie compró) se resuelve en la entrada, no en la regla: al agregar un SKU a un
deal con propuestas sin pagos, la app ofrece **reemplazar** la propuesta (opción por defecto) y dice explícitamente que
conservar ambos es solo si el cliente de verdad compró los dos. Medido el 27-nov en producción: ningún deal en Ganado
completo tenía propuestas; el único ganado con una (Tactical, `7b728cef…`, C3 pagada y C4 propuesta) ya estaba en parcial.

**`cohorts.estado` se va.** Activa, futura y cerrada se calculan con una función de las fechas de la ventana y hoy en
Bogotá; no puede ser columna generada porque depende de hoy. La columna, su índice y sus checks salen en la migración
del corte 1.

## Migración (decidida: todo automático)

- Por programa: un producto `programa_virtual` (marcado como cupo) y un SKU por cohorte existente, con el precio de la
  cohorte.
- Cada deal con cohorte recibe la línea de su SKU, con su valor vendido; sus abonos `ticket` se cuelgan de ella.
- Los abonos `adicional` se listan con su deal, monto, fecha y nota para Mani; él crea los SKUs que hagan falta y se
  re-cuelgan a su línea. Hasta entonces quedan en una línea de un SKU `sin_clasificar` del programa, que no cuenta como
  cupo.
- Paridad obligatoria antes y después: caja, Vendido, Recaudado, Por cobrar, Ventas, cupos y metas por programa y
  cohorte idénticos (los adicionales pasan de "fuera de Vendido" a Vendido: es el único cambio esperado, y se reporta
  aparte con su monto).

## Descartado

| Alternativa | Por qué no |
|---|---|
| El SKU absorbe la cohorte (sin tabla de cohortes) | Duplica ventana y metas por producto, pierde el no-solape por programa y reescribe ~223 usos de `cohortId` |
| Varios deals por lead, uno por producto | Rompe `deals_uno_abierto_por_lead_y_programa_idx`, el emparejamiento de Calendly, el Inbox y el motor de etapas; infla la conversión |
| Asignar = vender | Un SKU asignado que nunca se paga sería una venta fantasma que alguien tiene que anular a mano |
| Ventas = líneas | La conversión subiría con cada upsell: una persona "convertiría" dos veces (lo que el ADR 0113 quiso evitar) |
| Código del SKU con mes y año | El mes no identifica la cohorte (una ventana cruza meses); es el desorden de "tbd" y meses que tiene HubSpot (`docs/comercial.md:527`) |
| Lista fija global de productos | Un producto nuevo pediría tocar configuración; Mani prefiere texto libre controlado por quién crea |
| Eliminar `deals.cohort_id` ya | Un solo cambio gigante sobre el objeto central, con riesgo alto sobre metas, cartera y ROAS que hoy cuadran |

## Consecuencias

- Gerencia deja de crear y activar cohortes a mano: crea SKUs, y la cohorte y su estado salen solos.
- El Hub puede filtrar por programa, producto y cohorte con opciones que se arman de los SKUs que existen.
- El 1:1 se cuenta, se filtra, tiene saldo y puede pagar comisión.
- Mientras `deals.cohort_id` exista hay una redundancia vigilada; su retiro queda como ticket.
- Los tickets de Hotmart (448 a 455) asignan la línea con la misma regla que el abono manual (ver 376, corte 1).
