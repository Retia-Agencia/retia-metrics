---
id: 108
etapa: E3
serves: "decisión de Mani del 28-sep (cierra A6 de docs/plan.md §7) · ADR 0004 (corte directo)"
depends: [106]
status: done
---

# 108 — Retirar el sync de Sheets

## Objetivo

Mani, 28-sep: *"lo de sync sheets se DESCARTA, vamos a usar el webhook directo"*. Los leads entran solo
por el webhook (106). El sync vivo de las hojas deja de existir: código muerto que sigue desplegado es
una segunda puerta de entrada que nadie vigila.

## Qué se va

- El cron: `app/api/cron/sync/route.ts`. Su entrada en `vercel.json` ya se quitó el 28-sep (metió 5.343
  leads sin envíos en producción; ver `docs/operations.md`).
- La corrida manual: `app/api/sync/[programa]/route.ts`, `components/boton-sincronizar.tsx` y su uso en
  `/ajustes/fuentes`.
- `lib/sheets/sync.ts` (corridas, candado, reaper) y `lib/sheets/plan-sync.ts` si solo los usa el sync.
- `scripts/sincronizar.ts` (`npm run sync`) y `scripts/backfill-fechas-centinela.ts` (ya ejecutado).
- Sus tests: `tests/sync-candado.test.ts`, `tests/sync-entrada.test.ts`, `tests/sync-permisos.test.ts`,
  `tests/plan-sync.test.ts` (lo que pruebe solo el sync).
- La excepción de `proxy.ts` para `/api/cron/sync` y la de `exigirMismoOrigen` si ya no queda ningún
  route handler que mute (`lib/auth/origen.ts`; si queda sin llamadores, se borra con su test).

## Qué se queda

Lo que sirve para leer una hoja **una sola vez** (el traslado y la migración de la etapa 7, 078): la
lectura (`lib/sheets/leer.ts`, `auth.ts`), el mapeo y `parsearFecha` (`mapeo.ts`), el dedup, el
adaptador de Sheets (`lib/ingesta/adaptador-sheets.ts`) y la prueba de una fuente de hoja. Si una pieza
queda sin ningún llamador, se reporta: no se borra a ciegas.

## La base

`sync_runs` y su índice quedan **sin tocar** en este ticket: quitarlos es una migración y la hace la
sesión principal, si Mani la quiere. Lo mismo `sources.estado` (salud del 055) y `tz_fechas` (053).

## Done cuando

- [x] `grep -rn "cron/sync\|api/sync\|sincronizar" app lib components scripts proxy.ts vercel.json` no
      devuelve nada vivo (solo `sincronizarMembresias`, que es de usuarios).
- [x] `/ajustes/fuentes` carga y ya no ofrece sincronizar.
- [x] `npm test` (1.053), `npm run typecheck`, `npm run lint` y `npm run build` limpios.
- [ ] Quitar de Vercel `CRON_SECRET` y `SHEET_ID_*` (lo hace Mani o con su ok).
      ⚠️ **`GOOGLE_SERVICE_ACCOUNT_JSON_B64` se QUEDA en Vercel:** "probar" y activar una fuente de hoja
      en `/ajustes/fuentes` leen la hoja en tiempo de ejecución (`lib/sheets/probar-fuente.ts`). Quitarla
      rompería esa pantalla sin error de build.

## Cierre, 28-sep

- Se fueron las dos rutas, el botón, `lib/sheets/sync.ts`, `plan-sync.ts`, `lib/auth/origen.ts` (sin
  llamadores), los scripts `sincronizar`, `backfill-fechas-centinela` y `cron-secret.sh`, y los tests
  `sync-candado`, `sync-entrada`, `sync-permisos` y `plan-sync`. De `zona-por-fuente` y `fuentes-webhook`
  solo salieron los casos que corrían el sync; los de `parsearFecha` y el dedup siguen.
- `/nerd-stats` ya no muestra `CRON_SECRET` (habría dicho "FALTA" para siempre). La tarjeta "Últimas
  sincronizaciones" sigue: lee `sync_runs`, que es historial.
- `FuenteLeida` se mudó a `lib/queries/fuentes.ts`, su único lector.
- `eslint.config.mjs` ignora `.claude/**`: los worktrees de otras sesiones dejaban `npm run lint` sin
  memoria.

## Kiro

Sí, con revisión. Sin migración.
