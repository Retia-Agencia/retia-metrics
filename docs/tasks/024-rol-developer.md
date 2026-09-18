---
id: 024
fase: F4
serves: "spec §1 pilar 4; docs/design.md §2"
depends: [010]
status: done
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
- [x] Un developer entra a `/mi-dia`, `/ajustes/*`, `/programas/*` y `/nerd-stats`.
      (`/nerd-stats` no existe todavía: llega con el 025 y nacerá cubierta, porque la
      excepción vive en `puedeAcceder` y no en cada guarda.)
- [x] Ningún test existente de disjunción gerente/closer cambia de resultado.
      462 tests pasando (eran 444); ninguno cambió de resultado, solo se sumaron.

## Cierre (17-sep)

**Decisión sobre el stash de Kiro: se rescató el código, se descartó la migración.** El stash
estaba basado 26 commits atrás y su migración pedía el slot `0008`, ya ocupado por
`0008_registro_y_abonos`; el ADR que proponía como `0022` también estaba ocupado (ventana de venta).
`git stash pop` no era ni posible (colisión de `_journal.json` y `0008_snapshot.json`). Se extrajo
archivo por archivo, se regeneró la migración como **0012** y el ADR como **0025**. El stash ya no
existe.

**Tres huecos que el avance de Kiro no cubría y que se cerraron aquí:**
1. **`/mi-dia` quedaba inservible para el developer.** Pasaba la guarda, pero la página seguía
   pidiendo los programas con la proyección de `closer` hardcodeada; un developer no es miembro de
   ninguno, así que veía la pantalla vacía. Ahora usa la proyección de gerente, como `/productos`.
2. **`protegerAdministrador` (015) le impedía a un gerente ponerse developer a sí mismo.** Se
   reescribió contra `esAdministrador`: gerente ↔ developer se permite, bajar a `closer` o
   desactivarse no.
3. **Había una TERCERA definición del union de roles** escrita a mano en `types/next-auth.d.ts`,
   que el typecheck destapó: la sesión y el token seguían creyendo que solo había dos roles. Ahora
   importa `Rol` de `lib/auth/roles`.

También dejaron de tener literales de rol la pantalla `/ajustes/usuarios` (las opciones salen de
`ROLES`), el menú de usuario (`Record<Rol, string>` exhaustivo: un rol nuevo sin etiqueta rompe el
typecheck) y el CLI de emergencia (cuenta administradores, no gerentes).

**Estado de la base:** migración 0012 aplicada en `dev` (`br-withered-sun-b439zjof`, verificado por
`neon.branch_id`), 13 migraciones. `manuelmejiaarana@gmail.com` es **developer en `dev`**.
**`production` sigue con 12 migraciones y Mani sigue de `gerente` allá:** ambas cosas necesitan el ok
explícito de Mani.

## Notas (16-sep): se retoma en su turno (F4)
Mani pidió que `manuelmejiaarana@gmail.com` sea developer (hoy es `gerente` en `dev` y `production`).
Kiro arrancó el ticket y se detuvo a mitad por cierre de sesión; su avance sin revisar está en
`git stash list` → "wip 024 rol developer" (migración `0008_rol_developer`, roles, guards, nav y
tests). Recuperarlo con `git stash pop` y revisarlo entero antes de seguir; no está verificado.
Pendientes que el prompt ya pedía: ADR 0022 (developer es la única excepción al ADR 0003),
`/ajustes/usuarios` y el CLI aceptan el rol, y la protección del 015 deja pasar de `gerente` a
`developer` (y al revés) pero no bajar a `closer` ni desactivarse. `/nerd-stats` llega con 025.
Después: aplicar 0008 en `dev`, cambiar el rol de Mani en `dev`, y en `production` solo con ok.
