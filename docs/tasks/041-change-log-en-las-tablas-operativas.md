---
id: 041
etapa: E1
serves: "plan v2 §6 etapa 1 · tarea E1-7 · ADR 0042 (D6), molde del ADR 0029"
depends: [037, 038]
status: done
---

# 041 — `change_log` cubre las tablas operativas, desde el primer dia

> Parte de la etapa 1: **una rama, una migracion** (`0020`).

## Objetivo

Que **toda escritura del CRM** deje fila con quien, cuando y que cambio de que a que: `deals`,
`calls`, `abonos` y `deal_actividades`, no solo el catalogo.

## Por que AHORA y no "de lo ultimo"

Mani dijo *"eso puede ser de lo ultimo que configuramos"*. **Lo ultimo es la PANTALLA (ticket 076),
no el rastro.** 🩸 Si se retrofitea al final, todo lo escrito antes no tiene historia y **no hay
manera honesta de fabricarla**: los 5 enlaces de PayPal entraron a `production` el 18-sep con
`change_log` en 0 y siguen sin rastro a proposito, porque un historial de auditoria fabricado se ve
identico al de verdad. ADR 0042, mismo argumento del ADR 0029.

## Alcance

- **Dentro:** la escritura y su fila de `change_log` en **la misma operacion**, por el molde de
  `lib/catalogo/`. No hay forma de escribir sin registrar; **no hay que acordarse**.
- **Dentro:** el **quien** sale siempre de la sesion, nunca del input. Desde un script,
  `actorDelScript()` (`SCRIPT_ACTOR_EMAIL`), que se niega a arrancar sin el (ADR 0029).
- **Dentro:** un guardian que recorre `lib/`, `app/`, `components/` y `scripts/` y falla si hay un
  `insert`/`update` sobre esas cuatro tablas fuera de la funcion que registra.
- **Fuera:** el movimiento de etapa. Tiene su propia tabla, `deal_etapa_historial` (ticket 045), y
  duplicarlo en los dos rastros crearia la divergencia que el invariante 1 del plan prohibe.
- **Fuera:** la pantalla de la bitacora (ticket 076).

## Lo que hay que decidir al escribirlo

Cuanto del "antes" se guarda en un `update`. **La fila entera es cara; solo los campos tocados es
lo util.** Se decide aqui, con la primera mutacion delante, y se anota en el ADR 0042.

## Done cuando

- [ ] Ninguna escritura sobre `deals`, `calls`, `abonos` o `deal_actividades` puede ocurrir sin su
      fila de `change_log`.
- [ ] El guardian esta **mordido en los dos sentidos**.
- [ ] Un test comprueba que el actor sale de la sesion y que un `id` de actor metido en el cuerpo
      de la peticion **se ignora** (misma prueba que el ticket 031).

## Kiro

Si, con revision. El diseno del contrato del rastro, no.
