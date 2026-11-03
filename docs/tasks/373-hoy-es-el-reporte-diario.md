---
id: 373
etapa: hub
serves: "Weekly con Daniel Tovar del 3-nov (docs/hub.md §0, G-10: el CRM como fuente única de verdad) · ADR 0086 (Hoy es el reporte diario) · objetivo O1 de docs/hub.md · reemplaza el punto 1 del 300 y al 254"
depends: [352, 369, 371]
status: todo
---

# 373 — Hub › Hoy es el reporte diario de Michael, y se descarga en PDF

Entrega del Hub a Gerencia, fase 1 (`docs/hub.md` §0). Es lo que Gerencia va a usar todos los días.

## Por qué

Daniel Tovar, weekly del 3-nov:

> "Mike me manda diariamente unos reportes, y yo no sé de dónde carajos él los está sacando. (...) 'Nuestra única
> fuente de verdad es el CRM de Manu'. Entonces, esa vaina debe poderse descargar un reporte en PDF (...) Y eso es como
> la fuente única de verdad."

Mani, 3-nov: el reporte que quiere Dani es **la plantilla del reporte diario que Michael le manda**, y vive en la
**pestaña Hoy del Hub**. La plantilla son los PDF de septiembre en `work/retia/reportes diarios/` (fuera del repo, no se
commitean); la vigente es `Reporte-Diario-Retia-2026-09-15-v5.pdf`, y las otras cuatro comparten su estructura (audit
del 14-oct, `docs/hub.md` §2.3). Es la meta del ADR 0086 ("Hoy es el reporte diario") y del objetivo O1, que no se había
cerrado: Hoy tiene las cifras (252, 299, 367) pero no el orden ni la forma del reporte, y no se descarga.

## La plantilla, sección por sección, y de dónde sale cada cifra

Los programas van **lado a lado**: en la vista "todos" (`/hub?seccion=hoy`) una columna por programa visible, como en
la plantilla (TI | Comunicarte); en el Hub de un programa, solo esa columna. **Ninguna tasa se suma entre programas**
(ADR 0048): donde la plantilla tiene una fila "Total" con % de show o % de cierre, el total lleva solo los conteos, y la
tabla por closer va dentro de cada programa (la plantilla mezclaba a Andrea en los dos).

