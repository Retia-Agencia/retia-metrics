---
id: 366
etapa: avisos
serves: "ADR 0114 punto 10 (enmienda del 3-nov, PUSH-1)"
depends: [343]
status: todo
---

# 366 — El CRM cancela en Calendly a quien no confirmó, en los casos seguros

## Por qué

Es el corte del protocolo de confirmación de 30X (Instructivo del Confirmador v3.3, 23-oct): la agenda que no se
confirma se libera la víspera para que entre otra. En 30X Luigi canceló a quien no respondió 3 mensajes y en ese
espacio entraron dos agendas, una cerró. Mani, 3-nov: "todo lo que reduzca fricción es bueno".

## Alcance

- **Migración** (la aplica la sesión principal): en `programs`, el modo del corte (`pgEnum`: `apagado`, `aprobar`,
  `automatico`; por defecto `apagado`), editable en Programa con el molde de `lib/catalogo/` y su `change_log`.
- Una función de `lib/calendly/` que responde "¿esta llamada se puede cancelar por no confirmar?" y es la única que lo
  decide. Sí solo si todo se cumple: confirmación `no_confirmada` (343); llamada vigente, sin resultado, con huella
  `calendly:<uuid>`; la cita no es hoy en Bogotá (`hoyEnBogota`); se agendó con 24 h o más de anticipación.
- `POST /api/avisos/cancelaciones` con el secreto de avisos: `[{ evento: <uuid de Calendly> }]`. El CRM vuelve a
  comprobar cada caso con esa función (no confía en Juanito), cancela con la API de Calendly del programa (ADR 0057) y
  deja rastro con origen `whatsapp`. Responde `{ canceladas, rechazadas: [{ evento, motivo }] }`. Con el modo en
  `apagado` todo sale rechazado. La llamada la marca el webhook de cancelación de Calendly, como cualquier otra.
- Con el modo en `automatico`, el CRM devuelve en "¿qué mando ahora?" (340) el aviso al closer de lo que canceló, en
  vez de esperar el sí.

## Antes de construir

- Verificar que el token de Calendly guardado por programa puede cancelar (`POST /scheduled_events/{uuid}/cancellation`).
  Si no, el token se cambia antes; no se busca otro camino.

## Done cuando

- Test por cada condición en los dos sentidos (hoy, agendó con menos de 24 h, confirmada, anulada, con resultado, sin
  huella de Calendly, otro programa): solo el caso completo cancela.
- El mismo uuid dos veces llama a Calendly una sola vez.
- Calendly caído: la cita sale en `rechazadas` con su motivo y nada se escribe.
- Una prueba real con un closer, el modo en `aprobar` y una cita de prueba.
