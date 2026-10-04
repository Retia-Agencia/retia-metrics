---
id: 198
etapa: O6
serves: "A-86; tickets 185 y 193 a 197"
depends: [197]
status: todo
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
