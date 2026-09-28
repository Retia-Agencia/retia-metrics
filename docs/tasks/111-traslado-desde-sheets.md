---
id: 111
etapa: E3
serves: "plan.md §4.3d · ADR 0004 · ADR 0054 · plan-reparto §3 y E1 (carril Alejo)"
depends: [106, 048]
status: todo
---

# 111 — Traslado de leads y envíos desde Sheets, una sola vez

## Objetivo

Producción solo tiene los leads que entraron por el webhook desde el 28-sep. Lo que está en las hojas
entra **una vez**, por la misma puerta que el webhook (`ingerirEntradas`), para que el CRM tenga la
historia sin inventar nada.

## Alcance

- **Dentro:** leer la pestaña fuente de cada programa (`docs/structure.md` §10: nunca las vistas
  derivadas ni los respaldos, que rompen el dedup o inflan los conteos) con `lib/sheets/`, y pasar cada
  fila por `ingerirEntradas`. Idempotente: correrlo dos veces no duplica.
- **Dentro:** el Estado **como lo escribió la hoja** (ADR 0054: el CRM traduce, no califica).
- **Dentro:** las 55 de `Forms viejo` ([079]), en la misma corrida.
- **Dentro:** un script en `scripts/` con `actorDelScript()` (ADR 0029) y modo ensayo que solo cuenta.
- **Fuera:** deals, llamadas, abonos y lo abierto de gestión (077 a 081, en el corte del hito B).

## Done cuando

- [ ] El ensayo reporta cuántos leads, envíos y contactos crearía, por programa, y cuadra con la hoja
      deduplicada por `(programa, correo)`.
- [ ] Corrió en producción con el ok de Mani, y la conciliación del [110] marca cero faltantes.
- [ ] Un lead trasladado que vuelve a llenar el formulario no se duplica (prueba de costura de E1).
- [ ] Cierra [048] y [049], y la parte de datos del [050].
