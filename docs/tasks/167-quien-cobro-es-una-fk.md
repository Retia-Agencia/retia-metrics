---
id: 167
etapa: O4 (antes O2, semana 1)
serves: "docs/anotaciones.md A-51, A-15, A-16, A-17; ticket 159 (primera mitad); plan.md K-3"
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

## Ampliado el 3-oct (ola O4, sesión S5)

Va en la ola O4 parte 1 junto con lo que queda de Facturación, porque toca los mismos archivos (el abono):

5. **A-15:** "Cambiar cohorte" sale una sola vez en Facturación.
6. **A-16:** a 375 px el encabezado de Facturación (título, Cambiar cohorte, Registrar abono) cabe sin pegarse al borde.
7. **A-17:** sin valor vendido, el saldo dice el texto en la fuente normal, no en `cifra` (no es un número).
8. **K-3:** borrar `lib/calendly/buscar-llamada.ts`, que nadie importa (decidido el 29-sep). Comprobar con `grep`.

Archivos de más: `components/deals/ficha/ficha-pago.tsx`. **No toca** `ficha-transicion.tsx` (182) ni
`ficha-alertas.tsx` (184). Si agrega algo a `lib/queries/metricas-filtros.ts`, el 183 también puede tocarlo: quien
llegue segunda a `main` rebasa. La migración la genera y aplica la sesión central con el ok de Mani.

## Done cuando

- Un closer dado de alta **sin** `closer_id` registra abonos, crea deals a mano y aparece en caja y comisión.
- La caja y la comisión por closer cuadran antes y después contra producción (consulta de solo lectura).
- Ninguna lectura nueva decide con `closer_id`.
- Facturación sin "Cambiar cohorte" repetido, cabe a 375 px y el saldo sin valor no sale en `cifra`.
- `lib/calendly/buscar-llamada.ts` borrado; typecheck limpio.
