---
id: 009
fase: F0
serves: "ADR 0012 — regla verificable: ningún programa escrito a mano"
depends: []
status: done
---

# 009 — Test guardián: ningún programa escrito en el código

## Objetivo
Un test falla si alguien escribe el slug o el nombre de un programa en `lib/`, `app/` o
`components/`.

## Alcance
- Dentro: `tests/contrato-extension.test.ts` que recorre esos tres directorios y busca
  `comunicarte`, `tactical` y `vieira` (sin distinguir mayúsculas). Reporta archivo y línea.
- Dentro: excepciones explícitas y comentadas solo si son inevitables (por ejemplo un comentario
  histórico en `lib/sheets/dedup.ts`); preferir reescribir el comentario.
- Fuera: arreglar las violaciones. Eso es el ticket 010. Este test nace en rojo y 010 lo pone en
  verde (TDD).

## Done cuando
- [x] El test existe, corre con `npm test` y hoy lista las violaciones conocidas
      (`lib/nav.ts`, `app/(app)/ajustes/fuentes/page.tsx`, las dos páginas fijas, `app/layout.tsx`).
- [x] Se marca `it.fails` o equivalente hasta que 010 cierre, para no romper el CI mientras tanto,
      con un comentario que lo explique.
