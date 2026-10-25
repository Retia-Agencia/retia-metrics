# 0079: Las tasas del embudo comercial se cuentan sobre el mismo grupo de personas

- **Estado:** aceptado, 4-oct-2026 (Mani). Se construye en el ticket 187. **Enmendado el 24-oct-2026 (Mani):** una
  cita ocurrida sin resultado queda fuera del grupo hasta que lo tenga (puntos 1 y 8), y la Proyección del 253
  usa la cadena con el show (punto 9).
- **Enmienda:** `overview.md` §7 (% de show y % de cierre), que no decía de quiénes se contaba cada lado.
- **Confirma:** la regla dura de `AGENTS.md` (toda tasa se calcula sobre personas, nunca sobre filas) y el ADR 0067
  (toda cifra abre la lista que la produjo).

## Contexto

El % de cierre dividía las ventas con fecha de venta en el rango entre los shows con fecha de llamada en el rango.
Son dos grupos distintos: quien entró a la llamada la semana pasada y compró hoy está arriba y no abajo. Por eso la
tasa podía pasar de 100%. Por closer era peor: las ventas iban al dueño del deal y los shows a quien tomó la
llamada. Una cifra así se ve creíble y miente sin lanzar un error (lo detectó la sesión M1 en el 148).

Mani, 4-oct: *"tiene que ser sobre el mismo grupo de personas, una métrica real y confiable a lo que dice y
muestra"*, y el % de cierre de un closer es *"sobre las llamadas que hizo show"*.

## Decisión

1. **El grupo es la cohorte de citas del rango.** Son los deals del programa (vigentes) con al menos una cita
   ya ocurrida **y con resultado** (show, cerrada, no show o cancelada) cuya fecha cae en el rango. Una cita futura
   es agenda, no resultado, y no entra. Una cita ocurrida que sigue en `agendada` tampoco: nadie registró qué pasó,
   y contarla como no show es inventar un resultado (enmienda del 24-oct, punto 8).
2. **Se cuenta por deal (persona), no por llamada.** Un deal que no llegó, re-agendó y luego sí llegó cuenta una
   vez, como show.
3. **La cadena, toda sobre ese grupo:**
   - **% de show** = deals del grupo con al menos un show ÷ deals del grupo.
   - **% de cierre** = deals con show que hoy están vendidos (Ganado Pago Parcial o Pagado Completo, sin
     cortesías, vigentes) ÷ deals con show.
   - **Agenda → venta** = deals del grupo vendidos ÷ deals del grupo.
   - Como el grupo es el mismo, **% de show × % de cierre = agenda → venta**, y un test lo exige.
4. **Por closer, el grupo es el de sus shows:** los deals donde ese closer tomó la llamada con show
   (`calls.closer_user_id`, la última con show del rango si hubo varias). Su % de cierre es cuántos de esos están
   vendidos hoy. No hay mezcla con el dueño del deal.
5. **La venta cuenta hasta hoy, sin importar su fecha.** Por eso el grupo de un rango reciente sigue creciendo
   mientras la gente compra. La pantalla lo dice ("aún madurando") cuando el rango termina hace menos de 30 días.
6. **Las cantidades no cambian:** el número de ventas, la caja y el contratado siguen contándose por su fecha
   (de venta y de abono). Esas son cantidades del periodo, no tasas.
7. **Una sola definición.** El grupo y la cadena viven en un módulo de `lib/queries/`, y lo importan el dashboard,
   el comparativo entre closers, Mi espacio y la lista de cada cifra.
8. **Las citas sin resultado se cuentan aparte, a la vista (24-oct).** Un deal cuyas citas ocurridas del rango
   siguen todas en `agendada` es **pendiente de resultado**: no entra al grupo ni a ninguna tasa, y toda pantalla que
   muestra % de show, % de cierre o agenda → venta dice al lado cuántos hay, con su lista (ADR 0067). Si el deal
   tiene alguna cita con resultado, esa decide y las `agendada` se ignoran. Por closer, el pendiente es de quien
   tiene la cita. Cuando se registra el resultado, el deal entra solo al grupo, como entra una venta tardía (punto 5).
9. **La Proyección (253) va por el show.** Ventas por día ÷ % de cierre = shows por día; shows ÷ % de show =
   agendas por día; agendas ÷ agendas por registro = leads por día. Las dos tasas salen del **mismo** grupo (la
   cohorte anterior si alcanza la muestra, si no la cohorte en curso), así que su producto sigue siendo agenda →
   venta y la cifra de agendas no cambia por pasar por el show: lo que gana es que se vea en qué paso se pierde.
   Cada tasa pide al menos 20 en su denominador (personas del grupo para el % de show, shows para el % de cierre) y
   el % de cierre alguna venta. Un objetivo declarado de agenda → venta, si existe, sigue mandando sobre las
   agendas; los shows salen entonces de agendas × % de show medido, o "—" con su razón.

## Consecuencias

- Ninguna tasa de la cadena puede pasar de 100%, y la del closer se explica con su propia lista.
- El número de una semana pasada puede subir días después. Es lo esperado y la pantalla lo anuncia.
- `overview.md` §7 y `analytics.md` §6 se corrigen para decir esta definición.
- **Por la enmienda del 24-oct**, las tasas suben cuando hay citas sin registrar (en Tactical C3, el 24-oct, 221 de
  288 deals estaban en `agendada` con la cita ya pasada y el % de show daba 11%). El hueco ya no se esconde dentro de
  la tasa: aparece como un conteo de pendientes, que es un problema de registro de los closers y no de conversión.
  `docs/metricas.md` se actualiza en el mismo commit.
