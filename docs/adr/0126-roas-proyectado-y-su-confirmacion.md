# 0126 — ROAS proyectado y su confirmación

- **Estado:** aceptada · 9-nov-2026 (Mani decidió las cinco reglas en chat)
- **Relacionadas:** ADR 0115 (N3 cobertura), ticket 351 (cobertura del gasto), 352 (muestra mínima), 355 (madurez del ROAS), 375, `docs/weekly-2026-11-03.md`

## Contexto

Daniel Tovar (weekly del 3-nov): el gasto del viernes puede agendar una llamada el lunes, así que un ROAS cortado el viernes no ve el retorno de ese gasto. Pidió dos cosas: avisar cuántas agendas faltan por ocurrir y proyectar el ROAS con la tasa de show y de cierre de las últimas semanas por closer, para confirmar después si la proyección fue cierta.

## Decisión

1. **Citas pendientes del rango** = las citas por venir (`agendada`, hora futura) de deals abiertos sin venta de los envíos de Paid del periodo. Es el mismo conjunto que ya marca «parcial: N agendas pendientes» (355); las pasadas sin marcar siguen siendo otro concepto. La cifra abre su lista.
2. **Proyectado** = (vendido a hoy + Σ prob. de show × prob. de cierre × precio de la cohorte del deal) ÷ gasto, en USD y por programa. Show y cierre son del closer dueño de la cita, de las últimas 3 semanas. Con menos de `programs.muestra_minima_conversion` personas con cita, el closer usa la tasa del programa y la pantalla lo dice; si el programa tampoco llega, «—» con motivo. Con la cobertura del gasto incompleta, o una cita sin cohorte, «—» con motivo: nunca un número a secas.
3. **Se guarda con un cron diario** (`/api/cron/proyeccion-roas`, 30 min después del de pauta), no al abrir una pantalla. Una fila por programa y día (`proyecciones_roas`, índice único); el periodo es el mes en curso de Bogotá hasta ese día. `roas_proyectado` nunca se reescribe.
4. **Se confirma:** cuando todas las citas pendientes de la fila tienen resultado (una `reagendada` espera, una anulada no cuenta), se recalcula el MISMO rango y se guardan `roas_real` y `confirmada_en`.
5. Vive en Hub › Pauta, con el periodo elegido.

## Consecuencias

- Las 3 semanas son una constante del código (`SEMANAS_DE_MUESTRA`); hacerlas dato del programa exige una columna (migración) y se deja para cuando Gerencia lo pida.
- El historial se mide por deal (como las tasas del grupo, ADR 0079): el cierre de las últimas 3 semanas todavía puede subir (madurez); la proyección hereda ese sesgo a la baja.
- Un closer sin historial propio y un programa sin historial dejan el proyectado en «—»: preferimos no mostrar a mostrar una cifra con muestra insuficiente.
