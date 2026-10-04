# 0079: Las tasas del embudo comercial se cuentan sobre el mismo grupo de personas

- **Estado:** aceptado, 4-oct-2026 (Mani). Se construye en el ticket 187.
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
   ya ocurrida cuya fecha cae en el rango. Una cita futura es agenda, no resultado, y no entra.
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

## Consecuencias

- Ninguna tasa de la cadena puede pasar de 100%, y la del closer se explica con su propia lista.
- El número de una semana pasada puede subir días después. Es lo esperado y la pantalla lo anuncia.
- `overview.md` §7 y `analytics.md` §6 se corrigen para decir esta definición.
