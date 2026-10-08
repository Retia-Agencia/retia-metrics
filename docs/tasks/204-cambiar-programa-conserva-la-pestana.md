---
id: 204
etapa: O7
serves: "docs/anotaciones.md A-106; enmienda el ticket 097"
depends: [097, 193, 194, 197]
status: done
---

# 204 — Cambiar de programa conserva la pestaña visible

## Por qué existe

El ticket 097 conservaba la pestaña de objeto (`Dashboard`, `Inbox`, `Programa`), pero descartaba toda
la query al cambiar de programa. Cuando los tickets 193, 194 y 197 agregaron subpestañas con
`?seccion=`, el selector empezó a devolver a la primera subpestaña aunque la persona siguiera en el
mismo objeto.

## Alcance y decisión

- `rutaAlCambiarDePrograma` conserva exclusivamente `seccion`, porque es navegación y no un filtro.
- Se siguen soltando filtros, página, ids y cualquier otra query: pueden pertenecer al programa anterior.
- La regla aplica también al entrar o salir de `Todos los programas` en el Dashboard.
- Un programa inactivo sigue abriendo solamente su ficha; si el cambio se hace desde esa ficha, conserva
  también su subpestaña.

## Done cuando

- [x] Dashboard, Inbox y Programa conservan la subpestaña al cambiar entre programas.
- [x] El Dashboard conserva la subpestaña al entrar o salir de `Todos los programas`.
- [x] Los filtros del programa anterior no viajan al nuevo.
- [x] Tests del helper y typecheck en verde; lint sin errores y build de producción verificado con webpack.

## Cierre · 7-oct-2026

La regla queda centralizada en `lib/nav.ts` y el selector pasa la query vigente usando la API de
navegación de Next. Tests de regresión en `tests/roles.test.ts`. El lint conserva una advertencia previa
en `lib/deals/actividades.ts`; el build normal de Turbopack no pudo enlazar su puerto auxiliar en el
sandbox, y el build equivalente con webpack terminó completo.
