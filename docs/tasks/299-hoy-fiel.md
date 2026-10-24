---
id: 299
etapa: hub
serves: "docs/hub.md O1, §2.3 · ADR 0086 punto 3 · los reportes diarios de Michael (1, 3, 9, 14 y 15-sep)"
depends: [252]
status: done
---

# 299 — Hoy fiel: las cifras del reporte diario, definidas y comprobadas contra un día conocido

## Por qué

El 252 puso en Hub › Hoy la estructura del reporte de septiembre, pero nadie ha comprobado que las cifras digan lo
mismo que el reporte: Hoy solo se puede ver con la fecha de hoy y ningún día ya conocido se contrastó. Hay además una
diferencia de definición medida (Mani y la sesión principal, 23-oct):

- **"Agendas" no es lo mismo.** En el reporte, "Agendas reales" son las **citas que caían ese día** (15-sep, Tactical:
  11 agendas, 5 realizadas, 45% de show = 5 ÷ 11). En Hoy, "Agendas de hoy" es `embudo.agendas`, las llamadas
  **creadas** hoy (`docs/metricas.md` §1.2), y el % de show va por deal sobre las citas ya ocurridas (§3.1, ADR 0079).
  Las dos tarjetas están una al lado de la otra y miden universos distintos sin decirlo.
- **Los leads del día no aparecen.** El reporte siempre los traía (meta, real, cumplimiento por programa); Hoy los dejó
  para el 253 porque `cohorts.meta_leads_dia` está vacía.

Mani (23-oct): "Hoy fiel es prioridad, y definir las métricas que muestra según el reporte". Este ticket va antes del
253, el 254, el 257 y el 300, porque todos construyen encima de estas cifras.

## Objetivo

Que cada cifra de Hoy tenga una definición escrita en `docs/metricas.md`, que corresponda a una fila del reporte de
Michael (o diga por qué no), y que esté comprobada contra un día real.

## Alcance

1. **Hoy acepta una fecha.** `armarVistaDelDashboard` y `lib/queries/vista-hoy.ts` reciben el día de referencia
   ("hoy" por defecto, en Bogotá): el contexto, la meta dinámica, la semana, el mes y la cohorte se calculan **como se
   veían al cierre de ese día**, no contra la fecha de hoy. Es la pieza que hace posibles la comprobación de este ticket
   y la foto del 300; la pantalla sigue mostrando solo hoy (el 300 decide si se navega a días pasados).
2. **El catálogo de Hoy contra el reporte.** Una tabla en `docs/metricas.md` (sección nueva, "Hub › Hoy") con cada
   fila del reporte del 15-sep y del 9-sep: la cifra de Hoy que la responde, su función, su fecha (creada, de la cita,
   del abono) y su universo. Donde no hay cifra, el ticket que la trae (253, 254, 257) o "fuera" con la razón (masivos
   y cola: H-9).
3. **Decidir con Mani, antes de tocar código** (cada una queda en el catálogo):
   - **D1. Agendas del día:** ¿Hoy muestra las citas del día (lo que contaba el reporte) en vez de, o además de, las
     agendas creadas hoy? Propuesta: la tarjeta de la operación pasa a "Citas de hoy" (§1.3) con realizadas y show
     sobre ellas, como el reporte; las agendas creadas se quedan en Pauta, donde alimentan el costo por agenda.
   - **D2. % de show:** por cita (el reporte: realizadas ÷ citas del día) o por deal (ADR 0079, lo de hoy). Propuesta:
     por deal, porque es la definición de todo el CRM, con la cuenta de citas al lado para que se lea igual que el
     reporte. Si Mani elige por cita, se enmienda el ADR 0079 y no se crea una segunda fórmula.
   - **D3. Leads del día:** registros del día (§1.1) por programa, sin meta hasta el 253 (la tarjeta lo dice). Choca con
     "cada cifra de Hoy tiene meta" (ADR 0086 punto 3): se acepta como excepción temporal o espera al 253.
   - **D4. Caja del día:** el reporte la daba en USD con los nombres; Hoy la da por moneda con su lista. Confirmar que
     alcanza.
4. **La comprobación.** Antes de elegir el día, medir qué tiene el CRM de septiembre: los leads entraron por el traslado,
   pero las llamadas y los abonos de antes del 22-sep pueden no estar. Si el 15-sep tiene llamadas y abonos, se compara
   contra el PDF (TI: 45 leads, 11 agendas, 5 realizadas, 1 venta; ComunicArte: 30, 6, 2, 1; caja USD 2.897; cohorte 22
   y 23). Si no, se compara un día reciente contra lo que cuentan las closers y Calendly ese día. Solo lecturas en
   producción, con las mismas funciones que pinta Hoy. Cada diferencia se explica (dato faltante, definición distinta o
   bug); un bug se arregla aquí si es pequeño o abre ticket.

## Fuera

- La proyección y los requeridos (253), el origen del cierre (254), las acciones (257), la vista imprimible y las fotos
  (300).
- El texto narrativo del reporte ("Andrea, 9 agendas: 1 cierre, 2 no-show..."): lo da la lista de cada cifra.

## Done cuando

- [x] D1 a D4 decididas por Mani y escritas en `docs/metricas.md`, con cada fila del reporte mapeada.
- [x] La vista de Hoy para una fecha dada cuadra, cifra por cifra, con la de "hoy" cuando la fecha es hoy, y con un
  cálculo hecho a mano para un día armado en el test (meta dinámica, semana, mes y cohorte como estaban ese día).
- [x] La comparación contra el día real queda en la nota de cierre, con cada diferencia explicada.
- [x] Si cambian tarjetas de Hoy: recorrido en escritorio y 375 px con clic en cada cifra, `npm run test:humo` en verde.

