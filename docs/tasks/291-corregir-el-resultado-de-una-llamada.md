---
id: 291
etapa: llamadas
serves: "Un closer corrige desde la app un resultado de llamada mal marcado (Show ↔ No show ↔ Cancelada), con motivo y rastro, y el deal queda en la etapa que corresponde (ADR 0101, parte A)"
depends: [177]
status: done
---

# 291 — Corregir el resultado de una llamada

## Por qué

El 21-oct Maru marcó Show en una llamada que fue No show y no lo pudo cambiar: Resultado solo existe sobre una cita
`agendada` y el servidor rechaza con 409 un resultado sobre una ya resuelta. El deal quedó en Atendido y el show cuenta
en las tasas sin que nadie pueda arreglarlo sin un script (ADR 0101).

## Alcance

- **Dominio**, en `lib/deals/llamadas.ts`: `corregirResultado(db, actor, { callId, resultado, motivo, motivoReagendaId? })`.
  - Esquema zod: `resultado` en `show | no_show | cancelada`; `motivo` texto 3 a 500; `motivoReagendaId` uuid opcional.
  - Reja: llamada vigente de un deal que el actor puede trabajar (`llamadaVigenteDeDealCompletable` o la reja
    equivalente; el developer pasa por `esAccesoTotal`). Rechaza si el resultado actual no es `show`, `no_show` o
    `cancelada` (409 con el porqué) y si el nuevo es igual al actual (409).
  - Una transacción: `editarConRastro` sobre `calls` (`resultado`; `fechaLlamada` se llena con `fechaAgenda` si pasa a
    show y estaba vacía), una nota del actor en el deal con el antes, el después, la fecha de la cita y el motivo
    (`dejarNotaDelActor`), y el movimiento por `moverEtapa()`:
    - show → no_show/cancelada con el deal en Atendido: pendiente Re-agenda por PR2, con `motivoReagendaId` si llega.
    - no_show/cancelada → show con el deal en Agendado o Atendido con pendiente Re-agenda: a Atendido sin pendiente.
      Si la tabla de `lib/deals/etapas.ts` no tiene la flecha, se agrega con su test; nunca se escribe la etapa a mano.
    - no_show ↔ cancelada: solo el resultado.
    - Deal en Compromiso Verbal, Ganado parcial, Ganado completo o Cierre perdido, cuando la corrección cambiaría si la
      llamada sucedió: 409 "El deal ya avanzó; corrígelo primero desde el deal." no_show ↔ cancelada sí se permite ahí.
  - Calendly no se toca.
- **Acción**, en `app/(app)/p/[programa]/deals/[id]/acciones.ts`: `corregirResultadoAccion`, con `exigirLlamadaVisible` y
  el molde de las demás (zod en el borde, `correr`, el actor sale de la sesión).
- **UI**, en `components/deals/ficha/acciones-de-llamada.tsx`: sobre una llamada `show`, `no_show` o `cancelada`, un
  botón "Corregir resultado" que abre un diálogo con el resultado nuevo (los otros dos), el motivo (obligatorio) y el
  motivo de re-agenda cuando pasa de show a fallida. Sale en todos los lugares que ya usan `AccionesDeLlamada` (ficha,
  Calls, Inbox, detalle). Llama `onCambio` al terminar, como las demás.
- **Historial:** el cambio ya sale en la ficha por `cambioLegible`; verificar que se lea "Estado: Show → No show" y que
  la nota del deal se vea.

## Tests

- `tests/corregir-resultado.test.ts` (PGlite, base por archivo):
  - show → no_show con deal en Atendido: resultado escrito, deal en Atendido con pendiente Re-agenda, una fila de
    `change_log` de `resultado` y la nota con el motivo.
  - no_show → show con deal en Atendido con pendiente Re-agenda (y desde Agendado con pendiente): deal en Atendido sin
    pendiente.
  - no_show ↔ cancelada: solo cambia el resultado.
  - Rechazos: llamada `agendada` o `reagendada`, mismo resultado, motivo vacío, deal ganado (show → no_show), llamada
    anulada, actor sin acceso al deal (otro closer) → 403/404 y la base sin moverse.
  - El developer puede corregir.
- Las métricas: tras show → no_show, el embudo y la tasa de show del programa cuentan la llamada como no show (usar la
  función que ya calcula show, no una consulta nueva).

## Done cuando

Desde la ficha, un closer cambia Show → No show de una llamada suya con un motivo, el deal queda en Atendido con
Re-agenda pendiente, la ficha muestra el cambio y la nota, y otro closer forjando la acción recibe 403 sin mover nada.

## Relacionado

ADR 0101, 0026, 0042, 0038. 177 (Resultado), 059 (marcarFallida), 292 (la otra mitad del ADR).
