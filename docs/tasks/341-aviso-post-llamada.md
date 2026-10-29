---
id: 341
etapa: avisos
serves: "ADR 0114 punto 5 (primera mitad)"
depends: [340]
status: todo
---

# 341 — El aviso al closer cuando su llamada queda sin resultado

## Por qué

Todas las métricas dependen de que el closer registre el resultado, y hoy se olvida. Juanito le manda el link del
Sheet (Push 5), que ya no cuenta.

## Alcance

- Regla pura: una llamada vigente con `resultado = agendada` cuya hora pasó hace 15 min o más (duración del evento +
  15) produce **un** aviso al dueño del deal, con llave `post-llamada:<id de la llamada>`. Nunca se repite.
- Texto: hora y programa, y un enlace al deal. Ningún dato del lead.
- Solo en horario hábil del programa; una llamada que termina fuera de horario cae al resumen de la mañana (342).

## Done cuando

- Test de la regla: antes de los 15 min no hay aviso, después hay uno, con resultado registrado no hay ninguno, una
  llamada anulada no cuenta y una llamada de otro programa no se mezcla.
