---
id: 376
etapa: deals
serves: "Weekly con Daniel Tovar del 3-nov (docs/hub.md §0, G-13) · ADR 0137 (reemplaza el 0113) · ADR 0012, 0037, 0065, 0123, 0125, 0136"
depends: [377, 369]
status: todo
---

# 376 — Productos y SKUs: qué compró cada persona

**Norte de la migración a SKUs: [`docs/norte-del-sku.html`](../norte-del-sku.html)** (audit del 20-nov-2026, ábrelo en el
navegador). Inventario de side effects por superficie con archivo:línea, decisiones abiertas D-0 a D-10, orden de los
cortes (incluye los tickets propuestos 464 y 465) y restricciones tocadas. Léelo antes de tocar cualquier corte; si
una decisión se cierra, actualízalo ahí y en el ADR.

**Diseño cerrado el 19-nov-2026 (grill con Mani).** La fuente de cada decisión es el **ADR 0137**; este archivo es
el plan de ejecución. Una sesión que lo retome **no rediseña**: ejecuta los cortes en orden y, si algo del código
contradice el ADR, para y pregunta a Mani en vez de decidir.

**20-nov: después del corte 1, el ADR 0139 rehízo los cortes siguientes en los tickets 459 a 463 (abajo).**

Antes era fase 2 del Hub (`docs/hub.md` §0). **Mani, 19-nov: arranca ya**, en una sesión padre aparte.

## Por qué (resumen; citas en el ADR 0137)

Daniel Tovar quiere ver qué SKUs compró cada persona (Virtual C3 y 1:1 C3 son dos productos), con una nomenclatura
uniforme que solo crean los admins. Mani quiere que la única operación sea asignar SKUs a los deals y que gerencia
deje de crear y activar cohortes a mano.

## Lo decidido, en una tabla (detalle y argumento en el ADR 0137)

| # | Decisión |
|---|---|
| D1 | SKU = programa × producto × cohorte + precio de lista USD + activo. **Cuenta como cupo** es del producto, apagado por defecto (enmienda 19-nov, ADR 0137) |
| D2 | Código armado por el sistema: `programa_producto_cohorte` (`tactical_investor_uno_a_uno_c3`), único, nunca tecleado |
| D3 | Solo `esAdministrador` crea, edita o desactiva SKUs; botón que abre popup en la vista del programa |
| D4 | Producto = texto libre normalizado (snake_case, sin tildes) con autocompletar; fila propia por programa |
| D5 | Cohorte = número; nace con el primer SKU que la nombra (el popup pide la ventana si es nueva); **activa = la que tiene hoy en su ventana**; se va el botón Activar |
| D6 | Venta = deal con ≥1 línea con abono vigente (una vez por persona); SKUs vendidos = líneas, lo que se filtra |
| D7 | Línea asignable siempre; sin abonos está **propuesta** (saldo visible, no cuenta); vende por su valor completo el día de su 1.er abono vigente |
| D8 | Valor vendido por línea: precio de lista del SKU por defecto, editable por el closer; se guardan ambos |
| D9 | Cupos = SKUs vendidos con Cuenta como cupo (validar con Daniel Tovar antes del corte 3). Comisión **por SKU**: % del SKU (prellenado con el del programa, que queda como defecto), congelado en la línea con su 1.er abono; comisión del deal = Σ valor vendido × % de cada línea vendida (enmienda 20-nov) |
| D10 | Closer, en deal suyo: asigna, edita valor, quita línea sin abonos; con abonos solo se anula |
| D11 | Todo abono cuelga de una línea; muere el concepto `adicional` |
| D12 | `deals.cohort_id` y `deals.valor_vendido_usd` se quedan **derivados** de las líneas, un solo escritor, misma transacción, test de paridad. Su retiro es ticket aparte |
| D13 | El SKU es del programa del deal (FK compuesta, ADR 0125) |
| D14 | Migración automática; los abonos `adicional` se listan para que Mani cree sus SKUs |
| D15 | Etapa por líneas: cualquier abono vigente a cualquier línea → Ganado parcial; todas las líneas **vendidas** en saldo 0 → Ganado completo; anular recalcula (enmienda 19-nov, ADR 0137 punto 14) |

## Modelo de datos (corte 1)

