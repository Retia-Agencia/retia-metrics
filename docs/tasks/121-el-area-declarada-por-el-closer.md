---
id: 121
etapa: E6
serves: "ADR 0062 punto 5 · docs/analytics.md PT-20, PT-21, PT-23"
depends: [083]
status: done
---

# 121 — El área declarada por el closer al cerrar

## Objetivo

Tener lo que dice el comercial ("¿cómo nos conociste?") para las ventas que llegan sin UTM, sin mezclarlo
nunca con el UTM.

## Alcance

- **Dentro:** `deals.area_declarada_id`, FK a `areas`, nula (migración de la sesión principal).
- **Dentro:** requisito del motor (ADR 0056, 044): entrar a Compromiso Verbal, Abonado o Completo exige el
  área declarada si el deal no la tiene. Un select de un clic en "¿Cómo terminó?", en el registro del abono
  y en la Ficha del Deal.
- **Dentro:** los deals históricos (ADR 0059) quedan exentos; si al corte las pestañas de gestión traen la
  columna "origen del deal" (tarea O-4 de `docs/analytics.md` §7), el importador del 078 la lleva a este
  campo.
- **Dentro:** la consulta de la burbuja "sin UTM · según el comercial": ventas sin UTM por área declarada.
- **Fuera:** cualquier métrica de atribución que la use: salen del UTM.

## Done cuando

- [x] Llevar un deal a Abonado sin área declarada lo rechaza el motor con el requisito a la vista, con test.
- [x] Una venta con UTM y área declarada distinta cuenta en su área por UTM, con test.
- [x] La acción forjada desde otro programa recibe 403.

## Kiro

Sí, con revisión visual.

---

## Cierre 2026-09-30 (Mani)

Implementó Codex; revisó y ajustó Claude. Migración **0049** (`deals.area_declarada_id`, FK `restrict` a `areas`,
con `lock_timeout`) aplicada en producción con el ok de Mani: ref y `pg_stat_activity` revisados, 134 deals
intactos con el área vacía. Iba a ser la 0048, pero el 116 de Alejo la tomó mientras tanto: la rama se rehízo
encima y se regeneró.

**Qué quedó:**
- `lib/deals/requisitos.ts`: requisito `area_declarada` en T4, T12, T25, T5, T13, T14, T16, T17, T26 y T18 (toda
  flecha que entra a 6, 7 u 8). **No** en A1 ni A2: son reversas por anular un abono. Un deal con
  `huella_migracion` (ADR 0059) queda exento.
- El área viaja en la misma transacción del movimiento: `DatosMovimiento.areaDeclaradaId` (`moverEtapa`), el
  primer abono (`registrarAbono`: si falta, el abono entero se deshace) y `editarDeal`. Se valida en UN lugar,
  `exigirAreaActiva` (`lib/catalogo/areas.ts`), por el molde.
- `lib/catalogo/areas.ts`: `deals.area_declarada_id` cuenta como referencia en `borrarSiNoSeUso`. Sin eso, un área
  usada solo por deals contaba cero y el borrado chocaba con la FK en vez de ofrecer desactivarla.
- `lib/queries/origen-declarado.ts`: `ventasSinUtmPorAreaDeclarada(db, programId, rango)`. La venta y su fecha son
  las del dashboard (`vendidosEn`, ahora exportada de `dashboard.ts`); sin UTM = sin envío de origen o
  `resolverCanal` → `sin_utm`. Nadie la pinta todavía: la burbuja es de la pantalla de Pauta (123/125).
- Pantallas: selector en el diálogo del Kanban (y por él en "¿Cómo terminó?"), el abono de la Ficha y del Inbox
  (solo si el deal no tiene área) y "Editar deal". `moverDeal` rechaza con 403 un deal fuera del alcance de la
  sesión (`tests/acciones-ficha-deal.test.ts`, acción real con un deal de otro programa).

**Recorrido visual (base local, closer):** Kanban → Mover a Compromiso Verbal: "Mover" deshabilitado sin área, el
selector lista Paid/Orgánico/Referidos, el deal se movió y la Ficha dice "Referidos". Editar → Orgánico, guardado
con aviso. Abono con área ya puesta: no pide área y pasó a Abonado solo. 390 px sin scroll horizontal. Consola
limpia en todo. No se probó el modo claro (los campos son el `Select` de siempre).

**Pendiente, no bloquea:** el abono pide área a un deal histórico sin ella aunque el motor no se la exija. Pide un
dato de más, no rompe nada; si molesta en el uso, se condiciona a "el deal todavía no vendió y no es histórico".
