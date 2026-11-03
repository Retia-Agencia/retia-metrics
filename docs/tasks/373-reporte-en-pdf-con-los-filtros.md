---
id: 373
etapa: hub
serves: "Weekly con Daniel Tovar del 3-nov (docs/hub.md §0, G-10: el CRM como fuente única de verdad) · reemplaza la parte imprimible del 300"
depends: [368, 369, 370, 371, 372]
status: todo
---

# 373 — El reporte en PDF, con los filtros puestos

Entrega del Hub a Gerencia, fase 1 (`docs/hub.md` §0). Cierra la entrega: es lo que Gerencia usa a diario.

## Por qué

Daniel Tovar, weekly del 3-nov:

> "Mike me manda diariamente unos reportes, y yo no sé de dónde carajos él los está sacando. Entonces (...) 'Nuestra
> única fuente de verdad es el CRM de Manu'. Entonces, esa vaina debe poderse descargar un reporte en PDF, con los
> filtros que él le ponga. Y eso es como la fuente única de verdad."

El 300 (23-oct) pedía una vista imprimible solo de Hoy más una foto guardada por día (tabla nueva, `pg_cron`,
contrato versionado). Lo que pidió Dani es más simple y más amplio: cualquier pestaña, con los filtros que se pongan.
La foto diaria no la pidió nadie en esta reunión: queda en el 300, fase 2.

## Alcance

1. **Botón "Descargar PDF" en cada pestaña del Hub** y en la vista "todos". Llama `window.print()` (función nativa del
   navegador: no se instala librería, ADR 0006). Una hoja `@media print`: carta, márgenes, sin menú, sin barra de
   filtros interactiva, sin botones, tablas que no se parten, gráficas en SVG (ya lo son, ADR 0091).
2. **Encabezado del PDF**, en este orden: programa · pestaña · los cuatro filtros escritos en palabras ("Cohorte C3 ·
   Desde el inicio (3-oct a 3-nov) · Todos los closers · Comparado con C2 al mismo día") · los interruptores de cada
   gráfica · "Datos al 3-nov-2026, 14:32 (Bogotá)" · quién lo generó.
3. **Pie del PDF: la URL exacta** que lo produjo. Cualquiera que la abra ve las mismas cifras: eso es lo que hace al
   PDF verificable y al CRM la fuente única (no hay otro número que discutir).
4. **El bloque "¿Vamos a llegar?" (371) siempre va**, al final, con su subtítulo de que no sigue los filtros.
5. **En papel una cifra no abre su lista** y no se imprime nada interactivo. Las secciones plegadas ("Diagnóstico")
   salen desplegadas.
6. **El 300 se enmienda**: su punto 1 (vista imprimible) queda hecho por este ticket; conserva solo la foto del día,
   fase 2, sin fecha.

## Done cuando

- [ ] Imprimir a PDF desde Chrome cada pestaña de un programa y la vista "todos" en `dev:local`: carta, nada cortado,
  encabezado y pie correctos; se adjuntan los PDF al ticket.
- [ ] Abrir la URL del pie en otra sesión da las mismas cifras que el PDF.
- [ ] Un paid trafficker imprime sin ver el trabajo del equipo comercial (la proyección `sinListas` sigue aplicando).
- [ ] Regla N8: `docs/hub.md` §0 y `docs/operations.md` (cómo sale el reporte diario) en el mismo commit.
