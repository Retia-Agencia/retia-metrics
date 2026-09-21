---
id: 076
etapa: E6
serves: "plan v2 §6 etapa 6 · tarea E6-7 · ADR 0042 (D6)"
depends: [068, 041]
status: todo
---

# 076 — La bitacora en Nerd Stats: la PANTALLA de un rastro que ya lleva meses escribiendose

## Objetivo

Ver toda escritura del CRM, filtrable por usuario, tabla y rango.

🎯 **Esto es lo unico de D6 que va de ultimo.** El **rastro** se escribe desde la etapa 1 (ticket
041), por la razon del ADR 0029: si se retrofitea al final, **todo lo escrito antes no tiene
historia y no hay manera honesta de fabricarla**. Mirar el historial no urge; tenerlo si.

## Alcance

- **Dentro:** la vista sobre `change_log` extendido (deals, calls, abonos, actividades) **y**
  sobre `deal_etapa_historial`, presentados juntos aunque vivan en dos tablas: son dos rastros con
  dos formas porque contestan dos preguntas (ADR 0042).
- **Dentro:** filtros por usuario, tabla y rango de fechas.
- **Dentro:** guarda por rol, sin escribir `"developer"` a mano (ADR 0025).
- **Fuera:** exportar. Si hace falta, es otro ticket.

## Done cuando

- [ ] Toda escritura hecha desde la app aparece aqui, con quien y cuando.
- [ ] Los movimientos de etapa se ven junto al resto, sin estar duplicados en los dos rastros.
- [ ] La pantalla es exclusiva por guarda de servidor, **probada forjando la peticion**.

## Kiro

Si.
