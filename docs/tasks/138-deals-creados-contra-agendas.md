---
id: 138
etapa: NC1
serves: "comercial.md GC-33 · §9.7 gráficas 7 y 8"
depends: [136]
status: done
---

# 138 — Deals creados contra agendas, acumulado del mes contra el anterior

## Objetivo

La gráfica que pidió Dani: *"si la generación de deals sube y los agendados no, no estoy trayendo leads
calificados"*.

## Alcance

- **Dentro:** una serie acumulada por día hábil con dos líneas, deals creados y agendas creadas (llamadas por
  la fecha en que se agendaron), y una tercera, la razón agendas / deals, en %. Periodo A contra B del 136
  (por defecto: este mes contra el mes pasado al mismo día hábil). Por programa; en "todos", los conteos se
  suman y la razón va por programa (ADR 0048).
- **Dentro:** número y % en cada punto (136) y clic a la lista (137).
- **Dentro:** la fecha de creación del deal es la de su envío de origen cuando la tiene (GC-07); verificarlo y
  dejarlo dicho en la consulta. Los históricos sin envío usan su fecha de alta.
- **Fuera:** el desglose por canal (es de Pauta, después de v1).

## Done cuando

- [x] El día hábil 7 la gráfica compara contra los 7 primeros días hábiles del mes anterior, no contra el mes.
- [x] La razón se calcula por programa y nunca se suma.
- [x] Las cifras cuadran con sus listas (137).

## Codex

Sí, esfuerzo `medium`.

## Hecho (1-oct, Alejo)

- **Fechas:** el deal nace el día de su envío de origen (`coalesce(submissions.fecha_envio, deals.created_at)`,
  GC-07 verificado; los históricos sin envío usan su alta). La agenda, el día en que se agendó
  (`calls.created_at`), no el de la cita. Las dos viven en `lib/queries/metricas-filtros.ts`
  (`fechaAnclaDealCreado`, `fechaAnclaAgendaCreada`) y la vista interina de Pauta usa la misma.
- **Serie:** `lib/queries/deals-contra-agendas.ts`, acumulado al cierre de cada hábil (lo de un fin de semana
  entra en el hábil siguiente; la cola, en el último, así el último punto es el total del rango). Un programa
  por llamada: la razón es de cada programa y en "todos" (095) se llama una vez por programa.
- **Lista (137):** métricas nuevas `deals_creados` y `agendas_creadas`. Como los leads, no se atribuyen a un
  closer: con filtro de closer la gráfica dice por qué no se muestra.
- **Periodo:** sigue al selector; si A tiene uno o ningún hábil cae a este mes contra el anterior y, si el mes
  apenas empieza, al mes pasado contra el anterior, con nota.
- Recorrido en `dev:local`: lista = cifra (107), consola limpia, sin desborde a 390 px. Dos arreglos de
  `SeriesLineales` que salieron ahí: la tabla `sr-only` desbordaba la página (una `<table>` no respeta el
  `width:1px`) y el `<title>` con varios nodos rompía la hidratación de React 19.
- Tests: `tests/deals-contra-agendas.test.ts`, `tests/variacion.test.ts` (cambio de una tasa en pp).