Nombres orientativos; respetar las convenciones de `docs/agents/convenciones.md` y el molde de `lib/catalogo/molde.ts`
(toda fila de catálogo tiene `id` y `activo`, rastro en `change_log`, nunca se borra).

- **`productos`** (`id`, `program_id`, `nombre` tal como se escribió, `slug` normalizado, `activo`, timestamps).
  Único `(program_id, slug)`. Unique `(id, program_id)` para la FK compuesta.
- **`skus`** (`id`, `program_id`, `producto_id`, `cohort_id`, `codigo`, `precio_lista_usd`, `activo`,
  timestamps). **Cuenta como cupo** vive en `productos.cuenta_como_cupo`, default `false` (enmienda 19-nov). Único `codigo`; único `(producto_id, cohort_id)`; FK compuestas
  `(producto_id, program_id)` y `(cohort_id, program_id)` (esta última ya tiene destino: `cohorts_id_programa_uq`);
  unique `(id, program_id)`. `codigo` = `${programs.slug en snake_case}_${productos.slug}_${cohorts.codigo en minúscula}`,
  escrito por el servidor al crear; si cambia el producto o la cohorte se recalcula.
- **`deal_lineas`** (`id`, `deal_id`, `program_id`, `sku_id`, `precio_lista_usd` copiado del SKU al asignar,
  `valor_vendido_usd` editable, `asignada_por`, `asignada_en`, `anulada_en`/`anulada_por` según el patrón de vigencia
  de `lib/queries/vigente.ts`). FK compuestas `(deal_id, program_id)` y `(sku_id, program_id)`. CHECK valor ≥ 0.
- **`abonos.linea_id`** nullable en 0153 (backfill), NOT NULL en 0154 cuando los escritores ya la llenan; FK compuesta al programa. `abonos.concepto` se retira en el corte 2
  (en el corte 1 se mantiene y se escribe en paralelo para que nada se rompa).
- **`cohorts.estado`**: deja de escribirse a mano. `cohorteActiva` (`lib/queries/cohortes.ts`) y `cohortesVendiendo`
  (`lib/cohortes/vendiendo.ts`) responden por la ventana de hoy en Bogotá. **Decidido:** `estado` se calcula con una función de
  las fechas y la columna sale en 0154 (no puede ser generada: depende de hoy); el índice `cohorts_una_activa_por_programa_idx` sobra porque el
  `EXCLUDE` de `cohorts_sin_solape_de_ventas` ya garantiza una sola por día. **`cerrado`/`futuro` también se deducen**
  (antes de la ventana = futura, después = cerrada); una cohorte sin fechas es futura "por definir".
- **Derivados en el deal** (D12): `deals.cohort_id` = cohorte de la línea vendida vigente más antigua con cupo; si no
  hay, la de la línea propuesta más antigua con cupo; si no, nulo. `deals.valor_vendido_usd` = suma del valor vendido
  de las líneas vendidas vigentes (nulo si no hay). Los escribe **solo** `lib/deals/lineas.ts` (nuevo), en la misma
  transacción que la línea o el abono; evaluar un trigger de base como guardia (ADR 0005).
- `deals.cortesia` no cambia: un deal cortesía no vende, tenga las líneas que tenga.
- `deals.cohorte_destino_id` (pendiente "próxima cohorte") sigue apuntando a una cohorte; al pagar, la línea toma el
  SKU con cupo de esa cohorte.

## Cortes (cada uno a producción por separado, con CI verde y checkpoint de Mani)

### Corte 1 — Modelo, migración y cohorte deducida (no toca pantallas del Hub)

1. Migración drizzle (siguiente número libre en `drizzle/`; hoy la última es 0152): tablas, FKs, índices, backfill.
   **La aplica la sesión padre con el ok explícito de Mani**, nunca un agente por su cuenta.
2. Backfill, en este orden y en una transacción por programa:
   - producto `programa_virtual` (nombre "Programa virtual") por programa;
   - un SKU por cohorte existente con `precio_lista_usd = cohorts.precio_usd`, cuenta como cupo;
   - SKU `sin_clasificar` por (programa, cohorte del deal) con adicionales, vigentes o anulados; no cuenta como cupo
     (un adicional anulado queda en una línea nacida anulada);
   - una línea por deal con `cohort_id` (vendido o no), con `valor_vendido_usd = deals.valor_vendido_usd`;
   - cada abono `ticket` → línea de su deal; cada abono `adicional` → línea `sin_clasificar` del deal, con su monto como
     valor vendido.
