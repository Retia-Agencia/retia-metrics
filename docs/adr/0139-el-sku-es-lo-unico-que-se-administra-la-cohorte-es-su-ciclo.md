# 0139 — El SKU es lo único que se administra; la cohorte queda como el ciclo C<N> que nace con él

- **Estado:** aceptada · 20-nov-2026 (Mani, grill del ticket 376 después del corte 1, PR 53).
- **Reemplaza:** el punto 5 del ADR 0137 (la cohorte sigue existiendo y nace con el primer SKU) y su punto 1 en lo que
  toca al producto. También reemplaza las enmiendas del 19-nov (el cupo es del producto) y del 20-nov (la comisión del
  programa como valor por defecto) del mismo ADR.
- **Enmienda:** ADR 0065 punto 7 (el % de comisión es del programa: pasa al SKU), ADR 0022 (la ventana sigue siendo dato
  declarado, ahora se declara al nacer el ciclo desde el popup del SKU), ADR 0133 (valor vendido de la venta directa =
  precio del SKU, no ticket de la cohorte).
- **Confirma:** ADR 0123 (ventanas sin solape por programa), ADR 0012 (catálogo por el molde), restricción
  `meta-de-cohorte` (la meta es del ciclo, no se reparte ni se suma por SKU).

## Contexto

El corte 1 del 376 (PR 53, migraciones 0153 a 0155) dejó SKUs, líneas del deal y la cohorte activa deducida de sus
fechas. Quedaron tres cosas administradas a mano que Mani quiere fuera: crear cohortes en su pantalla, el ticket base y
el % de comisión del programa (`programs.ticket_usd`, `programs.comision_porcentaje`), y la tabla `productos` con el
cupo. Mani, 20-nov: "el SKU reemplaza todo"; "solo toca asociar SKUs a deals y ya".

Lo que no se puede tirar sin perder el Hub: la ventana de venta y las metas. De la ventana salen «¿Vamos a llegar?»
(`lib/queries/vamos-a-llegar.ts`), la proyección de cupos (`lib/queries/proyeccion.ts`), el cumplimiento y el ritmo
(`lib/metas/cumplimiento-de-cohorte.ts`), la meta de leads del día, el semáforo y las alertas, y a qué ciclo va una venta
directa de la pasarela (`lib/pagos/traducir.ts`). Un Virtual C3 y un Uno a uno C3 comparten esa ventana y esa meta. Medido
el 20-nov: 243 usos de `cohortId` en 60 archivos de `lib`, `app` y `components`; 141 referencias a la tabla `cohorts`.

## Decisión

1. **El SKU es la única fila que alguien crea.** Campos del popup "Nuevo SKU" (vista del programa, solo
   `esAdministrador`): **Nombre** (texto libre), **Cohorte** (número N), **Precio de lista** (USD), **% de comisión** y
   **Cuenta como cupo**. Los tres últimos viven en el SKU (`skus.precio_lista_usd`, `skus.comision_porcentaje`,
   `skus.cuenta_como_cupo`). El popup llega **vacío**: no prellena precio, % ni cupo de ningún lado (Mani, 20-nov). Precio
   y % son obligatorios; cuenta como cupo arranca apagado.
2. **Sin tabla de productos.** El nombre vive en el SKU (`skus.nombre` como se escribió y `skus.slug` normalizado:
   minúsculas, sin tildes, snake_case). El código sigue siendo `programa_slug_c<N>` (`tactical_investor_uno_a_uno_c3`),
   armado por el servidor y único. "Todos los Uno a uno de cualquier ciclo" se agrupa por `skus.slug` dentro del
   programa: es determinista porque el slug se normaliza al guardar. Único `(program_id, slug, cohort_id)`. El
   autocompletar del popup sale de los slugs que ya existen en el programa.
3. **La cohorte queda como el ciclo C<N>: una fila por (programa, N) sin pantalla propia.** Guarda solo lo que es del
   ciclo: ventana de venta (inicio y cierre), meta de cupos, meta de leads por día, inicio de clases, notas y sus
   objetivos (`objetivos`). **Nace desde el popup del SKU** cuando N es nuevo: el popup pide inicio y cierre de ventas y
   meta de cupos (**obligatorios**) y la meta de leads por día (prellenada en 50, ADR 0123). Desaparece la cohorte "por
   definir": un ciclo sin ventana no sabe cuándo vende. El choque de ventanas sigue siendo el 400 del ADR 0123.
