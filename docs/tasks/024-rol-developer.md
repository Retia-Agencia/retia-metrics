---
id: 024
fase: F4
serves: "spec §1 pilar 4; docs/design.md §2"
depends: [010]
status: todo
---

# 024 — Rol developer

## Objetivo
Existe el rol `developer`, que entra a todas las rutas.

## Alcance
- Dentro: ADR nuevo que amplía el ADR 0003: `developer` es la única excepción a la disjunción,
  con acceso total. `gerente` y `closer` siguen disjuntos entre sí.
- Dentro: `rolEnum` suma `developer` (migración), `ROLES`, `puedeAcceder`, `navParaRol`,
  `rutaInicial`.
- Dentro: tests de roles, guards y páginas que cubren al developer en cada ruta.
- Dentro: `/ajustes/usuarios` (015) permite asignar el rol.
- Fuera: "ver como" gerente o closer (futuro).

## Done cuando
- [ ] Un developer entra a `/mi-dia`, `/ajustes/*`, `/programas/*` y `/nerd-stats`.
- [ ] Ningún test existente de disjunción gerente/closer cambia de resultado.
