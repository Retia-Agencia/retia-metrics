# 0003 — Los roles no heredan: gerente y closer son conjuntos disjuntos

**Fecha:** 2026-08-18

Lo normal en un sistema de permisos es que el rol alto sea el rol bajo mas extras: un gerente
seria "un closer que ademas ve la caja".

**Decidimos que no.** `gerente` y `closer` son conjuntos disjuntos. Un endpoint marcado
`requireRole("gerente")` rechaza al closer, y uno marcado `requireRole("closer")` rechaza al
gerente. `/mi-dia` es del closer y el gerente no entra.

La razon es de negocio, no tecnica: la politica de Retia prohibe que un closer vea el comparativo
entre closers, el ranking, la caja o la pauta. Con herencia, cualquier permiso nuevo que se le
agregue al closer se lo gana el gerente sin que nadie lo piense, y la superficie que hay que
auditar crece sola. Sin herencia, cada acceso se declara una vez y se puede leer de un vistazo.

Esta decision esta testeada (`tests/roles.test.ts`, `tests/guards.test.ts`, `tests/paginas.test.ts`)
y la validacion es de servidor: esconder un boton no es seguridad.
