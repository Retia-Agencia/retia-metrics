---
id: 005
serves: "spec §5 criterios 2 y 3"
status: todo
---

# 005 — Dashboard real en /comunicarte y /tactical-investor

## Objetivo
Un closer o un gerente abre el dashboard del programa y ve cierres, tasas y caja en vivo,
filtrando por closer y por fecha.

## Alcance
- Dentro: reemplazar el `ProximaFase` de ambas páginas con la tabla/tarjetas de cierres, tasas y
  caja por closer, usando el ticket 004, con selector de rango de fecha.
- Fuera: no incluye historial de persona (ticket 006). No genera PDF (fuera de spec).

## Done cuando
- [ ] Un closer y un gerente ven exactamente los mismos números (ADR 0009).
- [ ] El filtro de fecha cambia los números mostrados.
- [ ] Los montos muestran la moneda (USD) junto al número.

## Notas
Depende del ticket 004. El guard de rol de estas páginas ya quedó actualizado
(`paginaConRol("gerente", "closer")`) en la sesión de `/grill-with-docs`; no hace falta tocarlo
de nuevo.
