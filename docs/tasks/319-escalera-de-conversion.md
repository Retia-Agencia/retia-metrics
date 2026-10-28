---
id: 319
etapa: media
serves: "ADR 0109 · propuesta.md §3.1 (la escalera ya responde preguntas sin IA)"
depends: []
status: todo
---

# 319 — La escalera de conversión

## Alcance

- Migración: `programs.corte_pago_rapido_dias` (entero, nulo permitido, CHECK > 0), editable en Programa por quien
  administra, con rastro.
- `lib/queries/escalera.ts`: `escaleraDeDeals`, sobre la capa de hechos (C-2), con la regla y la precedencia del
  ADR 0109; días hábiles de Retia y fechas de Bogotá; `vigente()` en `calls`, `deals` y `abonos`. Corte nulo: une 2 y 3
  en "pagó después" y lo marca.
- **Medición antes de mostrar** (solo lectura en producción): por programa, cuántas ventas caen en el escalón 1 y una
  muestra para que Mani o gerencia confirmen que son "pagó en la llamada". El resultado va al archivo de este ticket; si
  no cuadra, se para y se enmienda el ADR 0109.
- `docs/metricas.md`: la escalera, en el mismo commit.

## Done cuando

- Tests por escalón en los dos sentidos, con anulados, corte nulo y cambio de escalón cuando el deal paga.
- La suma de los escalones 1 a 3 en un periodo es igual a las ventas del Hub en el mismo periodo (test).
- La medición está escrita en este archivo.
