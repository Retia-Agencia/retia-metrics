---
id: 024
fase: F4
serves: "spec §1 pilar 4; docs/design.md §2"
depends: [010]
status: en curso
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

## Notas (16-sep, sesión pausada)
Mani pidió que `manuelmejiaarana@gmail.com` sea developer (hoy es `gerente` en `dev` y `production`).
Kiro arrancó el ticket y se detuvo a mitad por cierre de sesión; su avance sin revisar está en
`git stash list` → "wip 024 rol developer" (migración `0008_rol_developer`, roles, guards, nav y
tests). Recuperarlo con `git stash pop` y revisarlo entero antes de seguir; no está verificado.
Pendientes que el prompt ya pedía: ADR 0022 (developer es la única excepción al ADR 0003),
`/ajustes/usuarios` y el CLI aceptan el rol, y la protección del 015 deja pasar de `gerente` a
`developer` (y al revés) pero no bajar a `closer` ni desactivarse. `/nerd-stats` llega con 025.
Después: aplicar 0008 en `dev`, cambiar el rol de Mani en `dev`, y en `production` solo con ok.
