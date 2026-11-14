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
- [ ] El PDF de un día con tres programas da, por programa, las mismas cifras que Hub › Hoy; un cuadro así sembrado en un test.
- [ ] El paid trafficker no ve nada del equipo comercial en el PDF (`sinListas`).
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
