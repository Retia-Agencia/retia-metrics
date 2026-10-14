---
id: 254
etapa: hub
serves: "docs/hub.md H-10, §5.2 (origen del cierre) · los reportes del 1 y 3-sep (\"tres de los cinco salieron de follow-up\")"
depends: [252, 262]
status: todo
---

# 254 — El origen del cierre: agenda del día, seguimiento o sin llamada

## Objetivo

Que cada venta diga de qué tipo de trabajo salió, sin pedirle un clic más al closer, y que Hoy y Comercial muestren el
reparto, porque es la palanca que más pesaba en los reportes de septiembre.

## Alcance

- **Dentro:** una dimensión nueva del hecho venta (262), derivada al leer: **agenda del día** (el deal tuvo un show el
  mismo día de Bogotá en que entró a ganado), **seguimiento** (su último show fue un día anterior) y **sin llamada**
  (ningún show vigente). La definición vive en un módulo y es una propuesta de Mani por confirmar (`plan.md` §7 E,
  HQ-7): si cambia, cambia el módulo.
- **Dentro:** el reparto en Hoy (las ventas del día y de la semana por origen) y en Comercial (por closer y por
  periodo), con número y %; cada cifra abre la lista de ventas.
- **Fuera:** distinguir "cola de descartados" o "masivos" dentro de "sin llamada": necesita Kapso (H-9).

## Done cuando

- [ ] Los tres casos (show el mismo día, show antes, sin show) se clasifican bien, con test; una cita anulada no cuenta.
- [ ] La suma de los tres grupos da las ventas del periodo, con test.
- [ ] Recorrido con clic en cada cifra.
