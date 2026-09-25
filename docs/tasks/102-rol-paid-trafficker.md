---
id: 102
etapa: E1b
serves: "ADR 0052"
depends: [094]
status: todo
---

# 102 — El rol Paid Trafficker y la pregunta `manejaPauta`

## Objetivo

Que Pauta cree sus campañas y sus links dentro del CRM, sin ver ni administrar nada más.

## Alcance

- **Dentro:** el valor `paid_trafficker` en el enum de roles (migración de la sesión principal) y la
  pregunta `manejaPauta` en `lib/auth/roles.ts`. La cumplen el paid trafficker, el gerente y el
  developer.
- **Dentro:** acceso a Campañas de sus programas (membresía, ticket 094): crear, editar, generar links y
  cargar gasto.
- **Dentro:** alta de usuarios con este rol desde `/ajustes/usuarios`.
- **🔴 Por decidir con Gerencia:** qué ve del Dashboard. Propuesta: la parte de pauta de sus programas,
  sin caja ni comparativo entre closers.
- **Fuera:** deals, llamadas, abonos, administración.

## Done cuando

- [ ] Nada en `app/` ni `lib/` pregunta `rol === "paid_trafficker"` (el guardián de roles lo caza).
- [ ] Un paid trafficker que forja la petición a una ruta de deals recibe 403, y la base no se mueve.
- [ ] La vista `todo` del developer sigue siendo superset de todas (ticket 032).

## Kiro

Parcial. El código y los tests sí, con revisión de permisos. La migración, la sesión principal.
