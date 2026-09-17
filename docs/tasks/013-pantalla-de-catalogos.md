---
id: 013
fase: F0
serves: "ADR 0012 — pieza 3 del molde"
depends: [011]
status: done
---

# 013 — Pantalla de administración de catálogos

## Objetivo
Un gerente agrega, renombra y desactiva plataformas, motivos y orígenes desde
`/ajustes/catalogos`, sin código.

## Alcance
- Dentro: una sola pantalla con una pestaña por catálogo, construida sobre un componente
  genérico que recibe la definición del catálogo (nombre visible, esquema, acciones).
- Dentro: server actions con `requireRole("gerente")` que llaman al molde.
- Dentro: lista con activos e inactivos (los inactivos atenuados y reactivables).
- Dentro: enlace desde `/ajustes`.
- Fuera: productos (017, tiene su propia pantalla porque también la usan closers).

## Done cuando
- [x] Agregar un catálogo nuevo a esta pantalla es una línea de configuración.
- [x] Un closer que entra a `/ajustes/catalogos` es redirigido (test de páginas).
- [x] Cada cambio aparece en `change_log`.

## Notas
El molde ganó `reactivar` (simétrico a `desactivar`). Un id que no es uuid sale como 400
(deuda del 011 saldada en `lib/catalogo/operaciones.ts`). Las pestañas y el campo de texto son
nativos con los tokens del tema, sin instalar `tabs`/`input` de shadcn.
