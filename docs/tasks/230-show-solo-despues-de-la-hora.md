---
id: 230
etapa: llamadas
serves: "Mani, 12-oct: no se puede marcar show una llamada que aún no ha pasado"
depends: []
status: done
---

# 230 — Una llamada solo es show cuando su hora ya pasó

## Por qué existe

Hoy un closer puede marcar como show (o "Terminó" en Agendado) una cita de mañana, y el deal pasa a Atendido.
`marcarShow` (`lib/deals/llamadas.ts`) solo revisa `resultado = 'agendada'`; `darPorAtendida` (E8 a mano,
`lib/deals/mover-etapa.ts`) tampoco mira la hora. Una llamada que no ha ocurrido contada como atendida infla las
atendidas y la tasa de cierre sin lanzar un error.

## Qué se construye

- UNA regla en `lib/deals/`: "¿esta llamada ya pudo ocurrir?" = `fecha_agenda` no nula y `fecha_agenda <= ahora`
  (instante, no día de Bogotá). La usan `marcarShow`, `pegarGrain` y E8 a mano (`darPorAtendida`).
- Si la hora no ha llegado: 409 con "La llamada es el <fecha y hora de Bogotá>: todavía no se puede marcar como
  atendida." La base no se mueve.
- En pantalla (ficha, Calls, Kanban y el diálogo de Mover), el botón de show/Terminó sale deshabilitado con ese
  mismo texto antes de la hora. El dato llega por props desde el servidor; ningún cliente importa `lib/db`.
- El no-show y la cancelación NO cambian: Calendly puede cancelar antes de la hora.

## Done cuando

- [ ] Test: show, Grain y E8 manual sobre una cita futura se rechazan sin escribir nada; la misma cita con la hora
      pasada sí mueve a Atendido.
- [ ] Recorrido en base local: el botón sale deshabilitado con el texto y se habilita después de la hora.
