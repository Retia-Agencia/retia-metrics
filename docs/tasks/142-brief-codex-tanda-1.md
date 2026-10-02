Repo: /Users/mani/Desktop/mani/work/retia/repos/retia-metrics-mani/.claude/worktrees/142 (branch 142-etapas-30x). Work ONLY in this folder. Commit your work on this branch at the end (message in Spanish, `git add` naming files, never -A). Do not push.

Goal: TANDA 1 de 3 del ticket 142. Rewrite the deal stage ENGINE in lib/deals/ for the eleven 30X stages plus the deal "Pendiente" (ADR 0070-0072), with its tests. Schema and migration 0058 are ALREADY done and committed (lib/db/schema.ts, drizzle/0058_etapas-30x.sql); do not touch them.

What the schema now has (read lib/db/schema.ts lines 30-75 and the `deals` / `dealEtapaHistorial` tables, search with rg):
- etapa_deal: potencial, registrado, en_gestion, contactado, calificado, agendado, atendido, compromiso_verbal, ganado_parcial, ganado_completo, cierre_perdido. (pendiente_setteo, en_contacto, pendiente_reagenda, seguimiento, proxima_cohorte, abonado, completo NO LONGER EXIST.)
- pendiente_deal enum: reagenda, seguimiento, proxima_cohorte. `deals.pendiente` (nullable). `deal_etapa_historial.pendiente_de` / `pendiente_a` (nullable).
- tipo_actividad gained `intento` (failed contact attempt). `deals.cortesia` boolean exists (NOT used by this tanda).

Decisions (already made, do not revisit):

1. Display names (NOMBRE_DE_ETAPA): Potencial, Registrado, En gestión, Contactado, Calificado, Agendado, Atendido, Compromiso Verbal, Ganado Pago Parcial, Ganado Pagado Completo, Cierre perdido. ETAPAS_EN_ORDEN = that same order. Remove NUMERO_DE_ETAPA (the numbers were the old names); grep its users and drop the usage. Add NOMBRE_DE_PENDIENTE: Re-agenda, Seguimiento, Próxima Cohorte. "Setteo" = potencial, registrado, en_gestion, contactado, calificado: export it as ETAPAS_DE_SETTEO.

2. Etapa arrows (replace FILAS in lib/deals/etapas.ts; new ids, the old T-ids die). A change of etapa ALWAYS leaves pendiente = null unless the row says otherwise.
   | id | de | a | quien | requisitos | notes |
   | E1 | potencial, registrado | en_gestion | sistema | dueno, actividad (new code: a `contacto` or `intento` activity exists) | ADR 0071 p1, taken by registrarActividad |
   | E2 | en_gestion | contactado | sistema | dueno, contacto | old T1, taken by registrarActividad tipo contacto |
   | E3 | en_gestion, contactado | calificado | closer | contacto | ADR 0071 p3 |
   | E4 | potencial, registrado, en_gestion, contactado, calificado | agendado | ambos | llamada_con_fecha | old T2/T3/T23 |
   | E5 | contactado, calificado | compromiso_verbal | closer | fecha_limite_pago, area_declarada | old T4 |
   | E6 | contactado, calificado | ganado_parcial, ganado_completo | sistema | pago por destino + area_declarada | old T5 (same segunDestino logic) |
   | E7 | agendado | agendado | sistema | llamada_con_fecha | old T9; a new cita also clears a reagenda pendiente here |
   | E8 | agendado | atendido | ambos | llamada_sucedio | old T10 (keep darPorAtendida for the user path) |
   | E9 | atendido | agendado | ambos | llamada_con_fecha | ONLY when the deal has a pendiente (new row flag, e.g. soloConPendiente) |
   | E10 | atendido | compromiso_verbal | closer | fecha_limite_pago, area_declarada | old T12 |
   | E11 | atendido | ganado_parcial, ganado_completo | sistema | pago + area_declarada | old T13/T14 |
   | E12 | compromiso_verbal | ganado_parcial, ganado_completo | sistema | pago + area_declarada | old T16/T17 |
   | E13 | ganado_parcial | ganado_completo | sistema | as old T18 | |
   | RETRO | compromiso_verbal | atendido, contactado, calificado | closer | motivo (lista `retroceso`), fecha_seguimiento | ADR 0070 p3: lands with pendiente = seguimiento; destination = the etapa the deal had right before it entered compromiso_verbal, read from the historial (same mechanism as A1/etapaALaQueVuelve; reject a different `a` with 409) |
   | P | potencial, registrado, en_gestion, contactado, calificado, agendado, atendido, compromiso_verbal, ganado_parcial | cierre_perdido | closer | motivo (lista `perdida`) | ganado_parcial desiste = Cierre perdido (ADR 0071 p8) |
   | R | cierre_perdido | en_gestion, agendado | closer | motivo (lista `recuperacion`) | R → en_gestion may arrive with pendiente proxima_cohorte (then requires cohorte_destino) |
   | A1 | ganado_parcial | contactado, calificado, atendido, compromiso_verbal | sistema | sin_abonos | etapa previa from historial, as today |
   | A2 | ganado_completo | ganado_parcial | sistema | saldo_pendiente | |

