---
id: 113
etapa: E0
serves: "plan-reparto §3 · plan.md §7.1 R5 · ADR 0047 (enmienda del 28-sep) · aprobado por Mani el 28-sep"
depends: []
status: done
---

# 113 — Base local para desarrollar pantallas

## Objetivo

La única base es producción (ADR 0047, enmienda). Cada clic de prueba al construir el Kanban o el
Inbox escribiría ahí. Hace falta una base local con el esquema real y datos de ejemplo, que no sea otro
proyecto de Supabase.

## Alcance

- **Dentro:** Postgres local (Docker o equivalente) con todas las migraciones de `drizzle/` aplicadas y
  un seed de ejemplo: dos programas, closers con membresía, leads en varias etapas, llamadas y abonos.
- **Dentro:** un comando de `npm` que la levante y una variable que la app use en `npm run dev`, sin
  tocar `.env.local` de producción por accidente (mirar el ref antes de escribir, `AGENTS.md`).
- **Dentro:** la misma receta corre en el CI ([112]) si se agrega Playwright.
- **Fuera:** copiar datos reales de producción.

## Done cuando

- [ ] Un clon limpio levanta la app contra la base local con un solo comando documentado en
      `docs/operations.md`.
- [ ] El seed pasa por las funciones de `lib/` (ADR 0029: no hay `db.insert` crudo sobre catálogo).
