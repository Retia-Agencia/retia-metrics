---
id: 427
etapa: hub
serves: "Mani, 13-nov (carril H de `docs/plan-reparto.md` §4): el reporte diario de Michael en PDF con todos los programas · 373 · ADR 0048"
depends: [373]
status: todo
---

# 427 — El PDF del reporte diario trae todos los programas

## Por qué

El 373 dejó `/hub` imprimiendo con `window.print()` (nativo, ADR 0006). La vista "todos los programas" existe (punto 4 del 373),
pero lo armado para imprimir no tiene ticket propio: no está dicho qué lleva el PDF de varios programas ni quién lo valida.
Michael se va el 30-nov (`docs/weekly-2026-11-13.md`); el reporte tiene que poder salir sin él.

## Alcance (a confirmar antes de construir)

Una hoja `@media print` del Hub "todos" con una columna o sección por programa visible para la sesión (alcance, ADR 0048), solo
magnitudes sumables juntas y tasas, meta y ROAS **por programa, lado a lado** (nunca sumadas), con el pie "Datos del CRM al
<fecha y hora> (Bogotá)" y la URL que lo produjo. Ningún cálculo nuevo: lo que el Hub ya muestra, en papel.

## Decisiones abiertas (no se asumen)

- **D-1.** ¿Se queda en `window.print()` o hace falta un archivo generado en el servidor (que Juanito pueda mandarlo)? Lo segundo
  exige librería o navegador sin cabeza: decisión de Mani con su costo.
- **D-2.** ¿Qué secciones de la plantilla de septiembre (`work/retia/reportes diarios/`, fuera del repo) entran con varios programas?
- **D-3.** ¿Quién lo valida contra el reporte manual de una semana real (Michael o Daniel Tovar)?

## Done cuando

- [x] D-1 a D-3 respondidas por Mani, con su respuesta escrita aquí (14-nov).
- [x] El PDF de un día con tres programas (hecho 14-nov, `f24c3502`: `tests/hub-reporte.test.ts`) da, por programa, las mismas cifras que Hub › Hoy; un cuadro así sembrado en un test.
- [x] El paid trafficker no ve nada del equipo comercial en el PDF (hecho 14-nov, mismo test) (`sinListas`).
- [ ] Probado en claro y en papel (vista previa de impresión), 375 px no aplica.
- [ ] Regla N8 y N9; tracker y `status:` coinciden.

## Decisiones (14-nov, Mani: "el que consideres más eficiente y correcto para el CRM")
- **D-1: `window.print()`, sin archivo del servidor.** Un PDF generado en el servidor exige un navegador sin cabeza o una librería (costo, tamaño y mantenimiento en Vercel) y rompe el ADR 0006 (nada instalado antes del código que lo usa). `window.print()` ya funciona en `/hub` (373), guarda como PDF desde el navegador y no tiene piezas que se rompan. Si Juanito necesita *mandarlo* algún día, es otro ticket con su costo.
- **D-2: las secciones que el Hub "todos" ya muestra (Hoy y Pauta), una por programa, sin cálculo nuevo.** Una sección de la plantilla de septiembre que el Hub no tenga se anota como faltante, no se inventa.
- **D-3: Michael lo valida contra su reporte manual de una semana real antes de irse (30-nov), con Daniel Tovar como segundo ojo.** Es quien lo hace hoy y se va; el valor del ticket es que pueda salir sin él.
- Brief para Codex: `docs/agents/briefs-codex-14-nov.md`, B-4.

