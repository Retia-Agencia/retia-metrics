---
id: 417
etapa: pauta
serves: "docs/paid-media-excels-2026-11-10.md §2 (inversión sugerida, diferencia vs plan) y §6 · Q-4"
depends: [414, 416]
status: todo  # 17-nov: Q-4 respondida (Pauta fija la inversión); espera el ok de Mani para la migración
---

# 417 — Plan de inversión diario y diferencia contra el plan

**Q-4 respondida (Paid Media, 17-nov): «Pauta lo fija con su propio criterio».** La inversión sugerida la pone Pauta; no sale de repartir la meta de la cohorte. Por tanto Pauta **captura el número por tramos de fecha** (tabla editable `plan_inversion`, molde `lib/catalogo/`), lo que **necesita migración**: queda escrita en la cola de la sesión principal y **no se genera hasta el ok de Mani**.

## Alcance

- Si sale repartido: calcular desde la meta de inversión de la cohorte (`objetivos.inversion`), sin migración.
- Si la fija Pauta: tabla editable `plan_inversion` por el molde de `lib/catalogo/` (cola de migraciones), cargada por Pauta o
  Gerencia de forma sencilla, y fila "Diferencia contra el plan".

## Done cuando

- [x] Q-4 respondida y escrita aquí (17-nov).
- [ ] Ok de Mani a la migración de `plan_inversion` (tramos de fecha por cuenta, con actor y rastro).
- [ ] Plan y diferencia en la tabla por día y por cuenta, con su ficha.
