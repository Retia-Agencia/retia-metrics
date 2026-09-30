---
id: 121
etapa: E6
serves: "ADR 0062 punto 5 · docs/analytics.md PT-20, PT-21, PT-23"
depends: [083]
status: todo
---

# 121 — El área declarada por el closer al cerrar

## Objetivo

Tener lo que dice el comercial ("¿cómo nos conociste?") para las ventas que llegan sin UTM, sin mezclarlo
nunca con el UTM.

## Alcance

- **Dentro:** `deals.area_declarada_id`, FK a `areas`, nula (migración de la sesión principal).
- **Dentro:** requisito del motor (ADR 0056, 044): entrar a Compromiso Verbal, Abonado o Completo exige el
  área declarada si el deal no la tiene. Un select de un clic en "¿Cómo terminó?", en el registro del abono
  y en la Ficha del Deal.
- **Dentro:** los deals históricos (ADR 0059) quedan exentos; si al corte las pestañas de gestión traen la
  columna "origen del deal" (tarea O-4 de `docs/analytics.md` §7), el importador del 078 la lleva a este
  campo.
- **Dentro:** la consulta de la burbuja "sin UTM · según el comercial": ventas sin UTM por área declarada.
- **Fuera:** cualquier métrica de atribución que la use: salen del UTM.

## Done cuando

- [ ] Llevar un deal a Abonado sin área declarada lo rechaza el motor con el requisito a la vista, con test.
- [ ] Una venta con UTM y área declarada distinta cuenta en su área por UTM, con test.
- [ ] La acción forjada desde otro programa recibe 403.

## Kiro

Sí, con revisión visual.