### Enmienda 14-nov (Mani): NO es un Ctrl+P del Hub
Michael no quiere el Hub impreso: quiere un reporte **resumido, directo y fácil de leer**, y de **todos los programas** (sin AI Second Brain Jurídico, que se retira). Entonces D-1 cambia: **una página propia para el reporte** (`/hub/reporte`, construida para leerse como documento, no la pantalla del Hub), con el mismo contenido que su reporte manual de septiembre (`work/retia/reportes diarios/`): **1. El día** (meta contra real de cupos y leads; caja del día; agendas, realizadas, show, ventas y % de cierre por programa y por closer), **3. La semana** (meta de la semana, a la fecha y real; la meta diaria para llegar a la del corte) y **4. El corte** (vendidos contra meta de cohorte y cumplimiento), un programa al lado del otro. Se imprime o se guarda como PDF con el botón de la propia página (`window.print()` sobre esa página, que sí es corta y de formato propio); un archivo generado en el servidor sigue descartado hasta que Juanito necesite mandarlo.
**Lo que el CRM no tiene y por tanto NO entra:** la sección "2. Los masivos" (los envíos masivos de WhatsApp) y los párrafos narrativos por closer ("1 cierre, 2 no-show, 1 que viaja a China…"). Si Michael los quiere, es otra fuente o texto libre: se pregunta antes de construir.

## Avance del 14-nov (tarde): `/hub/reporte` construida y en producción; falta la validación de Michael y tres retoques
**Construido** (`f24c3502`; Mani abrió producción con su sesión y la página carga):
- `app/(app)/hub/reporte/page.tsx` + `loading.tsx`, componentes en `components/hub-reporte/` (`reporte.tsx`, `guardar-como-pdf.tsx`), `tests/hub-reporte.test.ts` y un bloque en `tests/paginas.test.ts` (404 sin programas).
- Guarda `paginaConCapacidad(veTableroDelPrograma)`; programas = `programasVisibles`; `?fecha=` con `resolverDiaDelReporte` (futuro se rechaza con aviso). Cada cifra sale de `armarReporteDiario` (`lib/queries/reporte-diario.ts`): cero cálculo nuevo. Por closer solo si `veEquipoComercial` (el paid trafficker pasa por `sinListas`).
- Secciones: **1. El día** (objetivo del día, cupos vendidos, objetivo de leads, leads de hoy, entró a caja, citas, realizadas, asistencia, ventas, cierre; por closer), **3. La semana** (objetivo de la semana, llevamos, por día hábil), **4. El corte** (cohorte, cupos vendidos, objetivo, cumplimiento). La numeración 1, 3, 4 es intencional: la 2 «Los masivos» no entra (el CRM no la tiene), ni los párrafos narrativos por closer. Pie «Datos del CRM al <fecha y hora> (Bogotá)».
- Impresión: el botón es `window.print()`; el CSS global (`app/globals.css`, `@media print`) ya oculta todo salvo `#reporte-diario`, y la página usa ese mismo id, así que el sidebar no sale. Revisado en producción el 14-nov (13-nov: los tres programas, secciones 1/3/4 y pie).
**Lo que falta:**
1. **Michael valida el reporte contra su reporte manual de una semana real** (con Daniel Tovar de segundo ojo) **antes del 30-nov** (D-3). Referencia: `work/retia/reportes diarios/Reporte-Diario-Retia-2026-09-15-v5.pdf`. Es la casilla que cierra el ticket.
2. **«Meta de la semana a la fecha» NO existe:** no hay cifra precalculada en `lib/queries/`, y el ticket prohíbe calcular. La sección 3 muestra objetivo de la semana, llevamos y por día hábil. Decidir con Mani si se construye (módulo propio en `lib/queries/`) o se acepta sin ella.
3. **Rótulos con «hoy» en un día pasado:** «Entró a caja hoy» y «Leads de hoy» salen igual si `?fecha=` es otro día. Cambiar a «del día» (vocabulario) cuando haya fecha elegida.
4. **Probar la vista de impresión real** (Guardar como PDF, A4, claro) y ver que el pie de página queda dentro del margen; revisar el ancho con tres programas en columnas (`lg:grid-cols-3`).
5. **Cierra el ticket:** casillas «Probado en claro y en papel» y N8/N9 (tracker y `status:`).
