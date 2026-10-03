---
id: 170
etapa: O3
serves: "docs/anotaciones.md A-60, A-61, A-62, A-65, A-68 (y A-09, A-11); ADR 0075 (el closer ve solo lo suyo); ADR 0077"
depends: []
status: done
---

# 170 — Las listas: filtros que se aplican solos, Calls de cada closer y Leads en tabla

Sesión **S3** de la ola O3. Sin migración.

## Por qué existe

Mani (3-oct): en Calls no se sabe que una llamada se abre; los filtros piden un botón; un closer ve llamadas de otros
(en Deals no, ADR 0075); Leads necesita una vista tipo hoja; y Personas sigue ahí aunque Leads la reemplaza (A-11).

## Alcance

1. **Un componente de filtros para toda lista (A-61).** Nuevo en `components/filtros/`: cada control actualiza la URL
   al elegir (selects y fechas al cambiar; texto al dejar de escribir unos 400 ms o con Enter), sin botón
   "Filtrar". Siempre hay **"Quitar filtros"** cuando hay alguno activo, y deja la página en 0. El filtro vive en la
   URL (ADR 0023), así se comparte y se vuelve atrás. Se adopta en: Calls, Leads, Students, el Kanban
   (`filtro-kanban.tsx`), el Dashboard (`filtro-dashboard.tsx`, `selector-periodo.tsx`), Nerd Stats → Bitácora y
   Ajustes → Migración. **Recursos lo adopta el 171** (es su pantalla en la ola).
2. **Calls de cada closer (A-62, ADR 0075 extendido).** `llamadasDelPrograma` (`lib/queries/llamadas.ts`) recibe el
   alcance (`AlcanceDeals` de `lib/auth/alcance-deals.ts`, el mismo de Deals, sin copiar el predicado): quien
   administra ve todas; un closer ve las llamadas de **sus deals** y las que tienen `closer_user_id` = él. El tipo
   de la consulta no admite llamarla sin alcance. **Las sueltas salen de Calls**: el Inbox es el único lugar
   compartido (llamadas sin closer y deals sin dueño). El detalle de una llamada ajena responde 404 (forjar el id).
3. **Calls se ve clicable (A-60).** Toda la fila abre el detalle (`DetalleDeLlamada`, 163): hover con fondo, cursor de
   mano, foco con teclado. Lo mismo en las filas de Leads y Students.
4. **Leads en tabla (A-68).** Arriba a la derecha, un toggle de dos opciones (Tarjetas / Tabla) con el layout de la
   captura de Mani: dos segmentos en una cápsula, el elegido con un tono más claro; colores de Tinta, iconos de
   `lucide-react`. La vista va en la URL (`?vista=tabla`). La tabla es tipo hoja: filas delgadas, una celda por
   columna (nombre, correo, teléfono, calidad, etapa del deal, canal, fecha del último envío), encabezado fijo,
   scroll horizontal dentro de la tabla (nunca de la página), misma paginación del servidor. Clic en la fila abre
   la ficha del lead.
5. **Personas se va, adelantado (A-65, A-11).**
   - Leads gana el **buscador** por nombre, correo o teléfono (en el servidor, dentro del programa; reusa
     `lib/queries/personas.ts` acotado al programa o lo mueve a `lib/queries/leads.ts`, una sola función).
   - `components/deals/nuevo-deal.tsx` deja de importar `buscarPersonasAccion` de `app/(app)/personas/`: usa la
     búsqueda de Leads.
   - `components/admin/entregas-webhook.tsx` enlaza a `/p/<programa>/leads/<id>`, no a `/personas/<id>`.
   - Se borran `app/(app)/personas/`, `components/personas-buscador.tsx`, el item de `lib/nav.ts` y sus tests
     (`tests/personas.test.ts` se reescribe sobre la búsqueda de Leads, no se pierde lo que afirmaba de alcance).
   - `/personas` y `/personas/<id>` quedan 404 (no redirigen: nadie los tiene guardados y la nav ya no los ofrece).

## Archivos

Suyos: `components/filtros/` (nuevo), las páginas de Calls, Leads, Students, `components/deals/llamadas-programa.tsx`,
`filtro-kanban.tsx`, `filtro-dashboard.tsx`, `selector-periodo.tsx`, `lib/queries/llamadas.ts`, `lib/queries/leads.ts`,
`lib/queries/personas.ts`, `components/deals/nuevo-deal.tsx`, `components/admin/entregas-webhook.tsx` (solo el
enlace), `lib/nav.ts` (solo quitar Personas; avisar a Alejo), `app/(app)/personas/` (se borra).
**No toca** `components/deals/detalle-de-llamada.tsx` (168), `lib/queries/inbox.ts` (168, 169), la tab Programa ni
Recursos (171).

Tests: `tests/llamadas-programa.test.ts` (alcance por dueño, mordido en los dos sentidos), `tests/leads-tab.test.ts`,
`tests/paginas.test.ts`, `tests/personas.test.ts`.

## Done cuando

