---
id: 163
etapa: O2
serves: "docs/anotaciones.md A-45; A-02 (la parte de llamadas)"
depends: [157]
status: todo
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
