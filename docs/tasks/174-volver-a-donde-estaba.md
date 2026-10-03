---
id: 174
etapa: O3
serves: "docs/anotaciones.md A-57; ADR 0077"
depends: [168, 170, 171, 172, 173]
status: review
---

# 174 — Volver a donde estaba

Sesión **S7**, ola O3 parte 3 (al final: toca todas las pantallas). Sin migración.

## Por qué existe

Mani (3-oct): no hay forma de regresar a la pantalla de la que se venía (A-57). El botón Atrás del navegador sirve a
medias: un pop-up o un filtro cambian la URL, y entrar a una ficha desde un enlace compartido no tiene "atrás".

## Alcance

1. **Un componente `Volver`** en la cabecera de `PageShell` para las pantallas de detalle (ficha del deal, del lead,
   detalle de llamada como página si existe, cohortes): muestra "← {nombre de la lista}" (por ejemplo "← Deals",
   "← Calls · filtrados", "← Mi espacio").
2. **El origen viaja en la URL:** todo enlace desde una lista a un detalle agrega `?desde=<ruta relativa con su
   query>`. El componente lo valida (solo rutas internas que empiezan por `/`, nunca `//` ni un esquema: sin open
   redirect) y lo usa; sin `desde`, vuelve a la lista natural del objeto (Deals para un deal, Leads para un lead).
3. Un helper para armar los enlaces (`enlaceConVuelta(href, origen)`), uno solo; ninguna pantalla concatena `desde`
   a mano.

## Archivos

`components/page-shell.tsx`, el componente y el helper nuevos, y los enlaces de las listas (Deals, tarjeta del Kanban,
Leads, Calls, Students, Inbox, Mi espacio, Dashboard → lista). Tests del helper (rutas válidas y las que se rechazan).

## Done cuando

- Desde cualquier lista filtrada, abrir un detalle y pulsar "Volver" deja la lista con sus mismos filtros y página.
- Un `desde` externo o malformado se ignora (test).
- `npm run build` en verde; recorrido en `dev:local`, escritorio y 375 px.

## Estado (3-oct, S7)

Implementado por Kiro, revisado por la sesión. Rama `o3-174-volver`, worktree `wt-174`. Sin migración.

- `lib/navegacion/volver.ts` (`origenValido`, `enlaceConVuelta`, `etiquetaDeOrigen`, `destinoDeVolver`, `origenDeLaPagina`), `components/volver.tsx`, prop `volver` en `PageShell`. Las dos fichas (deal y lead) lo usan y entre ellas se pasan su propio origen.
- El origen llega por props desde la página de servidor a las listas (Deals, Kanban, Leads, Calls, Students, Inbox, Mi espacio, Dashboard → lista), sin `useSearchParams` ni Suspense. Se borró el hook `useOrigen` que nadie usaba.
- Guardián en `tests/volver.test.ts`: nadie escribe `desde=` fuera del helper.
- No pasan por el helper, a propósito: `AvisoOtrosProgramas` (cruza de programa), `ajustes/migracion`, `nerd-stats/bitacora`, `entregas-webhook`, `posibles-duplicados`.

Verificado: typecheck, lint, `tests/volver.test.ts` (26) y `npm run build` en verde.
**Recorrido (sin navegador: la extensión de Chrome no conectó):** login local y pedidos HTTP sobre `dev:local`. Los enlaces de Leads, Students, Inbox y Deals llevan `desde` con la ruta y su query; la ficha muestra "← Deals · filtrados" y vuelve a `/deals?q=1`; un `desde` con `//evil.com` o `https://` cae a la lista natural; deal → lead encadena el origen. Sin ver: Calls (sin filas para ese closer en la base local), clics reales, 375 px y la consola. Sin correr: `tests/paginas.test.ts` y `tests/alcance-deals.test.ts` (la suite los corre el checkpoint).
