Repo: /Users/mani/Desktop/mani/work/retia/repos/retia-metrics-mani/.claude/worktrees/142 (branch 142-etapas-30x). Work ONLY in this folder. Commit your work on this branch at the end (message in Spanish, `git add` naming files, never -A). Do not push.

Goal: TANDA 2 de 3 del ticket 142. Tanda 1 rewrote the stage engine in lib/deals/ (eleven 30X stages + `deals.pendiente`). Make every OTHER consumer speak the new stages until `npm run typecheck` is fully green, update their tests, and rewrite docs/structure.md §3 and §3.1 to match the engine. No new behaviour beyond what is listed here.

The engine you build on (read it, do not change its rules): lib/deals/etapas.ts exports EtapaDeal (potencial, registrado, en_gestion, contactado, calificado, agendado, atendido, compromiso_verbal, ganado_parcial, ganado_completo, cierre_perdido), PendienteDeal (reagenda, seguimiento, proxima_cohorte), NOMBRE_DE_ETAPA, NOMBRE_DE_PENDIENTE, ETAPAS_EN_ORDEN, ETAPAS_DE_SETTEO, `unaCitaMueveAAgendado(etapa, pendiente)`, the etapa arrows (E1-E13, RETRO, P, R, A1, A2) and the pendiente arrows (PR1, PR2, PS1-PS3, PC, RET). moverEtapa's Movimiento has `pendiente?: PendienteDeal | null` (the pendiente AFTER the move). If tanda 1's names differ from these, use tanda 1's names; if something here contradicts the engine, STOP and report.

Decisions (already made, do not revisit):

