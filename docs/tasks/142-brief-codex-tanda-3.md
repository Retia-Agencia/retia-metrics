Repo: /Users/mani/Desktop/mani/work/retia/repos/retia-metrics-mani/.claude/worktrees/142 (branch 142-etapas-30x). Work ONLY in this folder. Commit your work on this branch at the end (message in Spanish, `git add` naming files, never -A). Do not push.

Goal: TANDA 3 de 3 del ticket 142. ADR 0072 points 1 and 2: each etapa has ONE question whose answer is an engine arrow. The deal ficha shows the question of its current etapa instead of the generic "mover" menu, and dropping a card on a Kanban column opens that same question with the answer preselected, showing what the deal has (green) and lacks (red) to enter. Tandas 1 and 2 already built the engine (lib/deals/etapas.ts, requisitos.ts, mover-etapa.ts), the serializable map (components/deals/transiciones.ts) and made everything compile. You only build the question layer.

Decisions (already made, do not revisit):

1. ONE client-safe table, `components/deals/pregunta-de-etapa.ts` (only `import type` from lib/deals, like etapa-tono.ts): `PREGUNTA_DE_ETAPA: Record<EtapaDeal, { pregunta: string | null; respuestas: Respuesta[] }>`. A `Respuesta` is `{ id, etiqueta, accion }` where `accion` is one of:
   - `{ tipo: "mover"; a: EtapaDeal; pendiente: PendienteDeal | null }` → moverDeal (the server action), with the fields the arrow asks (camposDeDialogo);
   - `{ tipo: "actividad"; actividad: "contacto" | "intento" }` → opens the existing activity form preset to that tipo (registrarActividad moves the deal, tanda 1);
   - `{ tipo: "abono" }` → opens the existing "registrar abono" form of ficha-pago (to ganado only by money, ADR 0037);
   - `{ tipo: "llamada"; uso: "agendar" | "reprogramar" | "fallida" }` → the existing call forms of ficha-llamadas (a new call with date moves E4/E7/E9; marking it no_show/cancelada triggers PR1). Reuse those forms; do not write a second call writer.
   Each respuesta that a user can never take (because the arrow is `sistema` and has no user path) does not exist.

2. The content of the table (ADR 0072 p1; ADR 0071 p5 for Atendido). "Descartar → Cierre perdido" (mover a cierre_perdido, motivo `perdida`) is the LAST answer of every etapa where arrow P allows it. "Próxima cohorte" (mover, same etapa, pendiente proxima_cohorte, cohorte destino) appears wherever arrow PC allows it, before Descartar.
   | Etapa | Pregunta | Respuestas, in this order |
   | potencial, registrado | null | Registrar contacto (actividad contacto) · Registrar intento (actividad intento) · Próxima cohorte · Descartar |
   | en_gestion | ¿Se logró el contacto? | Sí (actividad contacto) · No, fue un intento (actividad intento) · Próxima cohorte · Descartar |
   | contactado | ¿Califica? | Sí (mover calificado) · Próxima cohorte · No califica (= Descartar, label "No califica") |
   | calificado | ¿Qué pasó? | Agendó (llamada agendar) · Negocia (mover compromiso_verbal) · Pagó (abono) · Interesado, más adelante (mover calificado + pendiente seguimiento) · Próxima cohorte · Descartar |
   | agendado | ¿Cómo va la cita? | Terminó (mover atendido) · Se movió (llamada reprogramar) · No asistió o canceló (llamada fallida) · Próxima cohorte (only if the deal has a pendiente, as PC says) · Descartar |
   | atendido | ¿Cómo terminó? | Pagó ahora (abono) · Compromiso (mover compromiso_verbal) · Seguimiento (mover atendido + pendiente seguimiento) · Otra llamada (mover atendido + pendiente reagenda, motivo `reagenda`) · Próxima cohorte · Perdido (= Descartar, label "Perdido") ; and, only when the deal has a pendiente, first: Agendó (llamada agendar, E9) |
   | compromiso_verbal | ¿Cómo va la negociación? | Pagó (abono) · Revisando propuesta (mover compromiso_verbal + pendiente seguimiento) · Se echó para atrás (mover RETRO: `a` = the destination the engine computes; the server action asks the engine for it, never the client) · Próxima cohorte · Descartar |
   | ganado_parcial | null | Registrar abono (abono) · Desistió (= Descartar, label "Desistió") |
   | ganado_completo | null | none |
   | cierre_perdido | ¿Se recupera? | A gestión (mover en_gestion, motivo `recuperacion`) · Con cita (mover agendado per arrow R, motivo `recuperacion`; it needs llamada_con_fecha: give the user the same path the old R→agendado used — read it in dialogo-mover / moverDeal; if there was none, STOP and report) |
   If any row here has no matching arrow in the engine (or the engine has a closer/ambos arrow that no row reaches and is not listed in decision 3), STOP and report it: do not change the engine.

