---
id: 033
fase: F4
serves: "ADR 0030; protege el criterio 5 de la spec y el comparativo entre closers (ADR 0023)"
depends: [028]
status: done
---

# 033 — `Mani` y `mani` no pueden ser dos closers

> **CERRADO el 18-sep.** 570 tests, typecheck y lint limpios. Migracion `0015` aplicada en `dev` y
> en `production`. `users.closer_id` de Mani corregido a `Mani` en `production`, por el molde.

## De donde salio

No de un plan: del **primer recorrido real contra `production`**. Mani se cargo su `closer_id`
desde `/ajustes/usuarios` y quedo en `mani`; el de la otra closer activa es `Maru`, y la columna
Closer de las hojas usa nombres capitalizados (`Andrea` tiene 317 llamadas historicas atadas a esa
ortografia).

## Por que era grave y no cosmetico

`closerId` se comparaba como texto crudo en cuatro sitios distintos, asi que `Mani` y `mani` eran
**dos closers en todas las metricas**: el comparativo mostraba dos filas donde hay una persona, el
filtro por closer devolvia la mitad de sus llamadas, `esCloserValidoEnPrograma` habria negado un
programa donde si vende, y la reja de la anulacion le habria dicho *"la registro otro closer"* a
quien la registro.

**Ninguna de las cuatro lanza un error.** Las dos cifras se ven creibles. Misma familia que el
centinela del ano 1 y que la subconsulta correlacionada del 025.

## Que se hizo

- `lib/closers/identidad.ts`: la unica respuesta a "¿son el mismo closer?" (`mismoCloser`,
  `igualCloser`, `claveDeCloser`, `claveDeCloserSql`). El texto se sigue guardando como se escribio.
- Los seis sitios que comparaban en crudo pasan por ahi (`dashboard.ts` x2, `personas.ts` x3,
  `anulaciones.ts` x1).
- El comparativo agrupa por la clave normalizada **en SQL** y devuelve `min(closer_id)` como
  etiqueta, en vez de agrupar por texto crudo y unir en memoria: lo segundo funcionaba, pero dejaba
  el footgun puesto para la proxima consulta.
- Migracion `0015`: indice unico parcial sobre la expresion normalizada en `users` (ADR 0005).
- `tests/closer-identidad.test.ts`: comportamiento, equivalencia SQL/JS **ejecutada contra
  Postgres**, el indice, y un guardian sobre `lib/`, `app/` y `components/`.

## Done cuando

- [x] `Mani`, `mani` y `  MANI  ` cuentan como un solo closer en el comparativo y en el filtro.
- [x] Dos cuentas no pueden reclamar el mismo closer (lo impide la base, no el codigo).
- [x] Un guardian falla si alguien vuelve a comparar `closerId` en crudo.
- [x] El guardian esta probado mordiendo en los DOS sentidos: caza las formas malas y **no marca la
      solucion**.
- [x] La migracion aplicada en `dev` y en `production`, sin colisiones.

## La trampa que casi entra (leer antes del proximo regex en SQL)

La primera version normalizaba con `'\s+'` dentro de una plantilla `sql`. En un template literal de
JavaScript **`\s` se cocina a `s`**: el regex que llegaba a Postgres era `'s+'` y colapsaba las
eses, no los espacios. `Jose` habria quedado `jo e`.

Peor: el indice y la consulta viven en archivos distintos y quedaron con escapes **distintos**, o
sea el indice habria protegido una cosa y la consulta agrupado otra — la divergencia exacta que el
modulo existe para impedir. Se atajo antes de aplicar nada.

Por eso la expresion es `'[[:space:]]+'` (sin backslash, nada que cocinar) y hay un test que
**ejecuta** las dos normalizaciones y las compara. Detalle completo en el ADR 0030.

## Lo que NO resuelve

Que alguien escriba `Andre` en vez de `Andrea`. Eso no es un problema de mayusculas sino de un
identificador de texto libre, y sigue siendo el riesgo de fondo del ADR 0011 y del ticket 031.
