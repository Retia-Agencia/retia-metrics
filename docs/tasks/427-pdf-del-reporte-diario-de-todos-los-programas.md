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

- [ ] D-1 a D-3 respondidas por Mani, con su respuesta escrita aquí.
- [ ] El PDF de un día con tres programas da, por programa, las mismas cifras que Hub › Hoy; un cuadro así sembrado en un test.
- [ ] El paid trafficker no ve nada del equipo comercial en el PDF (`sinListas`).
- [ ] Probado en claro y en papel (vista previa de impresión), 375 px no aplica.
- [ ] Regla N8 y N9; tracker y `status:` coinciden.
