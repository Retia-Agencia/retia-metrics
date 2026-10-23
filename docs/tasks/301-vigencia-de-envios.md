---
id: 301
etapa: envios-falsos
serves: "ADR 0105 (consecuencia: envíos y leads entran a la vigencia) · ADR 0026 · ADR 0038"
depends: []
status: todo
---

# 301 — Vigencia de envíos: un envío anulado no cuenta en ninguna métrica

## Por qué

Para anular un envío falso sin borrarlo (ADR 0105 punto 5), un envío tiene que poder quedar fuera de toda métrica
igual que una llamada, un deal o un abono. `vigente()` (`lib/queries/vigente.ts`) ya detecta sola la columna
`anuladoEn`; lo que falta es la columna y que el guardián obligue a cada lectura a decidir. Medido el 23-oct: **44
lecturas de `submissions` en 28 archivos**. Omitir una no lanza ningún error, solo infla una cifra.

## Alcance

1. **Una sola migración para las dos tablas** (`submissions` y `leads`): `anulado_en`, `anulado_por` (FK a `users`),
   `motivo_anulacion`, y el CHECK de las tres juntas, igual que `deals_anulacion_completa`. Empieza con
   `SET lock_timeout = '5s';` (las dos tablas están calientes). La genera y aplica la sesión principal, con el ok de
   Mani y el SQL leído antes.
2. `submissions` entra a `TABLAS_ANULABLES` en `tests/vigencia-centralizada.test.ts`, y se decide cada una de sus
   lecturas:
   - métricas, listas y hechos (`lib/queries/`, `lib/queries/hechos/`, `lib/atribucion/`, salud de fuentes, embudo):
     `vigente(submissions)`;
   - ingesta e identidad (idempotencia por `(fuente, token, es_parcial)`, dedup, envío de origen): 
     `incluyendoAnulados(submissions)`. Un reintento del webhook de un envío anulado no debe crear otro;
   - ficha del lead (historial): `incluyendoAnulados`, y el envío anulado se ve tachado.
3. `crearConRastro` / `editarConRastro` (`lib/crm/rastro.ts`) aceptan `submissions` y `leads`, y el guardián de
   `tests/rastro-operativo.test.ts` las vigila.

## Fuera

- Las lecturas de `leads` (302). La columna de `leads` entra aquí para no abrir dos migraciones.
- Cualquier pantalla o acción que anule (307).

## Done cuando

- [ ] Migración aplicada en producción; el CHECK rechaza una anulación a medias (test contra PGlite).
- [ ] El guardián falla si una lectura de `submissions` no decide, mordido en los dos sentidos.
- [ ] Un envío anulado desaparece de los hechos de envío, agenda y cita y del embudo del formulario (test por cada
  hecho), y sigue en la ficha del lead.
- [ ] Un reintento del webhook de un envío anulado no crea un envío nuevo (test por la ruta real).
- [ ] typecheck, lint, los tests tocados y los guardianes; la suite completa en el checkpoint.
