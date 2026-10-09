---
id: 211
etapa: corte
serves: "reunión del 8-oct (Michael): dos cortes vendiendo a la vez la última semana"
depends: []
status: review
---

# 211 — La corte del deal la elige su dueño, y dos cortes pueden vender a la vez

## Por qué existe

Michael, en la reunión del 8-oct: en la **última semana de venta** de una corte se vende para dos. Las clases
de C3 empiezan el 10-nov y se vende hasta el 13-nov; esa semana alguien puede entrar a C3 aunque las clases
ya arrancaron, o pasar a C4. Hoy el CRM tiene **una sola cohorte activa por programa**
(`cohorts_una_activa_por_programa_idx`) y le asigna esa cohorte a todo deal nuevo.

## Decisión (reunión del 8-oct)

**El dueño del deal elige la corte**, sin asignación automática. Además es una forma de asegurar que alguien
contactó a la persona.

## Por decidir antes de construir (pasar por `/grill-with-docs`)

- ¿El deal nace sin cohorte y la elige el dueño, o nace con la activa como sugerencia y el dueño la cambia?
  Recomendación: nace con la activa (las métricas de la cohorte y la meta la necesitan) y el dueño la puede
  cambiar en la ficha; en la semana de solape, la ficha pide elegir.
- ¿Dos cohortes en estado `activo` o la siguiente en `futuro` vendiendo? Recomendación: el índice de una sola
  activa se queda (la meta dinámica y el embudo dependen de él) y la ventana de venta (`fecha_inicio_ventas`
  a `fecha_cierre_ventas`, ADR 0022) define qué cohortes se pueden elegir en una fecha.
- Relación con Próxima Cohorte (ADR 0070, `cohorte_destino_id`) y con `cambiarCohorte` (063).
- Requiere ADR nuevo: cambia quién decide la cohorte.

## Done cuando

- [ ] El dueño elige o cambia la cohorte del deal, con rastro, entre las que están vendiendo.
- [ ] En la semana de solape se pueden elegir las dos.
- [ ] Las métricas por cohorte siguen cuadrando (tests).
