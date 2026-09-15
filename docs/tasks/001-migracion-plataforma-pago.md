---
id: 001
serves: "spec §6 Datos — plataforma de pago; precondición de los criterios 1 y 2"
status: todo
---

# 001 — Migración: agregar plataformaPago a sales

## Objetivo
La tabla `sales` tiene un campo para guardar la plataforma de pago (MercadoPago, PayPal,
Bancolombia, Global66, Hotmart, Otro), listo para que el ticket 002 lo use.

## Alcance
- Dentro: nuevo enum `plataformaPagoEnum` en `lib/db/schema.ts`, columna `plataformaPago` en
  `sales` (nullable, porque las filas viejas de Sheets no lo traen), migración generada y
  aplicada.
- Fuera: no migra datos históricos a este campo. Eso es el import histórico, fuera de este MVP.

## Done cuando
- [ ] `sales.plataformaPago` existe en el schema con el enum de 6 valores.
- [ ] La migración corre limpio contra una base de desarrollo.
- [ ] `npm run typecheck` sigue limpio.

## Notas
Ver ADR 0010. Campo nullable porque no aplica a filas con `origen = "sheets"`.
