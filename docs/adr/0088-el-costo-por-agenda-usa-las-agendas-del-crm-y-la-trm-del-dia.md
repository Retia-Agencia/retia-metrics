# 0088: El costo por agenda usa las agendas del CRM, Meta va al lado como control, y el dinero se cruza con la TRM de cada día

- **Estado:** aceptado, 14-oct-2026 (Mani, audit del Hub, `docs/hub.md` H-4 y H-5). Se construye en los tickets
  120, 123, 244 y 249. **Cierra la decisión A12** de `plan.md` §7.
- **Enmienda:** ADR 0063 punto 3 (la TRM de la cohorte, que la migración 0057 ya había quitado, pasa a ser la TRM
  de cada día), ADR 0062 punto 3 (además del gasto se guardan las agendas según Meta, por anuncio y día).
- **Confirma:** la regla dura "nunca convertir moneda en silencio" (se convierte, y la tasa va a la vista), ADR
  0060 (la agenda hereda el origen del envío que abrió su deal), ADR 0045 (sin gasto, "sin pauta", nunca $0).

## Contexto

- Meta cuenta las agendas con su pixel (`conversions` → `offsite_conversion.fb_pixel_custom.invitee_meeting_scheduled`)
  y el CRM con las citas reales de Calendly. En 30X difieren hasta 166%. En Retia, del 9 al 13-oct: TI 47 contra
  46, CA 51 contra 35 (preliminar). Con las del CRM, el costo por agenda de CA sale ~45% más caro.
- El ticket está en USD; el gasto, en COP, salvo dos cuentas de ComunicArte que están en USD. La migración 0057
  quitó `cohorts.trm_cohorte` y dejó abierta de dónde sale la tasa (A12).
- Mani, 14-oct: la TRM oficial, *"con cuidado: mostrar la tasa de cambio que se está usando en el momento en que
  se ven las métricas"*.

## Decisión

1. **El costo por agenda oficial divide el gasto de Paid entre las agendas del CRM de Paid** (por el envío que abrió
   el deal). Lo mismo por campaña, conjunto y anuncio.
2. **Las agendas según Meta se guardan por anuncio y día** junto al gasto, y se muestran al lado ("según Meta"),
   **nunca** en el costo oficial. La diferencia por campaña y semana cerrada es un **control**: menos de 10% es
   normal, de 10% a 40% se revisa, más de 40% es rojo (el runbook del vault). Una semana se compara cuando lleva
   al menos tres días cerrada.
3. **La TRM oficial de cada fecha se guarda** (una fila por fecha, con su fuente, por un solo escritor). Un día sin
   publicación usa la vigente ese día.
4. **El gasto se guarda en la moneda de su cuenta** y nunca se convierte al guardar. Al sumar dos monedas o al
   cruzar con ventas, **cada día se convierte con su propia TRM**.
5. **Toda cifra convertida dice la tasa que usó**: una fecha, "TRM 3.912 (13-oct)"; un rango, "TRM 3.880 a 3.950".
6. **Las unidades:** CPL y costo por agenda en COP; costo por venta en COP y en USD (propuesta, `docs/hub.md`
   HQ-7); ROAS = contratado de Paid en USD ÷ gasto de Paid en USD.

## Consecuencias

- El costo por agenda de un día reciente puede bajar cuando Calendly cuelga una llamada suelta: el Hub dice cuándo
  una cifra sigue "madurando", como las tasas del ADR 0079.
- El ROAS de un mes pasado no se mueve aunque el dólar se mueva hoy.
- El semáforo durante el día puede mirar las agendas según Meta como señal temprana, pero su color sale del costo
  oficial (ADR 0089).

## Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| Meta como cifra oficial, como 30X | hereda el retraso de atribución y una diferencia que en CA ya es de un tercio |
| Las dos cifras sin jerarquía | dos números para la misma pregunta: nadie sabe cuál decide |
| La TRM de hoy para todo | el ROAS de septiembre cambiaría cada día con el dólar |
| Una TRM fija por cohorte | se aleja del costo real si el dólar se mueve en las seis semanas de venta |
| No convertir | sin ROAS ni costo por venta en una sola cifra, que es lo que se pidió |
