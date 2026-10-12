---
id: 232
etapa: llamadas
serves: "Michael/Andrea, 12-oct: 'La hora debe ser HH:MM' al marcar Terminó sobre una cita de Calendly (A-142)"
depends: [230]
status: done
---

# 232 — Marcar Show sobre una cita existente no pide ni valida hora

## Por qué existe

Andrea marcó "¿Cómo va la cita? · Terminó" sobre una cita de Calendly ya registrada y le salió **"La hora debe ser
HH:MM."**. Causa: `dialogo-mover.tsx` arranca la llamada con `{ dia: hoy, hora: "", linkGrain: "" }`; cuando el deal
ya tiene llamada no muestra el campo de hora, pero `responder-pregunta.tsx:181` igual manda `dia` y `hora: ""` junto
al `callId`. En el borde (`app/(app)/p/[programa]/deals/[id]/acciones.ts`, rama `atendido` de `esquemaHecho`) `hora`
es `hora.optional()`, y un `""` no es `undefined`: el regex lo rechaza. La hora de esa llamada ya la dio Calendly;
no hay nada que pedir.

## Qué se construye

- Borde: en la rama `atendido`, `dia` y `hora` vacíos cuentan como ausentes (`textoOpcional`, el mismo molde del
  link de Grain). La regla del `superRefine` no cambia: sin `callId` sí se exigen fecha y hora (es la llamada que se
  crea en ese momento).
- Cliente: con `callId` no se mandan `dia` ni `hora`. Revisar los demás llamadores de `moverConHechoAccion` con hecho
  `atendido` (Kanban, Calls) por el mismo patrón.

## Done cuando

- [x] Test del borde: `atendido` con `callId` y `hora: ""` pasa; sin `callId` y `hora: ""` da "Pon la fecha y la hora
      de la llamada.".
- [x] El 230 sigue en pie: una cita futura no se marca show.

## Anotaciones

A-142.