- Ninguna lista tiene botón "Filtrar"; todas tienen "Quitar filtros"; el filtro se ve en la URL.
- Un closer en Calls ve solo lo suyo; con el id de una llamada ajena en la URL, 404; las sueltas solo en el Inbox.
- Leads tiene buscador y el toggle Tarjetas / Tabla; la tabla cabe a 375 px con scroll dentro de ella.
- `/personas` no existe y nada la enlaza (`grep -rn "/personas" app components lib` vacío).
- `npm run build` en verde; recorrido en `dev:local` como closer y como gerente, consola abierta, escritorio y 375 px.

## Cierre 3-oct (S3: Codex implementa, Claude revisa; rama `o3-170-listas`, sin migración)

- **Filtros (A-61).** `components/filtros/`: `query.ts` (puro: `siguienteQuery` siempre borra `pagina`;
  `hayFiltrosActivos`), `use-filtros-url.ts`, `BarraDeFiltros` (pone "Quitar filtros" cuando hay alguno),
  `FiltroSelect` (el Select de Base UI, como el Kanban) y `FiltroFecha`. Adoptado en Calls, Leads, Students, Bitácora,
  Migración, Kanban, `filtro-dashboard`, `filtro-fecha-lista` y `selector-periodo`. No hay filtro de texto en la URL:
  el buscador de Leads va por server action. En el período personalizado, una fecha aplica sin cerrar el diálogo (las
  cuatro siguen siendo obligatorias, como antes con `required`); un atajo sí lo cierra.
- **Calls de cada closer (A-62).** `llamadaVisiblePara` vive junto a `dealVisiblePara` en `lib/auth/alcance-deals.ts`
  (dueño del deal o closer de la llamada; quien administra, todo). `llamadasDelPrograma` recibe `AlcanceDeals` como
  parámetro obligatorio y excluye las sueltas para TODOS (el Inbox es el único lugar compartido). Para un closer no hay
  selector de closer y un `?closer=` forjado se ignora. `detalleDeLlamadaAccion` responde "Esa llamada no existe." para
  una ajena, igual que para una inexistente; una suelta sí abre (la usa el Inbox). Decisión que tomé y queda a la
  vista: un deal sin dueño se abre para reclamarlo, pero su llamada con el closer de otro no.
- **Filas clicables (A-60).** Calls, Students y Leads (tarjetas): enlace estirado (`after:absolute after:inset-0`) y
  lo demás interactivo en `relative z-10`; en la tabla, cada celda enlaza a la ficha.
- **Leads (A-68, A-09 en parte).** Toggle Tarjetas / Tabla en el `CardAction` (`?vista=tabla`). La tabla: una línea por
  fila, encabezado fijo, scroll dentro de ella. `leadsDelPrograma` suma teléfono, etapa (el deal vigente abierto, si no
  el más reciente) y canal (`utm_source / utm_medium` crudo del envío más reciente; "Sin UTM" si falta una mitad), en
  lecturas por lote. La paginación sigue en 100 (las páginas de 25 o 50 de A-09 no entraron).
- **Personas fuera (A-65, A-11).** `buscarLeads` (nombre, correo o teléfono, dentro del programa) en
  `lib/queries/leads.ts` + `buscarLeadsAccion`; `BuscadorDeLeads` arriba de Leads (400 ms o Enter). `nuevo-deal.tsx` usa
  esa acción. Borrados `app/(app)/personas/`, `components/personas-buscador.tsx`, `lib/queries/personas.ts`, el item de
  `lib/nav.ts` (aviso para Alejo, dueño de nav en la parte 2) y `slugDelLeadVisible`, que quedó huérfana. Los enlaces
  de Webhook Health y Migración van a `/p/<slug>/leads/<id>` (las entregas huérfanas, sin programa, quedan sin enlace).
  El grep del "Done cuando" solo devuelve `lib/mutations/personas` (la creación manual de un lead, otra cosa).
  `tests/personas.test.ts` no cambió: prueba esa mutación, no la pantalla.
- **Tests:** `filtros-url` (nuevo), `llamadas-programa` (alcance en los dos sentidos), `leads-tab` (buscador, etapa,
  canal), `acciones-mi-dia`, `alcance-de-sesion`, `mi-dia`, `roles`, `paginas` (la tab Leads: 404 fuera del alcance
  y tarjetas, tabla o vista inválida sin romperse): en verde en local. CI verde en el push del 3-oct (`6bc3988`).
- **Nivel 1:** typecheck, lint y `npm run build` en verde.
- **Recorrido en `dev:local`** (gerente y closer, escritorio y 375 px): filtros sin botón y "Quitar filtros" en Calls,
  Leads y Kanban; período A contra B; fila de Calls abre el detalle y "Pegar Grain" abre su diálogo; Students y la tabla
  de Leads abren su destino; buscador por teléfono; `/personas` 404; a 375 px la página mide 375 y la tabla hace scroll
  por dentro. Consola limpia. Bitácora y Migración no se recorrieron. **Mordido forjando la petición:** como Carlos
  (closer), Calls lista 28 llamadas, las mismas que cuenta la base para él, y con `?closer=<María>` sigue en 28; la
  acción del detalle, invocada a mano con el id de una llamada de Mani, devuelve lo mismo que con un id inexistente.