4. **La ventana y las metas de un ciclo que ya existe se editan en la sección de objetivos de la vista del programa**
   (`objetivos-de-la-cohorte.tsx`), por el molde. Sale la pantalla de cohortes (`components/cohortes-admin.tsx`), su
   botón "Nueva cohorte" y `crearCohorteAccion`. El botón Activar ya salió en el corte 1.
5. **Precio de referencia del ciclo** = el menor precio de lista entre los SKUs activos con cupo del ciclo (sin
   ninguno: nulo, y la cifra lo dice como hoy dice "sin ticket"). Es la única respuesta a "¿cuánto vale un cupo de
   este ciclo?" y la usan, con una sola función: la proyección de ROAS de una cita pendiente (decisión de Mani), la meta
   en USD (`meta de cupos × precio de referencia`), el ticket perdido del embudo y el valor de la venta directa cuando la
   pasarela no trae SKU. El menor, porque una proyección y una meta en caja no deben inflarse por un SKU caro.
   El **descuento** deja de usar el ticket: es por línea, `precio_lista_usd − valor_vendido_usd`, que la línea ya guarda.
6. **Se retiran `programs.ticket_usd`, `programs.comision_porcentaje`, `cohorts.precio_usd` y la tabla `productos`**
   (con `productos.cuenta_como_cupo`). La comisión de una venta sale del % congelado en cada línea con su primer abono
   vigente (ADR 0137 enmienda del 20-nov, que sigue en pie salvo el defecto del programa).
7. **`deals.cohort_id` se queda derivado** (ADR 0137 punto 12, sin cambio): los 243 usos siguen leyendo la cohorte del
   deal. Su retiro sigue siendo un ticket aparte, por partes.
8. **Fecha límite:** la C3 de Tactical Investor cierra ventas el 15-dic-2026. Hasta que el popup esté en producción, la
   pantalla de cohortes **no se quita** (el puente del corte 1, `crearCohorte` crea su SKU, es la única puerta para crear
   la C4). El popup tiene que estar en producción antes del 10-dic para que gerencia cree la C4 con margen.

## Descartado

| Alternativa | Por qué no |
|---|---|
| Ventana y meta en cada SKU | Rompe el no solape del ADR 0123 y la meta de cohorte; Virtual C3 y Uno a uno C3 tendrían dos metas que sumar; reescribe ~380 usos y no llega al 15-dic |
| Ventana en el SKU, metas en el ciclo | Dos fuentes de fecha para decidir a qué ciclo va una venta |
| Sin fechas ni metas de ciclo | Mani lo planteó ("las ventanas dan igual"); se descartó al ver que de ellas salen «¿Vamos a llegar?», proyección, ritmo, meta de leads del día y semáforo, que Daniel Tovar usa en el Hub |
| Solo fecha de cierre (inicio deducido) | Una fecha menos, pero prohíbe huecos entre ciclos, que el ADR 0022 permite |
| Mantener `productos` como agrupador | Mani, 20-nov: solo el SKU. El slug normalizado del SKU da el mismo agrupamiento sin una segunda tabla |
| Prellenar precio y % del último SKU del mismo nombre | Mani prefiere teclearlos: un valor viejo arrastrado en silencio es peor que un campo vacío |
| Precio de referencia = promedio vendido del ciclo | Nulo al arrancar el ciclo, que es cuando más se usa la proyección |

## Consecuencias

- Gerencia no crea cohortes, programas sin ticket ni %: crea SKUs, y el ciclo nace del primero que nombra su número.
- Al crear un programa ya no se pide ticket (`program-switcher.tsx`, `programas-admin.tsx`).
- El filtro Producto del corte 3 se llama **Nombre del SKU** y agrupa por slug; no hay lista fija.
- `cohorts` sigue existiendo como tabla. El nombre "cohorte" se queda en la interfaz (C3 es como lo dice el negocio).
- Plan de ejecución: `docs/tasks/376-productos-y-skus.md` §Cortes 2 a 4, tickets 459 a 463.
