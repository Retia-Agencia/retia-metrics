---
id: 065
etapa: E5
serves: "plan v2 §6 etapa 5 · tarea E5-2 · insumo §8, ADR 0037"
depends: [064]
status: todo
---

# 065 — Lo que el modelo nuevo hace posible: conversion etapa a etapa y tiempo en etapa

## Objetivo

Las cuatro metricas que **no existian** y que son la razon de haber construido el deal:

1. **Conversion etapa a etapa.**
2. **Tiempo promedio en etapa.**
3. **Deals abiertos por etapa y por owner.**
4. **Unclaimed por antiguedad.**

## De donde salen

De `deal_etapa_historial` (ticket 037/045). 🎯 Por eso esa tabla se creo en la etapa 1 aunque
ninguna pantalla la usara: **el dato es el instante del cambio y no se puede reconstruir despues**.

## Alcance

- **Dentro:** las cuatro consultas, con su rango de fechas y su filtro por programa.
- **Dentro:** los deals **anulados** no cuentan en ninguna (ADR 0038).
- **Dentro:** un deal que retrocede y vuelve a avanzar cuenta su tiempo **en cada paso**, no solo
  el ultimo. Decidir y escribir como se suma (¿tiempo total en la etapa o solo el ultimo tramo?)
  **antes** de pintar el numero: las dos respuestas son defendibles y elegir en silencio es como
  nace una cifra que nadie sabe leer.
- **Fuera:** el Kanban. Esto son consultas; la pantalla es el ticket 069.

## La pregunta abierta que esto destapa

🟡 **Si "Setteo No Calificado" es etapa o salida** cambia la conversion de **0,9% a 2,6%**. Lo
contestan los closers. Mientras tanto la consulta **reporta las dos** y dice cual es cual, en vez
de elegir una y que nadie sepa cual esta mirando.

## Done cuando

- [ ] Las cuatro metricas salen sobre los datos de `dev`.
- [ ] Un deal con retroceso produce un tiempo en etapa explicable, con la regla escrita.
- [ ] Los anulados no aparecen.
- [ ] La conversion se puede leer con y sin Setteo No Calificado.

## Kiro

Si.
