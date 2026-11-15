---
id: 434
etapa: configuracion
serves: "Mani, 14-nov: el alta pide un dato técnico · ADR 0132 punto 5 · docs/onboarding-de-programa.md F6"
depends: [431]
status: en main
---

# 434 — El alta de un programa sin pedir el slug

## Qué
El diálogo "Nuevo programa" pide Nombre y Ticket. La dirección (`/p/<slug>`) se deriva con `slugDesdeNombre`
(`lib/programas/slug.ts`, puro, usa `sinTildes`), se muestra y se puede corregir antes de crear. El esquema y el índice
único siguen siendo la reja.

## Done cuando
- [x] Test de `slugDesdeNombre` (tildes, ñ, espacios, símbolos, guiones repetidos, tope de 60).
- [ ] Typecheck, lint, tests del cambio y build en verde; crear un programa en `dev:local`.
- [ ] Tracker y `status:` iguales (N9).

**14-nov (orquestador):** CI verde en `6b225924` (incluye build). Marcado solo lo que se ve en el código y los tests. Falta con evidencia escrita: crear un programa en `dev:local`.
