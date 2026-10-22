---
id: 285
etapa: pauta
serves: "Pauta ve a qué hora y qué día de la semana agenda la gente, en el cierre de medianoche y en el CRM, para repartir el presupuesto por franja (Anderson vía Michael, 19-oct)"
depends: [262, 269]
status: todo
---

# 285 — Agendas por hora y día de la semana

## Por qué

Michael (19-oct): *"mete en el cierre de medianoche y en el CRM la distribución de agendas por hora del día y por día
de la semana"*. El domingo 18-oct el costo por agenda pasó de ~$66.000 a ~$171.000 COP porque la gente llenaba el
formulario y no agendaba (César).

## Decidido con Mani (19-oct)

- **La hora es la de cuando la persona agendó** (`calls.createdAt`, la misma definición de "agenda" del 277), no la de
  la cita. Hora de Bogotá.
- **Ventana: los últimos 28 días.** Un solo día tiene muy pocas agendas para ver un patrón.

## Alcance

> **22-oct:** la dimensión `hora` y el mensaje con las horas exactas del día cerrado los hace el 298. Lo de aquí que
> va a WhatsApp (la línea de franjas de 28 días) va en ese mensaje de horas, no en el del semáforo.

- Dos dimensiones nuevas en `dimensionesDeFecha` (`lib/queries/hechos/fechas.ts`): `hora` (0 a 23) y `dia_semana`
  (lunes a domingo), en Bogotá. Las usa el hecho agenda; quedan disponibles para los demás.
- **CRM:** un mapa de calor hora × día por programa en Hub › Pauta, con el periodo elegible (28 días por defecto) y la
  lista detrás de cada celda.
- **Cierre de medianoche** (el mensaje de 0h del semáforo, 269): una línea por programa con las tres franjas y el día
  más fuertes de los últimos 28 días. No va un mapa en WhatsApp. Lo arma `armarMensaje`, así que la vista previa lo
  muestra igual.
- Se documenta en `docs/metricas.md`.

## Done cuando

El cierre de 0h trae la línea de franjas por programa y el mapa del CRM suma lo mismo que el conteo de agendas de esos
28 días.