3. Pendiente arrows (the etapa stays the same; a separate table in etapas.ts, keyed by (etapa, pendiente destino); allowed whatever the current pendiente is, including the same one, so a closer can change the date):
   | id | etapa | pone | quien | requisitos |
   | PR1 | agendado | reagenda | sistema | llamada_fallida (old T8; the call result is the motivo, no motivo list) |
   | PR2 | atendido | reagenda | closer | motivo (lista `reagenda`) (old T29) |
   | PS1 | atendido | seguimiento | closer | fecha_seguimiento (old T24) |
   | PS2 | calificado | seguimiento | closer | fecha_seguimiento, contacto (ADR 0072 p3: only an already-contacted lead) |
   | PS3 | compromiso_verbal | seguimiento | closer | fecha_seguimiento ("revisando propuesta"; the deal stays in CV, not RETRO) |
   | PC | potencial, registrado, en_gestion, contactado, calificado, atendido, compromiso_verbal; and agendado ONLY if it already has a pendiente | proxima_cohorte | closer | cohorte_destino |
   | RET | any etapa whose pendiente is proxima_cohorte | (quita: pendiente → null) | sistema | a `contacto` activity dated on/after the destino cohort's `fecha_inicio_ventas` (destino without that date: not retomable this way) |
   There is no other way to set pendiente to null without changing etapa (ADR 0070 p7: no "quitar" button).

4. moverEtapa API: `Movimiento` gains `pendiente?: PendienteDeal | null` = the pendiente AFTER the move (default null). Resolution: if `a !== deal.etapa` → etapa arrow (resulting pendiente null, except RETRO forces seguimiento, and R→en_gestion accepts proxima_cohorte). If `a === deal.etapa` and `pendiente != null` → pendiente arrow. If `a === deal.etapa` and `pendiente == null` → only E7 (agendado→agendado) or RET. Anything else → MovimientoRechazado with transicion_no_permitida. The concurrency guard of the update becomes `etapa = de AND pendiente IS NOT DISTINCT FROM pendiente_de`. Write `pendiente` on `deals` and `pendiente_de`/`pendiente_a` on the historial row. Historial `fecha` is written as `sql\`clock_timestamp()\`` (in moverEtapa AND abrirDeal) so two moves in one transaction keep their order (now() is the transaction start and would tie).

5. Próxima Cohorte mudanza (ADR 0070 p8): any move that CLEARS a proxima_cohorte pendiente, except P (cierre_perdido), sets `deals.cohort_id = cohorte_destino_id` in the same transaction through editarConRastro (lib/crm/rastro.ts), so it lands in change_log. Cierre perdido clears it without moving the cohort.

6. Cita nueva: replace the list ETAPAS_QUE_UNA_CITA_MUEVE_A_AGENDADO with a function in etapas.ts, `unaCitaMueveAAgendado(etapa, pendiente): boolean` = etapa in ETAPAS_DE_SETTEO, or (etapa is agendado or atendido) and pendiente != null. Compromiso Verbal and ganado_parcial never move by a cita (ADR 0072 p3: CV with Seguimiento stays in CV). Update its use in lib/deals/llamadas.ts (agregarLlamada / completarAgendada): from agendado with pendiente → E7 with pendiente null; from atendido with pendiente → E9. marcarFallida (no_show / cancelada) → PR1 (stays agendado, pendiente reagenda). Leave lib/calendly/ and lib/ingesta/ to tanda 2 (they will fail to compile; that is expected).

7. Births (NACIMIENTOS in mover-etapa.ts): sistema → potencial, registrado, calificado, agendado. usuario → en_gestion only, with the creator as owner (ADR 0071 p6).

8. registrarActividad (lib/deals/actividades.ts): zod tipo accepts "contacto" | "nota" | "intento". On a deal WITHOUT owner, an actor who can work leads (trabajaLeads, lib/auth/roles.ts) becomes the owner in the same transaction (ADR 0071 p1), written the same way reclamarDeal writes it (lib/deals/reclamar.ts ~line 60-85). Then, in the same transaction, call moverEtapa with the transaction as db (nested = savepoint) and actor { tipo: "sistema" } (historial userId null already means "lo movió el sistema"). Rules: tipo contacto or intento on potencial/registrado → E1; then tipo contacto on en_gestion → E2 (so a contacto on Registrado makes two historial rows: registrado→en_gestion, en_gestion→contactado). tipo contacto with pendiente proxima_cohorte and no etapa move → RET if its requirement holds. `nota` never moves. intento on en_gestion does not move (the 3-intentos alert is ticket 128, not here).

