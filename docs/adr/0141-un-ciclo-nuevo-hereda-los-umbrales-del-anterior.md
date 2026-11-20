# 0141 — Un ciclo nuevo hereda los umbrales del ciclo anterior de su programa

- **Estado:** aceptada · 20-nov-2026 (Mani).
- **Enmienda:** ADR 0139 punto 3 (lo que guarda un ciclo al nacer desde el popup del SKU).
- **Confirma:** restricción `catalogo-por-molde` (las filas copiadas dejan rastro con actor) y la regla de
  `objetivos` de que el CRM nunca trae un valor escrito en el código (`lib/db/schema.ts:2842`).

## Contexto

El umbral del semáforo de Pauta es la fila `costo_por_agenda` de `objetivos`, que cuelga del ciclo (`cohort_id`). El
semáforo y Juanito leen el umbral del ciclo que vende hoy (`lib/semaforo/semaforo.ts:95-97`). Desde el 459 el ciclo
nace en el popup Nuevo SKU (`lib/catalogo/skus.ts:164-187`), que pide la ventana, los cupos y los leads por día, pero
ningún objetivo. Un ciclo recién creado arranca sin umbral: cuando empieza a vender, el semáforo responde "La cohorte
activa no tiene umbral de costo por agenda" (`semaforo.ts:204`) y la alerta de Pauta por WhatsApp deja de salir, sin
avisar, hasta que alguien lo llene en Objetivos.

## Decisión

1. **Al crear un ciclo nuevo, se copian los objetivos de tipo umbral del ciclo anterior del mismo programa.** El
   ciclo anterior es el de la ventana de ventas más reciente, cerrada o abierta, entre los que tienen fechas. La copia
   ocurre en la misma transacción que crea el ciclo.
2. **Qué se copia:** las tasas y los costos que miden la calidad del gasto, que no dependen del tamaño del ciclo:
   `costo_por_agenda`, `costo_por_venta`, `roas` y `conversion_agenda_venta`, todas sus áreas, con `meta`,
   `aceptable` y `moneda` tal como estaban (sin convertir moneda). **Qué no se copia:** `cupos`, `agendas` e
   `inversion`, porque son metas del tamaño de cada ciclo, y el cupo ya es obligatorio en el popup.
3. **No se trae ningún valor del código.** Si el ciclo anterior no tenía un objetivo, el nuevo tampoco lo tiene y el
   Hub sigue diciendo "sin umbral". Copiar un valor que ya existe no es escribir uno.
4. **Cada fila copiada deja rastro** en `change_log` con el actor que creó el SKU y la nota "heredado de C<N>", por el
   molde de `lib/catalogo/`.
5. **Se ve en la pantalla:** la confirmación del popup dice qué umbrales heredó y de qué ciclo, y se corrigen en
   Objetivos de la vista del programa como cualquier otro.

## Descartados

| Opción | Por qué no |
|---|---|
| Pedir el umbral en el popup | Mete un dato de Pauta en un formulario de producto, y quien crea el SKU no siempre lo conoce |
| Dejarlo como está (llenarlo a mano) | La alerta de Juanito se apaga en silencio en cada ciclo nuevo |
| Copiar todos los objetivos | Cupos, agendas e inversión dependen del tamaño del ciclo; heredarlos inventaría metas |
| Un umbral por programa en vez de por ciclo | Rediseña `objetivos` y el Hub; el ciclo sigue siendo la unidad de metas (ADR 0139) |
