---
id: 070
etapa: E6
serves: "plan v2 §6 etapa 6 · tarea E6-2 · insumo §6, ADR 0021 (enmendado por el 0037)"
depends: [069, 085]
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

---

## ⚠️ Ampliacion 2026-09-21 (ADR 0044 punto 5): el ORIGEN va a la vista

Mani decidio que **un lead traido por un closer NO se auto-asigna**: *"los closers definen eso;
supongo que deben revisar bien el UTM."*

🎯 **La segunda mitad de esa frase es un requisito de esta pantalla, no una suposicion.** Si el closer
tiene que revisar el UTM para decidir si reclama un lead, **el origen tiene que estar a la vista aca**:

- el **area** a la que resuelve el envio (via el emparejador, ticket 085),
- los **UTM** tal como llegaron,
- **quien lo trajo**, si `traido_por_user_id` esta poblado (ticket 086).

**Sin esto, la regla del ADR 0044 punto 5 es imposible de cumplir** y el closer reclama a ciegas.
Un envio que cae en `(sin clasificar)` se muestra asi, no en blanco.

---

## Enmienda 2026-09-24 (ADR 0050): Pendiente Setteo y Unclaimed son secciones del Inbox

Este ticket deja de ser una pantalla propia: sus dos listas son las secciones "sin dueño" del Inbox
(ticket 071). Con Calendly (ADR 0049), un Agendado cuyo host es un closer registrado **ya nace con
dueño**; Unclaimed queda para los Agendados cuyo host no está registrado. Todo lo demás de este ticket
(la reja del reclamo, el origen a la vista) sigue igual.
