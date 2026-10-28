---
id: 330
etapa: media
serves: "ADR 0112 puntos 4, 5 y 6 · propuesta.md §3.3 y §3.5"
depends: [319, 321, 329]
status: todo
---

# 330 — El reporte semanal de insights

## Alcance

- Media › Insights: por programa y semana, los dolores, deseos y objeciones más repetidos, **ponderados por escalón**
  con `escaleraDeDeals` (el peso por escalón es un dato del programa que fija gerencia, pregunta 10 de la propuesta; sin valor, sin ponderar y se dice). Cada insight
  abre su lista: para media, citas y escalón; para gerencia y developer, también la llamada.
- Cobertura a la vista: llamadas atendidas sin Grain y sin transcript en la semana.

## Done cuando

- Test de proyección: ningún campo de identidad en lo que recibe `media` (guardián con lista blanca, molde del
  contrato del semáforo).
- Recorrido con `media` y con gerente.
