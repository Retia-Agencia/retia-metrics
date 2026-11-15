---
id: 446
etapa: operacion
serves: "docs/estudio-rendimiento-y-conexion.md §11 · vercel logs --status-code 5xx, 8 al 14-nov"
depends: []
status: todo
---

# 446 — El cron de Calendly falla todos los días

## Qué
`GET /api/cron/calendly` responde 500 a diario (8 al 14-nov, 13:00 UTC) con
`TypeError: Cannot read properties of undefined (reading 'ownerUserId')`. No tiene relación con la conexión (435).

## Dónde mirar
`app/api/cron/calendly/route.ts` · `lib/calendly/emparejar-llamada.ts:140` (`const despues = host ?? deal.ownerUserId`)
y `:147`, `:149`: `deal` llega `undefined`. · `lib/calendly/escritura.ts:350` · `lib/calendly/reconciliar.ts`.

Hipótesis a comprobar, no a asumir: el cron recorre citas cuyo deal ya no está entre los candidatos (anulado, cerrado
o de otro programa) y el emparejador recibe una lista donde falta. Reproduce primero con `/diagnose`:
un test con una cita cuyo deal está anulado, otra con el deal en Completo y otra sin deal.

## Cómo
1. Test que falla con el mismo `TypeError` (rojo).
2. Arreglo en el punto donde nace el `undefined`, no un `?.` en la línea 140: si falta el deal, la cita queda suelta
   en el Inbox, que es lo que dice el contrato "Cuando una llamada de Calendly se cuelga de un deal" (ADR 0049).
3. El cron no se cae entero por una cita: procesa las demás y devuelve cuántas falló, con su razón.

## Done cuando
- [x] Test de regresión con los tres casos; verde (rojo con el mismo TypeError sin el arreglo, 14-nov).
- [x] Qué dejó de reconciliarse entre el 8 y el 14-nov (producción, solo lectura, 14-nov noche): casi nada. Llamadas de
      Calendly sueltas y vigentes hoy: 3 (Tactical 1 del 6-nov; Comunícate con Confianza 2, una del 20-oct y una de hoy
      14-nov 22:32, futura). Desde el 8-nov nacieron 114 llamadas ya colgadas de su deal (Tactical 85, Confianza 29,
      Comunicarte 42): el webhook hizo el trabajo y el cron era solo la red diaria. No hay nada que re-correr; las 3
      sueltas las toma el cron en su primera pasada con el arreglo, o un closer desde el Inbox.
- [ ] El cron responde 200 al día siguiente del despliegue (`vercel logs --query cron/calendly`).
- [x] Typecheck, lint, tests del cambio (77 verdes); tracker y `status:` iguales (siguen `todo`: faltan las dos casillas de producción).
