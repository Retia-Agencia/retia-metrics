# 0124 — La moneda es un conjunto cerrado en la base

- **Estado:** aceptada · 9-nov-2026 (Mani eligió en chat COP o USD para `abonos`; el resto sigue el plan F3 §6.7)
- **Relacionadas:** AGENTS.md («nunca convertir moneda en silencio»), ADR 0024 (el saldo tiene una definición), ADR 0115 N6, ticket 395, auditoría 385 F3-12

## Contexto

`moneda` era texto libre en siete tablas; solo `objetivos` tenía `CHECK`. Medido el 9-nov-2026 en producción (solo SELECT): `abonos` 81 filas USD; `eventos_meta` 35 USD; `enlaces_pago` y `cuotas_pactadas` vacías; `gasto_pauta` 2.520 COP y 126 USD (Comunicarte gasta en las dos desde el 23-oct); `cuentas_publicitarias` 4 COP y 2 USD; `fotos_pauta` 1.189 COP y 75 USD. Ninguna fila fuera de COP/USD. Un «usd» o un «US$» tecleado habría sumado como una moneda más, sin error.

## Decisión

1. `CHECK` en la base, migración 0126 (solo agrega restricciones, no toca datos):
   - `abonos`, `enlaces_pago`, `gasto_pauta`, `cuentas_publicitarias`, `fotos_pauta`: `COP` o `USD`. En `abonos` la app (zod) sigue aceptando solo USD; la base deja abierta la puerta a la conversión pendiente (decisión del 8-nov: el USD es el referente) y veta el tecleo.
   - `eventos_meta`, `cuotas_pactadas`: solo `USD` (el valor que se manda a Meta y la cuota del ticket).
   - `enlaces_pago` entró primero como solo USD (migración 0126) y pasó a COP o USD en la 0127: la reja de `registrarAbono` compara la moneda del link con la del abono, y la base tiene que dejar que puedan diferir (lo cazó `tests/abonos-del-deal.test.ts` en el CI).
   - `fotos_pauta` no estaba en el ticket; se incluye porque es la foto del gasto y guarda moneda de la misma cuenta.
2. Una suma que mezcla monedas no se calcula: el saldo de un deal con abonos en otra moneda es `null` con su razón (`moneda_distinta`, `lib/queries/saldo.ts`), y el gasto pasa por `convertirGasto`, que convierte con la TRM del día, no suma el día sin TRM y lo cuenta, y lanza con una moneda que no es COP ni USD. Probado en `tests/moneda-check.test.ts`.
3. La TRM se mantiene sola: el cron diario `/api/cron/pauta` (11:00 UTC) llama `leerTrm`, repasa la última semana desde datos.gov.co (`32sa-8pi3`) y baja hasta el primer gasto si hay uno anterior a la primera tasa guardada. No hay conversión de abonos: un abono en COP deja el Recaudado y Por cobrar de su venta sin calcular hasta que se decida esa conversión.

## Consecuencias

Agregar una moneda nueva exige una migración y enmendar este ADR, `docs/metricas.md` §1.5 y §1.6 y el vocabulario de `overview.md` §11. Un escritor que mande otro texto recibe error de la base (23514, `esViolacionCheck`), no un dato mal sumado.
