---
id: 215
etapa: O8
serves: "A-120; ADR 0081 punto 7"
depends: []
status: done
---

# 215 — Retirar los intentos y la alerta de los tres intentos

## Por qué existe

Mani, 9-oct: *"nada de 3 intentos"*. No se usa y llena la Transición de un camino que nadie toma. El seguimiento
repetido se modela con varias anotaciones, cada una con su fecha (217).

## Alcance

- Nadie escribe más una actividad `intento`: se quita de `lib/deals/actividades.ts`, `lib/deals/actividad-mueve.ts`,
  `pregunta-de-etapa.ts` y `responder-pregunta.tsx` (En gestión: el "No" deja de anotar un intento).
- Se borra la alerta de los tres intentos: `lib/queries/intentos.ts`, su uso en `lib/queries/inbox.ts`,
  `lib/queries/ficha-deal.ts`, `components/deals/inbox-atencion.tsx` y la página del Inbox.
- El valor `intento` del enum **se queda** (Postgres no quita valores sin reescribir la tabla, y hay filas): las
  filas viejas se siguen mostrando en Actividades como "Intento". Comentario en `tipoActividadEnum`.
- Tests: se borran los de la alerta; uno nuevo comprueba que ninguna acción escribe `intento`.

## Done cuando

- [ ] Ningún camino de la app crea una actividad `intento` (guardián en el test).
- [ ] La alerta de tres intentos no sale en la ficha, el Inbox ni Mi espacio.
- [ ] Las actividades `intento` viejas se siguen viendo.
- [ ] Typecheck, lint y los tests tocados en verde.
