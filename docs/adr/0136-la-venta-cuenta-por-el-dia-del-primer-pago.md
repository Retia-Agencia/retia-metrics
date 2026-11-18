# 0136 — La venta cuenta por el día del primer pago, no por el día de la etapa

- **Estado:** aceptada · 18-nov-2026 (Mani). Reemplaza la decisión de fechar la venta por la primera entrada del deal a Abonado o Completo (tickets 352 y 392, ADR 0024 y ADR 0115 N1).
- **Relacionadas:** ADR 0013 (caja y ventas separadas: se conservan separadas), ADR 0113 (el abono `adicional` no vende), ADR 0038 (anular no es perder), ADR 0026 (vigencia), ticket 456, hallazgo D-1 de la auditoría de coherencia del 18-nov.

## Contexto

`ventasConDiaEn` fechaba cada venta con el día de la primera entrada del deal a Abonado o Completo (`dealEtapaHistorial`). Esa fecha mide cuándo alguien anotó la venta, no cuándo ocurrió. Un lote capturado tarde el 11-nov movió 9 ventas de Comunicarte de octubre a noviembre: octubre salió con 28 ventas por etapa frente a 37 por primer pago; noviembre con 20 frente a 11. Cohorte, ROAS y metas por mes se movían igual, sin error y con cifras creíbles.

## Decisión

1. **La venta cuenta por el día del primer pago:** el abono **vigente** más antiguo del deal, concepto `ticket`, por su `abonos.fecha` (día de calendario de Bogotá). Un abono anulado no cuenta; el `adicional` tampoco (ADR 0113).
2. **Respaldo:** un deal vendido sin abono vigente de ticket (venta directa por pasarela sin abono, o toda la historia que nunca tuvo abono) cae al día de su primera entrada a Abonado o Completo, como antes.
3. **Una sola definición:** `diaDeVenta` en `lib/queries/metricas-filtros.ts`, dentro de `ventasConDiaEn`. Hub, series, cohorte, escalera, ROAS, proyección, metas, reporte del día, MCP y listas la leen de ahí. La lista de ventas (`cierres`) muestra la misma fecha que la cifra.
4. **Qué se conserva:** *qué* es una venta no cambia (deal hoy en Abonado o Completo, sin cortesía, sin anulados, sin reversa posterior). Solo cambia el día. La pregunta «¿cuándo se capturó la venta en el CRM?» sigue existiendo como `diaDeEtapaDeVenta` (respaldo del punto 2 y fecha de las cortesías, que por definición no tienen pago) y como la Close date (`cerradosEn`, ticket 141), que no es una venta.
5. **Caja y ventas siguen separadas** (ADR 0013): una venta se fecha por su primer pago, pero la caja de un mes sigue siendo la suma de los abonos de ese mes. Un deal con dos abonos es UNA venta en el mes del primero.

## Consecuencias

- Las ventas de un mes cuadran con la caja de ese mes y dejan de depender de cuándo se capturó la etapa.
- Un deal cuyo primer pago es de un mes cerrado entra a ese mes aunque hoy se corrija: las cifras de meses pasados pueden moverse al llegar un abono con fecha anterior. Es lo esperado: el dato es el pago.
- Rendimiento: una subconsulta cerrada agrupa `abonos` por deal y se une por `dealId`; no suma consultas por página. Existe `abonos_deal_idx(deal_id)`; un índice `(deal_id, fecha)` no existe y no se necesita a esta escala (anotado en el ticket 456).
- El ROAS sigue anclado al día del envío (ticket 355): no cambia.
