---
id: 456
etapa: metricas
serves: "ADR 0136 · hallazgo D-1 de la auditoría de coherencia del 18-nov"
depends: []
status: en curso
---

# 456 — La venta cuenta por el día de su primer pago

## Qué
`ventasConDiaEn` fecha cada venta con el día del primer pago (abono vigente más antiguo, concepto `ticket`); sin abono cae al día de la etapa. Una sola definición (`diaDeVenta`, `lib/queries/metricas-filtros.ts`); la fecha por etapa sigue como `diaDeEtapaDeVenta` (respaldo y cortesías).

## Hecho (18-nov)
- [x] `diaDeVenta` + `primerPagoPorDeal` (subconsulta cerrada agrupada por deal, sin N+1); la lista `cierres`/`contratado` une el mismo derivado y muestra la misma fecha.
- [x] Registro (`anclaDeFecha: primer_pago_del_deal`), `docs/metricas.md`, `docs/overview.md` §11 y ADR 0136.
- [x] Guardianes en `tests/venta-primer-pago.test.ts`: pago anterior a la etapa → mes del pago; sin abono → día de la etapa; varios abonos = una venta; anulado y `adicional` no fechan.

## Números que se mueven (medidos por la auditoría, a confirmar con la base viva tras desplegar)
- Comunicarte octubre: 28 → 37 ventas. Comunicarte 1-17 nov: 20 → 11. Tactical no se mueve (17=17, 5=5).
- Ningún número dorado cambia. Tres fixtures asumían la fecha por etapa y se ajustaron con su primer pago explícito: `reporte-diario` (saldo de una venta de agosto), `series-dinero` (la venta de `octubre` cae el 04-oct, día de su primer pago vigente) y `dinero-de-ventas` (el deal «fuera del periodo» paga en septiembre).

## Pendiente
- [ ] Índice `abonos(deal_id, fecha)`: hoy existe solo `abonos_deal_idx(deal_id)`. No se genera migración sin aviso de Mani; a esta escala la subconsulta agrupada no lo necesita.
- [ ] Confirmar las cifras de arriba contra la base viva y medir el p95 de Comercial/Pauta.
- [ ] Ventas de meses cerrados pueden moverse si llega un abono con fecha anterior: avisar a Daniel.
