---
id: 163
etapa: O2
serves: "docs/anotaciones.md A-45; A-02 (la parte de llamadas)"
depends: [157]
status: done
---

# 163 — El detalle de una llamada, el mismo en la ficha y en Calls

## Por qué existe

Mani (2-oct): las llamadas del deal son una lista de texto y no se distingue cuál es la cita **activa**, cuáles se
reagendaron, se cancelaron o se tuvieron. Y en la tab Calls cada fila es un enlace al deal
(`components/deals/llamadas-programa.tsx`): no hay forma de ver la llamada en sí.

## Alcance

1. **Un componente, `DetalleDeLlamada`**, que se abre al hacer clic en una llamada (pop-up o panel expandible,
   lo que mejor quepa a 375 px) y muestra todo lo de la llamada: estado, fecha de la cita y fecha en que ocurrió,
   closer y setter, origen (Calendly, manual, re-agenda), link de la reunión, Grain, notas, motivo de re-agenda,
   anulada o no, y su historial de cambios (`change_log`).
2. **Una consulta**, en `lib/queries/` (por ejemplo `detalleDeLlamada(db, programId, callId)`), que usan las dos
   pantallas. Respeta el programa como frontera (otro programa = no existe) y `vigente(calls)` /
   `incluyendoAnulados(calls)` decidido a propósito (AGENTS.md, guardián de vigencia).
3. **En la ficha del deal:** cada llamada abre su detalle; arriba de la lista, la **cita activa** marcada como tal
   (la vigente más reciente con fecha futura o sin resultado), y las demás con su estado en palabras.
4. **En Calls:** la fila abre el detalle (ya no navega); el detalle trae **"Ir al deal"** cuando la llamada tiene
   deal. Una suelta muestra su detalle sin ese botón y con lo que hoy permite (asignar, según el ADR 0076).
5. Las acciones de hoy (pegar Grain, marcar fallida, completar) siguen donde están o se mueven al detalle, sin
   perder ninguna.

## Archivos

Toca: componente nuevo en `components/deals/`, consulta nueva en `lib/queries/`, `ficha-llamadas.tsx`,
`llamadas-programa.tsx`, la página de Calls. **No toca** `ficha-transicion.tsx`, `ficha-actividades.tsx` ni
`page.tsx` de la ficha (los toca el 162). El hub del closer (164) va a reusar este componente.

Tests que afirman el contrato: `tests/llamadas-del-deal.test.ts`, `tests/llamadas-programa.test.ts`,
`tests/ficha-deal-lectura.test.ts`, `tests/vigencia-centralizada.test.ts`.

## Done cuando

- En la ficha y en Calls, clic en una llamada muestra el mismo detalle con su link; en Calls hay "Ir al deal".
- La cita activa se distingue a simple vista de las reagendadas, canceladas y atendidas.
- Pedir el detalle de una llamada de otro programa (forjando el id) no devuelve nada.
- Test de la consulta (incluye anulada y otro programa); `npm run build` en verde; recorrido en `dev:local` con
  consola abierta, escritorio y 375 px.

## Hecho (2-oct, noche, S2)

- Consulta `detalleDeLlamada(db, programId, callId)` en `lib/queries/detalle-llamada.ts`: lee con
  `incluyendoAnulados(calls)` a propósito (el detalle de una anulada se muestra, marcada) y con
  `incluyendoAnulados(deals)`. Otro programa o id inexistente devuelve `null`. Trae closer, lead, setter (sale del
  deal, `deals.setter_user_id`), motivo (solo `calls.motivo_id`: el motivo de re-agenda del PR2 vive en el movimiento
  del deal y no se infiere), anulación y el `change_log` de la llamada, con los ids del historial resueltos a nombres.
- Server action `detalleDeLlamadaAccion` en `app/(app)/p/[programa]/calls/acciones.ts`: alcance por
  `programaVisiblePorSlug`. Un programa ajeno o un id forjado responden "Esa llamada no existe." y no traen datos. Es
  solo lectura.
- `lib/deals/estado-de-llamada.ts` (sin `lib/db`, lo importan los clientes): las etiquetas y tonos del resultado
  (antes copiados en `ficha-llamadas` y `llamadas-programa`), `etiquetaDeOrigen`, `citaActiva` (la agendada no
  anulada con la cita más reciente; sin fecha cuenta como la más vieja, igual que el "No se dio" que ya existía y que
  ahora usa esta función) y `cambioLegible` (el historial en palabras, fechas en Bogotá, sin campos internos).
- `components/deals/detalle-de-llamada.tsx`: un solo pop-up (Dialog de Base UI), con scroll propio a 375 px. En la
  ficha, la cita activa va primero y con su etiqueta, y cada llamada abre su detalle (sin "Ir al deal"). En Calls,
  la fila abre el detalle con "Ir al deal". Las sueltas tienen "Ver detalle" y se siguen asignando desde su fila.
  Ninguna acción cambió de lugar.
- Tests: `tests/detalle-llamada.test.ts` (14): detalle completo, anulada, otro programa = `null`, historial ordenado
  y sin filas de otro registro, nombres del historial, suelta, `citaActiva` y `cambioLegible`.
- Nivel 1: typecheck, lint y `npm run build` en verde. Los tests corrieron en el entorno de Codex (14 del ticket y
  68 de los archivos que cita el ticket); en local no, por swap (7,8 GB): los valida el CI.
- Recorrido en `dev:local` (`app163.localhost:3163`, closer, escritorio y 375 px): Calls abre el detalle con "Ir al
  deal"; la ficha marca la cita activa y abre el mismo detalle; sin scroll horizontal y sin errores en consola. El
  primer recorrido mostró el historial en crudo (uuids, nombres de columna y la fecha en UTC), y se arregló antes de
  cerrar.
- Queda para quien lo use: el hub del closer (164) reusa `DetalleDeLlamada` tal cual (`programaSlug`, `callId`,
  `conIrAlDeal`).

