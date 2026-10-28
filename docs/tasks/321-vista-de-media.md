---
id: 321
etapa: media
serves: "ADR 0107 · propuesta.md §6 paso 2 (media entra al CRM)"
depends: [315]
status: todo
---

# 321 — La vista de media

## Alcance

- Una sección `/media` con guarda `trabajaContenido` (`paginaConRol` sobre la pregunta, nunca el rol a mano), en la
  navegación solo para quien la cumple. Pestañas vacías con su porqué hasta que llegue cada ticket: Hoy (326),
  Creadores y piezas (316), Banco (324, 325), Insights (330).
- Selector de programa con el alcance de la sesión, más "sin programa" para quien no tiene alcance limitado.
- Sistema de diseño Tinta (`docs/structure.md` §9); pensada primero para el celular.

## Done cuando

- `tests/paginas.test.ts`: entra media, gerente y developer; closer y paid trafficker no.
- Humo verde en escritorio y celular con el usuario `media`.
