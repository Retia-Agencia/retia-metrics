---
id: 331
etapa: media
serves: "ADR 0112 punto 6"
depends: [330, 340]
status: todo
---

# 331 — El aviso semanal de insights por WhatsApp

> **Reconciliar antes de construir (29-oct):** este ticket se escribió antes del ADR 0114. La puerta de avisos es la
> del 340 (`/api/avisos/pendientes` y `/entregados`); el aviso semanal debe ser un tipo de aviso más ahí, no un
> segundo envío en el endpoint del semáforo. Depende entonces también del 340. Además, Juanito tiene que estar activo
> para los destinatarios (Alejo y Dana, pedido de Michael el 28-oct).

## Alcance

- El endpoint con secreto del semáforo gana un envío semanal por programa al destino de media (dato del programa):
  "insights de la semana listos" con el enlace, sin una sola cita. Contrato `.strict()` ampliado.
- Juanito lo manda tal cual (su repo, con el ok de Mani).

## Done cuando

- `tests/semaforo-endpoint.test.ts`: el envío nuevo no trae llaves fuera de la lista blanca.
