---
id: 331
etapa: media
serves: "ADR 0112 punto 6"
depends: [330]
status: todo
---

# 331 — El aviso semanal de insights por WhatsApp

## Alcance

- El endpoint con secreto del semáforo gana un envío semanal por programa al destino de media (dato del programa):
  "insights de la semana listos" con el enlace, sin una sola cita. Contrato `.strict()` ampliado.
- Juanito lo manda tal cual (su repo, con el ok de Mani).

## Done cuando

- `tests/semaforo-endpoint.test.ts`: el envío nuevo no trae llaves fuera de la lista blanca.
