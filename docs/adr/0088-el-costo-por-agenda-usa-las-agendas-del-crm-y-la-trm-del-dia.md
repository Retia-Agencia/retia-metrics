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

---

## Enmienda 16-oct-2026 (Mani): en el semáforo, el costo por agenda divide por las agendas de Meta

Cambia el punto 1 **solo para el semáforo** (258, 260) y la consecuencia del último punto ("su color sale del costo
oficial"). El Hub y el diccionario de métricas siguen con las agendas del CRM hasta que se decida otra cosa.

1. **El color del semáforo sale de gasto ÷ agendas según Meta** (`agendas_meta` de las fotos durante el día y de
   `gasto_pauta` para un día cerrado). Las agendas del CRM de Paid van al lado, en la misma línea.
2. **Por qué:** el equipo de pauta (Michael, Ander) mide y decide con las agendas de Meta desde sus Excel, y el umbral
   que cargaron está pensado sobre ese número. El 16-oct el semáforo dividía por el CRM y el Excel por Meta: la misma
   pauta salía en colores distintos (TI 14-oct: 70 mil en el Excel, 92 mil en el CRM) y la discusión se fue a "¿cuál
   número es real?". Medido ese día: el gasto cuadra con el Excel peso a peso; lo que difiere es el denominador.
3. **Lo que no se pierde:** la diferencia Meta contra CRM sigue siendo el control del punto 2 (ticket 249), y el
   mensaje lo dice al final: qué cuenta cada número y que el color sale de Meta.
4. **Riesgo aceptado:** Meta subreporta o sobrereporta según el pixel (en 30X, hasta 166% contra los formularios). Si
   el control del 249 muestra una diferencia sostenida de más de 40%, esta enmienda se revisa.
5. **Sin agendas según Meta** (una cuenta sin el evento del pixel, `agendas_meta` nulo), el semáforo dice "Meta no
   reporta agendas" y no pinta color: nunca cae en silencio al número del CRM.
