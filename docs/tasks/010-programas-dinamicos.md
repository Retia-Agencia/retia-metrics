---
id: 010
fase: F0
serves: "ADR 0012; spec §5 criterio 4"
depends: [008, 009]
status: todo
---

# 010 — Programas dinámicos: /programas/[slug] y navegación desde la base

## Objetivo
Los programas que ve la app salen de la tabla `programs`. Agregar una fila hace aparecer el
programa en la navegación y en su propia ruta.

## Alcance
- Dentro: `app/(app)/programas/[slug]/page.tsx` con `paginaConRol("gerente", "closer")`; 404 si
  el slug no existe o está inactivo. Borrar `app/(app)/comunicarte` y
  `app/(app)/tactical-investor`.
- Dentro: redirecciones permanentes `/comunicarte` y `/tactical-investor` → `/programas/<slug>`
  en `next.config.ts` (enlaces viejos). Van en config, no en código de app, para que el test 009
  siga limpio; si no es posible, documentar la excepción.
- Dentro: `lib/queries/programas.ts` con `programasActivos()`. `lib/nav.ts` deja de tener
  `PROGRAMAS`; la navegación recibe los programas como dato. `ProgramSwitcher` igual.
- Dentro: `rutaInicial("gerente")` va al primer programa activo (o a `/ajustes` si no hay).
- Dentro: `ajustes/fuentes/page.tsx` muestra `programs.nombre` en vez del ternario.
- Dentro: `app/layout.tsx` con una descripción que no nombre programas.
- Dentro: actualizar `tests/paginas.test.ts` y `tests/roles.test.ts`.

## Done cuando
- [ ] El test del ticket 009 pasa en verde sin `it.fails`.
- [ ] Un programa insertado a mano en la base aparece en el sidebar y su ruta responde.
- [ ] Un closer y un gerente entran a `/programas/<slug>`; sin sesión, redirige a login.
