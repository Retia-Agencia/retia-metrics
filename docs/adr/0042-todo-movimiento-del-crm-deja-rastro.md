# 0042 — Todo movimiento del CRM deja rastro, y el rastro se escribe desde el día uno

**Fecha:** 2026-09-21 · **Reescrito:** 2026-09-27 (implementado el 22-sep; la alternativa de triggers
se reabrió con el ADR 0047) · **Estado:** aceptado

Mani, 21-sep: *"modificar la info de un Deal se puede hacer cuando sea necesario (para asegurar
integridad, todo movimiento en el CRM debe quedar en logs en Nerd Stats, trackeado, eso puede ser de
lo último que configuramos)"*.

## Decidimos

**1. Un deal se edita.** Producto, cohorte, dueño, fechas y motivo se corrigen cuando haga falta. Si
editar fuera imposible, anular sería el único remedio para un dato mal puesto y terminaría usándose
para todo (ADR 0038). Lo que **no** se edita a mano es la etapa (solo `moverEtapa()`, ADR 0037).

**2. Toda escritura del CRM deja fila con quién, cuándo y qué cambió**, sobre `deals`, `calls`,
`abonos` y `deal_actividades`, además del catálogo (ADR 0012).

- La escritura y su fila de `change_log` van **en la misma operación**: `crearConRastro` y
  `editarConRastro` en `lib/crm/rastro.ts`. No hay que acordarse de registrar.
- En una edición se guardan **los campos tocados, una fila por campo**, con el valor anterior y el
  nuevo. Si nada cambió no se escribe nada: un update vacío no es un hecho.
- El **quién** sale de la sesión, nunca del input; desde un script, de `actorDelScript()` (ADR 0029).
- `tests/rastro-operativo.test.ts` recorre `lib/`, `app/`, `components/` y `scripts/` y falla si
  aparece una escritura sobre esas tablas fuera de la función que registra, mordido en los dos
  sentidos.
- **El movimiento de etapa no va a `change_log`:** tiene su propia tabla, `deal_etapa_historial`,
  porque es el hecho del que salen la conversión y el tiempo en etapa.

**3. Lo que va de último es la PANTALLA** (la bitácora en Nerd Stats, ticket 076), **no el rastro.**
Si el rastro se retrofitea al final, todo lo escrito antes no tiene historia y no hay manera honesta
de fabricarla: un historial de auditoría fabricado se ve idéntico al de verdad.

## Abierto

🔴 **R2: que el rastro lo garantice la base con triggers** en vez de un guardián por regex. Se descartó
porque con `neon-http` el trigger no sabía quién escribía; con las transacciones reales del ADR 0047,
`SET LOCAL app.user_id` lo resuelve. El guardián de hoy no ve alias de tabla ni `.delete(`. Decide
Mani (`docs/plan.md` §7).