**Encabezado.** "Reporte Diario Retia" (o el nombre del programa) · la fecha en palabras · la línea de contexto que ya
existe (`LineaDeContexto`: semana día 2 de 5, mes día 11 de 22 hábiles, corte de cada programa día 20 de 30) · la meta
proyectada de cada programa ("lo que falta dividido por los días hábiles que quedan, recalculado cada día. Hoy la meta
era 2,6 cupos en TI y 5,6 en Comunicarte"), con la meta de apertura del día (DA-5).

**1. El día.**
- Tabla Indicador · Meta · Real · Cumplimiento: cupos y leads de cada programa. Meta de cupos = la del día (352); meta
  de leads = leads por día hábil que hacen falta (253, `leerProyeccion`); leads = registros del día (299).
- **Las ventas del día**, una fila por venta: persona, programa, closer, Vendido · Recaudado · Por cobrar (369) y **cómo
  nació**: *agenda del día* (tuvo show el mismo día de Bogotá en que entró a venta), *seguimiento* (su último show fue
  un día anterior) o *sin llamada* (ningún show vigente). Era el 254; se hace aquí como una función derivada al leer
  sobre el hecho venta (262), sin columna nueva.
- **Entró a caja del día**, por moneda, con su desglose: lo que entró por ventas nuevas del día y lo que entró como
  saldo de una venta anterior, con la fecha y el closer de esa venta ("Maryce Lopez pagó los USD 750 que le faltaban de
  su cupo del 31-ago, cerrado por Jerónimo: no suma un cupo nuevo"). Los abonos adicionales (1:1), en su línea.
- Tabla por programa: agendas del día (citas con fecha hoy), realizadas, % de show, ventas, % de cierre (las funciones
  de Hoy, 299). Tabla por closer dentro de cada programa, con las mismas columnas.
- **Qué pasó con cada agenda**, por closer y programa, en una línea: el conteo por resultado (cierre, no-show,
  reprogramada, perdida con su motivo, pendiente): "Andrea · TI, 9 agendas: 1 cierre, 2 no-show, 2 reprogramadas, 1
  perdida (precio), 3 pendientes". Cada número abre su lista. Es lo que Michael escribía a mano, armado con los
  resultados y motivos que ya se registran.
- Leads del día por programa: total y de pauta (área Paid, `resolverCanal`).

**2. Los masivos.** No pasan por el CRM (Kapso, H-9): la sección no se dibuja. Fase 2.

**3. La semana.** Tabla Indicador · Meta de la semana · Meta a la fecha · Real · Cumplimiento a la fecha, para cupos y
leads de cada programa (146), y el show de la semana ("se realizaron 16 de 35 citas: 46 %"). Debajo, **"Meta para llegar
a {meta}, desde mañana"** por programa: cupos que faltan, hábiles que quedan, meta diaria, resto de esta semana, cada
semana siguiente, los días sueltos del final y leads por día hábil (253, ya construido).

**4. El corte y 5. El mes.** El bloque **"¿Vamos a llegar?" (371)** va aquí, en el lugar de las dos secciones: cohorte y
mes, en cupos y en USD. Es la misma pieza que va al pie de las otras pestañas, así que en Hoy no se repite abajo.

**6. Planes de acción.** Viven en el 257 (tabla nueva, migración): fase 2. Hasta entonces la sección no se dibuja.

La prosa interpretativa de Michael ("la inteligencia artificial apareció dos veces hoy...") no la escribe el CRM: el
reporte trae los hechos con su lista, y la lectura es de quien lo manda.

## Alcance

1. **Hoy se reordena en ese orden** (`components/dashboard/hoy.tsx`), con los números de sección de la plantilla. Las
   tarjetas que repiten una cifra del reporte se borran (N7). Lo que sirve para seguir el día y no está en la plantilla
   (la agenda por hora y Mañana, del 367; Lo que pide atención) queda **debajo del reporte**, bajo "Para seguir el día",
   y no va al PDF.
2. **Un selector de día**, el único control de Hoy: Hoy · Ayer · una fecha (`?fecha=AAAA-MM-DD`, Bogotá). Los filtros de
   cohorte, periodo y closer del 377 no aplican a Hoy (el reporte es del día y de la cohorte activa). Una fecha futura
   se rechaza; un día sin datos dice "Sin datos" (N5).
3. **"Descargar PDF"** arriba a la derecha: `window.print()` (nativo, sin librería, ADR 0006) con una hoja `@media print`:
   carta, márgenes, sin menú ni controles, tablas que no se parten, encabezados de tabla en el estilo de Tinta
   (`docs/structure.md` §9). Pie de cada página: "Datos del CRM al 3-nov-2026, 14:32 (Bogotá)" y la URL que lo produjo,
   para que cualquiera vea las mismas cifras. En papel una cifra no abre su lista.
4. **Vista "todos"**: el mismo reporte con una columna por programa visible para la sesión (alcance, ADR 0048).
5. **Paid trafficker**: ve el reporte sin el trabajo del equipo comercial (`sinListas`: sin tabla por closer ni nombres).

## Fuera

- Masivos (H-9) y Planes de acción (257): fase 2. La foto guardada de cada día: el 300, fase 2.

## Done cuando

- [ ] Test: una venta con show el mismo día es "agenda del día"; con show un día antes, "seguimiento"; sin show, "sin
  llamada".
- [ ] Test: un abono de saldo de una venta de otro día entra a caja del día y no suma un cupo; se rotula con la fecha y
  el closer de esa venta.
- [ ] Test: en "todos", la fila Total solo lleva conteos.
- [ ] Test: `?fecha=` de ayer da las cifras de ayer; una fecha futura se rechaza.
- [ ] Comparado a mano contra un día real: el reporte del CRM de un día de la semana del 3-nov, sección por sección,
  contra lo que Michael mandó ese día; cada diferencia explicada en el ticket.
- [ ] Imprimir a PDF desde Chrome el Hoy de un programa y de "todos" en `dev:local`: carta, nada cortado, pie correcto;
  los PDF se adjuntan al ticket.
- [ ] `npm run test:humo` en verde.
- [ ] El 254 queda `reemplazado` por este ticket.
- [ ] Regla N8: `docs/hub.md` §2.3 (columna "Queda en") y §0, y `docs/metricas.md` (cómo nació la venta) en el mismo
  commit.
