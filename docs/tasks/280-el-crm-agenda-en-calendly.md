---
id: 280
etapa: llamadas
serves: "Agendar, reagendar y cancelar desde el CRM crea, mueve y cancela la cita real en Calendly, con su Meet y su correo al lead, en cualquier estado del deal (Nicolás y Daniel, grupo Nuevos closers Retia, 14 y 19-oct; Mani, 19-oct)"
depends: []
status: todo
---

# 280 — El CRM agenda, reagenda y cancela en Calendly

Decisión: **ADR 0096**. Léelo antes de empezar; no se re-litiga.

## Por qué

Reagendar en la ficha crea una llamada que solo existe en la base: el lead no recibe nada y no hay Meet. Los closers
reagendan a mano en Calendly y a veces Calendly no los deja (cita en curso o pasada). Gerencia quiere poder reagendar en
cualquier momento.

## Qué se construye

1. **Cliente de escritura de Calendly** en `lib/calendly/` (un módulo; nadie más hace `POST` a Calendly):
   - `horasDisponibles(programa, eventType, desde, hasta)` → `GET /event_type_available_times` (máx. 7 días por
     consulta en la pantalla; la API acepta hasta 31).
   - `reservarCita(programa, { eventType, startTime, lead, tracking? })` → `POST /invitees`. Invitado: nombre y correo
     principal del lead, `timezone: "America/Bogota"`. Sin `location` en el round robin; en un evento personal, la
     `location` del evento (`google_conference`). Si el evento tiene preguntas obligatorias, se llenan con datos del
     lead (teléfono) o falla ruidosamente diciendo cuál falta.
   - `cancelarCita(programa, uuidEvento, motivo)` → `POST /scheduled_events/{uuid}/cancellation`; `Event in the past`
     y `already canceled` se devuelven como resultados, no como excepciones.
   - El token sale del lector que ya existe (el 278 lo moverá; este ticket no lo espera).
2. **Qué evento toca** (`eventoParaAgendar(deal)`, puro, con test): etapa en `ETAPAS_DE_SETTEO` → round robin del
   programa, resuelto desde `programs.calendly_url` contra el `scheduling_url` de sus event types (si no hay uno
   exacto y único, error visible) y con `tracking.utm_content = codigoDeDeal(deal.id)`; cualquier otra → el evento
   personal del dueño en `miembros_programa`.
3. **Migración:** `miembros_programa.calendly_event_type` (texto, URI, nulo). La genera y aplica la sesión principal.
4. **Selector del evento personal** donde hoy se edita la membresía y su correo de Calendly: lista por API los eventos
   del usuario de Calendly de ese correo en la organización del programa. Escribe con rastro (molde del catálogo).
5. **Acciones en `lib/deals/llamadas.ts`** (reutilizar `dealAbiertoDelActor`, `unaCitaMueveAAgendado`, `moverEtapa`):
   - `agendarEnCalendly(deal, startTime)`: deal sin cita `agendada` (setteo, Re-agenda, Seguimiento). Reserva → crea
     la llamada con `huellaFila = huellaDeCita(uuidInvitado)`, `origen: "calendly"`, fecha, host y `linkCalendly` =
     link del Meet. En setteo **no** cambia el dueño: lo hace el webhook (ADR 0076).
   - `reagendarLlamada` pasa a: reservar → transacción (vieja `reagendada` con motivo + nueva como arriba) → si la
     vieja es futura y tiene huella de Calendly, cancelarla. Si la cancelación falla, nota del sistema en el deal y
     acción "reintentar cancelación".
   - Cancelar una cita futura desde el CRM la cancela en Calendly (motivo como `reason`).
   - Ya no se aceptan fecha libre ni `linkCalendly` tecleado en estas acciones.
6. **Webhook (`lib/calendly/colgar-llamada.ts`, `eventos-de-cita.ts`):** un `invitee.created` cuya huella ya existe se
   adopta (no duplica); llega antes o después de la escritura del CRM, en los dos órdenes. El `invitee.canceled` de una
   llamada ya `reagendada` no la toca (confirmar con test que sigue así).
7. **Diálogo** (Agendar / Reagendar en la ficha del deal): días → huecos disponibles del evento que toca → confirmar;
   dice con quién queda la cita ("Round robin del programa: Calendly asigna el closer" o "Tu agenda"). Cliente sin
   valores de `lib/` que carguen la base: corre `npm run build`.

## Spike antes de construir (con el token de Confianza, pide el ok de Mani porque escribe)

- Reservar con el token del **owner** en el evento personal de otro miembro: ¿lo permite? Si no, este diseño cambia.
- Una reserva de prueba en un hueco real y su cancelación: payload del webhook, `rescheduled`, link del Meet en
  `location.join_url`, correo al invitado (usar un correo propio).

## Done cuando

- Tests: `eventoParaAgendar` en los dos sentidos; reagenda con la API simulada en sus tres fallos (reserva falla →
  nada escrito; CRM falla → webhook la cuelga sin duplicar; cancelación falla → aviso y la vieja no cuenta); vieja
  pasada no se cancela; webhook en los dos órdenes con la misma huella; guardián: ningún `fetch` a
  `api.calendly.com` con método de escritura fuera del módulo del cliente.
- Recorrido en `dev:local` del diálogo (clic en todo, consola limpia) y una reagenda real en producción con Nicolás,
  verificada en su Calendly.
- Typecheck, lint, build y tests del cambio limpios; checkpoint verde.

## Fuera de alcance

- Marcar no-show en Calendly. Reasignar el dueño desde el CRM al agendar en setteo. Una cola de reintentos.