3. A test, `tests/pregunta-de-etapa.test.ts`, guarantees the table and the engine never drift: every `mover` respuesta is an arrow of the map for that etapa (and pendiente condition); every arrow whose `quien` is closer or ambos is reached by some respuesta, EXCEPT a named list in the test (expected: E4 from potencial/registrado/en_gestion/contactado, which only Calendly takes, and RET, which is automatic). Bite it both ways (remove an answer → fails; add a fake arrow → fails).

4. The requisitos preview: a new server action next to moverDeal (app/(app)/p/[programa]/deals/acciones.ts), `revisarMovimiento({ dealId, a, pendiente })`, same guard as moverDeal, read-only, that returns `{ requisitos: { codigo, mensaje, cumple: boolean }[]; destinoRetro?: EtapaDeal }` computed with leerHechos + the SAME pure evaluation moverEtapa uses (requisitos.ts `queLeFaltaTransicion` / its sibling). If the evaluation is not exported in a usable form, add the export in requisitos.ts; do not copy the logic. Test it in the existing acciones/ficha test file: for one arrow, the preview's red list equals what moverEtapa rejects with, and green equals what it accepts.

5. Ficha (components/deals/ficha/ficha-acciones.tsx): the "mover de etapa" dropdown is replaced by the question of the current etapa (pregunta as heading, respuestas as buttons, Tinta: `<Button variant>` only, no hand colors). Choosing a `mover` answer opens a dialog (reuse/rename DialogoMover → keep the file, generalize it) with the arrow's fields plus the green/red requisitos list from revisarMovimiento; Confirmar is disabled while a red item can't be fixed in the dialog itself, and the red text says where to fix it (e.g. "registra el contacto en Actividades"). `actividad`, `abono` and `llamada` answers scroll to and open the existing form on that section, preset. The current pendiente is shown under the question with its badge (tanda 2) and, for proxima_cohorte, the line "Se retoma cuando se registre un contacto desde el <fecha inicio de ventas de la cohorte destino>". ganado_completo shows no question.

6. Kanban (components/deals/tablero-kanban.tsx): dragging stays (native HTML DnD, no new deps). On drop on column X: find the respuestas of the card's etapa whose action leads to X (`mover` with a = X; `abono` for a ganado column; `actividad contacto` for contactado or en_gestion; `llamada agendar` for agendado). Exactly one → open the same question dialog with it preselected (for actividad/abono/llamada, open the deal ficha at that form: `/p/<programa>/deals/<id>#<seccion>`). More than one → the dialog with those respuestas to choose. None → the card goes back and a toast says why (reuse razonSistema for system-only arrows; otherwise "Desde <etapa> no se pasa a <X>"). Columns that accept a drop are highlighted while dragging (destinosArrastrables, updated to the question table).

7. Activity form (ficha-actividades.tsx): tipo selector gains "Intento" (`intento`, label "Intento sin respuesta") next to Contacto and Nota.

8. Copy: Spanish, short, as in the table. No accents in identifiers.

Read map (rg first; max ~150 lines per read; never cat whole docs):
- docs/adr/0072-*.md "Decisión" (points 1-3), docs/adr/0071-*.md point 5
- components/deals/transiciones.ts (all), components/deals/etapa-tono.ts, lib/deals/etapas.ts (exports + arrow tables), lib/deals/requisitos.ts (exports and the evaluation functions)
- components/deals/dialogo-mover.tsx (all, in two reads), components/deals/tablero-kanban.tsx:150-269, components/deals/ficha/ficha-acciones.tsx (in chunks), ficha-actividades.tsx, the form parts of ficha-llamadas.tsx and ficha-pago.tsx (rg for "<form" / "onSubmit")
- app/(app)/p/[programa]/deals/acciones.ts
- docs/structure.md §9 lines for Badge/Button variants only (rg "variant")

Constraints: follow AGENTS.md (Tinta §9 is mandatory: no color, shadow or radius by hand; Base UI composition rules: `render={...}` not asChild, every Menu part inside its group; role enforced in the server action, never by hiding a button; developer passes every guard). No new deps. Typed, no dead code, no TODO stubs. Do NOT touch lib/db/, drizzle/, the engine rules in lib/deals/ (only the requisitos export of decision 4). Do NOT run db:generate / db:migrate / drizzle-kit, nor `next dev` / `next build` (Turbopack fails in this worktree; the visual walkthrough is done afterwards from the main checkout). Do NOT run the full suite: only `npm test -- tests/<file>.test.ts ...`.

Reading budget: ~70 tool calls max. If you need more, stop and report what is left.
If a decision comes up that is not listed above: STOP, do not choose, report the question.

Done when:
- `npm run typecheck` and `npm run lint` clean.
- `npm test -- tests/pregunta-de-etapa.test.ts <the acciones/ficha test file> tests/kanban-transiciones.test.ts tests/paginas.test.ts` pass.
- Report: files changed, the exceptions list of decision 3 as written, any question you stopped on, and a click-list for the walkthrough (for each etapa: which answer to click and what should happen), which Claude will run in the browser.

Out of scope: the order of the closer's queue (ADR 0072 p5), area declarada at Atendido (143), alerts (128), cortesía, structure.md (tanda 2 did it).
