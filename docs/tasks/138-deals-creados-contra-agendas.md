---
id: 138
etapa: NC1
serves: "comercial.md GC-33 · §9.7 gráficas 7 y 8"
depends: [136]
status: todo
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

- [ ] El día hábil 7 la gráfica compara contra los 7 primeros días hábiles del mes anterior, no contra el mes.
- [ ] La razón se calcula por programa y nunca se suma.
- [ ] Las cifras cuadran con sus listas (137).

## Codex

Sí, esfuerzo `medium`.
