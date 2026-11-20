---
id: 376
etapa: deals
serves: "Weekly con Daniel Tovar del 3-nov (docs/hub.md §0, G-13) · ADR 0137 (reemplaza el 0113) · ADR 0012, 0037, 0065, 0123, 0125, 0136"
depends: [377, 369]
status: todo
---

# 376 — Productos y SKUs: qué compró cada persona

**Diseño cerrado el 19-nov-2026 (grill con Mani).** La fuente de cada decisión es el **ADR 0137**; este archivo es
el plan de ejecución. Una sesión que lo retome **no rediseña**: ejecuta los cortes en orden y, si algo del código
contradice el ADR, para y pregunta a Mani en vez de decidir.

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

### Corte 2 — Operación: popup de SKUs, líneas en la ficha, abono por línea

1. **Popup "Nuevo SKU"** en la vista del programa (`app/(app)/p/[programa]/programa/page.tsx`, misma familia de
   popups que el resto del CRM), visible solo para `esAdministrador`. Campos: Producto (texto libre con autocompletar),
   Cohorte (número), Precio (USD, prellenado con `programs.ticket_usd`), Cuenta como cupo (check, sí). % de comisión (prellenado con `programs.comision_porcentaje`, editable). Programa
   prellenado y fijo. Si el número de cohorte no existe, aparecen Inicio y Cierre de ventas (y la meta de leads/día con
   su defecto de 50); el choque de ventanas se traduce al 400 que ya existe (ADR 0123). Muestra el código que se va a
   crear antes de guardar. Tabla de SKUs del programa con editar y desactivar por el molde.
2. **Ficha del deal**: sección "SKUs" con cada línea (código decodificado: producto, cohorte, precio de lista, valor
   vendido, recaudado, por cobrar, estado propuesta/vendida/anulada). Closer dueño o admin: Asignar SKU (lista de SKUs
   activos del programa), editar valor, quitar si no tiene abonos; con abonos, Anular.
3. **`FormularioAbono`** (`components/deals/formulario-abono.tsx`): en vez de "¿Qué está pagando? Programa / Servicio
   adicional", pregunta "¿Qué SKU está pagando?" entre las líneas del deal, con "Asignar otro SKU" ahí mismo. Se retira
   `abonos.concepto` y el texto "Aparte del programa".
4. **La cohorte deja de crearse a mano** (Mani, 19-nov: "todo desde SKUs"): se quita Crear cohorte de
   `components/cohortes-admin.tsx` y de su acción; la única puerta es el popup de SKU. Se retira el puente del corte 1
   (crear cohorte crea su SKU Programa virtual).
5. Re-colgar los adicionales de la lista del corte 1 a los SKUs que Mani creó (script o acción de admin).
6. Permisos: forjar un POST de closer creando un SKU → 403 y la base no se mueve; closer sobre deal ajeno → 403.

**Done del corte 2**
- [ ] Test: una persona con Virtual C3 y 1:1 C3 tiene dos líneas y dos saldos en su deal.
- [ ] Test: un closer no puede crear un SKU (403 forjado); sí puede asignarlo, editar su valor y quitarlo sin abonos.
- [ ] Test: una línea propuesta no suma a Vendido, Ventas, cupos ni comisión; con su primer abono suma su valor completo
      ese día.
- [ ] `sin_clasificar` vacío en producción.

### Corte 3 — Hub y ficha del lead

1. Filtros del Hub (los de 377, `lib/queries/metricas-filtros.ts`): **Producto** y **SKU** al lado de Cohorte, con
   opciones que salen de los SKUs que existen en el programa (nunca una lista fija). Programa sigue siendo la ruta y
   el Hub de todos (`/hub`, 422) nunca mezcla programas en una cifra.
2. Vendido, Recaudado y Por cobrar (369) por línea; Ventas por deal; "SKUs vendidos" como cifra nueva con su entrada en
   `docs/metricas.md` y en el registro de métricas. Desaparece "Aparte del programa".
3. Cupos de la meta = SKUs vendidos con Cuenta como cupo (`lib/queries/metas.ts`); comisión por línea vendida con su % congelado
   (`lib/queries/comision.ts`; columnas `skus.comision_porcentaje` y `deal_lineas.comision_porcentaje`, migración con
   el % ya congelado de cada deal y 0 % para `sin_clasificar`). **Antes de construir este paso, Mani confirma D9 con Daniel Tovar.**
4. Ficha del lead: "Compras", todas las líneas de todos sus deals en orden de fecha (SKU, fecha de venta, valor
   vendido, recaudado, por cobrar, closer).
5. **Pestaña Students por producto** (`app/(app)/p/[programa]/students/page.tsx`): deja de filtrar por la cohorte del
   deal y agrupa por producto (Programa virtual, 1:1 Rosario, ...), cada persona con lo que pagó y su saldo por línea.
   Pedido de Mani el 19-nov: "visibilidad completa de quiénes han pagado qué".
6. MCP (`lib/mcp`): exponer producto y SKU como filtros de `consultar_metrica` y `consultar_hechos`, y las líneas en
   `ficha_de_deal` y `ficha_de_lead`.

**Done del corte 3**
- [ ] Test: una persona con Virtual C3 y 1:1 C3 cuenta 1 en Ventas, 2 en SKUs vendidos y aparece en el filtro de cada
      producto.
- [ ] Las cifras del Hub con los filtros nuevos cuadran con la suma de las líneas (test de coherencia).
- [ ] D9 confirmada por Daniel Tovar y anotada en el ADR 0137.

## Fuera de este ticket

- Retirar `deals.cohort_id` y `deals.valor_vendido_usd` cuando sus lecturas migren a las líneas (ticket nuevo, por
  partes; Mani lo pidió el 19-nov para quitar la redundancia).
- Mapear la oferta de Hotmart a un SKU (449).