3. `lib/deals/lineas.ts`: único escritor de líneas y de los derivados del deal. Reemplazar las escrituras de
   `cohortId` y `valorVendidoUsd` en `lib/deals/abonos.ts:224`, `lib/deals/mover-etapa.ts:552` y `:649`,
   `lib/deals/cambiar-cohorte.ts`, `lib/deals/valor-vendido.ts`, `lib/pagos/procesar.ts` y los importadores
   (`lib/migracion/importar.ts`) por llamadas a ese módulo. Regla por defecto cuando un flujo viejo "congela la
   cohorte": asignar la línea del SKU con cupo de la cohorte que vende ese día; si hay cero o más de uno, el mismo
   `en_revision` que ya usa `resolverCohorte` (`lib/pagos/traducir.ts:10`).
   La etapa la calcula el mismo módulo por líneas (D15); la venta sin abono del ADR 0136 vende la línea con cupo con
   Recaudado 0 (ADR 0137 punto 15).
4. `cohorteActiva`, `cohortesVendiendo` y `lib/programas/hechos.ts:51` por fechas. Quitar el botón Activar de
   `components/cohortes-admin.tsx` (la pantalla de cohortes queda de solo lectura de fechas y metas, que se siguen
   editando ahí hasta el corte 2).
5. `saldosDeDeals` (`lib/queries/saldo.ts`) suma por línea; el saldo del deal = suma de saldos de sus líneas
   vendidas. La reja del sobrepago pasa a ser por línea.
6. Reporte de adicionales: script `scripts/376-adicionales.ts` que imprime deal, lead, programa, fecha, monto y nota de
   cada abono que quedó en `sin_clasificar`. **Se le entrega a Mani** para que cree los SKUs (en el corte 2, con el
   popup) y se re-cuelguen.
7. **Puente hasta el corte 2:** `crearCohorte` (`lib/catalogo/cohortes.ts`) crea en la misma transacción el SKU
   Programa virtual de la cohorte, a su precio, como hizo la migración; así una cohorte nueva puede vender. Sale en el
   corte 2.
8. Migración 0154: `abonos.linea_id SET NOT NULL`; sale `cohorts.estado` con su índice y sus checks.
9. Coordinación: los tickets de Hotmart 448 a 455 (`docs/tasks/README.md` §25) escriben la cohorte de la compra. Si
   alguno está en curso, el corte 1 los reconcilia con la regla del paso 3; el 449 (la oferta dice qué se vendió) es
   el lugar natural para mapear oferta → SKU más adelante.

**Done del corte 1**
- [ ] Migración aplicada en producción con el ok de Mani.
- [ ] Test de paridad (pglite, ADR 0020) sobre una copia de los datos: caja, Vendido, Recaudado, Por cobrar, Ventas,
      cupos y metas por programa y cohorte **idénticos** antes y después; la única diferencia permitida son los
      adicionales, reportados con su monto.
- [ ] Test: `deals.cohort_id` y `deals.valor_vendido_usd` siempre iguales a lo que dicen las líneas, después de
      asignar, editar, quitar, abonar y anular.
- [ ] Test: la cohorte activa se deduce de la ventana; no existe forma de activarla a mano.
- [ ] Test: un SKU de otro programa no entra a un deal (la base lo rechaza).
- [ ] Test: abono a cualquier línea → Ganado parcial; todas las vendidas en 0 → Ganado completo; una propuesta sin
      abono no impide el completo; anular recalcula.
- [ ] Lista de adicionales entregada a Mani.

### Después del corte 1: el SKU reemplaza todo (ADR 0139, 20-nov)

**El ADR 0139 reemplaza el punto 5 del 0137** y cambia lo que sigue. Lo que había aquí como cortes 2 y 3 se rehízo en
cinco tickets. Resumen de lo que cambia: no hay tabla `productos` (el nombre vive en el SKU); precio, % de comisión y
cuenta como cupo son del SKU y el popup llega vacío; la cohorte es el ciclo C<N>, nace desde el popup con ventana y meta
obligatorias y se edita en Objetivos de la vista del programa; salen la pantalla de cohortes, `programs.ticket_usd`,
`programs.comision_porcentaje` y `cohorts.precio_usd`; el **precio de referencia del ciclo** es el menor precio de los
SKUs activos con cupo del ciclo.

