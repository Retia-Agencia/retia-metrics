---
id: 429
etapa: hub
serves: "Mani, 13-nov (carril D): lo que el 419 E-1 dejó con el texto de §2.2 y sin fuente en el diccionario · N8 (ADR 0115)"
depends: [419]
status: todo
---

# 429 — Tres textos del registro que no tienen fuente

## Por qué

El 419 E-1 pasó el texto de cada explicación a la ficha del registro. Tres quedaron con el texto aprobado en
`docs/diseno-cifra-y-pauta.md` §2.2 pero **sin una fila del diccionario que los respalde** (ticket 419, "Avance"). Un texto sin fuente
es el caso que el ADR 0115 N8 prohíbe: la ficha dice una cosa y nadie puede decir de dónde sale.

## Los tres puntos

1. **Envíos: ¿solo completos o también parciales?** El diccionario (`docs/metricas.md`) se contradice. Es la duda de Daniel Tovar en el
   weekly del 3-nov (`docs/weekly-2026-11-03.md`, "→ 397"; `docs/tasks/372-comercial-con-su-periodo-y-parciales-aparte.md`). Hay que medir
   cuál cuenta hoy el código (`lib/queries/hechos/`), decidir la definición y reescribir una sola fila; la cifra y el texto salen de ella.
2. **Compensación exacta de `objetivo_semana`.** El texto cita "la regla del 146" y la fila del diccionario no la escribe. Hay que leer
   la función que la calcula (`lib/metricas/pendientes.ts`, concepto `objetivo_semana`), escribir la regla con un ejemplo numérico en
   el diccionario y copiarla a la ficha.
3. **`agendas_meta` (agenda del pixel de Meta).** Quedó como variante de `costo_agenda_meta` según el mapa del 419, pero es otro número.
   Si se pinta solo en alguna pantalla, merece clave propia en el registro y su fila.

## Decisiones abiertas (no se asumen)

- **D-1.** Envíos: ¿completos solamente, o completos y parciales con los parciales aparte (como Comercial en el 372)? Decide Mani con
  la medición de (1) delante.
- **D-2.** `agendas_meta`: ¿clave propia ahora, o solo cuando una pantalla la pinte sola?

## Done cuando

- [ ] D-1 y D-2 respondidas por Mani, con su respuesta escrita aquí.
- [ ] Las tres filas del diccionario reescritas con su fuente, y la ficha igual que la fila en el mismo commit (N8: título del ADR, índice,
      vocabulario de `overview.md` §11).
- [ ] Un test o la prueba existente (`tests/explicacion-sin-jerga.test.ts`, `tests/registro-de-metricas.test.ts`) cubre el cambio; si la
      definición de Envíos cambia una cifra, se detiene y se anota (la regla del 419: ninguna cifra se mueve sin avisar).
- [ ] Tracker y `status:` coinciden (N9).
