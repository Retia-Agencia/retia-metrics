---
id: 200
etapa: O6
serves: "Regla 'un registro anulado no cuenta en ninguna métrica' (ADR 0026, 0038); ventas = deals en Abonado o Completo (ADR 0037); cortesía no es venta (ADR 0071 punto 10)"
depends: []
status: done
---

# 200 — La venta que se revierte al anular su abono no cuenta

Sin migración.

## Por qué existe

Revisión del 5-oct (Alejo + Claude) sobre lo construido el 4-oct. `vendidosEn`, `ventasConDiaEn` y
`primerosMovimientosDeVenta` (`lib/queries/metricas-filtros.ts`) cuentan como vendido todo deal que **alguna vez**
entró a Ganado Pago Parcial o Pagado Completo. Si se anula su único abono, el motor lo devuelve a donde estaba antes
de pagar (**A1**), pero la fila del historial sigue ahí y la venta se sigue contando: en el dashboard, en la meta del
mes (146), en Mi espacio, en el origen declarado y en las listas. Medido con un test sobre la base de prueba: tras
anular, el deal está en Atendido y `vendidosEn` lo devuelve igual.

Y si después vuelve a pagar, el día de la venta es el del pago anulado, no el del nuevo: puede caer en otro mes.

El embudo por etapas (065, `lib/queries/embudo-etapas.ts`) tiene la misma falla en el paso "vendido" (usa la etapa
más lejana del historial) y además cuenta las **cortesías** como vendidas, cosa que `vendidosEn` no hace.

## Decidido

1. **Una venta revertida es la entrada a una etapa vendida seguida, más tarde, de una salida A1**: de una etapa
   vendida a una etapa abierta. A1 solo ocurre al anular abonos (`lib/deals/abonos.ts`), así que es un error de
   tecleo, no un resultado del negocio.
2. **Ganado Pago Parcial → Cierre Perdido (P) NO revierte la venta:** se vendió y después se perdió, y Cierre Perdido
   cuenta (ADR 0038). Ganado Pagado Completo → Ganado Pago Parcial (A2) tampoco: sigue vendido.
3. **La regla vive en el predicado compartido** `esMovimientoDeVenta()`, así la heredan todos los lectores, y su
   gemela en memoria para el embudo por etapas. Sin plantilla `sql` correlacionada: `notExists` de drizzle sobre un
   alias de `deal_etapa_historial`.
4. El día de la venta pasa a ser la primera entrada a una etapa vendida **después de la última reversa**.

## Done cuando

- Test: anular el único abono saca al deal de `vendidosEn`, `ventasConDiaEn`, `primerosMovimientosDeVenta`, de la
  meta del mes y del paso "vendido" del embudo por etapas; pagar de nuevo lo vuelve a contar con el día del pago
  nuevo; un Abonado que pasa a Cierre Perdido sigue contando como venta; una cortesía no llega a "vendido".
- `npm run typecheck`, `npm run lint` y los tests de métricas tocados, limpios. La suite la valida el CI.

## Nota de cierre (5-oct, Alejo + Claude)

- `esMovimientoDeVenta(db)` excluye la entrada a una etapa vendida con una reversa ESTRICTAMENTE posterior
  (`DESTINOS_DE_REVERSA`, `esReversaDeVenta`); la heredan `vendidosEn`, `ventasConDiaEn`, `cortesiasEn` y
  `primerosMovimientosDeVenta`. El embudo por etapas usa `esReversaDeVenta` en memoria, con el mismo desempate, y
  topa las cortesías en Compromiso Verbal (`DealParaEmbudo.cortesia`).
- El guardián de vigencia resuelve los alias de drizzle (`const x = alias(tabla, …)`): el de una tabla no anulable
  pasa, el de `calls`, `deals` o `abonos` sigue exigiendo `vigente(x)`. Probado en los dos sentidos.
- Revisión de Codex (solo lectura): SQL calificado en los cuatro lectores y en el anidamiento de
  `metricas-con-filas.ts` (verificado con `.toSQL()`); A2, P, R y CORR no cuentan como reversa; cartera, Kanban,
  Students y cohorte leen la etapa actual. Halló el empate de instante SQL ≠ memoria: corregido y con test.
- Nivel 1: typecheck, lint y 13 archivos de tests de métricas en verde. Falta el checkpoint.

## Cierre (checkpoint, 5-oct)

Checkpoint `cp-20261005-1` sobre `d974c76`: CI verde (suite completa, Postgres real y build), deploy de
producción en Vercel correcto, fuentes recibiendo y sin sobres crudos con error real (los 5 pendientes son entregas
de prueba que no se ingieren a propósito).
