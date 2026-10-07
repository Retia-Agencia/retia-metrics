---
id: 202
etapa: O7
serves: "docs/anotaciones.md A-105; A-61 (ticket 170); docs/structure.md §9"
depends: [170, 193, 198]
status: open
---

# 202 — La barra de lista: búsqueda, filtros y orden en una fila

Sesión Kiro `barra-de-lista`, revisada e integrada por la sesión central. Sin migración.

## Por qué existe

En Leads, Deals, Calls, Students, Dashboard y Recursos los filtros se apilan en filas y cada `FiltroSelect` lleva su
etiqueta **encima** de la caja (~56 px por control). Leads gasta unas cinco franjas (~260 px) antes del primer
registro: buscador a lo ancho, fila de fecha, fila de 4 selects, pestañas con descripción y el encabezado
"Leads · N" con Tarjetas/Tabla. Deals parte 7 selects en dos filas. Además Deals (`FiltroKanban`), el Dashboard
(`FiltroDashboard`) y la fecha de las listas (`FiltroFechaLista`) arman sus `Select` a mano en vez de usar
`components/filtros/`, así que no hay un solo componente. Mani (6-oct, A-105): que ocupe mucho menos, sea intuitivo,
y sea UNA pieza reutilizable que escale a más filtros, orden y búsqueda.

## Decidido (Mani + sesión central, 6-oct)

Guía: Uxcel, *Filter & sort best practices* (Baymard): lo popular a la vista y el resto guardado, filtrar y ordenar
son dos cosas, siempre conteo de resultados, filtros aplicados visibles con quitar uno y quitar todo, aplicar al
elegir (A-61 ya lo hace).

1. **Navegación y herramientas son dos filas distintas.** Las pestañas (`Pestanas`) siguen en su fila, sin
   mezclarse con filtros. Su descripción deja de ser una línea debajo y pasa a `title` (tooltip) de la pestaña.
2. **Una fila de herramientas, `BarraDeLista`**, controles de 32 px (`h-8`), sin etiqueta encima. Izquierda a derecha:
   - **Buscador** (opcional), que se estira (`flex-1`, con un máximo razonable).
   - **Filtros a la vista** (0 a 2 por pantalla): chips compactos `Etiqueta: valor`. Un chip con valor se pinta con
     el acento de Tinta y lleva × para quitarlo.
   - **"Filtros · n"**: abre un popover (Base UI `Popover`; ya está en `@base-ui/react`, sin dependencia nueva) con
     el resto de los filtros, cada uno con su etiqueta pequeña. n = filtros activos dentro del popover. Dentro, al
     pie, "Quitar filtros". Elegir aplica en el acto (A-61); no hay botón Aplicar.
   - **Orden** (opcional): botón con ícono y el orden vigente en su `aria-label`/tooltip, separado de los filtros.
   - **Acciones de vista** (slot opcional a la derecha): p. ej. Tarjetas/Tabla de Leads.
3. **Línea de estado** de una línea, texto `xs`, debajo de la fila: el conteo (`N resultados`, `cifra`), los filtros
   activos como etiquetas con × (también los del popover) y "Quitar todo". Si no hay filtros activos, solo el
   conteo y, donde exista, el resumen (Students: completos, sin onboarding, cartera vencida). Esto reemplaza el
   encabezado "Leads · N", la tarjeta de resumen de Students, el "N deals" del Kanban y el "Llamadas · N" de Calls.
4. **Escala por declaración, no por copia.** Cada pantalla declara sus filtros (nombre en la URL, etiqueta, opciones,
   valor "todos", `aVista: boolean`) y la barra deriva chips, popover, conteo de activos, etiquetas activas y "Quitar
   todo" de esa lista. La lista de claves que borra "Quitar todo" sale de las declaraciones (más las claves extra
   que declare un filtro compuesto, como el periodo), no de un arreglo `nombres` escrito aparte. Un filtro nuevo es
   una entrada, no un componente.
5. **Todo sigue en la URL** con `useFiltrosUrl` / `siguienteQuery` (ADR 0023). Los nombres de los parámetros NO
   cambian, para que los enlaces guardados y "Volver" sigan llegando. Las claves viejas que hoy se limpian
   (`rango`, `desde`, `hasta` en el periodo; `orden`/`sentido` en Deals) se siguen limpiando igual.
6. **Las piezas compuestas se compactan, no se reescriben**: `SelectorPeriodo` gana una variante de una línea
   (chip `Periodo: Este mes` con el rango en el tooltip); su diálogo y su lógica quedan iguales. `FiltroFechaLista`
   (campo de fecha + periodo) es un solo chip o un par de chips compactos. El buscador de Leads conserva su server
   action y su debounce, pero sus resultados **flotan** (popover o `absolute`) en vez de empujar la lista. El
   buscador de Recursos (`q`) conserva su lógica.

