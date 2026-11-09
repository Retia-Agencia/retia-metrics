---
id: 375
etapa: pauta
serves: "Weekly con Daniel Tovar del 3-nov (docs/hub.md §0, G-12, 'la cereza del pastel') · ADR 0115 N3 · metricas.md ROAS"
depends: [351, 353, 355, 377]
status: todo
---

# 375 — El ROAS que espera sus citas, y el ROAS proyectado

> **Nota 9-nov:** el 355 (rama `t355`) ya trae el aviso «parcial: N agendas pendientes» y la ancla por cohorte de envío; el 375 conserva la proyección (tasa de show y cierre de las últimas ~3 semanas por closer) y la confirmación posterior. Fuente: `docs/weekly-2026-11-03.md`.

**Fase 2** de la entrega (`docs/hub.md` §0): Dani lo dijo explícito, "Manu, esto es para allá? No. Para allá es el tema
comercial (...) ya después vemos el tema de pauta más a profundidad". Se escribe hoy para que el detalle no se pierda.

## Por qué

Daniel Tovar, weekly del 3-nov (el ejemplo es suyo):

> "Yo pude gastarme dos millones de pesos entre el lunes 2 de noviembre y el viernes 6 de noviembre. Pero resulta que
> el viernes 6 de noviembre, con el dinero que me gasté ese día, yo agendé una llamada de ventas para el lunes 9. (...)
> Si tú pones un filtro que te corte la medición el viernes 6, vas a dejar por fuera el retorno de la inversión que se
> generó el lunes 9."

> "Lo que tienes que hacer es (...) no medir por la fecha que está agendada la llamada de ventas, sino el día en que se
> creó. (...) Debería salir una alerta como de: 'Hay tantas agendas pendientes por ejecutar', 'Es probable que el ROAS
> que estás calculando esté por debajo del estimado'."

> "Si históricamente, en las últimas tres semanas, nuestra tasa de show ha sido de X y la tasa de cierre ha sido de X,
> entonces tú puedes proyectar el ROAS de lo que va a ocurrir el lunes. (...) Andrea tiene cinco llamadas y Maru tiene
> las otras cinco (...) ¿cuántas llamadas proyectamos que cierren Andrea y Maru? (...) Y cuando ocurran las llamadas de
> ese lunes, confirmaremos si esa proyección fue cierta o no."

**Lo que ya está bien (medido el 3-nov):** el ROAS ya ancla la venta al día del envío que abrió el deal, no a la fecha
de la cita ni de la venta (`docs/metricas.md`, fila ROAS). La primera mitad del pedido está construida; falta lo que
cuenta lo que todavía no pasó.

## Alcance

1. **Agendas pendientes del rango.** Para los envíos del periodo con deal Paid: citas futuras (o pasadas sin resultado,
   353) que aún pueden vender. Al lado del ROAS: "ROAS a hoy 1,8× · faltan 10 citas de estos envíos (la última el
   9-nov): este ROAS todavía puede subir". Con su lista.
2. **ROAS proyectado** = (Vendido a hoy + Σ por cita pendiente de prob. de show × prob. de cierre × ticket esperado) ÷
   gasto. Las probabilidades son **por closer dueño de la cita**, de las últimas N semanas (por defecto 3, dato del
   programa, contrato C-1); un closer con menos de la muestra mínima (352) usa la del programa y lo dice. Ticket
   esperado = precio de la cohorte del deal.
3. **Cobertura** (351, N3): sin gasto completo o sin muestra, el proyectado sale "—" con su motivo; nunca un número a
   secas.
4. **Se confirma después**: cada proyección se guarda con su fecha y, cuando la última cita pendiente tiene resultado,
   la pantalla muestra "Proyectado el 6-nov: 2,4× · Real: 2,1×". (Migración: una tabla de proyecciones; la aplica la
   sesión principal con el ok de Mani.)
5. Vive en Hub › Pauta, con los filtros del 377.

## Done cuando

- [ ] Test con el ejemplo de Dani: gasto del 2 al 6-nov, 10 citas el 9-nov (5 de un closer, 5 de otro, tasas
  distintas): el ROAS a hoy no cuenta el 9, el aviso dice 10 pendientes y el proyectado da el número a mano.
- [ ] Test: un closer sin muestra usa la tasa del programa y la pantalla lo dice.
- [ ] Test: con gasto parcial el proyectado es "—" con motivo.
- [ ] Recorrido en `dev:local` con datos sembrados.
- [ ] Regla N8: filas "Citas pendientes del rango" y "ROAS proyectado" en `docs/metricas.md`, mismo commit.
