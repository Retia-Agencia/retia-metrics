---
id: 410
etapa: dinero
serves: "Pedido de Mani del 9-nov (conversión «perfecta, que nunca falle y que ninguna métrica mienta») · ADR 0124 · AGENTS.md (nunca convertir moneda en silencio) · ADR 0115 N1, N2, N3, N6"
depends: [395]
status: idea
---

# 410 — Abonos en COP: la conversión a USD se congela al registrar

**Estado (9-nov, Mani): «maybe muy maybe». Todo sigue en USD y este ticket no se construye mientras no haya pagos reales en COP.** Respondió D1 (es previsión, hoy todo entra en USD), D2 (la TRM del día del pago) y D3 (bloquear si no hay TRM); lo demás queda abierto. Mientras tanto un closer **no puede** abonar en COP: `esquemaAbono` exige `z.literal("USD")` (`lib/abonos/esquema.ts`). El `CHECK` del 395 (ADR 0124) solo deja la puerta abierta en la base; nada la usa.

## Por qué

Hoy un abono en otra moneda deja el saldo de su venta en `null` (`moneda_distinta`) y su Recaudado y Por cobrar «sin calcular» (decisión del 8-nov: el USD es el referente). Eso es seguro pero no es una conversión: si el negocio cobra en COP, esa plata no entra a ninguna cifra en USD. Y habilitar COP sin conversión pondría en riesgo toda cifra que suma abonos: `lib/queries/saldo.ts` (`sumaDeAbonos`), `hechos/abono.ts`, `dashboard.ts`, `reporte-diario.ts`, `metricas-con-filas.ts`, `abonos-del-lead.ts`, `lib/deals/abonos.ts` (la reja del sobrepago), ROAS y las metas.

## Diseño propuesto (a decidir)

1. **La conversión se congela al escribir, no al leer.** El abono guarda `monto` y `moneda` tal cual los pagó la persona, más `monto_usd` y `trm_aplicada` (con la fuente y el día de la tasa). Leer a la tasa de hoy cambiaría cifras históricas cada vez que se corrige o se carga una TRM; congelar las deja reproducibles. Es el mismo criterio de `valor_vendido_usd`.
2. **La base lo garantiza (N6, ADR 0005):** `CHECK` de que `moneda = 'USD'` implica `monto_usd = monto` y sin TRM, y `moneda = 'COP'` implica TRM no nula y `monto_usd = round(monto / trm, 2)`. Un abono no puede existir sin su `monto_usd`.
3. **Una sola suma (N1):** todo lo que hoy hace `sum(abonos.monto)` pasa a sumar `monto_usd` por UN módulo; un guardián falla si alguien vuelve a sumar `abonos.monto` a mano. Las cifras en USD no dependen de la moneda original; la caja «por moneda» sigue disponible como desglose del original.
4. **Reja del sobrepago en USD:** compara `monto_usd` contra el saldo en USD; el redondeo se define una vez (centavo de USD, a favor del deal, nunca un sobrepago por redondeo).
5. **La TRM:** `tasas_cambio` (datos.gov.co `32sa-8pi3`), cron diario `/api/cron/pauta`. La tasa que se aplica es la del día del pago (`abonos.fecha`) según `tasasDelRango`.
6. **Pantalla:** el closer elige moneda, escribe el monto original y ve **antes de guardar** la TRM, el día y el equivalente en USD; la ficha muestra siempre ambos montos.
7. **Qué ya existe y se reemplaza (N7):** el estado `sinSaldoPorque: "moneda_distinta"` y el aviso «sin calcular» desaparecen cuando todo abono tiene `monto_usd`; borrarlos, no dejarlos.

## Decisiones abiertas (de Mani)

- **D1:** ¿Se reciben pagos en COP hoy o es previsión? Si ya hay, es prioridad; si no, se puede dejar en `idea`.
- **D2:** ¿Qué TRM? Propuesta: la del día del pago (`abonos.fecha`). Alternativa: la del día de registro.
- **D3:** Si no existe TRM para ese día: bloquear el abono con un mensaje claro (propuesta) o guardarlo marcado «conversión pendiente» (deja una cifra parcial en el Hub hasta que se complete).
- **D4:** Los abonos ya existentes (81, todos USD) no cambian: `monto_usd = monto`, TRM nula. ¿OK?
- **D5:** ¿El valor vendido del deal también puede nacer en COP? Hoy es solo USD (`valor_vendido_usd`) y este ticket no lo toca.

## Alcance (cuando se cierren las decisiones)

Migración (columnas `monto_usd`, `trm_aplicada`, `trm_dia`, `trm_fuente` y sus `CHECK`; relleno de los 81 abonos USD), ADR nuevo, módulo único de conversión, una sola suma, reja del sobrepago, formulario, ficha, y la enmienda de `docs/metricas.md` §1.5 y de los conceptos de caja/Recaudado/Por cobrar en el mismo commit (N8). Un ticket aparte, no el 395.

## Done cuando

- [ ] Decisiones D1 a D5 cerradas por Mani y escritas en el ADR.
- [ ] Test de propiedades: para toda combinación de monto, moneda y TRM, `monto_usd` redondea igual en SQL y en TypeScript (N2), y COP a TRM y de vuelta no pierde más de un centavo.
- [ ] Test adversarial sobre base sembrada: deal con abonos USD y COP; Vendido, Recaudado, Por cobrar, caja, ROAS, metas y la lista detrás de cada cifra cuadran entre sí y con la suma a mano.
- [ ] La base rechaza un abono COP sin TRM o con `monto_usd` distinto del cálculo.
- [ ] Guardián: ninguna lectura de `lib/`, `app/` ni `components/` suma `abonos.monto` fuera del módulo único.
- [ ] Una TRM que se corrige después no cambia ningún abono ya registrado (test).
- [ ] Recorrido en `dev:local`, escritorio y 375 px: registrar un abono en COP, ver la TRM y el equivalente antes de guardar, y verlo reflejado en el Hub y en su lista.
