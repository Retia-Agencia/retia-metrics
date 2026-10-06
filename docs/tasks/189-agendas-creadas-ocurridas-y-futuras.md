---
id: 189
etapa: O6
serves: "148 (Lo que sigue, puntos 9 y 10); comercial.md §9.7 (#8 a #13)"
depends: [187]
status: done
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

## Nota de cierre (5-oct, Alejo + Claude; Codex sin cuota)

- **Agendas por semana** en Operación, junto al embudo: semanas de lunes a domingo en Bogotá (`semanasDelRango` en
  `lib/rangos.ts`), recortadas al rango. Creadas por la fecha de creación de la cita (la lista `agendas_creadas` de
  siempre); ocurridas, show y no-show (número y %) del grupo de citas del ADR 0079 de ESA semana
  (`gruposPorSemana`: una lectura de citas y la cuenta pura por semana). Cada semana es su grupo, así que no suman el
  grupo del rango, y la tabla lo dice. Del programa entero, sin filtro de closer (crear agendas es del programa, 138).
- **Las futuras, aparte y desde hoy** (decidido en el recorrido): "este mes" llega hasta hoy, así que una columna de
  futuras dentro del rango casi siempre daba 0. "Próximas agendas, desde hoy" lista solo las semanas con alguna cita
  que sigue agendada y no ha llegado, sin depender del periodo. Una futura no entra al no-show; la cancelada no viene.
- Listas nuevas: `agendas_futuras` (`filtroAgendasFuturas`) y `grupo_sin_show`; cada cifra abre su lista sin B.
- Tests: `tests/agendas-por-semana.test.ts` (la cita creada en septiembre para octubre cuenta creada en septiembre y
  ocurrida en octubre; la futura no es no-show; la que pasó sin resultado sí, ADR 0079; anuladas y otro programa no
  cuentan; cada celda contra su lista; las próximas por semana, sin semanas vacías ni canceladas). Vecinos en verde.
- Recorrido en `dev:local`: la tabla con septiembre a octubre de la base sembrada, el diálogo de no-show de la semana
  del 7-sep (7, por closer y etapa) y su lista (7 filas, sin B), consola limpia, 375 px sin desborde. `npm run build`.
- **Visto, sin tocar:** la agenda de un deal anulado sigue contando como agenda creada si la llamada está vigente (es
  la regla de `agendas_creadas` y `agendas` desde el 138); el grupo de citas sí la excluye.
- **Revisión del cadenero (otra sesión):** celda y lista cuadran (semana en memoria = `grupoDeCitas` de la semana).
  Arreglado lo que vio: una futura de un deal anulado o de cortesía contaba (ahora no, con test), el `ahora` de la
  entrada se ignoraba, y las próximas se arman desde las fechas (una cita tecleada en 2099 no recorre mil semanas).
- **Falta:** el checkpoint.

## Cierre (checkpoint, 5-oct)

Checkpoint `cp-20261005-1` sobre `d974c76`: CI verde (suite completa, Postgres real y build), deploy de
producción en Vercel correcto, fuentes recibiendo y sin sobres crudos con error real (los 5 pendientes son entregas
de prueba que no se ingieren a propósito).
