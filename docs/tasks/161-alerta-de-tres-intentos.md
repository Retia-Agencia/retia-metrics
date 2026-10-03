---
id: 161
etapa: O2
serves: "ADR 0071 punto 4"
depends: [128, 142]
status: done
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

## Cierre 2-oct (Codex implementa, Claude revisa)

- **El conteo vive en un módulo:** `intentosEnEtapaPorDeal` en `lib/queries/intentos.ts` (ADR 0024), con
  `INTENTOS_PARA_ALERTA = 3` (`ponytail:` un valor para todos los programas; si uno necesita otro, columna en
  `programs`). La entrada a la etapa es el último movimiento de `deal_etapa_historial` con `a` = etapa actual y
  `de <> a`: **cambiar solo el pendiente no reinicia el conteo**; sin movimiento, el `created_at` del deal.
- **Inbox:** motivo nuevo `intentos_agotados`, después de re-envío sin atender y antes de link sin cita. La ficha
  lo muestra en rojo porque `alertasDelDeal` ya lee el Inbox (128), sin segunda regla.
- **Las dos salidas son a mano:** la alerta las nombra ("Cierre perdido con motivo o sigue intentando") y no
  agrega botones ni mueve nada (ADR 0037). Seguir intentando deja la alerta mientras el deal siga en la etapa.
- **"Un intento anulado no cuenta" se cumple solo a medias:** `deal_actividades` no tiene `anulado_en` (anular una
  actividad pide migración, fuera de este ticket). La consulta ya pasa por `vigente(dealActividades)`, así que
  respetará la anulación el día que exista la columna.
- Manual: se quitó "cuéntalos en el log" y el tip de En gestión dice que la ficha y el Inbox avisan.
- Tests: `tests/intentos.test.ts` (nuevo), `tests/inbox.test.ts` y `tests/alertas-del-deal.test.ts`, 43/43 en la
  corrida de Codex. Nivel 1 de la sesión: typecheck y lint en verde, `npm run build` en verde; los tests no se
  corrieron otra vez en local porque la máquina tenía 7,3 GB de swap: los valida el checkpoint.
- Recorrido en `dev:local` (`app161.localhost:31161`), como closer: con 2 intentos no hay alerta; registrar el
  tercero desde la ficha la pinta en rojo sin recargar, y el Inbox muestra la fila con su texto. Consola limpia.