## Alcance

- `components/filtros/`: `barra-de-lista.tsx` (la fila + línea de estado + popover), las piezas compactas que
  necesite (chip de select, chip de fecha, orden, buscador) y `components/ui/popover.tsx` al estilo shadcn sobre
  Base UI si no existe. Las funciones puras nuevas (p. ej. contar activos, claves a borrar, etiquetas activas desde
  las declaraciones) van en `components/filtros/query.ts` o un archivo puro hermano, con tests en
  `tests/filtros-url.test.ts` (este repo no tiene tests de componentes).
- Migrar a la barra: **Leads, Deals, Calls, Students, Dashboard del programa, Dashboard de todos
  (`app/(app)/dashboard/page.tsx`) y Recursos**. Reparto visible sugerido (ajustable si el recorrido lo pide):
  - Leads: buscador; a la vista fecha; popover Deal, Calidad, Abandonó, Posible duplicado; vista Tarjetas/Tabla.
  - Deals: a la vista fecha y Dueño (si aplica); popover Calidad, Valor, Cohorte, Canal, Antigüedad; Orden aparte.
  - Calls: a la vista Closer (si aplica) y Resultado; popover Desde/Hasta (o un chip de rango).
  - Students: a la vista Cohorte; popover Onboarding; resumen en la línea de estado.
  - Dashboard: a la vista Periodo (compacto) y Closer; sin popover si no hace falta.
  - Recursos: buscador (solo en la pestaña recursos); a la vista Programa.
- `BarraDeFiltros` y los `Select` a mano de `FiltroKanban`/`FiltroDashboard`/`FiltroFechaLista` desaparecen o pasan
  a ser internos de la barra; no quedan dos formas de pintar un filtro. Revisar los otros usuarios de esas piezas
  (`ajustes/migracion`, `nerd-stats/bitacora`, `mi-espacio/tab-metricas`) para que no se rompan; migrarlos solo si
  es trivial, si no, dejarlos y anotarlo.
- `Pestanas`: descripción a `title`. Revisar que `PestanasProps` siga igual para no tocar a cada llamador.
- `docs/structure.md` §9: nombrar `BarraDeLista` como la pieza única de búsqueda, filtros y orden, junto a
  `PantallaFija`, `ZonaConScroll` y `Pestanas`, y corregir la frase de la descripción de pestaña.

## Fuera de alcance

- Cambiar qué filtra cada pantalla o la consulta del servidor. Mismos parámetros, mismos resultados.
- Filtros de selección múltiple (Uxcel lo recomienda; hoy ninguna consulta lo admite). La declaración debe dejar
  sitio para agregarlo después sin romper la API.
- Mobile más allá de que no se rompa: por debajo de `md` la fila puede envolver o hacer scroll horizontal.

## Reglas que aplican

- Tinta (§9): ningún color, sombra ni radio a mano; un solo acento morado; cifras en `cifra`.
- Base UI es estricto con la composición: una parte fuera de su contenedor lanza al ABRIR. Abrir cada popover,
  select y diálogo en el recorrido.
- Un componente cliente no importa valores de módulos de `lib/` que carguen `lib/db`: lo que necesite llega por
  props. Por eso el cambio corre `npm run build`.
- Sin `rol === "..."` a mano: la visibilidad de Closer/Dueño sigue saliendo de lo que ya decide cada página.

## Done cuando

- Las 7 pantallas usan `BarraDeLista`; `grep -rn "BarraDeFiltros" app components` no encuentra llamadores fuera de
  la pieza (o solo los nombrados en la nota de cierre).
- Leads, a 1440×900, muestra el primer registro a menos de la mitad del alto que hoy (medir la `top` de la zona con
  scroll antes y después) y Deals pinta sus filtros en una sola fila.
- Filtrar, quitar un filtro con ×, "Quitar todo", el popover, el orden, el periodo y el buscador funcionan igual que
  antes en la URL (mismos parámetros); un enlace viejo con filtros sigue filtrando.
- Typecheck, lint, `npm test -- tests/filtros-url.test.ts tests/paginas.test.ts`, `npm run build`.
- Recorrido en `dev:local` (la sesión central): abrir todo lo que se abre en las 7 pantallas, consola limpia.

## Nota de cierre (Kiro)

Sesión `barra-de-lista` (branch `t202`). Hecho:

- **`components/ui/popover.tsx`**: Popover shadcn-on-base-ui (`@base-ui/react/popover`), mismo molde que
  `dialog.tsx`; portal + positioner + popup, tokens de Tinta, sin dependencia nueva.
