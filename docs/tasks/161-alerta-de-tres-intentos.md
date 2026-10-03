---
id: 161
etapa: O2
serves: "ADR 0071 punto 4"
depends: [128, 142]
status: todo
---

# 161 — La alerta "agotó intentos"

## Por qué existe

El ADR 0071 (punto 4): cada intento de contacto fallido en En gestión, o tras un no-show, queda como actividad, y
al tercero el deal sale con una **alerta roja "agotó intentos"**; una persona decide perderlo con motivo o seguir.
El esquema ya prevé el tipo de actividad `intento` (`lib/db/schema.ts`), pero **la alerta no existe** en
`lib/queries/inbox.ts` ni en las alertas del deal (128). El manual de operación comercial le dice al closer
"cuéntalos en el log".

## Alcance

1. Contar los intentos fallidos vigentes del deal desde que entró a su etapa actual (calculado al leer, ADR 0024).
2. Al tercero, alerta roja en la ficha y en el Inbox ("lo mío que necesita atención"), con las dos salidas a mano:
   Cierre perdido con motivo, o seguir.
3. Nunca mueve el deal solo (ADR 0037: no hay relojes).

## Done cuando

- Con 2 intentos no hay alerta; con 3 sí, en la ficha y en el Inbox; un intento anulado no cuenta.
- Al mover el deal de etapa el conteo vuelve a empezar.
- El manual de operación comercial quita "cuéntalos en el log".
