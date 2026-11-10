---
id: 415
etapa: pauta
serves: "docs/paid-media-excels-2026-11-10.md §2 (CAC) y §6 · docs/metricas.md §3.2 (🟡 123) · docs/diseno-cifra-y-pauta.md §2.1 (cac) y §4.3"
depends: [412]
status: todo
---

# 415 — Costo por venta (CAC) de Pauta

## Alcance

- Fila "Costo por venta" en General, después de Ventas: Inversión ÷ Ventas de pauta, con cobertura (sin ventas = "—" con "No hubo
  ventas: no hay entre qué dividir").
- Un módulo único (N1), fila en `metricas.md` §3.2 (cierra el 🟡 del 123), nombre en `overview.md` §11, ficha con su explicación.
- Estado contra `objetivos` con `costo_por_venta` (ya existe en el enum).

**Migración:** Ninguna.

## Done cuando

- [ ] Fila, ficha, diccionario y vocabulario en el mismo commit (N8).
- [ ] Test con el caso que la haría divergir (venta de otra área, semana sin gasto).
