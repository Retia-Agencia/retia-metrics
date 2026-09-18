---
id: 006
fase: F2
serves: "spec §1 pilar 2 — historial de una persona"
depends: [005]
status: done
---

# 006 — Historial de una persona

## Objetivo
Desde el dashboard, entrar a una persona muestra sus llamadas, ventas y abonos en orden.

## Alcance
- Dentro: `/personas/[id]` con llamadas (resultado, fecha, closer, nota, motivo, seguimiento),
  ventas y abonos.
- Fuera: editar o borrar registros pasados.

## Done cuando
- [x] La URL usa el `personId` (UUID), nunca el correo.
- [x] Muestra el saldo pendiente de cada venta (precio del contrato menos abonos).

## Notas de cierre (17-sep)

**El dashboard no lista personas**, así que la frase del objetivo ("desde el dashboard, entrar a
una persona") describía una puerta que no existía. El enlace se puso en el buscador de `/mi-dia`,
que es el único lugar donde hoy se listan personas; agregarle una lista al dashboard habría sido
una feature nueva, fuera de este ticket.

**La ven gerente y closer**, igual que el dashboard desde el que se entra (ADR 0009). Ningún ADR
pide restringirla más.

**Un id que no es uuid es 404 sin tocar la base**: `where id = 'lead@correo.co'` sobre una columna
uuid revienta en Postgres, y un 500 diría que el id existe pero algo falló. De paso corta que
alguien pruebe a pasar un correo por la URL.
