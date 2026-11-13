---
id: 370
etapa: hub
serves: "Weekly con Daniel Tovar del 3-nov (docs/hub.md §0, G-4, G-5, G-6) · ADR 0091, 0106 · absorbe lo que le faltaba al 256"
depends: [377, 369]
status: done
---

# 370 — Gráficas que siguen los filtros, en cupos o en plata, por día o acumuladas

Entrega del Hub a Gerencia, fase 1 (`docs/hub.md` §0).

## Por qué

Daniel Tovar, weekly del 3-nov:

> "Ahí me estás mostrando solamente por mes, pero creo que si yo quiero ver el histórico de todo el cohort, no se está
> actualizando esa gráfica."

> Sobre "Cupos vendidos acumulado": "No entiendo esa gráfica, huevón. Ni los datos que dicen abajo. Cupos dos, fecha
> cero, menos dos, menos cien."

> "Todas las gráficas debería yo poderlas ver en dos tipos de unidades: en cupos y en plata."

Y Mani en la misma reunión, con el sí de Dani: "sería bueno también verlo por día, que no sea todo acumulado".

Hoy (3-nov, `components/dashboard/dinero.tsx:174-260`, `lib/queries/series-dinero.ts`):
- "Vendido por mes", "Cupos vendidos por mes" y "Recaudado por mes" muestran **siempre los últimos seis meses** hasta
  el fin del periodo: no siguen la cohorte, y con una cohorte elegida no cambian.
- Las "acumulado" comparan el mes en curso contra el anterior **independientemente de "Comparar con"** (lo dice el
  texto de la pantalla), y el eje dice `dd/mm / dd/mm` (`diaCorto(p.dia) / diaCorto(p.diaAnterior)`): dos fechas por
  punto, sin unidad. Eso es lo que Dani leyó como "fecha cero, menos dos".
- Ninguna gráfica cambia de unidad.

## Alcance

1. **Toda gráfica del Hub sigue los cuatro filtros del 377.** El eje X es el periodo elegido: con C3 y Desde el
   inicio, del día de la primera venta de C3 a hoy. Se borran las series fijas de seis meses (`leerSeriesDeDinero` con
   su `Array.from({ length: 6 })`) y su texto "Últimos seis meses".
2. **Tres interruptores por gráfica, encima de ella, con el valor elegido a la vista:**
   - **Unidad: Cupos · USD.** En toda gráfica de ventas (vendidos, por closer, por canal, escalera de ventas). Cupos =
     conteo de ventas; USD = Vendido (369). Las gráficas de actividad (envíos, agendas, shows) son conteos de personas o
     citas: no tienen plata que mostrar y lo dicen en su subtítulo ("en personas") en vez de inventar un valor (DH-3, decidido por Mani el 3-nov).
   - **Paso: Día · Semana · Mes.** Por defecto según el largo: hasta 31 días, día; hasta 26 semanas, semana; más, mes.
     Semana de lunes a domingo, en Bogotá; un tramo incompleto se marca "en curso".
   - **Forma: Por paso · Acumulado.** Por defecto: Por paso en actividad, Acumulado en ventas (es como se lee una meta).
   Los tres viajan en la URL por gráfica (`?g_<clave>=plata,semana,acum`; la unidad se llama `plata` porque en Caja no es USD sino cada moneda) para que el PDF (373) y un enlace guardado
   muestren lo mismo.
3. **Rótulos que se leen sin explicación** (contrato de `docs/structure.md` §9):
   - Eje X: fechas del periodo actual en formato corto (`4 nov`), nunca dos fechas por punto.
   - Eje Y con su unidad ("cupos", "USD").
   - Leyenda con nombres de negocio: "C3", "C2 al mismo día de venta", "Octubre", "Septiembre al mismo día hábil".
   - Tooltip de una línea por serie: "4 nov · 12 cupos · C2 al mismo día: 9 (+3, +33 %)".
   - La meta como número junto al título (ADR 0106), en la unidad elegida (cupos o USD = cupos × precio).
4. **La comparación es la de "Comparar con"** (377), no una propia de cada gráfica. Se borra el texto "Esta comparación
   mensual usa el mes anterior, independientemente de “Comparar con”" porque deja de ser cierto.
5. **Una serie por gráfica es la lista**: cada punto abre la lista de su tramo con los filtros puestos.
6. **Lo que faltaba del 256:** `test:humo` en verde y comparar las cifras migradas contra producción (una gráfica de
   cada pestaña, un día elegido a mano).

## Fuera

- Gráficas nuevas que nadie pidió. Este ticket arregla las que hay y les da unidad, paso y forma.

## Done cuando

