# 0003 — Los roles no heredan: gerente y closer son conjuntos disjuntos

**Fecha:** 2026-08-18 · **Reescrito:** 2026-09-27 (consolida los ADR 0009, 0025, 0048 y 0052) ·
**Estado:** aceptado

Lo normal en un sistema de permisos es que el rol alto sea el rol bajo más extras: un gerente sería
"un closer que además administra".

**Decidimos que no.** `gerente` y `closer` son conjuntos disjuntos. Una ruta exclusiva de gerente
(la administración: `/ajustes`) rechaza al closer, y una exclusiva de closer rechaza al gerente.
Cada acceso se declara una vez y se lee de un vistazo.

**Por qué.** Con herencia, cualquier permiso nuevo del closer se lo gana el gerente sin que nadie lo
piense, y la superficie que hay que auditar crece sola.

**Lo que esta decisión NO decide, y dónde vive:**

- **Qué datos ve cada rol dentro de un programa** lo decide el ADR 0048 (el closer ve solo los
  programas de su membresía y, dentro de ellos, todo). La disjunción rige el acceso a rutas, no la
  visibilidad del dashboard.
- **Hay dos roles más:** `developer`, la única excepción a la disjunción (ADR 0025), y
  `paid_trafficker` (ADR 0052).
- **Las preguntas de permiso** viven en `lib/auth/roles.ts`: `esAccesoTotal`, `esAdministrador`,
  `trabajaLeads` y, cuando entre, `manejaPauta`. Nunca un `rol === "..."` escrito a mano.

**Garantía.** La validación es de servidor en cada ruta (`requireRole`, `paginaConRol`): esconder un
botón no es seguridad. Probado en `tests/roles.test.ts`, `tests/guards.test.ts` y
`tests/paginas.test.ts`.
