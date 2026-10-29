---
id: 345
etapa: avisos
serves: "ADR 0114 punto 8 y su techo aceptado"
depends: [340]
status: todo
---

# 345 — El banner del Hub cuando Juanito no consulta

## Alcance

- Calculado al leer, sin cron: si en horario hábil la última consulta de Juanito tiene más de 20 min, o hay avisos
  servidos sin confirmar por más de 20 min, el Hub muestra un banner con cuánto tiempo lleva y cuántos avisos quedaron
  sin entregar.
- Webhook Health lista los avisos no entregados con su motivo.

## Done cuando

- Test de la regla pura del banner con los dos disparadores, y fuera de horario hábil no se enciende.
