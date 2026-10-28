# 0109: La escalera de conversión: un escalón por deal, en una sola función

- **Estado:** aceptado · 28-oct-2026 (Mani, grill del plan de media; `docs/media/propuesta.md` §3.1).
- **Confirma:** ADR 0024 (una cifra, un módulo), ADR 0079 (las tasas van por deal), ADR 0026 y 0038 (lo anulado no
  cuenta), ADR 0037 (venta = deal en Abonado o Completo), regla de días hábiles de Retia.

## Contexto

No todas las llamadas enseñan lo mismo: la que paga en la llamada dice qué convence; la que paga tarde, qué objeción
hubo que resolver; la que no compra, qué no alcanzó. Todo lo de media (origen × escalón, insights ponderados) se lee
a través de esa jerarquía, así que tiene que tener **una** definición.

## Decisión

1. **El escalón es de cada deal**, no de la persona: todo envío abre deal (GC-27), así que "no agendó" también es un
   deal, y un lead retomado en otra cohorte cuenta cada intento.
2. **Seis escalones, derivados de lo que el CRM ya registra**, en este orden de precedencia:

   | # | Escalón | Regla |
   |---|---|---|
   | 1 | Pagó en la llamada | primer abono vigente el mismo día (Bogotá) de la última cita atendida anterior a él |
   | 2 | Pagó rápido | primer abono hasta `corte_pago_rapido` días hábiles después de esa cita |
   | 3 | Pagó después | primer abono más tarde que el corte |
   | 4 | Atendió y no compró | alguna cita atendida, sin abono vigente |
   | 5 | Agendó y no se presentó | alguna cita, ninguna atendida, sin abono |
   | 6 | Dejó datos y no agendó | sin cita |

3. **El corte es un dato del programa** (`programs.corte_pago_rapido_dias`, días hábiles, editable en Programa, lo
   llena gerencia). **Nulo no se inventa:** la escalera junta 2 y 3 en "pagó después" y la pantalla lo dice.
4. **Una sola función**, `escaleraDeDeals` en `lib/queries/escalera.ts`, sobre la capa de hechos (contrato C-2):
   devuelve el escalón de cada deal y agrega por cualquier dimensión de la lista blanca. Toda vista (Hub, media,
   insights ponderados) la importa; ninguna recalcula un escalón. Pasa por `vigente()` en `calls`, `deals` y
   `abonos`.
5. **El escalón se calcula al leer, nunca se guarda:** un deal en el escalón 4 sube al 3 el día que paga, y el
   insight de su llamada pesa distinto desde ese momento.
6. **Se valida antes de mostrarse:** el ticket 319 mide con datos de producción si "mismo día de la cita" representa
   de verdad "pagó en la llamada". Si no cuadra, se pide la marca a la closer y este ADR se enmienda.

## Por qué

Por deal calza con las tasas del ADR 0079 y no mezcla cohortes. El corte por programa porque Tactical y ComunicArte
tienen ciclos distintos. Contar toques de seguimiento dependía de que cada closer registre cada toque.

## Consecuencias

- Test de la regla en los dos sentidos por escalón, con abonos y citas anuladas, y uno que compara la suma de
  escalones 1 a 3 contra las ventas del Hub en el mismo periodo (deben cuadrar).
- `docs/metricas.md` gana la escalera en el mismo commit que la función.
