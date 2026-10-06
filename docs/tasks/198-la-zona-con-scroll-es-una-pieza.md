---
id: 198
etapa: O6
serves: "A-86; tickets 185 y 193 a 197"
depends: [197]
status: done
---

# 198 — La zona con scroll es una pieza de `pantalla-fija.tsx`

## Por qué existe

La zona que hace scroll dentro de una pantalla fija está copiada a mano en 13 lugares (`md:relative md:min-h-0 md:flex-1
md:overflow-y-auto`). En el 197 una copia sin `relative` dejó que los `sr-only` de las gráficas estiraran la página de
Operación a 1.847 px, sin un error; la central lo arregló en `81f9a8d` copiando `md:relative` en las 13. La próxima
pantalla que copie la versión vieja repite el bug.

## Alcance

- `components/layout/pantalla-fija.tsx` exporta la zona (p. ej. `ZonaConScroll`, con `className` para lo extra).
- Las 13 copias pasan a usarla (`grep -rn "md:min-h-0 md:flex-1 md:overflow-y-auto" app components`). Sin cambio visual.
- `docs/structure.md` §9 la nombra junto a `PantallaFija` y `Pestanas`.

## Done cuando

- El `grep` de arriba solo encuentra la pieza.
- Typecheck, lint, `npm run build` (varias copias viven en componentes cliente).
- Recorrido en `dev:local`: Leads, Calls, Inbox, Students, Programa, Recursos, Dashboard y las seis de Ajustes siguen
  midiendo el alto de la ventana a 1440×900.

## Nota de cierre (5-oct, Alejo + Claude)

- `components/layout/pantalla-fija.tsx` exporta `ZonaConScroll` (un `div`) y `clasesDeZonaConScroll` (para una lista o
  un `CardContent`), con el porqué del `relative` escrito al lado. Eran **14** copias, no 13: las 14 pasan por
  `clasesDeZonaConScroll` conservando su elemento y sus clases extra, así que no hay cambio visual. El `grep` del
  ticket solo encuentra la pieza. `docs/structure.md` §9 la nombra.
- Typecheck, lint y `npm run build`. Recorrido en `dev:local` con Chrome headless a 1440×900: Leads, Calls, Inbox,
  Students, Programa, Recursos, el Dashboard del programa y el de todos, y las seis de Ajustes miden 900 px, sin errores.
- **Falta:** el checkpoint.

## Cierre (checkpoint, 5-oct)

Checkpoint `cp-20261005-1` sobre `d974c76`: CI verde (suite completa, Postgres real y build), deploy de
producción en Vercel correcto, fuentes recibiendo y sin sobres crudos con error real (los 5 pendientes son entregas
de prueba que no se ingieren a propósito).
