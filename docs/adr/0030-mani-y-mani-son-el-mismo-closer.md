# 0030 — La identidad del closer: FK para lo nativo, nombre normalizado solo para el histórico (`Mani` y `mani` son el mismo closer)

**Fecha:** 2026-09-18 · **Reescrito:** 2026-09-27 (consolida el ADR retirado 0011 y el modelo del
deal) · **Estado:** aceptado

## El problema

Las hojas escriben al closer como texto a mano (`Andrea`, `Andrea `, `juanse`, `Juanjo`), y en el MVP
el CRM copiaba ese mismo texto a sus registros. El 18-sep, en el primer recorrido real, el
`closer_id` de Mani quedó en `mani` y el de otra closer en `Maru`. Comparado como texto crudo, `Mani`
y `mani` son **dos closers en todas las métricas, sin un solo error**: el comparativo muestra dos
filas, el filtro devuelve la mitad y la reja de la anulación le dice "lo registró otro" a quien lo
registró.

## Decidimos

**1. Todo registro nativo apunta al usuario por FK, nunca por texto.** El dueño del deal
(`deals.owner_user_id`), quien hizo la llamada (`calls.closer_user_id`, ticket 057), quien registró
el abono (ticket 060) y quien trajo al lead (`leads.traido_por_user_id`, ADR 0044). Una FK no tiene
ortografía que defender.

**2. `users.closer_id` (texto) existe solo para mapear lo que escribieron las hojas** a una cuenta:
el histórico que entra con la migración de la etapa 7. Se guarda como se escribió (la ortografía de
la hoja es suya, ADR 0004), pero la pregunta *"¿son el mismo closer?"* la contesta
`lib/closers/identidad.ts` y nadie más, ignorando mayúsculas y espacios:

| Pregunta | Función |
|---|---|
| ¿son el mismo closer? (en memoria) | `mismoCloser(a, b)` |
| ¿esta columna es este closer? (en SQL) | `igualCloser(columna, valor)` |
| clave para agrupar | `claveDeCloser` / `claveDeCloserSql` |

**El `closer_id` de una cuenta solo lo edita quien administra; el closer lo ve en lectura** (Mani,
18-sep, ticket 031). El momento de riesgo es el primer valor: una cuenta nueva con el campo vacío que
se pusiera `Andrea` heredaría el histórico de otra closer.

**3. Que dos cuentas no reclamen el mismo closer lo garantiza la base:** índice único
`users_closer_id_normalizado_idx` sobre la forma normalizada (migración 0015), parcial porque
`closer_id` nulo es frecuente (un gerente no tiene).

**4. Un guardián** (`tests/closer-identidad.test.ts`) falla si alguien compara `closer_id` en crudo
(`eq`, `groupBy`, `===`), probado en los dos sentidos: caza lo malo y **no** marca la solución.

**5. El código del closer para su link de captación es opaco, nunca el nombre** (ADR 0051).

## La trampa que casi entra

La normalización en SQL se escribió primero con `'\\s+'` dentro de una plantilla `sql` de JavaScript:
`\s` se cocina a `s`, y el regex que llegaba a Postgres colapsaba las **eses** (`Jose` → `jo e`). Por
eso se usa la clase POSIX `'[[:space:]]+'`, y hay un test que compara la normalización de SQL contra
la de JavaScript **ejecutándolas contra el motor**. Regla: un regex con backslash dentro de `sql` pasa
por dos capas de escape; pruébalo contra la base.

## Lo que no resuelve

Que alguien escriba `Andre` en vez de `Andrea` en una hoja: eso no es de mayúsculas. En el histórico
se resuelve a mano al mapear (etapa 7); en lo nativo no puede pasar, porque es FK.
