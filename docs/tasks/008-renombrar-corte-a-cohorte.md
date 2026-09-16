---
id: 008
fase: F0
serves: "ADR 0014"
depends: []
status: todo
---

# 008 — Renombrar Corte a Cohorte en código y base

## Objetivo
No queda la palabra "corte" en el código, la UI ni la base (salvo insumos históricos y ADR viejos).

## Alcance
- Dentro: `lib/db/schema.ts`: `estadoCorteEnum` → `estadoCohorteEnum` (`estado_cohorte`),
  `trmCorte` → `trmCohorte` (`trm_cohorte`), tipo `Corte` → `Cohorte`, comentarios.
- Dentro: migración escrita a mano en `drizzle/` con `ALTER TYPE "estado_corte" RENAME TO
  "estado_cohorte"` y `ALTER TABLE "cohorts" RENAME COLUMN "trm_corte" TO "trm_cohorte"`, con su
  snapshot y entrada en `_journal.json` coherentes (verificar con `npx drizzle-kit check`).
- Dentro: textos de UI (`ajustes/page.tsx`, páginas de programa), `scripts/seed-datos.ts`,
  `README.md` (`AGENTS.md` y los docs ya se actualizaron el 16-sep).
- Fuera: **aplicar** la migración contra Neon. Producción y preview comparten base (S-14): la
  aplica Mani a mano con `npm run db:migrate`.

## Done cuando
- [ ] `grep -rni corte lib app components scripts tests` no devuelve nada.
- [ ] La migración no borra ni recrea nada (solo `RENAME`).
- [ ] `npm test`, `npm run typecheck` y `npm run lint` limpios.
