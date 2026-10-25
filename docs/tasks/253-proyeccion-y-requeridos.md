---
id: 253
etapa: hub
serves: "docs/hub.md H-10, §5.2 (ritmo, proyección, ventas, agendas y leads requeridos) · el reporte del 9 y del 15-sep"
depends: [252, 262]
status: en main
---

# 253 — La proyección y lo que hace falta por día

## Objetivo

Que Hoy diga, por programa y cohorte: "a este ritmo cierras en X de Y", y cuántas ventas, agendas y leads por día
hábil hacen falta para llegar, con el supuesto que usa a la vista.

## Alcance

- **Dentro:** las fórmulas de `docs/hub.md` §5.2 (ritmo, proyección, ventas requeridas, agendas requeridas, leads
  requeridos), cada una en un módulo de `lib/queries/` sobre la capa de hechos (262).
- **Dentro:** el reparto de lo que falta por semana que queda (el bloque "Meta para llegar a 50, desde mañana" del
  reporte: resto de esta semana, cada semana siguiente, los días sueltos del final).
- **Dentro:** los dos supuestos abiertos (PQ3, `plan.md` §7 E, HQ-5) entran como parámetros con un valor por defecto
  escrito en la pantalla: la **ventana del ritmo** (por defecto, los últimos 10 días hábiles) y la **conversión agenda →
  venta** (por defecto, el objetivo declarado de la cohorte (122) y, sin él, la de la cohorte anterior completa sobre
  el mismo grupo, ADR 0079). Cuando se decidan, se cambia el valor, no el código.
- **Dentro:** los leads requeridos llenan el lugar de "Leads contra su meta" de Hoy; `cohorts.meta_leads_dia` (vacía en
  todas) queda como meta declarada opcional que, si existe, se muestra al lado de la derivada.
- **Fuera:** el reparto por área (124).

## Done cuando

- [ ] Con una cohorte armada a mano, cada cifra cuadra con un cálculo hecho aparte, con test.
- [ ] Una cohorte sin ventas o sin conversión muestra "—" con la razón, nunca 0 ni infinito (ADR 0067).
- [ ] La pantalla dice qué ventana y qué conversión usó.