9. HechosDelDeal gains what the new requisitos need (actividad comercial exists, pendiente actual, fecha de inicio de ventas de la cohorte destino, fecha del último contacto); leerHechos reads them from the DB, never from the input. New CodigoRequisito: `actividad` ("Falta registrar una actividad: llamada, WhatsApp o correo."). Keep existing messages. `area_declarada` stays exactly where it is today (CV and ganado); moving it to Atendido is ticket 143, NOT this one.

10. ETAPAS_VENDIDAS (venta) = ganado_parcial, ganado_completo. Everything in lib/deals that said abonado/completo says ganado_parcial/ganado_completo (abonos.ts, estudiante.ts, pago.ts, editar-deal.ts, valor-vendido.ts, historico.ts as they apply). lib/deals/historico.ts births of historical deals: map old meanings to new names only (setteo → registrado, en_contacto → contactado, abonado → ganado_parcial, completo → ganado_completo); no new behaviour.

11. The guardian test of ticket 046 (tests/motor-etapas-guardian.test.ts) must cover `pendiente` exactly like `etapa`: nobody outside moverEtapa/abrirDeal writes `deals.pendiente`. lib/crm/rastro.ts already refuses to write `etapa`; make it refuse `pendiente` too.

12. mapa-transiciones.ts / components/deals/transiciones.ts (the serializable map for the Kanban): include the pendiente arrows as well so tanda 3 can use them; the shape is yours, keep it plain JSON.

Read map (read only these; rg first, max ~150 lines per read, never cat whole docs):
- docs/adr/0070-*.md, 0071-*.md, 0072-*.md (short; the "Decisión" sections)
- lib/deals/etapas.ts (all), lib/deals/requisitos.ts (all), lib/deals/mover-etapa.ts (in chunks), lib/deals/actividades.ts, lib/deals/reclamar.ts:40-84, lib/deals/llamadas.ts around agregarLlamada/completarAgendada/marcarFallida, lib/deals/abonos.ts where it moves etapas, lib/crm/rastro.ts:70-100
- tests: tests/deal-etapas.test.ts, tests/mover-etapa.test.ts, tests/deal-requisitos.test.ts, tests/motor-etapas-guardian.test.ts, tests/llamadas-del-deal.test.ts, tests/abonos-del-deal.test.ts, tests/inbox-reclamar.test.ts, tests/kanban-transiciones.test.ts (+ helpers they import)

Constraints: follow AGENTS.md (Spanish UI strings and comments in the same style, no accents in identifiers, every rule names stages one by one, never compare stages by order, moverEtapa is the only writer of etapa AND pendiente). No new deps. Typed, no dead code, no TODO stubs; remove old-T comments that no longer apply. Do NOT run db:generate / db:migrate / drizzle-kit. Do NOT run the full suite (`npm test` with no args): only `npm test -- tests/<file>.test.ts` for the files above (never `npx vitest` directly).

Reading budget: ~60 tool calls max; batch mechanical renames with sed/rg. If you need more, stop and report what is left.
If a decision comes up that is not listed above: STOP, do not choose, report the question.

Done when:
- `npm test -- tests/deal-etapas.test.ts tests/mover-etapa.test.ts tests/deal-requisitos.test.ts tests/motor-etapas-guardian.test.ts tests/llamadas-del-deal.test.ts tests/abonos-del-deal.test.ts tests/inbox-reclamar.test.ts tests/kanban-transiciones.test.ts tests/actividades*.test.ts` pass (create tests/actividades-del-deal.test.ts if no activities test exists).
- New tests cover, each in both directions: every E/RETRO/P/R/A row and every PR/PS/PC/RET row (allowed and rejected); pendiente cleared by any etapa change; RETRO destination from the historial; E9 refused without pendiente; Próxima Cohorte mudanza on a forward clear (with change_log row) and NO mudanza on Cierre perdido; contacto on Registrado writes two historial rows in order; first activity on an unowned deal makes the actor owner; nota moves nothing; the cita function for each etapa × pendiente case.
- `npm run typecheck` errors only OUTSIDE lib/deals/, lib/crm/ and the tests above (tanda 2 fixes the rest). `npm run lint` clean on the files you touched.
- Report: files changed, any question you stopped on, and the list of files outside lib/deals that now fail typecheck.

Out of scope: lib/db/schema.ts, drizzle/, lib/queries/, lib/ingesta/, lib/calendly/, lib/migracion/, app/, components/ (except components/deals/transiciones.ts types), scripts/, docs/ (tanda 2 rewrites structure.md §3.1), the cortesía flow, alerts (128), properties per stage (143), the UI questions (tanda 3).