- **`components/filtros/declaracion.ts`**: el modelo declarativo puro (`FiltroDeclarado`) y los helpers que
  la barra deriva (`valorDeFiltro`, `etiquetaDelValor`, `filtroActivo`, `activosEnPopover`, `clavesABorrar`,
  `clavesDelPopover`, `etiquetasActivas`, `hayAlgunActivo`). Tests nuevos en `tests/filtros-url.test.ts`
  (8 casos: conteo del popover, claves a borrar con extras y sin duplicar, etiquetas activas en orden).
- **`components/filtros/barra-de-lista.tsx`**: `BarraDeLista` (fila 32 px + línea de estado + popover) y
  `ControlDeOrden`. `total` es opcional (el dashboard no es una lista con un conteo único). Chip activo con
  el acento (`border-marca`), tags activos con × y "Quitar todo"; las claves salen de las declaraciones.
- **`SelectorPeriodo`** gana `variante="chip"` (una línea "Periodo: Este mes", rango en el tooltip); diálogo
  y lógica iguales. **`FiltroFechaLista`** pasa a un par de chips compactos (campo + periodo chip) y exporta
  `CLAVES_DE_FECHA_LISTA`. **`BuscadorDeLeads`**: los resultados FLOTAN (`absolute` + `shadow-flotante`) en
  vez de empujar la lista.
- **`Pestanas`**: la descripción pasó de una línea debajo a `title` (tooltip); `PestanasProps` no cambió, así
  que ningún llamador se tocó.
- **7 pantallas migradas**: Leads, Deals (vía `FiltroKanban`, que ahora compone `BarraDeLista` + `ControlDeOrden`),
  Calls, Students, Dashboard de programa (vía `FiltroDashboard`), Dashboard de todos y Recursos. Se quitaron los
  encabezados de conteo que la línea de estado reemplaza ("Leads · N", resumen de Students, "N deals" del Kanban,
  "Llamadas · N" de Calls). Los nombres de los parámetros de la URL NO cambiaron.
- **Dos usuarios extra migrados por ser triviales**: `/ajustes/migracion` y `/nerd-stats/bitacora` (sus
  `BarraDeFiltros`/`FiltroSelect` se cambiaron por `BarraDeLista` con filtros declarados; bitácora manda
  Desde/Hasta al popover). Así `grep "BarraDeFiltros" app components` queda sin llamadores.
- **Borrados**: `components/filtros/barra-de-filtros.tsx` y `components/filtros/filtro-select.tsx` (sin
  llamadores). `components/filtros/filtro-fecha.tsx` SE CONSERVA: lo usan los popovers de rango de Calls y
  Bitácora. `hayFiltrosActivos`/`siguienteQuery` en `query.ts` siguen (tests y `useFiltrosUrl`).

Sin migrar y por qué:

- **`components/mi-espacio/tab-metricas.tsx`** usa `SelectorPeriodo` en variante bloque (no es una lista con
  barra de herramientas, es la cabecera de un panel de métricas de Mi espacio). No entra en los 7 y no es
  trivial encajarlo en `BarraDeLista` sin cambiar su layout; se deja como está. El chip nuevo no lo afecta.

Lo que la sesión central debe revisar en el recorrido visual (`dev:local`, consola abierta, Base UI lanza al
ABRIR):

- Abrir el popover **"Filtros · n"** en Leads, Deals, Calls, Students y Bitácora; abrir cada **select** dentro
  (chips a la vista y filas del popover) y el **diálogo del periodo** desde su chip; abrir el **orden** en Deals.
  Que no salte `MenuGroupContext`/`PopoverContext` ni un error de contexto.
- **Leads a 1440×900**: medir la `top` de la zona con scroll antes/después (criterio del ticket: el primer
  registro a menos de la mitad del alto de hoy). El buscador ahora FLOTA: comprobar que el panel de resultados
  no empuja la lista y que tapa bien (z-index) las tarjetas de abajo.
- **Mismos parámetros en la URL**: filtrar, quitar un filtro con ×, "Quitar todo", y pegar un enlace viejo
  (`?deal=con&calidad=high`, `?cohorte=todas`, `?orden=creado&sentido=asc`, `?periodo=este_mes`) y confirmar
  que sigue filtrando igual. Ojo con el chip de **cohorte** de Deals: sin `cohorte` en la URL muestra "Cohorte
  activa" (su "todos"), "todas" es un valor real.
- **Claro y oscuro**: el acento del chip activo (`border-marca`/`text-marca-texto`) y los tags de la línea de
  estado se ven bien en los dos temas.
- `npm run build` (no corre en este worktree con symlink de `node_modules`; hay que correrlo en el checkout
  principal tras commit — regla de AGENTS.md para cambios en componentes cliente).
