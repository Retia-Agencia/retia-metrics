---
id: 442
etapa: rendimiento
serves: "docs/estudio-rendimiento-y-conexion.md §7, §8.7 y §13.5 · decisión 4 de la §10"
depends: [436]
status: in-progress
---

# 442 — Qué enlaces precargan se decide, no se hereda

## Qué
Un solo componente de enlace para el CRM con la política de precarga escrita, y los enlaces de filas, tarjetas y
filtros sin precarga automática.

## Por qué (medido el 14-nov, estudio §13.5)
- La primera carga de Leads dispara **43 precargas**: menú lateral, pestañas del programa, enlaces de filtros y cada
  fila visible de la tabla, dos veces por fila. Deals tiene 130 enlaces internos (114 tarjetas).
- Ninguno de los 100 `<Link>` del código declara `prefetch`. Cada precarga es una invocación en Vercel con la sesión y
  el layout (2 a 4 consultas). Por persona y por pantalla, decenas de invocaciones que casi nunca se usan.
- Lee antes: `node_modules/next/dist/docs/01-app/03-api-reference/02-components/link.md` (§ `prefetch`),
  `01-app/02-guides/prefetching.md` y `optimizing-prefetching.md`. Esta versión de Next cambió el prefetch.

## Política (decisión 4 del estudio; Mani la confirma al aprobar el ticket)
| Enlace | Precarga |
|---|---|
| Menú lateral y pestañas del programa (navegación principal, pocos y fijos) | Sí, la de por defecto |
| Filas de tabla, tarjetas del Kanban, resultados de búsqueda | **No al entrar en pantalla; sí al pasar el cursor** |
| Enlaces de filtros, orden, paginación y "ver por" (misma página, otro `searchParams`) | No |
| Enlaces a listas detrás de una cifra (`hub/lista`) | No |

## Archivos
`components/enlace.tsx` (nuevo) · `components/layout/pestanas.tsx` · el menú lateral · todo `<Link` de `app/` y
`components/` (100 usos) · `tests/enlace-guardian.test.ts` (nuevo).

## Cómo

```tsx
"use client";
import Link from "next/link";
import { useState, type ComponentProps } from "react";

type Precarga = "navegacion" | "al-pasar" | "nunca";

/**
 * El único enlace interno del CRM. `precarga` es obligatoria: quien enlaza decide.
 * - "navegacion": menú y pestañas. Precarga al entrar en pantalla (lo de por defecto de Next).
 * - "al-pasar":   filas y tarjetas. No precarga hasta que el cursor o el foco llegan al enlace.
 * - "nunca":      filtros, orden y paginación.
 */
export function Enlace({ precarga, ...props }: ComponentProps<typeof Link> & { precarga: Precarga }) {
  const [activo, setActivo] = useState(false);
  const prefetch = precarga === "navegacion" ? null : precarga === "al-pasar" && activo ? null : false;
  return (
    <Link {...props} prefetch={prefetch}
      onMouseEnter={(e) => { setActivo(true); props.onMouseEnter?.(e); }}
      onFocus={(e) => { setActivo(true); props.onFocus?.(e); }} />
  );
}
```

El patrón "al pasar el cursor" es el de la guía `optimizing-prefetching.md`; confirma ahí que cambiar `prefetch` de
`false` a `null` tras el hover dispara la precarga en esta versión, y ajusta si la guía da otro mecanismo.

⚠️ `Enlace` es un componente cliente. Un servidor solo importa **componentes** de un archivo cliente (AGENTS.md, 9-nov):
no exportes constantes desde `components/enlace.tsx`. Y como toca componentes cliente, corre `npm run build`.

Migración: reemplaza cada `<Link` por `<Enlace precarga="…">` según la tabla. Los enlaces externos y los `<a>` no cambian.

## Guardián
`tests/enlace-guardian.test.ts`: ningún `from "next/link"` fuera de `components/enlace.tsx`, en `app/` y
`components/`. Mordido en los dos sentidos.

## Done cuando
- [x] En el build de producción contra la base local, la primera carga de Leads dispara ≤ 15 precargas (hoy 43) y la
      de Deals ≤ 15; pasar el cursor por una fila dispara la suya. Medido el 15-nov (Chromium headless contra un proxy
      contador, rol developer): Leads **14 enlaces** precargados (13 de menú y pestañas + 1 pestaña interna), Deals 13,
      **ninguna fila ni tarjeta**. Cada enlace emite 2 peticiones `_rsc` (`/_tree` y el límite del `loading.tsx`), así que
      las peticiones son 27 y 26 contra las 43 de antes. Al pasar el cursor por una fila salen 3 (su árbol y su dato).
- [x] La navegación por menú y pestañas sigue mostrando el `loading.tsx` al instante (contrato vigente): no se tocó
      ningún `loading.tsx` ni la política de menú y pestañas.
- [ ] Con el 436 en producción: invocaciones por carga de página antes y después, pegadas aquí.
- [x] Guardián verde y mordido; `npm run build` verde; humo de la UI (escritorio, 5 roles) verde el 15-nov; typecheck y lint limpios.
- [ ] Tracker y `status:` iguales al cerrar (sigue en curso hasta la medición con el 436 en producción).
