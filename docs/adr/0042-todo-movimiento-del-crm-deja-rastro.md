# 0042 — Todo movimiento del CRM deja rastro, y el rastro se escribe desde el dia uno

**Fecha:** 2026-09-21 · **Estado:** aceptado (Mani, 21-sep; decision **D6** del plan v2) ·
**Implementacion:** el rastro en la etapa 1; la **pantalla** en la etapa 6 ·
**Amplia:** ADR 0029 (`change_log` sale del catalogo y llega a las tablas operativas) ·
**Aplica:** ADR 0026, ADR 0037

## De donde sale

Mani, 21-sep, textual:

> *"modificar la info de un Deal se puede hacer cuando sea necesario (para asegurar integridad,
> todo movimiento en el CRM debe quedar en logs en Nerd Stats, trackeado, eso puede ser de lo
> ultimo que configuramos)"*

Son dos mitades y se separan a proposito, porque una es una decision de producto y la otra de
arquitectura.

## Mitad 1 · Un Deal se edita

**Un deal no es inmutable.** Producto, cohorte, owner, fechas y motivo se corrigen cuando haga
falta.

Es coherente con el **ADR 0038**: si editar fuera imposible, **anular seria el unico remedio para
un dato mal puesto** y terminaria usandose para todo, que es exactamente lo que ese ADR evita. Un
remedio caro se usa mal; un remedio que borra el hecho se usa para esconder.

Lo que **no** se edita a mano es la etapa (se mueve por `moverEtapa`, ADR 0037) ni `lead.estado`
(lo escribe el sync, ADR 0032). Son las dos redundancias declaradas del modelo: en el momento en
que una persona las edita, pueden divergir de su fuente.

## Mitad 2 · El rastro, y CUANDO se escribe

**Toda escritura del CRM deja fila con quien, cuando, y que cambio de que a que.** No solo el
catalogo, que es lo que `change_log` cubre hoy, sino **`deals`, `calls`, `abonos` y
`deal_actividades`**.

⚠️ **Correccion explicita al "eso puede ser de lo ultimo".** Lo que va de ultimo es la
**pantalla**; el **rastro** se escribe desde la etapa 1.

La razon es la misma del **ADR 0029**, y no es una preferencia: **si se retrofitea al final, todo
lo escrito antes no tiene historia y no hay manera honesta de fabricarla.** 🩸 Ya paso exacto en
este repo: los 5 enlaces de PayPal entraron a `production` el 18-sep con `change_log` en **0**, y
**siguen sin rastro a proposito**, porque un historial de auditoria fabricado se ve identico al de
verdad. Dentro de tres meses, *"¿quien puso estos links?"* no tiene respuesta en la base.

**La forma, copiada del molde que ya funciona:**

- La escritura y su fila de `change_log` van en **la misma operacion**. No hay forma de escribir
  sin que quede registrado; **no hay que acordarse de registrar** (ADR 0029).
- El **quien** sale de la sesion, nunca del input. Desde un script, de `actorDelScript()`
  (`SCRIPT_ACTOR_EMAIL`), que **se niega a arrancar sin el**.
- Un **guardian** recorre `lib/`, `app/`, `components/` y `scripts/` y falla si aparece un
  `insert`/`update` sobre esas tablas fuera de la funcion que registra. Se **muerde en los dos
  sentidos** antes de darlo por bueno (invariante 3 del plan v2): el guardian del molde de catalogo
  paso en verde con un `DELETE` clandestino inyectado, y por eso esta regla esta escrita.

**Que NO va a `change_log`:** el movimiento de etapa, que tiene su propia tabla,
`deal_etapa_historial` (ADR 0037), porque no es "un campo cambio de X a Y" sino el hecho central
del que salen la conversion y el tiempo en etapa. Son dos rastros con dos formas porque contestan
dos preguntas; duplicar el movimiento en los dos crearia la divergencia que el invariante 1
prohibe.

## Mitad 3 · La pantalla (etapa 6, y ahi si de ultimo)

Bitacora en Nerd Stats: toda escritura del CRM, filtrable por usuario, tabla y rango. Es la
**pantalla** de un rastro que para entonces lleva meses escribiendose. Va de ultimo porque
**mirar** el historial no urge; **tenerlo** si.

## Consecuencias

- **A favor:** *"¿quien cambio esto?"* tiene respuesta desde el primer dia de uso real, que es el
  unico dia en que se puede garantizar.
- **A favor:** editar deja de dar miedo, y por eso anular deja de usarse como goma de borrar.
- **En contra:** `change_log` crece mucho mas rapido. Hoy tiene 2.340 filas y 600 kB sobre una base
  de 15 MB (medido el 19 y el 21-sep); con las tablas operativas adentro el ritmo lo marca la
  operacion diaria, no la configuracion. A la escala de Retia (5 usuarios) no es un problema; se
  vigila con las cifras de Nerd Stats, no con una politica inventada hoy.
- **En contra:** cada mutacion nueva tiene que pasar por la funcion que registra, y eso es una
  friccion real al escribir codigo. Es la friccion correcta: es la misma que impide que exista un
  `db.insert` suelto.
- **Abierto:** cuanto se guarda del "antes" en un `update` grande. Guardar la fila entera es caro y
  guardar solo los campos tocados es lo util. Se decide con la primera mutacion, no aqui.

## Alternativas descartadas

**Triggers de Postgres.** Atrapan **toda** escritura, incluida la de un script suelto, y eso suena
mejor. Pero el "quien" vive en la sesion de la app y no en la de la base (el driver es
`neon-http`, sin sesion ni transacciones interactivas), asi que el trigger tendria que leer un
`SET` que ese driver no puede mantener. Quedaria un rastro sin actor, que es medio rastro.

**Dejar el rastro para el final, como Mani dijo primero.** Rechazado con el precedente de los 5
enlaces de PayPal, que es el mismo error ya cometido en esta misma base.
