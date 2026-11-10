---
id: 417
etapa: pauta
serves: "docs/paid-media-excels-2026-11-10.md §2 (inversión sugerida, diferencia vs plan) y §6 · Q-4"
depends: [414, 416]
status: bloqueado
---

# 417 — Plan de inversión diario y diferencia contra el plan

**Bloqueado por Q-4** (Paid Media): ¿la inversión sugerida la fija Pauta cada día o sale de un presupuesto repartido?

## Alcance

- Si sale repartido: calcular desde la meta de inversión de la cohorte (`objetivos.inversion`), sin migración.
- Si la fija Pauta: tabla editable `plan_inversion` por el molde de `lib/catalogo/` (cola de migraciones), cargada por Pauta o
  Gerencia de forma sencilla, y fila "Diferencia contra el plan".

## Done cuando

- [ ] Q-4 respondida y escrita aquí.
- [ ] Plan y diferencia en la tabla por día y por cuenta, con su ficha.
