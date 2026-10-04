---
id: 189
etapa: O6
serves: "148 (Lo que sigue, puntos 9 y 10); comercial.md §9.7 (#8 a #13)"
depends: [187]
status: todo
---

# 189 — Agendas creadas, ocurridas y futuras, y el no-show por semana

## Por qué existe

Hoy el embudo cuenta las citas por la fecha en que ocurren. Comercial pide ver por separado cuántas citas **se
agendaron** en el periodo, cuántas **ocurrieron** y su resultado (show, no-show, en número y %), por semana, y las
**futuras** aparte: una cita que viene es agenda, no resultado.

## Alcance

1. Tres conteos de citas del programa en el rango: creadas (fecha de creación de la cita), ocurridas (fecha de la
   cita, ya pasada) y futuras (desde hoy). Por semana de lunes a domingo, en Bogotá.
2. El no-show de las ocurridas en número y %, con la misma regla de grupo del ADR 0079.
3. En Operación comercial del dashboard, junto al embudo; cada cifra abre su lista.

## Done cuando

- Test con PGlite: una cita creada en septiembre para octubre cuenta como creada en septiembre y ocurrida en
  octubre; una futura no entra al no-show; anuladas y otro programa no cuentan.
- Typecheck, lint, tests, `npm run build`; recorrido en `dev:local`.
