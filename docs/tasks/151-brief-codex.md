Repo: /Users/mani/Desktop/mani/work/retia/repos/retia-metrics-mani/.claude/worktrees/142 (branch 142-etapas-30x, up to date with main). Work ONLY in this folder. Do NOT commit (your sandbox cannot write .git; Claude commits). Do not push. Do not edit anything under docs/.

Goal: ticket 151 (docs/tasks/151-el-reenvio-sube-la-etapa-de-entrada.md, read it, 40 lines). A form re-send lifts an open deal that is still in an entry stage to the entry stage of that new submission (only upwards), and the CRM flags leads with 2+ submissions.

Decisions (already made, do not revisit):

1. Engine, lib/deals/etapas.ts FILAS_ETAPA: add three system arrows, no requisitos, no motivo:
   ["S1", "potencial", "registrado", "sistema"], ["S2", "potencial", "calificado", "sistema"], ["S3", "registrado", "calificado", "sistema"].
   requisitos.ts `requisitosDe`: S1-S3 require nothing (return []). They are only taken by the deal rule with actor { tipo: "sistema" }; a person gets the usual 403 (existing quienNoPuede logic). No other engine change.

2. lib/ingesta/regla-de-deals.ts `decidirAccionDeDeal(entrada, dealAbierto, cita)`: in the branch `entrada !== "agendado"` with an open deal, if `transicion(dealAbierto.etapa, entrada)` exists and its id is S1, S2 or S3, return a NEW action `{ tipo: "subir"; a: EtapaDeEntrada; nota: string }`; otherwise keep `nada` as today. Never compare stages by order: the S rows ARE the rule (only upward rows exist). The agendado branch does not change.
   `nota` (Spanish, one sentence, built by a small pure helper next to notaDeCita): S1 "Llegó la respuesta completa del formulario: el deal pasó de Potencial a Registrado."; S2/S3 "Llegó un envío con calidad High: el deal pasó de <Potencial|Registrado> a Calificado." (use NOMBRE_DE_ETAPA).
   `aplicarReglaDeDeal`: for `subir`, in the same transaction, `moverEtapa(tx, { dealId, a, actor: { tipo: "sistema" } })` then `dejarNotaDelSistema(tx, dealId, nota)` (lib/deals/nota-del-sistema.ts). If moverEtapa rejects (race: someone moved it), catch MovimientoRechazado and report it like the existing `mover` path does (rechazo in the result), never throw out of the ingestion.
   Update the decision table comment in regla-de-deals.ts with the new rows (Potencial/Registrado with a deal: "sube si hay flecha S; si no, nada").
   Add `subir` to the ResultadoIngesta.reglaDeDeals reporting the same way as `mover`.

3. Repeat-submission flag (ADR 0073 point 3). The count is `leads.numAplicaciones` (already = distinct (source, token); a partial and its complete count once). Do NOT recount submissions.
   - lib/queries/kanban.ts: the card gets `envios: number` (leads.numAplicaciones) and `leadId`. components/deals/tarjeta-deal.tsx: when `envios >= 2`, a `<Badge variant="info">{envios} envíos</Badge>` (Tinta, no hand colors) next to the pendiente badge. The card already links to the deal; do not add a second link on the card.
   - lib/queries/ficha-deal.ts: the ficha gets `lead.envios` (numAplicaciones) and `lead.id` if not already there. components/deals/ficha/ficha-cabecera.tsx: when `envios >= 2`, a line under the header badges: Badge info "{n} envíos" + a Link "Ver los envíos" to `/p/<programaSlug>/leads/<leadId>` (the lead ficha, ticket 073). If the cabecera lacks the program slug, take it as a prop from app/(app)/p/[programa]/deals/[id]/page.tsx (it has `programa.slug`).
   - Client components must not import VALUES from lib/ modules that load lib/db (AGENTS.md: run `npm run build`); types only, or props.

Read map (rg first; max ~150 lines per read; never cat whole docs):
- lib/deals/etapas.ts:55-80 (FILAS_ETAPA), lib/deals/requisitos.ts (requisitosDe switch)
- lib/ingesta/regla-de-deals.ts (decidirAccionDeDeal, AccionDeDeal, aplicarReglaDeDeal, notaDeCita) in chunks
- lib/ingesta/etapa-de-entrada.ts (EtapaDeEntrada), lib/deals/nota-del-sistema.ts
- lib/queries/kanban.ts (card type + select), components/deals/tarjeta-deal.tsx
- lib/queries/ficha-deal.ts (lead part of FichaDeDeal), components/deals/ficha/ficha-cabecera.tsx, app/(app)/p/[programa]/deals/[id]/page.tsx
- tests: tests/ingesta-regla-de-deals.test.ts (decision tests + entrada helper), tests/deal-etapas.test.ts, tests/mover-etapa.test.ts (sistema vs person arrows), tests/kanban.test.ts, tests/ficha-deal-lectura.test.ts, tests/pregunta-de-etapa.test.ts (S1-S3 are sistema: must NOT need an answer; if that test complains, it means the row is wrong)

Tests to add (both directions each):
- decidirAccionDeDeal: potencial + completo Low/sin calidad → subir a registrado; potencial + High → subir a calificado; registrado + High → subir a calificado; registrado + completo Low → nada; calificado + High → nada; en_gestion + High → nada; contactado + High → nada; agendado entrada unchanged.
- integration (ingerirEntradas with aplicarReglaDeDeals: true): partial without quality opens Potencial, then its complete High (new token) lifts to Calificado with one historial row (sistema, userId null) and the nota in deal_actividades; a deal moved by a person to en_gestion is not lifted.
- engine: S1-S3 by a person → 403 and no write; by sistema → moves.
- queries: kanban card and ficha expose envios = numAplicaciones.

Constraints: follow AGENTS.md (Spanish UI/comments in the surrounding style, no accents in identifiers, moverEtapa only writer of etapa, never compare stages by order, Tinta). No new deps, no migration (no schema change needed), no TODO stubs, no dead code. Do NOT run `npm test` (your sandbox fails with `spawnSync ps EPERM`; do not work around it). Run `npm run typecheck` and `npm run lint`. List the test files Claude must run.
Reading budget: ~50 tool calls. If a decision comes up that is not listed: STOP and report the question.
Out of scope: docs/ (Claude writes ADR 0073, manual, structure.md), merging/splitting leads, reopening closed deals.
