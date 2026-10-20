---
id: 252
etapa: hub
serves: "ADR 0086 punto 3 · docs/hub.md O1, §2.3 (el reporte diario contra el CRM)"
depends: [250]
status: done
quien: Alejandro (14-oct)
---

# 252 — Hub › Hoy: el reporte diario sale del CRM

## Objetivo

Que la pestaña Hoy reproduzca la estructura del reporte diario de septiembre (el del 15-sep es la referencia) con lo
que el CRM ya calcula, para que nadie tenga que armarlo a mano.

## Alcance

- **Dentro, en este orden:**
  1. **La línea de contexto:** "Semana: día 3 de 5 · Octubre: día 10 de 22 hábiles · TI C3: día 13 de 32" (el 14-oct), por
     programa, con los días hábiles de Retia (solo se excluyen sábado y domingo).
  2. **El día, la semana, la cohorte y el mes:** cupos (y leads cuando el 253 dé su meta) con meta, real y
     cumplimiento; la meta del día es la dinámica (020) y la de la semana, la compensación semanal (146).
  3. **La operación del día** por programa y por closer: agendas, realizadas, show, ventas y % de cierre (ADR 0079),
     cada cifra con su lista.
  4. **La caja del día** y lo que la compone (abonos que completan una venta anterior se ven como tales).
  5. **Las banderas rojas y las alertas por persistencia** (lo que hoy está en Pulso).
  6. **Los lugares reservados** para la proyección y los requeridos (253), el origen del cierre (254) y las acciones
     abiertas (257), que se llenan con sus tickets.
- **Dentro:** "todos los programas" muestra los programas lado a lado y solo suma lo sumable (ADR 0048).
- **Dentro:** cada cifra de Hoy tiene meta, umbral o dueño (ADR 0086 punto 3); lo que no, se queda en su pestaña.
- **Fuera:** cifras nuevas (253, 254), las acciones (257), las gráficas nuevas (256).

## Done cuando

- [x] Con los datos de producción, Hoy contesta cada fila del reporte del 15-sep que el CRM ya sabe calcular (§2.3 de
  `docs/hub.md`); las que faltan muestran su lugar y el ticket que las trae (nota de cierre con la comparación).
- [x] Las cifras de Hoy son las mismas que las de su pestaña de origen, con test sobre las consultas (no se recalcula).
- [x] Recorrido en escritorio y 375 px, con clic en cada cifra; `npm run test:humo` en verde.

## Hecho (14-oct, Alejandro)

- **Hoy es siempre de hoy:** la página arma `armarVistaDelDashboard` con `periodo: { preset: "hoy" }` y sin closer,
  sin importar la URL, y en Hoy no se muestra el selector (en las demás pestañas sigue igual). Es la misma consulta de
  Comercial y Dinero con el periodo de hoy: nada se recalcula. Mismo criterio en `/hub` (todos).
- **`lib/queries/vista-hoy.ts`:** `contextoDelDia` y `horizontesDeCupos` (puras, sobre la vista) y `cajaDelDiaPorOrigen`
  (la `cajaRecaudada` de Dinero partida en "de ventas de hoy" con `vendidosEn`, y "completan ventas anteriores" como
  la diferencia, así que siempre suman la caja de Dinero). `components/dashboard/hoy.tsx` pinta los seis bloques;
  `Comparativo` de Operación se exporta y se reusa como "Hoy por closer". El Pulso (`pulso.tsx`) se borró: sus
  banderas y alertas viven en Hoy; Contratado (sin meta) se queda en Dinero. En `/hub`, una tabla "Hoy por programa"
  con el día de la cohorte, ventas contra la meta de hoy y el embudo, sin sumar entre programas (ADR 0048).
- **Tests:** `tests/vista-hoy.test.ts` (contexto con semana, fin de semana y cambio de año; horizontes sin base dan
  `null`, nunca cero; la caja por origen contra `cajaRecaudada` y la vista, con anulados y otro programa; las ventas
  del día son los cierres de Comercial). `tests/paginas.test.ts`: Hoy ignora el periodo y el closer de la URL, y el
  paid trafficker no recibe el comparativo.

### El reporte del 15-sep contra Hoy (§2.3 de `docs/hub.md`)

Leído en producción el 14-oct a las 9:20 (solo lecturas, con las mismas funciones que pinta Hoy, los tres programas
activos). El contexto calza con el ejemplo del ticket: TI "Semana: día 3 de 5 · Octubre: día 10 de 22 hábiles ·
Cohorte C3: día 13 de 32".

| Fila del reporte | En Hoy |
|---|---|
| Contexto: semana, mes y cohorte | ✅ línea de contexto |
| Cupos del día contra la meta dinámica | ✅ Cupos › Hoy (la venta abre su lista) |
| Semana: meta, real, cumplimiento | ✅ Cupos › Semana (compensación semanal, 146) |
| Cohorte: meta, vendidos, cumplimiento contra la lineal | ✅ Cupos › Cohorte |
| Mes: cupos y cumplimiento contra la lineal | ✅ Cupos › Mes, y las metas del mes con sus flechas debajo |
| Agendas, realizadas, show, ventas y % de cierre, por programa y por closer | ✅ La operación de hoy + Hoy por closer, cada cifra con su lista |
| Caja del día | ✅ por moneda, partida en ventas de hoy y ventas anteriores |
| Banderas rojas y alertas por persistencia | ✅ Lo que pide atención |
| Leads del día contra su meta; leads por día que hacen falta | ⏳ 253 (la meta de leads está vacía en las cohortes) |
| Proyección, ventas, agendas y leads requeridos por día | ⏳ 253, con su lugar en "Lo que viene" |
| Cómo nació cada cierre | ⏳ 254, con su lugar en "Lo que viene" |
| Planes de acción | ⏳ 257, con su lugar en "Lo que viene" |
| Leads de pauta del día | ⏳ 248 (Origen); no tiene meta, así que no entra a Hoy hasta que la tenga |
| Masivos y descartados | fuera (H-9) |

**Recorrido:** escritorio y 375 px en la base local con el developer y el paid trafficker, sin desborde horizontal ni
errores de consola; humo 6/6 (escritorio y celular, developer, closer y paid trafficker; la base local no tiene
gerente). Typecheck, lint, build y los tests del cambio en verde. Falta el checkpoint.

## Enmienda 19-oct: la vista de cumplimiento diario de Pauta

Anderson pidió (mensaje de Michael, 19-oct) una "vista de cumplimiento diario" y dijo que mandaría su artefacto de
cumplimiento de pauta contra comercial. Decidido con Mani: la vista es el 252 (Hub › Hoy) con el 124 (cumplimiento por
área); cuando llegue el artefacto, cada fila suya se mapea a una métrica de `docs/metricas.md` o se vuelve métrica
nueva, y se enmienda este ticket. **Bloqueado por ese insumo.** También falta cruzar el artifact de métricas que
mandó Daniel Tovar (19-oct) para pulir el Hub: no se pudo leer desde la sesión.