1. Closed deal = `ganado_completo` or `cierre_perdido` (replaces every `"completo" || "cierre_perdido"` check: lib/calendly/*, lib/ingesta/regla-de-deals.ts, lib/queries/inbox.ts CERRADAS, app/(app)/p/[programa]/deals/[id]/page.tsx, components/deals/ficha/*). Venta / estudiante = `ganado_parcial`, `ganado_completo` (lib/queries/metricas-filtros.ts ETAPAS_VENDIDAS, lib/queries/dashboard.ts (its `abonado`/`completo` literals; `tests/mover-etapa.test.ts` "el dueño mueve Agendado a Atendido sin Grain" fails until this is fixed), lib/queries/estudiantes.ts, lib/queries/cartera.ts `abonado` → `ganado_parcial`, students page, ficha-pago). If tanda 1 exported ETAPAS_VENDIDAS from lib/deals, the queries import it instead of keeping a copy (AGENTS.md: one answer, one module). Do NOT rename the money word `abonado` in lib/queries/saldo.ts, personas.ts or ficha-deal.ts: there it is "amount paid", not a stage.

2. Estados de llegada (lib/catalogo/estados-llegada.ts, lib/queries/estados-llegada.ts, components/admin/estados-llegada-admin.tsx, scripts/estados-llegada-base.ts): ETAPAS_DE_ENTRADA = potencial, registrado, calificado, agendado (the CHECK of migration 0058). Labels come from NOMBRE_DE_ETAPA, not a local copy. The new-row default in the admin form is `registrado`. scripts/estados-llegada-base.ts: setteo_no_calificado → registrado, con_calendly_sin_agenda → calificado, descartado → registrado (same translation 0058 applied: prioridad alta → calificado, normal → registrado). The ADR 0069 routing (agenda + lead_quality) is ticket 117, NOT this tanda: the estados_llegada mechanism stays.

3. lib/ingesta/regla-de-deals.ts `decidirAccionDeDeal`:
   - `DealAbierto` becomes `{ etapa: EtapaDeal; pendiente: PendienteDeal | null } | null`; the caller reads `deals.pendiente` with the etapa.
   - etapaEntrada potencial, registrado or calificado: same as the old pendiente_setteo branch (opens at THAT etapa if there is no deal; with a deal, `nada`).
   - etapaEntrada agendado, in this order: if `dealAbierto` is null or `unaCitaMueveAAgendado(etapa, pendiente)` → with a cita vigente, `abrir` agendado / `mover` a agendado (the engine resolves E4, E7 or E9 and clears the pendiente); else if the etapa is agendado, atendido, compromiso_verbal or ganado_parcial (ETAPAS_AVANZADAS) → `agregar_llamada` with a cita vigente, `notificar_reenvio` without; else `nada`.
   - Cita cancelada / no encontrada / error with no deal: opens at `calificado` with the nota (was pendiente_setteo; the lead wanted to book, and 0058 mapped the old "con Calendly sin agenda" to Calificado). With a deal: `nada` with the nota, as today.
   - Rewrite the comments that cite old numbers (1, 2, 3, 9, 11, T2, T3, T6, T23, T27) in terms of the new names; keep the 🩸 history short.

4. Calendly (lib/calendly/colgar-llamada.ts, buscar-llamada.ts, eventos-de-cita.ts): replace ETAPAS_QUE_UNA_CITA_MUEVE_A_AGENDADO with `unaCitaMueveAAgendado(deal.etapa, deal.pendiente)` (select `pendiente` too). eventos-de-cita: a cancelada / no_show on an agendado deal → moverEtapa to agendado with `pendiente: "reagenda"` (PR1), never to a stage that no longer exists; a new `agendada` (reschedule) on an agendado deal with pendiente reagenda → moverEtapa to agendado with `pendiente: null` (E7). Adapt `moverDealDeLaLlamada`'s signature to carry the pendiente instead of the old stage pair. Same match rules as today (ADR 0049): nothing else changes.

5. Inbox: lib/queries/inbox-sin-dueno.ts, the "Pendiente Setteo" bucket = deals WITHOUT owner whose etapa is in ETAPAS_DE_SETTEO (import it). UI label of that bucket: "Por settear". lib/queries/inbox.ts:~295, `etapa === "pendiente_reagenda"` → `pendiente === "reagenda"` (any etapa).

6. Kanban (lib/queries/kanban.ts + its component under components/deals/): one column per etapa in ETAPAS_EN_ORDEN (eleven). The card gets `pendiente: PendienteDeal | null` and shows it as a `<Badge>` with NOMBRE_DE_PENDIENTE (Tinta, docs/structure.md §9: no hand colors). The overdue flag that read `etapa === "seguimiento"` reads `pendiente === "seguimiento"`. Drag-and-drop behaviour does not change here (tanda 3).

7. Tones (components/deals/etapa-tono.ts): potencial, registrado, en_gestion, contactado, calificado → neutro; agendado, atendido → info; compromiso_verbal → alerta; ganado_parcial, ganado_completo → exito; cierre_perdido → peligro. Add TONO_DE_PENDIENTE: reagenda → alerta, seguimiento → info, proxima_cohorte → neutro. Update the header comment.

8. Ficha (components/deals/ficha/*, app/(app)/p/[programa]/deals/acciones.ts and [id]/acciones.ts): only what typecheck needs plus: the server action that calls moverEtapa accepts an optional `pendiente` (zod enum of PendienteDeal, nullable) and passes it through; the abono toast says `El deal pasó a ${NOMBRE_DE_ETAPA[r.etapa]}`. The ficha shows the current pendiente next to the etapa with the same Badge as the Kanban. Do NOT redesign the move dialog (tanda 3).

9. Historical migration (lib/migracion/consolidar.ts, extraer-setteo.ts, extraer-estudiantes.ts, scripts/migrar-gestion.ts): translate exactly as 0058 did: pendiente_setteo → registrado, en_contacto → contactado, abonado → ganado_parcial, completo → ganado_completo, pendiente_reagenda → agendado with pendiente reagenda. consolidar's ETAPAS_DEL_SETTEO = registrado, contactado. For the reagenda case, thread an optional `pendiente` through to the historical birth writer in lib/deals/historico.ts (birth row with `pendiente_a` set); nothing else in historico.ts changes. Keep the rareza texts, renaming "Pendiente Re-agenda" to "Agendado con Re-agenda pendiente".

10. scripts/seed-local.ts: same translation; a seeded deal that was in seguimiento → atendido with pendiente seguimiento (and its fecha), proxima_cohorte → registrado with pendiente proxima_cohorte (and cohorte destino). Seeds still go through lib/ (moverEtapa / abrirDeal), never raw inserts of etapa.

11. Tests: update every failing test outside the tanda 1 files to the new names and behaviour above. For decisions 3, 4, 5 and 6 add or adjust cases in BOTH directions (e.g. a con_calendly re-send on atendido WITH pendiente moves to agendado and WITHOUT pendiente only adds the call; a no_show leaves the deal in agendado with pendiente reagenda; a reschedule clears it; an owned deal in registrado is NOT in "Por settear"). Fixtures with `"completo"` as a Typeform/Dapta completion flag are NOT stages: leave them.

12. docs/structure.md §3 (line ~153) through §3.2 (ends before "## 4."): rewrite to the new engine. The stage list with tones (decision 7), the pendientes (what each means, who puts and who clears them, ADR 0070), the transition table §3.1 with the ids E1-E13, RETRO, P, R, A1, A2 and the pendiente table PR1, PR2, PS1-PS3, PC, RET (take them from lib/deals/etapas.ts, which is the source: the doc describes it, never contradicts it), and §3.2 with the new names. Mermaid diagrams, if any, updated to the eleven stages. Same voice as the rest of the doc (Spanish, short sentences, ADR numbers cited). Cite ADR 0070, 0071, 0072; mark old T-ids as retired in one line ("los T1-T29 del 24-sep se retiraron con el 142").

13. Every decision the SYSTEM takes on a deal leaves a visible "why" in the deal's log (Mani, 2-oct). The pattern already exists: lib/ingesta/regla-de-deals.ts (~line 330) writes a `deal_actividades` row tipo `nota` with `user_id` null through crearConRastro, and the ficha log shows it as "Sistema". Move that writer to lib/deals/nota-del-sistema.ts (`dejarNotaDelSistema(tx, dealId, texto)`), keep regla-de-deals using it, and call it in the same transaction as each of these system moves, with a one-sentence Spanish reason:
   - birth at calificado because the cita was not vigente (already has notaDeCita; keep it);
   - Calendly cancelada / no_show → Re-agenda pendiente ("Calendly marcó la cita del <fecha Bogotá> como <no asistió|cancelada>: queda Re-agenda pendiente.");
   - Calendly reschedule clearing Re-agenda, and a cita that moves atendido-with-pendiente back to agendado (E9) ("Llegó una cita nueva para el <fecha>: …");
   - a con_calendly re-send that only adds a call or only notifies (say which and why).
   Moves caused by a user's own action (an activity, an abono) do NOT get a nota: the activity or abono is already in the log. A `nota` never moves a deal and never counts as actividad (tanda 1's rule). Alerts are ticket 128, not here.

Read map (rg first; max ~150 lines per read; never cat whole docs):
- lib/deals/etapas.ts (exports only), lib/deals/mover-etapa.ts (Movimiento type and NACIMIENTOS only)
- every file listed in decisions 1-10, at the lines rg shows for: `pendiente_setteo|en_contacto|pendiente_reagenda|proxima_cohorte|"seguimiento"|"abonado"|"completo"|NUMERO_DE_ETAPA|ETAPAS_QUE_UNA_CITA|setteo`
- `npm run typecheck` output is your worklist; docs/structure.md lines 153-288 for decision 12; docs/adr/0070-*.md "Decisión" for the pendientes wording.

Constraints: follow AGENTS.md (Spanish UI and comments in the surrounding style, no accents in identifiers, never compare stages by order, moverEtapa is the only writer of etapa and pendiente, Tinta for any UI, every stage named one by one). No new deps. Typed, no dead code, no TODO stubs. Do NOT touch lib/db/schema.ts, drizzle/, nor the engine rules in lib/deals/ (only historico.ts per decision 9; if the engine itself has a bug, STOP and report it). Do NOT run db:generate / db:migrate / drizzle-kit. Do NOT run the full suite (`npm test` with no args): only `npm test -- tests/<file>.test.ts ...` for the files you touched (never `npx vitest` directly).

Reading budget: ~90 tool calls max; batch mechanical renames with sed/rg. If you need more, stop and report what is left.
If a decision comes up that is not listed above: STOP, do not choose, report the question.

Done when:
- `npm run typecheck` is clean (zero errors, whole repo).
- `npm run lint` clean.
- `npm test -- <every test file you changed or added>` passes; list them in the report.
- `rg -n 'pendiente_setteo|en_contacto|pendiente_reagenda|ETAPAS_QUE_UNA_CITA|NUMERO_DE_ETAPA' lib app components scripts tests` returns only the historical translation in lib/migracion/ and tests that assert that translation.
- Report: files changed, tests run, any question you stopped on.

Out of scope: the ADR 0069 routing (117), the move dialog and drag-and-drop questions (tanda 3), cortesía, alerts (128), properties per stage (143), docs other than structure.md §3-§3.2.
