---
id: 283
etapa: pauta
serves: "Meta recibe también el agendó y el asistió de cada deal, para que Pauta tenga eventos con volumen para optimizar (ADR 0097, consecuencias)"
depends: [281]
status: todo
---

# 283 — Schedule y Atendido vuelven a Meta

## Por qué

Las ventas son pocas por semana y Meta aprende con unas 50 conversiones semanales por conjunto. Agendar y asistir
tienen más volumen y siguen siendo señales de calidad que el formulario no da.

## Alcance

- Dos eventos nuevos en `eventos_meta`, con la misma bandeja, el mismo envío y una sola vez por deal: `Schedule`
  (estándar) la primera vez que el deal entra a Agendado, y `Atendido` (personalizado) la primera vez que entra a
  Atendido. `event_id` = `<deal>:schedule` y `<deal>:atendido`.
- **Abierto antes de construir:** el pixel de Calendly o del formulario ya puede mandar `Schedule` desde el navegador.
  Si es así, se deduplica con el mismo `event_id` o no se manda desde el servidor. Se mira en Events Manager con Pauta.
- Pauta decide con qué evento optimiza cada campaña; el CRM solo lo manda.

## Done cuando

Un deal que agenda y asiste deja un `Schedule` y un `Atendido` en Events Manager, sin duplicar el del navegador.

## Enmienda 22-oct (Mani, Events Manager de Power Talk)

- **Schedule ya llega por el navegador:** el dataset de Confianza recibe `invitee_meeting_scheduled` (pixel de Calendly,
  calidad 8,8/10) e `invitee_select_day/time`. Mandar `Schedule` desde el servidor lo duplicaría salvo que se deduplique
  con el mismo `event_id`, que el CRM no conoce. **Recomendación:** solo `Atendido`, que nadie más manda.
- **Atendido queda como potencial de envío**, no comprometido: se decide con Pauta según si van a optimizar con él.
- El mapa completo de eventos posibles vive en el 294.
