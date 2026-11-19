# 0137 — Lo que se vende es un SKU, en una línea del deal; la cohorte deja de administrarse a mano

- **Estado:** aceptada · 19-nov-2026 (Mani, grill del ticket 376). Nace del weekly con Daniel Tovar del 3-nov
  (`docs/weekly-2026-11-03.md` §Modelo de producto; transcripción `docs/reportes/weekly-2026-11-04-transcripcion.md:166-235`).
- **Reemplaza:** ADR 0113 (el abono adicional): el 1:1 deja de ser un abono sin producto y pasa a ser la venta de su SKU.
- **Enmienda:** ADR 0037 (la venta es el deal: sigue siéndolo, ver punto 6), ADR 0065 (el valor vendido lo escribe el
  closer: ahora por línea), ADR 0136 (el día de la venta: primer abono vigente de cualquier línea), ADR 0022/0123 (la
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
   (prellenado con el programa de la vista), producto (texto libre), número de cohorte, precio de lista en USD,
   **Cuenta como cupo** (sí por defecto) y activo. Si se quiere que un SKU diga más cosas, se agrega un atributo
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
5. **La cohorte sigue existiendo, pero nadie la administra.** Nace con el primer SKU que nombra su número; si el número
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
9. **Cupos y comisión.** Cupos de la meta = SKUs vendidos con **Cuenta como cupo**. La comisión sale del valor vendido
   de todas las líneas vendidas del deal. Daniel Tovar valida estas dos reglas antes del corte 3; si las cambia, se
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

## Migración (decidida: todo automático)

- Por programa: un producto `programa_virtual` (cuenta como cupo) y un SKU por cohorte existente, con el precio de la
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
