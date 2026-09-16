---
id: 005
fase: F2
serves: "spec §5 criterios 2 y 3"
depends: [004, 010]
status: todo
---

# 005 — Dashboard real en /programas/[slug]

## Objetivo
Un closer o gerente abre el dashboard de cualquier programa y ve el día, la semana, la cohorte y
el mes, con filtro por fecha y closer.

## Alcance
- Dentro: reemplazar el `ProximaFase` de `/programas/[slug]` (ticket 010) con tarjetas y tablas
  del ticket 004. La descripción de la cohorte sale de la base, no de texto fijo.
- Dentro: selector de rango (hoy, esta semana, cohorte, mes, custom) y de closer.
- Fuera: historial de persona (006), snapshot (021), gráficas (se agregan si hacen falta, con su
  dependencia en ese momento).

## Done cuando
- [ ] Un closer y un gerente ven los mismos números (ADR 0009).
- [ ] El filtro cambia los números.
- [ ] Todo monto lleva su moneda al lado.
- [ ] Un programa creado desde `/ajustes` muestra su dashboard sin cambios de código.
