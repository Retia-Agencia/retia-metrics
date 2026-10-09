# 0080: La cohorte del deal la elige su dueño, entre las que están vendiendo

- **Estado:** aceptado, 9-oct-2026 (Mani). Se construye en el ticket 211.
- **Enmienda:** la regla de `cambiarCohorte` del ticket 063 (*"futura o activa"*, Mani, 28-sep), que queda solo
  para los estudiantes.
- **Confirma:** el ADR 0022 (la ventana de venta es dato de cada cohorte) y el índice
  `cohorts_una_activa_por_programa_idx` (una sola cohorte activa por programa).

## Contexto

Reunión del 8-oct con Michael: en la **última semana de venta** de una cohorte se vende para dos. Las clases de C3
empiezan el 10-nov y se vende hasta el 13-nov; esa semana alguien puede entrar a C3 aunque las clases ya
arrancaron, o pasar a C4. El CRM le pone a todo deal nuevo la cohorte activa y nadie la revisa. Michael pidió que
la elija el dueño del deal, que además es una prueba de que alguien habló con la persona.

## Decisión

1. **El deal sigue naciendo con la cohorte activa.** La meta, el embudo y la meta dinámica la necesitan desde el
   primer día; un deal sin cohorte no cuenta en ninguna. La activa es una sugerencia, no una asignación final.
2. **El dueño la cambia en la ficha** (o quien administra), con el `cambiarCohorte` de siempre: motivo
   obligatorio, `change_log` y nota del deal.
3. **"Vendiendo" se define por la ventana del ADR 0022.** Una cohorte vende en la fecha D (Bogotá) si es del
   programa, no está cerrada y `fecha_inicio_ventas ≤ D ≤ fecha_cierre_ventas`. La respuesta vive en UNA función,
   `cohortesVendiendo`. No se agrega un segundo estado `activo`: el índice de una sola activa se queda.
4. **Antes de ganar, solo se elige entre las que venden hoy.** Un deal que no es estudiante no puede ir a una
   cohorte que todavía no vende ni a una cerrada.
5. **Un estudiante sigue con la regla del 063:** futura o activa. Es el traslado (los 12 de agosto que pasaron a
   septiembre), que no depende de la ventana de venta.
6. **En la semana de solape, la ficha lo pide.** Si hoy venden dos cohortes, la ficha del deal abierto lo dice
   y ofrece cambiarla. No bloquea nada: decidir la cohorte no es requisito de ninguna etapa.

## Consecuencias

- Las métricas por cohorte no cambian de definición: siguen leyendo `deals.cohort_id`.
- En el solape, un deal que nadie revisó queda en la activa, que es lo que pasaba antes. El aviso es lo que
  cambia la conducta, no una reja.
- Si un día se pide que elegir la cohorte sea obligatorio para avanzar, va como requisito del motor de etapas,
  no como validación suelta en la ficha.
