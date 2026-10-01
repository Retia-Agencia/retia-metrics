---
id: 141
etapa: NC1
serves: "comercial.md §9.4 · ADR 0067"
depends: [136]
status: todo
---

# 141 — Filtros de fecha relativos en las listas de deals y de leads

## Objetivo

Filtrar las listas por fecha de creación, última actividad y cierre con el mismo selector del dashboard.

## Alcance

- **Dentro:** el selector del 136 (solo el rango A, sin comparación) en la lista de deals sobre creado, última
  actividad y cierre; en la base de leads (072) sobre creado y último envío.
- **Dentro:** los filtros en la URL, sin datos personales.
- **Dentro:** "última actividad" sale de UNA función (la misma que decide "estancado" en el Inbox), no de una
  copia.
- **Fuera:** la lista de leads en sí (072, carril de Alejo): este ticket le agrega el filtro. Coordinar con
  Alejo antes de tocar sus archivos.

## Done cuando

- [ ] "Ayer" a las 11 pm de Bogotá trae los de ayer de Bogotá, no los de UTC (test).
- [ ] La última actividad de la lista y la del Inbox salen de la misma función.
- [ ] Recorrido visual de las dos listas con cada atajo.

## Codex

Sí, esfuerzo `low`.