- [x] Test (constructor puro `crearOpcionGrafica`): con C3 y Desde el inicio el primer punto es la primera venta de C3;
  con 40 días el paso por defecto es semana; las etiquetas del eje son una fecha por punto.
- [x] Test: Unidad USD suma Vendido del tramo y cuadra con la lista del punto; Cupos cuenta ventas.
- [x] Test: Acumulado del último punto = total de la cifra del periodo.
- [x] Guardián: ninguna serie del Hub con un número de meses escrito en el código.
- [x] Recorrido en `dev:local` en claro, oscuro y 375 px con los tres interruptores en cada gráfica; consola limpia;
  `npm run test:humo` en verde. (12-nov, hija H4, sobre `9309e590`; detalle en "Recorrido del 12-nov" abajo.)
- [x] El 256 queda `reemplazado` por este ticket en su archivo y en el tracker.
- [x] Regla N8: el contrato de gráficas de `docs/structure.md` §9 y `AGENTS.md` (fila "Como se dibuja una grafica") en
  el mismo commit.

## Estado (4-nov, sesión del 370)

Hecho y verificado: todo salvo dos casillas. **Falta:** `npm run test:humo` en verde y comparar una gráfica de cada pestaña contra producción (la máquina estaba sin aire, swap de 8,7 GB, y el humo tarda 6 a 12 min por proyecto); el recorrido de `dev:local` se hizo en claro (escritorio) y oscuro (375 px) con los interruptores de Ventas, Caja y Deals contra agendas, consola limpia. Los puntos de «Cupos con caja» no abren lista todavía (no existe la lista de deals con abono). El ticket sigue en `todo` hasta cerrar esas casillas (N9).

## Recorrido del 12-nov (hija H4, `dev:local` sobre `9309e590`, gerente, ComunicArte Local, C1 · Desde el inicio)

- **Interruptores por gráfica, en la URL:** Dinero (`?g_dinero=`) y Comercial (`?g_deals-agendas=`) traen Paso
  (Día · Semana · Mes) y Forma (Por paso · Acumulado); cada clic reescribe la clave y la gráfica cambia. **Sin Unidad
  por diseño:** en Dinero lo quitó el 380 (el tooltip muestra siempre cupos y USD); en Comercial es actividad (DH-3:
  "Son conteos de personas y citas, no plata"). Pauta (`?g_pauta-diaria=`) trae los tres: Unidad (Inversión y agendas ·
  Cupos · Plata), Paso (Día · Semana) y Forma; las siete combinaciones responden 200 sin error de servidor.
- **Rótulos:** eje con una fecha por punto (`1 sep`, `Sem. 19 oct`, `nov 2026 (en curso)`), eje Y con unidad, tramo en
  curso marcado; tooltip de una línea por serie ("2 nov · C1: 5 cupos · Vendido: USD 3.586,50").
- **Toda serie es la lista:** clic en un punto de Cupos vendidos y de **Cupos con caja** abre su resumen con "Ver la
  lista completa" (`metrica=caja`, el día del punto). La deuda del 4-nov ("Cupos con caja no abre lista") ya no existe.
- **Claro, oscuro y 375 px:** Dinero, Comercial y Pauta en oscuro (escritorio y 375 px) y claro (375 px). Consola sin
  errores; solo un `log` de ECharts (`grid.containLabel` sin `LegacyGridContainLabel`, carril P).
- **`test:humo`:** en verde el 11-nov, escritorio 5/5 y celular 5/5 (`5e1fe816`, ticket 420), sobre código que ya incluye
  el 370 (`d362c59d` es ancestro). No se relanzó hoy: swap de 4,3 GB.
- **Comparado con el boceto** (`docs/bocetos/una-forma-de-metrica.html`): "¿Cómo se mueve día a día?" de Pauta tiene los
  mismos tres grupos, el mismo texto de ayuda y el mismo Paso sin Mes.
- **Hallazgos fuera del 370, reportados a la sesión padre:** (1) Comercial desborda en horizontal a 375 y a 763 px
  (`scrollWidth` 1141): la tabla `sr-only` de `BarraApilada100` (`components/graficas/barras.tsx:168`) dentro de la
  tabla de Closers (`components/dashboard/operacion.tsx:146-160`) se escapa del `overflow-x-auto` porque ningún ancestro
  dentro del contenedor es `relative`. (2) `AGENTS.md` (fila "Como se dibuja una grafica") y `docs/structure.md` §9 dicen
  "cada grafica trae sus tres interruptores", y Dinero y Comercial traen dos por decisión (380, DH-3): falta la enmienda N8.
- **Sigue abierto, sin casilla:** el alcance 6 ("comparar las cifras migradas contra producción, una gráfica de cada
  pestaña") no se hizo; `dev:local` no lee producción.
