---
id: 343
etapa: avisos
serves: "ADR 0114 punto 7"
depends: []
status: todo
---

# 343 — La confirmación de la llamada llega desde Juanito

## Por qué

"¿Cuántas confirmadas?" es la pregunta número uno de los grupos de ventas, y hoy el dato vive solo en Juanito.

## Alcance

- **Migración** (la aplica la sesión principal): en `calls`, `confirmacion` (`pgEnum`: `confirmada`, `no_confirmada`,
  `cancelada_segun_closer`, nula = sin preguntar) y `confirmacion_en`.
- `POST /api/avisos/confirmaciones` con el secreto de avisos: `[{ evento: <uuid de Calendly>, estado }]`. El CRM
  busca la llamada por `huellaDeCita(uuid)` (`lib/calendly/colgar-llamada.ts`) y escribe con `editarConRastro`, origen
  `whatsapp`. Responde `{ aplicadas, sin_cambio, no_encontradas }`.
- "Cancelada según el closer" no cancela la llamada ni mueve el deal.
- La ficha del deal muestra la confirmación junto a la llamada.

## Done cuando

- Test: mismo estado dos veces = una sola fila de rastro; un uuid desconocido sale en `no_encontradas` sin error; una
  llamada anulada no se toca; un uuid de otro programa no cruza la frontera.
