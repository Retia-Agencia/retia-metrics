---
id: 415
etapa: pauta
serves: "docs/paid-media-excels-2026-11-10.md §2 (CAC) y §6 · docs/metricas.md §3.2 (🟡 123) · docs/diseno-cifra-y-pauta.md §2.1 (cac) y §4.3"
depends: [412]
status: en main
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
- [x] Estado contra el objetivo `costo_por_venta` (ver "Avance"). *(13-nov: migración 0136 aplicada en producción con el ok de Mani, verificada (enum y CHECK); código en main en `84f6d23c`.)*

## Avance (13-nov)

- Hecho: `costoPorVenta` (`lib/pauta/costo-por-venta.ts`, módulo único), fila `cac` en General después de Ventas (tabla,
  por día, CSV), ficha en el registro, fila de `metricas.md` §3.2 (cierra el 🟡 del 123), término en `overview.md` §11.
  Tests: `tests/costo-por-venta.test.ts` y el bloque "costo por venta" de `tests/numeros-dorados-pauta.test.ts`.
- **Falta el punto de estado contra objetivo.** El alcance decía que `costo_por_venta` "ya existe en el enum" y no existe:
  `metrica_objetivo` tiene cupos, costo_por_agenda, roas, conversion_agenda_venta, agendas e inversion. Agregarlo es una
  migración (`ALTER TYPE ... ADD VALUE`), su definición en `lib/objetivos/metricas.ts` y `CONCEPTO_DE_OBJETIVO`, y una
  línea en `METRICAS_DE_OBJETIVO` de `lib/pauta/cifra-de-celda-semanal.ts`. Va por la cola de migraciones (Mani).

## Avance (13-nov, noche, carril D)

- Migración `drizzle/0136_costo_por_venta_objetivo.sql`: `ADD VALUE 'costo_por_venta'` y el CHECK de moneda rehecho para
  incluirlo. **Hallazgo:** la 0133 (403 F4) había retirado ese valor "por no tener lector"; este ticket es el lector, así que
  volver es coherente con esa razón. Sin rehacer el CHECK, un objetivo de costo por venta en COP habría chocado contra él. El
  CHECK compara `metrica::text`: un valor recién agregado a un enum no se puede usar como literal en la misma transacción.
- Código: `DEFINICION_METRICAS_OBJETIVO.costo_por_venta` (COP, menor es mejor, lector 415), `CONCEPTO_DE_OBJETIVO` → `cac`,
  `METRICAS_DE_OBJETIVO.cac`; la regla "un costo con objetivo en otra moneda no colorea" pasa de solo `costo_por_agenda` a todo
  objetivo en COP. Tests: `tests/objetivos.test.ts` (migración 0136: se guarda con moneda; sin moneda choca con el CHECK) y
  `tests/pauta-semanal-celdas.test.ts` (estado del costo por venta).
- **Orden de despliegue:** cumplido: la 0136 se aplicó en producción (ok de Mani, 13-nov) antes de empujar `84f6d23c`. Falta el checkpoint verde para `done`.