## Hecho (23-oct)

**Decisiones de Mani**, escritas en `docs/metricas.md` §3.5 con cada fila del reporte mapeada:

- D1: dos tarjetas rotuladas, "Agendas creadas hoy" y "Citas de hoy".
- D2: % de show por deal, con "X de Y deals con cita ocurrida · N reagendadas (no cuentan)".
- D3: "Leads de hoy" son registros (envíos completos) sin meta hasta el 253.
- D4: la caja como estaba.
- Meta del día: descuenta las ventas de hoy (todo dinámico según el CRM).

**La premisa de "Agendas" estaba al revés.** La tarjeta "Agendas de hoy" del 252 ya contaba citas por la fecha de
la cita (`filtroLlamadas` usa `fechaAnclaCall`), no llamadas creadas. La fila "Agendas" de `docs/metricas.md` §3.1
decía lo contrario y se corrigió: ahora son dos filas, Agendas creadas (`hechos/agenda.ts`, Pauta) y Citas
(`embudoDelRango`).

**Código:**

- `armarVistaDeHoy({ programId, dia })` en `lib/queries/vista-hoy.ts`. Con un día pasado, el corte es las
  23:59:59.999 −05:00.
- `vistaDeCohorteActiva` cuenta las ventas de la cohorte hasta el día. Antes contaba todas, sin fecha: un día
  pasado habría mostrado ventas posteriores.
- `leerMetasDelMes` descarta las ventas posteriores al día.
- `EmbudoDelRango.reagendadas` es un campo nuevo.
- Lista nueva `registros` en `metricas-con-filas.ts`.
- La pantalla sigue mostrando solo hoy; el 300 decide si se navega.

**Tests:** `tests/vista-hoy.test.ts`.

- Con la fecha de hoy, la vista es la misma que la de antes.
- Un día armado (cohorte de 10, ventas el día anterior, el día y el siguiente) da vendidos 2, meta dinámica 8/3,
  semana 2, mes 2 y el contexto literal, todo calculado a mano.
- Las reagendadas anuladas no cuentan.
- Agendas creadas y registros cuadran con su lista.

**El día comparado.** El 15-sep no se pudo comparar: el CRM no tiene llamadas antes del 29-sep (las de septiembre
vivían en las hojas, y el traslado solo pasó leads y algunos abonos). Se comparó el **22-oct** contra Calendly y
Typeform, con `armarVistaDeHoy` y solo lecturas en producción (23-oct, 9 a.m.):

| Cifra | ComunicArte | Tactical | Confianza | Fuente externa | Diferencia |
|---|---|---|---|---|---|
| Contexto | semana 4/5 · mes 16/22 · C3 19/35 | semana 4/5 · mes 16/22 · C3 19/32 | semana 4/5 · mes 16/22 · C1 14/25 | calendario | ninguna |
| Leads de hoy (registros) | 35 | 50 | 23 | Typeform: 35 / 50 / 23 completas | ninguna |
| Agendas creadas | 9 | 19 | 6 | Calendly: 9 / 20 / 7 | TI y Confianza: 1 cita creada y cancelada ese mismo día en Calendly que nunca llegó como llamada al CRM |
| Citas de hoy | 24 | 12 | 13 | Calendly: 24 activas + 1 cancelada / 11 + 2 / 12 + 2 | cada cita activa de Calendly está en el CRM, cruzada por invitado; falta 1 cancelada por programa, la misma familia de arriba |
| Realizadas | 2 | 1 | 2 | reporte de las closers (no disponible) | **dato faltante:** al día siguiente, 22 de 24 citas de CA y 10 de 12 de TI siguen sin resultado |
| % de show por deal | 2 de 23 | 1 de 12 | 2 de 12 | · | sale bajo por el dato faltante: una cita ocurrida sin resultado cuenta como deal sin show |
| Ventas · meta del día | 2 · 1,29 | 1 · 2,36 | 0 · 4 | · | la meta ya descuenta las ventas del día (decisión) |
| Cohorte | 28 de 50 | 17 de 50 | 2 de 50 | · | · |
| Caja | USD 800 | USD 1.500 | 0 | · | sin fuente externa en esta comparación |

**Lo que deja la comparación:** las cifras que dependen del CRM y de sus fuentes cuadran con Typeform y Calendly. Lo
que no cuadra con la realidad es el resultado de las llamadas: las closers no lo registran el mismo día. La bandera
"Llamadas pasadas sin resultado" de Hoy ya lo muestra. Mientras no lo registren, el % de show de Hoy mide
disciplina de registro, no asistencia. Bug no hay; la cancelada sin llamada queda como observación, sin causa
verificada.

**Recorrido:** escritorio y 375 px en la base local (developer), clic en las cinco cifras de la operación y en la lista nueva de registros, sin desborde horizontal; `npm run test:humo` 8/8 en verde (23 min). Typecheck, lint y los tests del cambio en verde. Falta el checkpoint del CI.

## Enmienda 24-oct: también el % de show por cita (Mani)

Mani pidió las dos tasas en Hoy ("poner ambas métricas no cuesta nada"), así que D2 queda: **% por deal (ADR 0079) y
% por cita al lado**. El por cita es otra pregunta (citas del día que ocurrieron ÷ citas del día que ya debían ocurrir
al corte), con su función `showPorCitaDelRango` (`lib/queries/tasa-show-por-cita.ts`) y su lista `citas_debidas`, que
cuadra con la cifra (`tests/show-por-cita.test.ts`). `055f07fe`. El ADR 0079 no cambia: ninguna otra tasa del CRM pasa
a contar por cita. Fila nueva en `docs/metricas.md` §3.1.
