---
id: 006
fase: F2
serves: "spec §1 pilar 2 — historial de una persona"
depends: [005]
status: todo
---

# 006 — Historial de una persona

## Objetivo
Desde el dashboard, entrar a una persona muestra sus llamadas, ventas y abonos en orden.

## Alcance
- Dentro: `/personas/[id]` con llamadas (resultado, fecha, closer, nota, motivo, seguimiento),
  ventas y abonos.
- Fuera: editar o borrar registros pasados.

## Done cuando
- [ ] La URL usa el `personId` (UUID), nunca el correo.
- [ ] Muestra el saldo pendiente de cada venta (precio del contrato menos abonos).
