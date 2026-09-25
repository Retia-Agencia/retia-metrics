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

---

## 🟡 Nota 2026-09-24

- La conversión se calcula sobre la tabla de transiciones que quede (ticket 043). Si se adopta la
  propuesta, un deal no retrocede por una segunda llamada, así que la conversión Agendado → Atendido
  no se infla.
- Regla propuesta: el **show** sale de las llamadas y el **cierre** de los deals (Abonado o Completo),
  nunca de llamadas `cerrada`.
- "Unclaimed por antigüedad" pasa a ser una sección del Inbox (ticket 071).

---

## ✅ Decisión 2026-09-24 (Mani, se valida con los closers): Seguimiento y "un deal, muchas llamadas"

- **Seguimiento es una etapa propia (la 11)**, después de Atendido: la llamada ocurrió y hay que volver a
  contactarlo. Separa lo que salió bien (Compromiso, pago) de lo que hay que re-contactar. Reemplaza la
  propuesta anterior de "quedarse en Atendido con fecha". El `pgEnum` gana un valor (migración de la
  sesión principal). El número no es el orden: va después de Atendido.
- **Un deal tiene muchas llamadas y nunca se duplica.** Si una llamada falla (no-show, cancelada, u
  otra llamada necesaria), el deal pasa a Re-agenda **con motivo** (5 → 3 incluido). Una llamada nueva
  de un lead con deal abierto **se agrega y se avisa al dueño**; en 1, 2, 3, 9 u 11 el deal pasa a
  Agendado, en 5, 6 o 7 la etapa no cambia.
- **La conversión cuenta deals distintos** que llegaron a una etapa, no entradas: el ir y volver no infla.
- Transiciones nuevas: T24 (5 → 11), T25 (11 → 6), T26 (11 → 7 u 8), T27 (11 → 4), T28 (11 → 9), T29
  (5 → 3 con motivo); T11 queda reemplazada y T15 pasa a 6 → 11. Perdido llega también desde 11. Tabla
  completa en `docs/auditorias/propuesta-crm-y-reunion-comercial-2026-09-24.md` §2.5 y §2.6.
- **Reemplaza** lo dicho antes en este documento sobre "la segunda llamada no hace retroceder".
