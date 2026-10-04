---
id: 182
etapa: O4
serves: "docs/anotaciones.md A-85, A-89; ADR 0078 (nuevo); ADR 0037, 0038, 0075"
depends: []
status: todo
---

# 182 — Transición en dos columnas, y corregir el último movimiento

Sesión **S2**, ola O4 parte 1. **Lleva migración** (un valor nuevo del enum de motivos): la sesión entrega el cambio
de `schema.ts` y avisa; la genera y aplica la sesión central con el ok de Mani.

## Por qué existe

Dos notas de Mani (3-oct, noche):

- **A-85.** "Los deals solo pueden avanzar". No es del todo así: hoy hay retrocesos (Compromiso Verbal vuelve a
  Atendido, Contactado o Calificado con motivo; perder y recuperar; Atendido vuelve a Agendado con pendiente; anular
  un abono devuelve el Ganado). Lo que **no existe** es corregir un movimiento equivocado: un deal movido a Calificado
  por error no tiene cómo volver a Contactado. Anular (ADR 0038) es para un registro que nunca debió existir y Cierre
  perdido es un "no" del cliente; un clic equivocado no es ninguno de los dos.
- **A-89.** La tarjeta Transición tiene mucho texto pegado sin jerarquía, botones sueltos a media tarjeta (Cierre
  perdido, No asistió o canceló), la insignia "Camino principal" sobra, y ocupa demasiado.

## Decisión (Mani, 3-oct noche) → ADR 0078

**Corregir el último movimiento.**

1. Un deal se puede **corregir**: vuelve a la etapa de la que vino en su **último movimiento**, y solo si ese
   movimiento **lo hizo una persona**. Lo que movió el sistema (Grain, abono, Calendly, ingesta) se corrige
   **anulando su causa** (el abono, la llamada), que ya devuelve el deal.
2. **Motivo obligatorio de tipo `correccion`** (catálogo de motivos, ADR 0012: filas editables; el tipo es un valor
   nuevo de `tipoMotivoEnum`, por eso la migración). Se siembran los motivos iniciales por el molde con
   `actorDelScript()` (ADR 0029), con el ok de Mani: "Me equivoqué de etapa", "Lo movió otra persona por error".
3. La corrección **pasa por `moverEtapa()`** (único escritor, ADR 0037) y queda en `deal_etapa_historial` y
   `change_log` como cualquier movimiento, marcada como corrección. La conversión no se infla porque cuenta deals
   distintos que llegaron a una etapa. **Una corrección no se corrige**: después de corregir, el último movimiento es
   la corrección y "Corregir" no se ofrece hasta el siguiente movimiento de una persona.
4. Quién corrige: quien puede mover ese deal hoy (dueño o quien administra, `puedeTrabajarDeal`).
5. **El mismo pop-up para todos los deals**, desde la ficha y desde el Kanban: el destino, lo que se deshace y el
   motivo. En el Kanban, al arrastrar, **la etapa de corrección se pinta en rojo** (avanzar sigue en morado); soltar
   ahí abre ese pop-up.

## Alcance

1. **Motor.** Una flecha de corrección en `lib/deals/etapas.ts` / `mover-etapa.ts` que lee el último movimiento del
   historial y solo permite volver a su `de`, con el requisito "motivo de corrección". Ninguna regla compara etapas por
   orden (manual §4). `lib/deals/mapa-transiciones.ts` y `components/deals/transiciones.ts` exponen "a qué etapa se
   corrige este deal, o ninguna".
2. **Transición en dos columnas (A-89).** Izquierda **Mover a** (incluye Cierre perdido y, cuando aplica,
   **Corregir** con tono de peligro); derecha **Registrar actividad** y **Dejar en espera** (incluye "No asistió o
   canceló"). Botones de **un solo tamaño estándar** (el `size` de `Button` que defina Tinta), espaciado uniforme,
   sin botones sueltos a media tarjeta. Fuera la insignia **"Camino principal"** (`esFeliz` / `destinoFeliz`). Cada
   columna con un título corto y una línea de ayuda, con jerarquía tipográfica de Tinta. La tarjeta mide lo que sus
   botones, no más. A 375 px las columnas se apilan.
3. **Kanban en rojo** (después de que el 181 esté en `main`: rebasar): el destino de corrección resaltado en rojo al
   arrastrar, en el único lugar donde el 181 deja el resaltado.
4. ADR **0078** con la decisión, `docs/manual-gestion-comercial.md` §4 y §8 (la fila de corregir y cómo se distingue
   de anular y perder), `docs/structure.md` (tabla de transiciones).

## Archivos (suyos en la ola)

`lib/deals/etapas.ts`, `lib/deals/mover-etapa.ts`, `lib/deals/requisitos.ts`, `lib/deals/mapa-transiciones.ts`,
`components/deals/transiciones.ts`, `components/deals/dialogo-mover.tsx`, `components/deals/boton-de-etapa.tsx`,
`components/deals/ficha/ficha-transicion.tsx`, `components/deals/pregunta-de-etapa.ts`,
`components/deals/responder-pregunta.tsx`, `lib/db/schema.ts` (solo el enum), y `tablero-kanban.tsx` **solo** en el
paso 3. **No toca** `lib/queries/ficha-deal.ts` ni `ficha-alertas.tsx` (son del 184) ni `ficha-pago.tsx` (del 167).

Tests: `tests/motor-etapas*.test.ts` (corregir vuelve al `de` del último movimiento; no se ofrece si lo movió el
sistema; no se corrige una corrección; sin motivo se rechaza; un closer no dueño recibe 403), el guardián del motor
sigue verde, `tests/pregunta-de-etapa.test.ts`.

## Done cuando

- Un deal movido por error por una persona vuelve a su etapa anterior con motivo, por `moverEtapa`, con historial.
- "Corregir" no aparece si el último movimiento fue del sistema, ni justo después de una corrección.
- Transición en dos columnas, botones del mismo tamaño, sin "Camino principal", más baja que hoy.
- En el Kanban, arrastrar a la etapa de corrección la pinta en rojo y abre el mismo pop-up.
- Permiso mordido forjando la acción desde un closer que no es dueño (403, la base no se mueve).
- `npm run build` en verde; recorrido en `dev:local` como closer y gerente, escritorio y 375 px, consola abierta.

## Estado

Cerrado el 3-oct (noche). Motor de corrección (`CORR`, `etapaDeCorreccion` y `destinosDeCorreccion`), ficha en dos columnas,
diálogo compartido, ADR 0078 y docs. Kanban: la etapa de corrección se pinta en rojo solo donde no hay un camino normal
hacia la misma etapa, y soltar abre el mismo pop-up. Migración **0066** (`ADD VALUE IF NOT EXISTS 'correccion'`, aplicada en
producción). **Falta sembrar los motivos de tipo `correccion`** ("Me equivoqué de etapa", "Lo movió otra persona por error")
por el molde, con el ok de Mani. El arrastre en rojo no se probó a mano en el navegador (solo build, tipos y tests).
