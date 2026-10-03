---
id: 167
etapa: O2 (semana 1)
serves: "docs/anotaciones.md A-51; ticket 159 (primera mitad)"
depends: []
status: todo
---

# 167 — Quién cobró es una FK a `users`, y un usuario nuevo no necesita `closer_id`

## Decisión (Mani, 2-oct)

La identidad de un usuario es **`users.id`**: la genera la base (`uuid`, `defaultRandom()`), es única, nunca se
repite y es un string. No se crea un segundo código automático: dos identidades para una persona son el bug de
`Mani` y `mani` (ADR 0030). `closer_id` (texto escrito a mano) queda solo para reconocer al closer en las hojas
(078) y se retira en el 159, después del corte.

Aparte, y no aquí: el **código público del closer** para su link de captación (`utm_content`, ADR 0051) sí lo genera
el CRM, único y opaco. Vive en el 086.

## Alcance

1. Migración aditiva: `abonos.registrado_por_user_id` (FK a `users`, nula para la historia). `registrarAbono`
   (`lib/deals/abonos.ts`) la escribe con el actor de la sesión.
2. Relleno: lo que se pueda casar desde `abonos.closer_id` con `mismoCloser` (`lib/closers/identidad.ts`), sin
   adivinar; lo que no case se lista y queda nulo.
3. Caja por closer (`delCloser` en `lib/queries/metricas-filtros.ts`), comisión (`lib/queries/comision.ts`) y
   "crear a mano" (`lib/deals/crear-a-mano.ts`) leen la FK. Un abono histórico sin FK sigue contando por el texto
   hasta el 159.
4. `/ajustes/usuarios` (`lib/catalogo/usuarios.ts`): `closerId` deja de ser obligatorio para el rol closer.

## Archivos

`lib/db/schema.ts` y `drizzle/` (la cola de migraciones: la genera y aplica la sesión principal con el ok de Mani),
`lib/deals/abonos.ts`, `lib/queries/metricas-filtros.ts`, `lib/queries/comision.ts`, `lib/deals/crear-a-mano.ts`,
`lib/catalogo/usuarios.ts`, `components/usuarios-admin.tsx`. **Va después del 160** si los dos tocan métricas a la vez.

Tests: `tests/abonos-del-deal.test.ts`, `tests/saldo-centralizado.test.ts`, `tests/comision.test.ts`,
`tests/crear-deal-a-mano.test.ts`, `tests/closer-identidad.test.ts`, `tests/metricas-con-filas.test.ts`.

## Done cuando

- Un closer dado de alta **sin** `closer_id` registra abonos, crea deals a mano y aparece en caja y comisión.
- La caja y la comisión por closer cuadran antes y después contra producción (consulta de solo lectura).
- Ninguna lectura nueva decide con `closer_id`.
