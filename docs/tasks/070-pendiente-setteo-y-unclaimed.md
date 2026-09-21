---
id: 070
etapa: E6
serves: "plan v2 §6 etapa 6 · tarea E6-2 · insumo §6, ADR 0021 (enmendado por el 0037)"
depends: [069]
status: todo
---

# 070 — Pendiente Setteo para reclamar, y Unclaimed

## Objetivo

Las dos listas por las que un deal consigue dueno. **El reclamo reemplaza a la rotacion ciega del
script.**

- **Pendiente Setteo**: tabla de deals sin owner en etapa 1, donde el closer **reclama**.
- **Unclaimed**: los **Agendados sin owner**, que es el caso urgente (ya hay una llamada agendada
  y nadie la esta mirando).

## Alcance

- **Dentro:** las dos listas, el boton de reclamar y la reasignacion por un gerente.
- **Dentro:** al reclamar un Agendado, el closer **completa la Call**: link de Calendly y fecha
  (ticket 057).
- **Dentro:** ordenar por **antiguedad**: en Unclaimed, lo viejo es lo que duele.
- **Dentro:** el rastro de quien reclamo y cuando (ADR 0042).
- **Fuera:** reparto automatico. **No existe** y no se echa de menos: "sin owner" es un estado
  valido (ADR 0021).

## La reja, en el servidor

Reclamar y reasignar son **permisos**, y esconder el boton no es seguridad. Reasignar es de quien
administra; reclamar, de quien `trabajaLeads` (**closer y developer, no el gerente**, ADR 0003 y
0025). ⚠️ **Nada de `rol === "closer"` escrito a mano**: eso es justo lo que dejo al developer
afuera el 18-sep.

## Done cuando

- [ ] Un closer reclama y queda como owner, con rastro.
- [ ] Un gerente reasigna; un closer no puede reasignar el deal de otro.
- [ ] **La regla se probo forjando la peticion**, no mirando que el boton no aparezca: se captura
      el `Next-Action` desde la vista que si puede y se invoca desde la que no. Se espera 403 y
      **la base sin moverse**.
- [ ] Un `id` de owner metido en el cuerpo se ignora: el objetivo sale de la sesion.

## Kiro

Si, con revision visual y de permisos.
