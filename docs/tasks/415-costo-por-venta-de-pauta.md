---
id: 415
etapa: pauta
serves: "docs/paid-media-excels-2026-11-10.md §2 (CAC) y §6 · docs/metricas.md §3.2 (🟡 123) · docs/diseno-cifra-y-pauta.md §2.1 (cac) y §4.3"
depends: [412]
status: en curso
---

# 415 — Costo por venta (CAC) de Pauta

## Alcance

- Fila "Costo por venta" en General, después de Ventas: Inversión ÷ Ventas de pauta, con cobertura (sin ventas = "—" con "No hubo
  ventas: no hay entre qué dividir").
- Un módulo único (N1), fila en `metricas.md` §3.2 (cierra el 🟡 del 123), nombre en `overview.md` §11, ficha con su explicación.
- Estado contra `objetivos` con `costo_por_venta` (ya existe en el enum).

**Migración:** Ninguna.

## Done cuando

- [x] Fila, ficha, diccionario y vocabulario en el mismo commit (N8).
- [x] Test con el caso que la haría divergir (venta de otra área, semana sin gasto).
- [ ] Estado contra el objetivo `costo_por_venta` (ver "Avance").

## Avance (13-nov)

- Hecho: `costoPorVenta` (`lib/pauta/costo-por-venta.ts`, módulo único), fila `cac` en General después de Ventas (tabla,
  por día, CSV), ficha en el registro, fila de `metricas.md` §3.2 (cierra el 🟡 del 123), término en `overview.md` §11.
  Tests: `tests/costo-por-venta.test.ts` y el bloque "costo por venta" de `tests/numeros-dorados-pauta.test.ts`.
- **Falta el punto de estado contra objetivo.** El alcance decía que `costo_por_venta` "ya existe en el enum" y no existe:
  `metrica_objetivo` tiene cupos, costo_por_agenda, roas, conversion_agenda_venta, agendas e inversion. Agregarlo es una
  migración (`ALTER TYPE ... ADD VALUE`), su definición en `lib/objetivos/metricas.ts` y `CONCEPTO_DE_OBJETIVO`, y una
  línea en `METRICAS_DE_OBJETIVO` de `lib/pauta/cifra-de-celda-semanal.ts`. Va por la cola de migraciones (Mani).
