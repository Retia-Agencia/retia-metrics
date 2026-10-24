---
id: 312
etapa: hub
serves: "Mani, 24-oct: 'hay que mostrar la métrica del porcentaje de personas que llegaron a Calendly y agendaron'"
depends: []
status: done
---

# 312 — Embudo del formulario: el % de cada paso sobre el anterior

## Por qué

En el embudo del formulario (`components/embudo-formulario.tsx`, datos de `embudoDelFormulario` en
`lib/queries/embudo-formulario.ts`) cada porcentaje es sobre "Dejó datos". Así "Agendó" no responde lo que importa:
de los que llegaron al Calendly, ¿cuántos agendaron? (en ComunicArte el 24-oct era el 100%).

## Alcance

- **Dentro:** cada paso muestra dos porcentajes, rotulados: **sobre el paso anterior** (el principal, "de los que
  llegaron al Calendly, agendó 100%") y sobre "Dejó datos" (secundario). Lo mismo en la tabla por canal.
- **Dentro:** base cero se escribe `—`, como el resto del Hub (ADR 0067).
- **Dentro:** `docs/metricas.md` define la tasa nueva ("agendó sobre llegó al Calendly": numerador, denominador, fecha
  del primer envío, sin filtro de closer) en el mismo commit. Es una tasa: por programa, nunca en "todos" (ADR 0048).
- **Fuera:** cambiar qué cuenta como "Llegó al Calendly" (agendó o calidad High).

## Done cuando

- [x] Test sobre la función que calcula los porcentajes: paso anterior y base cero.
- [x] En "todos los programas" la tasa no aparece sumada.
- [x] Recorrido en escritorio y 375 px.

## Enmienda 24-oct (Mani): más simple

"Del paso anterior" y "de dejó datos" no se entendían. Cada total dice el paso por su nombre ("100% de los que
llegaron al Calendly") y debajo "40% del total"; en Completó solo una, porque son la misma. La tabla por canal muestra
solo el % sobre la columna anterior, y la descripción del embudo lo dice.
