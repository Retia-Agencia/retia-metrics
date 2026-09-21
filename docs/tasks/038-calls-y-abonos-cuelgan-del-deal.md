---
id: 038
etapa: E1
serves: "plan v2 §6 etapa 1 · tarea E1-3 · ADR 0037, enmienda a los ADR 0027, 0010, 0015"
depends: [037]
status: done
---

# 038 — `calls` y `abonos` cuelgan del deal, y `sales` se elimina

> Parte de la etapa 1: **una rama, una migracion** (`0020`).

## Objetivo

Reapuntar las dos tablas operativas que sobreviven y borrar la que se disuelve.

```
calls   .person_id → .deal_id      (sin person_id)
abonos  .sale_id   → .deal_id      (sin sale_id)
sales   ← SE ELIMINA
```

## Por que esto es barato HOY y caro en un mes

Medido en `production` el 21-sep: **`calls` 0, `sales` 0, `abonos` 0**. No es una migracion de
datos: es un cambio de esquema sobre tablas vacias. **El costo esta entero en los 27 archivos que
nombran `sales`**, y ese costo solo sube.

## Alcance

- **Dentro:** las dos columnas nuevas, el borrado de `sales`, y los ~27 archivos que la nombran
  (`lib/queries/`, `lib/mutations/`, tests, tipos).
- **Dentro:** `sales.call_id` desaparece con la tabla (enmienda al ADR 0027, ya anotada ahi).
- **Dentro:** `calls` conserva sus ocho `resultado` (ADR 0015) y su `fechaSeguimiento`.
- **Fuera:** la logica nueva de calls y abonos. Eso es la etapa 4 (tickets 057 a 063).
- **Fuera:** decidir que mueve la etapa. Eso es la etapa 2.

## La trampa

Varias consultas del dashboard hacen `join sales` para contar ventas. **Al quitar la tabla, esas
consultas no fallan solas si alguien las "arregla" contando deals sin filtrar por etapa**: una
venta es un deal en **Abonado o Completo** (ADR 0037), no cualquier deal. Contar todos los deals
infla las ventas y **no lanza ningun error**. Si una consulta no se puede reescribir con criterio
en este ticket, se deja **rota a proposito** y se arregla en la etapa 5, que es donde vive esa
decision; lo que no se vale es dejarla compilando y mintiendo.

## Done cuando

- [ ] `grep -rn "\bsales\b" lib app components scripts` no devuelve nada.
- [ ] `calls.person_id` y `abonos.sale_id` no existen.
- [ ] `npm test`, `typecheck` y `lint` limpios.
- [ ] Ninguna consulta cuenta "ventas" como "deals" a secas.

## Kiro

Si, con revision cercana de las consultas del dashboard.