**Fecha:** la C3 de Tactical cierra ventas el 15-dic-2026. El 459 va a producción **antes del 10-dic**. Hasta entonces
la pantalla de cohortes no se toca (es la única puerta para crear la C4, con el puente del corte 1).

Orden: 459 → 460 + 464 (ADR 0140, prioridad de los closers) → 461 → 462 → 463. 460 y 461 no se pisan (ficha y formulario de abono contra lecturas de dinero) y
pueden ir en paralelo después del 459.

#### 459 — Popup "Nuevo SKU" y el ciclo nace con él (urgente, antes del 10-dic)

**Marcado para salir en este ticket:** `components/cohortes-admin.tsx` (la pantalla de cohortes y su botón "Nueva
cohorte"), `crearCohorteAccion` (`app/(app)/p/[programa]/programa/acciones-programa.ts`) y el puente de `crearCohorte`
(`lib/catalogo/cohortes.ts`). El botón Activar ya salió en el corte 1.

1. Migración (la aplica la sesión principal con el ok de Mani): `skus.nombre`, `skus.slug`, `skus.cuenta_como_cupo`
   (default `false`), `skus.comision_porcentaje` (0 a 100). Backfill: nombre y slug del producto del SKU; cupo del
   producto; % = `programs.comision_porcentaje` del programa (así ninguna comisión se mueve); `sin_clasificar` en 0 %.
   Único `(program_id, slug, cohort_id)`. `skus.producto_id` pasa a nullable (sale en el 463).
2. `lib/deals/lineas.ts` y `lib/pagos/traducir.ts` leen el cupo de `skus.cuenta_como_cupo`, no de `productos`.
   `lib/catalogo/skus.ts` (molde, `change_log`) crea, edita y desactiva; el código se arma con `programa_slug_c<N>`.
3. Popup "Nuevo SKU" en `app/(app)/p/[programa]/programa/page.tsx`, solo `esAdministrador` (la capacidad central, nunca
   un `rol ===`): Nombre (autocompletar con los slugs del programa), Cohorte (N), Precio USD, % de comisión, Cuenta
   como cupo. **Vacío, sin prellenar** (ADR 0139 punto 1). Si N no existe: Inicio y Cierre de ventas y Meta de cupos
   obligatorios, Meta de leads/día en 50; la cohorte y el SKU se crean en una transacción; el choque de ventanas es el
   400 del ADR 0123. Muestra el código antes de guardar. Tabla de SKUs del programa con editar y desactivar.
4. La ventana, la meta de cupos, la meta de leads/día, el inicio de clases y las notas de un ciclo existente se editan en
   Objetivos de la cohorte (`objetivos-de-la-cohorte.tsx`), por el molde.
5. Sale lo marcado arriba. Sale el estado "por definir" de `lib/cohortes/estado.ts` para ciclos nuevos (los que ya
   existen sin fechas se listan para Mani antes de migrar; no se inventan fechas).

**Done**
- [ ] Test: forjar el POST de un closer creando un SKU → 403 y la base no se mueve.
- [ ] Test: crear Virtual C4 con N nuevo crea el ciclo con su ventana; con ventana que choca → 400 y no queda nada.
- [ ] Test: el código sale `tactical_investor_uno_a_uno_c3` desde "Uno a Uno" y "uno a uno" (mismo slug).
- [ ] Test de paridad: cupos, comisión y metas por programa y cohorte idénticos antes y después de la migración.
- [ ] Gerencia crea la C4 de Tactical en producción desde el popup antes del 15-dic.

#### 460 — Líneas en la ficha del deal y abono por línea (antes corte 2, pasos 2, 3, 5 y 6)

1. **Ficha del deal**: sección "SKUs" con cada línea (nombre, cohorte, precio de lista, valor vendido, recaudado, por
   cobrar, propuesta/vendida/anulada). Closer dueño o admin: Asignar SKU (activos del programa), editar valor, quitar
   sin abonos; con abonos, Anular.
2. **`FormularioAbono`** (`components/deals/formulario-abono.tsx`): "¿Qué SKU está pagando?" entre las líneas del deal,
   con "Asignar otro SKU" ahí mismo. Se retira `abonos.concepto` y el texto "Aparte del programa".
3. Re-colgar los adicionales de `sin_clasificar` a los SKUs que Mani cree con el popup del 459.
4. Permisos: closer sobre deal ajeno → 403.

**Done**
- [ ] Test: una persona con Virtual C3 y Uno a uno C3 tiene dos líneas y dos saldos en su deal.
- [ ] Test: el closer asigna, edita valor y quita sin abonos; con abonos solo anula.
- [ ] Test: una línea propuesta no suma a Vendido, Ventas, cupos ni comisión; con su primer abono suma su valor completo ese día.
- [ ] `sin_clasificar` vacío en producción.

#### 461 — Dinero sin ticket del programa: precio de referencia y comisión por línea

**Antes de la parte de comisión, Mani confirma D9 con Daniel Tovar.**

1. Una función, `precioDeReferenciaDelCiclo` (en `lib/cohortes/`), = menor `precio_lista_usd` de los SKUs activos con
   cupo del ciclo; nulo si no hay. La leen, en vez de `cohorts.precio_usd`: `lib/queries/metas.ts`,
   `lib/queries/vamos-a-llegar.ts`, `lib/metas/cumplimiento-de-cohorte.ts`, `lib/queries/series-dinero.ts`,
   `lib/queries/embudo-etapas.ts` (ticket perdido), `lib/queries/proyeccion-roas.ts`, `lib/queries/configuracion-de-hoy.ts`,
   `lib/queries/ficha-programa.ts`, `lib/queries/kanban.ts`, `lib/queries/ficha-deal.ts`, `lib/mcp/salidas/operacion.ts` y la
   venta directa (`lib/deals/venta-de-la-pasarela.ts`, cuando la pasarela no trae SKU).
2. **Descuento por línea**: `precio_lista_usd − valor_vendido_usd` de la línea (`descuentoDeDeal` en
   `lib/queries/saldo.ts`, `lib/queries/dashboard.ts`, `lib/queries/vista-dashboard.ts`, `lib/queries/pagos-de-students.ts`).
3. **Comisión por línea**: `deal_lineas.comision_porcentaje`, congelado del SKU con el primer abono vigente
   (`lib/deals/lineas.ts`); migración con el % ya congelado de cada deal. `lib/queries/comision.ts` suma por línea.
   `deals.comision_porcentaje` queda derivado o sale (decidir al medir sus lectores).
4. Al crear o editar un programa ya no se pide ticket ni % (`components/program-switcher.tsx`,
   `components/programas-admin.tsx`, `lib/catalogo/programas.ts`, `acciones-programa.ts`, `lib/programas/hechos.ts`
   y el recorrido de configuración); la vista del programa deja de mostrarlos.

**Done**
- [ ] Ningún lector de `programs.ticket_usd`, `programs.comision_porcentaje` ni `cohorts.precio_usd` en `lib`, `app`, `components`.
- [ ] Test de paridad: meta en USD, ticket perdido, proyección de ROAS y comisión idénticos donde el ciclo tiene un solo SKU con cupo.
- [ ] Test: ciclo sin SKU con cupo → la cifra dice "sin precio" (nulo), nunca 0.

#### 462 — Hub, ficha del lead, Students y MCP por SKU (antes corte 3, pasos 1, 2, 4, 5 y 6)

1. Filtros del Hub (`lib/queries/metricas-filtros.ts`): **Nombre del SKU** (agrupa por `skus.slug`) y **SKU**, al lado
   de Cohorte, con opciones de los SKUs que existen. Programa sigue siendo frontera.
2. Vendido, Recaudado y Por cobrar por línea; Ventas por deal; "SKUs vendidos" como cifra nueva, en `docs/metricas.md` y
   en el registro de métricas. Cupos = SKUs vendidos con `skus.cuenta_como_cupo`. Desaparece "Aparte del programa".
3. Ficha del lead: "Compras" (todas las líneas de sus deals por fecha).
4. Students agrupado por nombre de SKU, con lo pagado y el saldo por línea.
5. MCP: nombre del SKU y SKU como filtros de `consultar_metrica` y `consultar_hechos`; líneas en `ficha_de_deal` y `ficha_de_lead`.

**Done**
- [ ] Test: Virtual C3 + Uno a uno C3 cuenta 1 en Ventas, 2 en SKUs vendidos y aparece en el filtro de cada nombre.
- [ ] Las cifras del Hub con los filtros nuevos cuadran con la suma de las líneas (test de coherencia).

#### 463 — Migración de retiro (destructiva, al final)

Cuando 459 a 462 están en producción y sin lectores: sale la tabla `productos` y `skus.producto_id`; salen
`programs.ticket_usd`, `programs.comision_porcentaje` y `cohorts.precio_usd`. La lee a mano la sesión principal, con
respaldo de lo que tenía datos (ADR 0131), y la aplica con el ok de Mani.

**Done**
- [ ] `git grep` de las cinco columnas y de `productos` vacío fuera de `drizzle/`.
- [ ] Respaldo de los valores retirados guardado antes de aplicar.

#### 464 — El ciclo del deal lo define su SKU; SKUs predeterminados (ADR 0140)

**Depende de 459. Va a producción junto con el 460 o después** (con varios predeterminados el abono tiene que elegir
línea). Prioridad de Mani, 20-nov: que los closers operen sin huecos lo antes posible.

1. Migración (la aplica la sesión principal con el ok de Mani): `skus.predeterminado` boolean, default `false`. Sin índice
   único: varios por programa.
2. Tabla de SKUs de la vista del programa: interruptor **Predeterminado** al lado de **Cuenta como cupo**, solo
   `esAdministrador`, por el molde con `change_log`.
3. `abrirDeal` (`lib/deals/mover-etapa.ts:654`) deja de llamar a `cohorteActiva`: `lib/deals/lineas.ts` asigna una
   línea propuesta por cada SKU activo y predeterminado del programa, en la misma transacción. Cero predeterminados →
   deal sin líneas, ciclo nulo. La pasarela que trae SKU asigna ese.
4. Derivado `deals.cohort_id` con la regla del D12 y el desempate del ADR 0140 punto 4.
5. Tablero de Deals: sale el filtro por defecto de cohorte activa (`lib/queries/kanban.ts:303`,
   `components/deals/filtro-kanban.tsx`, `app/(app)/p/[programa]/deals/page.tsx:112`). Filtros nuevos **Nombre del SKU**,
   **SKU**, **Ciclo** y la opción **Sin SKU**, con opciones leídas de los SKUs del programa. Sin filtro de ciclo por
   defecto. Los enlaces viejos con `?cohorte=` siguen funcionando.
6. Flujos del closer sin `cohorteActiva`: ficha (`components/deals/ficha/ficha-acciones.tsx`,
   `lib/deals/ficha/cargar-datos.ts`), `lib/deals/estudiante.ts`, `lib/deals/pago.ts`, `lib/deals/valor-vendido.ts`.
   Cada uno lee el ciclo de las líneas del deal. Hub, Juanito (`lib/catalogo/reportes-whatsapp.ts`), semáforo y alertas
   siguen por fechas (ADR 0140 punto 7).
7. MCP: el tablero y la ficha del deal muestran los mismos filtros y "Sin SKU" (`lib/mcp/herramientas/operacion.ts`,
   `lib/mcp/salidas/operacion.ts`).

**Done**
- [ ] Test: con dos SKUs predeterminados activos, un deal que entra por webhook nace con dos líneas propuestas y nada
      suma a Vendido, Ventas, cupos ni comisión.
- [ ] Test: sin predeterminados, el deal nace "Sin SKU" y aparece con ese filtro.
- [ ] Test: un SKU predeterminado desactivado no se asigna.
- [ ] Test: forjar el POST de un closer que prende Predeterminado → 403 y la base no se mueve.
- [ ] Test: el tablero sin parámetros no filtra por ciclo; `?cohorte=<id>` viejo sigue filtrando.
- [ ] `git grep cohorteActiva` solo en Hub, Juanito, semáforo, alertas y metas.
- [ ] Recorrido en producción con un closer: crea deal, ve su SKU, lo cambia, registra abono.

## Fuera de este ticket

- Retirar `deals.cohort_id` y `deals.valor_vendido_usd` cuando sus lecturas migren a las líneas (ticket nuevo, por
  partes; Mani lo pidió el 19-nov para quitar la redundancia).
- Mapear la oferta de Hotmart a un SKU (449).
