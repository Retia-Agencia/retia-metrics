---
id: 299
etapa: hub
serves: "docs/hub.md O1, §2.3 · ADR 0086 punto 3 · los reportes diarios de Michael (1, 3, 9, 14 y 15-sep)"
depends: [252]
status: todo
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

- [ ] D1 a D4 decididas por Mani y escritas en `docs/metricas.md`, con cada fila del reporte mapeada.
- [ ] La vista de Hoy para una fecha dada cuadra, cifra por cifra, con la de "hoy" cuando la fecha es hoy, y con un
  cálculo hecho a mano para un día armado en el test (meta dinámica, semana, mes y cohorte como estaban ese día).
- [ ] La comparación contra el día real queda en la nota de cierre, con cada diferencia explicada.
- [ ] Si cambian tarjetas de Hoy: recorrido en escritorio y 375 px con clic en cada cifra, `npm run test:humo` en verde.
