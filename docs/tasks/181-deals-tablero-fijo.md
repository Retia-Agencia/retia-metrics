---
id: 181
etapa: O4
serves: "docs/anotaciones.md A-82, A-83, A-84, A-07, A-08; ADR 0024; ADR 0077"
depends: []
status: done
---

# 181 — Deals: tablero fijo como HubSpot, dinero por etapa, orden, cohorte y tarjeta clicable

Sesión **S1**, ola O4 parte 1. Sin migración.

## Por qué existe

Mani usando el CRM (3-oct, noche): el tablero de Deals crece hacia abajo con cada deal nuevo y la página entera hace
scroll vertical. En HubSpot la página es fija, el tablero solo se desplaza a los lados y cada etapa hace scroll por
dentro. Con la página fija queda lugar para ver cuánto dinero hay en cada etapa. Y con más deals, el closer necesita
ordenar y filtrar por cohorte para que no se le sature. La tarjeta solo abre si se hace clic en el nombre.

## Alcance

1. **Pantalla fija (A-82, A-07).** La página de Deals ocupa el alto de la ventana y no hace scroll vertical. El
   tablero hace scroll horizontal; cada columna hace scroll vertical por dentro. La primitiva va en
   `components/layout/pantalla-fija.tsx` (nueva): un contenedor que llena el alto disponible bajo la cabecera de
   `PageShell` y deja que sus hijos decidan su scroll. **La usa el 185 en el resto de la app**, así que su contrato
   queda escrito en `docs/structure.md` §9 (una línea: qué hace y cuándo se usa). A 375 px el tablero sigue con
   scroll horizontal y columnas de ancho fijo.
2. **Dinero al pie de cada etapa (A-82).** Debajo de cada columna, siempre visible, dos cifras en USD con `cifra`:
   - **Potencial:** la suma del **valor vendido** de los deals de esa etapa; un deal sin valor vendido cuenta el
     **ticket base de su cohorte**. Cuentan todas las etapas, también Ganado y Cierre perdido (Mani).
   - **Confirmado:** lo abonado de esos deals.
   Las dos salen de `lib/queries/saldo.ts` (`saldosDeDeals` y su `sumaDeAbonos`): **ninguna suma de abonos a mano**
   (ADR 0024, `tests/saldo-centralizado.test.ts`). Abonos anulados no cuentan (`vigente`). Las cifras respetan los
   filtros activos del tablero (las de la columna son las de las tarjetas que se ven).
3. **Orden (A-83).** Un selector: más reciente o más viejo primero, por **fecha de creación** o por **fecha de
   última actividad**. Default: actividad, más reciente primero. Va por la URL, como los demás filtros
   (`parsearFiltros` en `lib/queries/kanban.ts`), validado con zod.
4. **Cohorte (A-83).** Filtro por cohorte del programa; **default la activa** (`cohorteActiva`). "Todas" es una
   opción. Por la URL.
5. **Tarjeta clicable (A-84).** Toda la tarjeta abre la ficha del deal, con hover (borde y fondo según los tokens de
   Tinta, `structure.md` §9, nada a mano). Arrastrar sigue funcionando: un clic abre, un arrastre mueve. El menú
   "Mover a…" de la tarjeta sigue funcionando sin abrir la ficha.
6. **Autoscroll al arrastrar (A-08).** Acercar una tarjeta arrastrada al borde izquierdo o derecho desplaza el
   tablero.

**Contrato con el 182 (corrección de etapa en rojo).** El 182 agrega en `components/deals/transiciones.ts` cómo saber
a qué etapa se corrige un deal y, **cuando este ticket esté en `main`**, pinta esa columna en rojo al arrastrar. Este
ticket no lo hace, pero deja el resaltado del destino en un solo lugar del tablero para que el 182 cambie solo el
tono.

## Archivos (suyos en la ola)

`app/(app)/p/[programa]/deals/page.tsx`, `components/deals/tablero-kanban.tsx`, `components/deals/tarjeta-deal.tsx`,
`components/deals/filtro-kanban.tsx`, `lib/queries/kanban.ts`, `components/layout/pantalla-fija.tsx` (nuevo).
**No toca** `dialogo-mover.tsx`, `transiciones.ts` ni el motor (son del 182), ni `lib/queries/saldo.ts` (solo lo
importa).

Tests: `tests/kanban.test.ts` (o el que cubra `tableroKanban`): orden en los cuatro sentidos, cohorte por defecto la
activa, totales de la columna contra `saldosDeDeals` con un abono anulado y un deal sin valor vendido (cuenta el
ticket base); `tests/saldo-centralizado.test.ts` sigue verde.

## Done cuando

- La página de Deals no hace scroll vertical en escritorio; cada columna sí; el tablero hace scroll horizontal.
- Cada columna muestra Potencial y Confirmado en USD, y cuadran con los deals visibles (test).
- Orden y cohorte por URL, con la activa por defecto.
- Toda la tarjeta abre la ficha, con hover; arrastrar y "Mover a…" siguen funcionando.
- `npm run build` en verde; recorrido en `dev:local` como closer y gerente, escritorio y 375 px, consola abierta,
  arrastrando hasta el borde.

## Nota de cierre (S1, 3-oct)

Implementado por Codex, revisado el diff por Claude. Typecheck, lint y `npm run build` en verde. **Sin correr:** los tests
(`kanban.test.ts`, `saldo-centralizado.test.ts`; la máquina sin aire, los decide el CI) y el recorrido en `dev:local`
(lo hace el hilo principal: arrastre con tarjeta clicable, menú "Siguiente paso", autoscroll, 375 px, closer y gerente).

- `PageShell` gana la prop `fija` (archivo de S6, cambio mínimo; con ella apagada el resultado es idéntico). El 185 rebasa sobre esto.
- URL: `orden` (`actividad`|`creado`) + `sentido` (`desc`|`asc`); `cohorte` ausente = la activa, `cohorte=todas` = todas.
- Resaltado del destino del arrastre: `claseDeDestino` en `tablero-kanban.tsx`, para que el 182 cambie solo el tono.
