# 0109: La escalera de conversión: un escalón por deal, en una sola función

- **Estado:** aceptado · 28-oct-2026 (Mani, grill del plan de media; `docs/media/propuesta.md` §3.1).
- **Confirma:** ADR 0024 (una cifra, un módulo), ADR 0079 (las tasas van por deal), ADR 0026 y 0038 (lo anulado no
  cuenta), ADR 0037 (venta = deal en Abonado o Completo), regla de días hábiles de Retia.

## Contexto

No todas las llamadas enseñan lo mismo: la que paga en la llamada dice qué convence; la que paga tarde, qué objeción
hubo que resolver; la que no compra, qué no alcanzó. Todo lo de media (origen × escalón, insights ponderados) se lee
a través de esa jerarquía, así que tiene que tener **una** definición.

## Decisión

1. **El escalón es de cada deal**, no de la persona: todo envío abre deal (GC-27), así que "no agendó" también es un
   deal, y un lead retomado en otra cohorte cuenta cada intento.
2. **Siete escalones (enmendado el 28-oct, abajo), derivados de lo que el CRM ya registra**, en este orden de precedencia:

   | # | Escalón | Regla |
   |---|---|---|
   | 1 | Pagó en la llamada | primer abono vigente el mismo día (Bogotá) de la última cita atendida anterior a él |
   | 2 | Pagó rápido | primer abono hasta `corte_pago_rapido` días hábiles después de esa cita |
   | 3 | Pagó después | primer abono más tarde que el corte |
   | 4 | Pagó sin llamada registrada | venta sin una cita atendida anterior o igual al primer abono (enmienda del 28-oct) |
   | 5 | Atendió y no compró | alguna cita atendida, sin venta |
   | 6 | Agendó y no se presentó | alguna cita **vencida sin atender** (su hora ya pasó y terminó en no show o cancelada), ninguna atendida, sin venta |
   | 7 | Dejó datos y sin cita ocurrida | ninguna cita atendida ni vencida, sin venta (incluye al que solo tiene citas pendientes) |

3. **El corte es un dato del programa** (`programs.corte_pago_rapido_dias`, días hábiles, editable en Programa, lo
   llena gerencia). **Nulo no se inventa:** la escalera junta 2 y 3 en "pagó después" y la pantalla lo dice.
4. **Una sola función**, `escaleraDeDeals` en `lib/queries/escalera.ts`, sobre la capa de hechos (contrato C-2):
   devuelve el escalón de cada deal y agrega por cualquier dimensión de la lista blanca. Toda vista (Hub, media,
   insights ponderados) la importa; ninguna recalcula un escalón. Pasa por `vigente()` en `calls`, `deals` y
   `abonos`.
5. **El escalón se calcula al leer, nunca se guarda:** un deal en el escalón 4 sube al 3 el día que paga, y el
   insight de su llamada pesa distinto desde ese momento.
6. **Se valida antes de mostrarse:** el ticket 319 mide con datos de producción si "mismo día de la cita" representa
   de verdad "pagó en la llamada". Si no cuadra, se pide la marca a la closer y este ADR se enmienda.

## Enmienda del 28-oct-2026: «Pagó sin llamada registrada» (medición del ticket 319)

La medición en producción encontró que 25 de las 52 ventas históricas (18 de 32 en comunicarte, 7 de 18 en tactical)
no tienen **ninguna** llamada en su deal: 20 vienen de la migración de las hojas (traen el deal y los abonos, no las
llamadas) y 5 se crearon a mano sin pasar por una cita. No hay contra qué medir «mismo día» ni días hábiles, y
meterlas en «Pagó después» lo habría inflado con ventas que no son un seguimiento. Mani decidió un escalón aparte
(28-oct). Las ventas del periodo son ahora los escalones **1 a 4**, y los medibles son 1 a 3; los deals sin venta
pasan a ser 5 a 7. Un abono sin llamada atendida registrada antes aparece en el escalón 4 aunque el deal tenga
llamadas posteriores. Una venta **sin abono vigente de ticket** (sin fecha de pago) cae también en el escalón 4, aunque tenga llamadas atendidas: sin fecha de pago no hay cita anterior contra la cual medir. Si el closer carga después la llamada, el deal sube solo de escalón (punto 5).

## Enmienda del 28-oct-2026: las citas pendientes no cuentan (Mani)

Una cita que no ha sucedido no es una cita no presentada. Son **pendientes** y no cuentan para el escalón 6: la cita
futura, la agendada cuya hora ya pasó pero sigue sin resultado (queda pendiente de resultado, igual que fuera del
grupo del % de show, ADR 0079) y la reagendada (la representa su cita nueva). Solo cuenta como no presentada una cita
cuya hora ya pasó y cuyo resultado es de llamada fallida (`RESULTADOS_FALLIDOS`: no show o cancelada).

Un deal cuyas únicas citas son pendientes cae en el escalón **7**, que ya existía: la escalera mide lo que ocurrió, y
ese deal todavía no ha pasado de dejar sus datos. Se ajustó su nombre a «Dejó datos y sin cita ocurrida», porque
«no agendó» sería falso para quien tiene una cita futura. No se creó un escalón nuevo: cuando la cita sucede, el
deal sube solo al 5 o al 6 (punto 5). Una cita pendiente junto a una atendida o vencida no cambia el escalón.

## Enmienda del 28-oct-2026: todos los programas (Mani)

En el Hub de todos los programas la escalera se muestra **por programa, lado a lado**, con su número y su %, y cada
cifra abre la lista de su programa. No hay total ni % combinado: el % es una `Tasa` y las funciones de suma de
`agregado-programas.ts` no la aceptan (ADR 0048).

## Por qué

Por deal calza con las tasas del ADR 0079 y no mezcla cohortes. El corte por programa porque Tactical y ComunicArte
tienen ciclos distintos. Contar toques de seguimiento dependía de que cada closer registre cada toque.

## Consecuencias

- Test de la regla en los dos sentidos por escalón, con abonos y citas anuladas, y uno que compara la suma de
  escalones 1 a 4 contra las ventas del Hub en el mismo periodo (deben cuadrar).
- `docs/metricas.md` gana la escalera en el mismo commit que la función.
