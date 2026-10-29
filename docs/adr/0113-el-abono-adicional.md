# 0113: Lo que se vende aparte del programa entra como abono adicional del deal, con nota opcional

- **Estado:** aceptado · 28-oct-2026 (Mani, tras el reporte de Michael Castellanos: Maru no pudo registrar un 1:1 de
  ComunicArte).
- **Cierra:** la D3 del ADR 0037 (un segundo producto a la misma persona).
- **Confirma:** ADR 0013 (caja y ventas son métricas separadas), ADR 0024 (el saldo vive en un módulo), ADR 0026
  (anulado no cuenta), ADR 0043 (el programa es frontera).

## Contexto

El 28-oct Maru intentó registrar USD 1.431 sobre un deal de ComunicArte con saldo de USD 797, y la reja del sobrepago
(`lib/deals/abonos.ts`) lo rechazó. La cifra coincide con la mentoría 1:1 (USD 1.590, `docs/overview.md` §3) con 10% de
descuento: no era un pago del programa, era otra cosa vendida a la misma persona. Hoy no hay dónde registrarla:

- El abono solo existe contra el ticket del deal, y la reja impide pasarse del saldo.
- Un segundo deal choca con `deals_uno_abierto_por_lead_y_programa_idx`, y aunque se abriera contaría como una venta
  más: infla ventas y conversión con una persona que no se convirtió dos veces.
- Subir el valor vendido mezcla el 1:1 con el ticket del programa y daña la comparación de tickets, el descuento y la
  cortesía (ADR 0071).

## Decisión

1. **Cada abono tiene un concepto: `ticket` o `adicional`.** Es un tipo del código (`pgEnum`), no un catálogo, porque
   el código decide con él (ADR 0012). Todo abono existente es `ticket`.
2. **El abono adicional cuelga del mismo deal** y suma a la **caja**: es plata que entró. No toca nada más:
   no cuenta en el saldo, no congela el valor vendido, no mueve la etapa y no lo frena la reja del sobrepago.
3. **Lo acepta cualquier deal vigente, en cualquier etapa, también cerrado.** El caso típico es un Student que ya
   pagó todo (Completo) y compra una mentoría. Un deal anulado no recibe nada (ADR 0038).
4. **Nota opcional, texto libre del closer** (`abonos.nota`), para que escriba qué vendió. No se exige ni se valida:
   ninguna métrica la lee. Si un día hay que agrupar lo adicional por producto, ese día nace el catálogo (ADR 0077) y
   la nota se queda como lo que es.
5. **Lo demás no cambia:** mismo rastro (`crearConRastro`), misma anulación, misma frontera de programa (sale del
   deal, nunca del input), misma regla de moneda: sin conversión, y la moneda la sigue restringiendo el esquema
   del abono (hoy solo USD). El adicional no se compara contra la moneda del saldo.
6. **El saldo lo sigue respondiendo un solo lugar** (`saldosDeDeals`, `lib/queries/saldo.ts`), que ahora suma solo
   los abonos de concepto `ticket`. La reja y la pantalla del closer leen esa misma cifra.

## Sin decidir (Gerencia)

Por defecto el adicional **no suma a ventas, valor vendido, meta ni comisión** (la comisión sale del valor vendido,
`lib/queries/comision.ts`). Si Gerencia decide que el 1:1 paga comisión o cuenta para la meta, se enmienda este ADR:

- ¿El 1:1 paga comisión al closer? ¿Con qué porcentaje?
- ¿Cuenta para la meta del mes o de la cohorte?

## Descartado

| Alternativa | Por qué no |
|---|---|
| Un segundo deal por producto | Choca con el índice del cupo; contaría el 1:1 como venta e inflaría la conversión |
| Subir el valor vendido del deal | Mezcla el 1:1 con el ticket del programa; rompe descuento, cortesía y comparación de tickets |
| Solo un comentario en un abono normal | La reja lo sigue rechazando, y nada distinguiría la plata del programa de la del 1:1 |
| Nota obligatoria o catálogo de adicionales | Ninguna métrica lo agrupa hoy (ADR 0077); se agrega cuando una lo pida |
