---
id: 078
etapa: E7
serves: "plan v2 §6 etapa 7 · tarea E7-2 · ADR 0029, invariante 2 del plan v2"
depends: [077]
status: todo
---

# 078 — La migracion pasa por la MISMA ingesta, nunca por inserts crudos

## Objetivo

Que la migracion one-time no sea un segundo camino de escritura.

## Por que

- **La ingesta es UNA funcion** (invariante 2): si la migracion escribe por su lado, implementa
  otra vez la identidad del lead, los centinelas y la regla de deals, y **diverge en silencio**.
- **ADR 0029:** un script que mete filas de negocio en una base **con datos reales** hace lo mismo
  que un humano en una pantalla. Llama a la funcion y **nunca a `db.insert` en crudo**. De ahi
  salen gratis la validacion y el rastro: **no hay que acordarse de registrar**.
- 🩸 Los 5 enlaces de PayPal entraron a `production` con `change_log` en **0** y siguen sin rastro
  a proposito. Esta migracion va a escribir miles de filas: sin rastro, no hay forma de auditarla
  despues ni de deshacerla con criterio.

## Alcance

- **Dentro:** el script de migracion, llamando a `ingerirEnvio` y a las mutaciones del CRM.
- **Dentro:** el actor sale de `actorDelScript()` (`SCRIPT_ACTOR_EMAIL`), que **se niega a arrancar
  sin el**.
- **Dentro:** idempotencia: correrlo dos veces no duplica. Se prueba corriendolo dos veces.
- **Dentro:** primero **`dev` completo y verificado**; `production` **solo con el ok explicito de
  Mani** (ADR 0018).
- **Fuera:** las excepciones del ADR 0029 (sembrar una base vacia, el acceso de emergencia). **No
  aplican aqui**: la base esta viva.

## Done cuando

- [ ] Cero `db.insert` crudos en el script.
- [ ] Toda fila migrada tiene su rastro en `change_log`.
- [ ] Corrido dos veces sobre `dev`, los conteos no cambian.
- [ ] Ok explicito de Mani antes de `production`.

## Kiro

Si, con revision.
