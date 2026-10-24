---
id: 308
etapa: agendamiento
serves: "Evaluación de dCal como reemplazo de Calendly (23-oct) · ADR 0049 · ADR 0057 · ADR 0096 · ADR 0098 · ADR 0100"
depends: []
status: todo
---

# 308 — Piloto de dCal: verificar lo que los docs no responden antes de decidir si reemplaza a Calendly

## Por qué

Dapta sacó dCal (app.dcal.ai, MIT, gratis; docs en https://docs.dapta.ai/dcal/dcal, código en
https://github.com/Dapta-Tech/dapta-calendars-slate). Los tres programas pagan Calendly Teams (ADR 0096). El 23-oct se
evaluó con los docs y el código, sin crear nada. Veredicto: **sirve para el lado del CRM (round robin, API,
webhooks), pero no reemplaza hoy el flujo del formulario**. Mani pidió verificar con un piloto antes de decidir.

Lo que gana frente a Calendly (docs de dCal):
- Reagendar nativo (`PATCH /v1/machine/bookings/{uid}`, `POST /v2/bookings/{uid}/reschedule`); Calendly no lo tiene
  (ADR 0096).
- Reserva por API en un team event (`POST /v2/bookings` con `teamSlug`), `/v2/slots` con el aviso mínimo ya aplicado
  (el `TOOSOON` del ADR 0101), `Idempotency-Key`, `metadata` (el `deal_id` viaja con la cita), webhook firmado
  HMAC-SHA256 (`X-Slate-Signature`) con `X-Slate-Delivery` estable por reintento.
- Si el invitado reagenda desde su correo, la cita conserva el `uid` (simplifica el `old_invitee` del ADR 0100).
- Round robin con prioridad (5 niveles), peso y desempate por quien esperó más; también collective y fixed.

Los dos huecos que rompen el flujo actual:
1. **Formulario → agenda.** Typeform embebe Calendly y el envío trae el uuid del invitado (ADR 0057, 052). dCal no
   se integra con Typeform **ni con dForms** (el Scheduler de dForms es solo Calendly), y su embed no prellena nombre
   ni correo (`dcal/share/embed`). El lead reescribe el correo y la cita puede quedar suelta (ADR 0049). La salida
   sólida es una pantalla de agenda propia del CRM sobre `/v2/slots` + `POST /v2/bookings`.
2. **Un solo workspace para todos los programas.** El webhook y la API key son del workspace (el de Dapta). La
   frontera de programa (ADR 0043) se impone con un mapa team→programa declarado, como el ADR 0098 con EstadoX.

Diferencias menores: el webhook trae solo `uid`, `status` y hora (sin correo, host ni evento: hace falta un `GET`
por evento); no hay no-show ni routing forms; horizonte fijo de 60 días sin tope diario; un team event no pide
confirmación; el peso cuenta también las citas personales del host; tras cambiar miembros hay que volver a guardar
cada team event; producto en piloto (renombre en curso, repo público de un solo commit, último cambio 21-oct).

## Alcance

Bloqueado hasta que el MCP de Dapta Calendars (`https://mcp.dcal.ai/mcp`) esté conectado en la sesión, o haya una
API key de dCal en `.env.local` (`DCAL_API_KEY`, que pone Mani; nunca por chat). Toda escritura en dCal pide el ok
de Mani antes y se nombra qué se crea.

1. Un team de prueba (`piloto-retia`) con dos hosts que tengan calendario conectado, y un team event round robin.
2. Un webhook a un receptor de prueba (no al CRM de producción) con `booking.created`, `booking.rescheduled` y
   `booking.cancelled`.
3. Reservar por `POST /v2/bookings` con `teamSlug` y `metadata`, varias veces, y medir el reparto entre los dos hosts.
4. `GET /v2/bookings/{uid}` de esa reserva: ¿trae el tipo de evento o el team, los `hosts` y el correo del invitado?
5. Reagendar la reserva de team con `PATCH /v1/machine/bookings/{uid}` (¿lo acepta o es solo personal?) y con
   `/v2/.../reschedule`; cancelar una cita pasada (Calendly lo rechaza).
6. Reservar desde la página pública embebida y comprobar el `postMessage` `dapta-calendars.booking_scheduled`.
7. Borrar lo creado al terminar, o dejarlo desactivado si se va a seguir.

## Resultados

### Fase 1 (23-oct): la API, sobre el evento personal de Mani

Con `DAPTA_CALENDARS_API_KEY` (en `~/.zshrc` de Mani, no en `.env.local`). El workspace tenía un solo evento
personal (`manuel/30-min-meeting`), ningún calendario conectado, ningún team y ninguna reserva. Invitado ficticio
`piloto-dcal@example.com`. Todo lo creado quedó cancelado (`GET /v1/machine/bookings?status=accepted` vacío).

| Pregunta | Medido |
|---|---|
| `cal-api-version` | Es **por endpoint** y estricto: event-types `2024-06-14`, slots `2024-09-04`, bookings `2026-02-25`. Otro valor da 400 `UNSUPPORTED_API_VERSION` |
| `POST /v2/bookings` | 201, devuelve `hosts` (con correo), `attendees`, `eventType {id, slug}`, `metadata` intacto y `absentHost`/`attendees[].absent` |
| Reintento con el mismo `Idempotency-Key` | 201 con el **mismo** `uid`: no duplica |
| Misma hora, otra key | 409 `SLOT_TAKEN` |
| Fuera de horario, o dentro del aviso mínimo | 422 `BOOKING_FIELDS_INVALID` "That time is not available." para los dos: **no dice cuál** (igual de opaco que el `TOOSOON` de Calendly, ADR 0101). La salida es leer `/v2/slots` antes |
| `PATCH /v1/machine/bookings/{uid}` | 200 y **conserva el `uid`**. Devuelve `manageUrl` con token (el link del invitado para reagendar o cancelar) |
| `POST /v2/bookings/{uid}/reschedule` | 201 con `uid` **nuevo**, `rescheduledFromUid` y la `metadata` copiada; la vieja queda `cancelled` con `rescheduledToUid` |
| Cancelar dos veces | 200 las dos: idempotente |
| `GET /v1/machine/bookings` | Trae `hostMemberId` (uuid), que **no es** el `hosts[].id` (número) de `/v2`: dos sistemas de id para el mismo host |

Consecuencia para el diseño: el CRM debería reagendar con `PATCH /v1` (mismo `uid`, una sola llamada) y guardar el
`deal_id` en `metadata` al reservar. `absent` existe en el modelo de la reserva aunque ni la API ni el dashboard lo
escriban (sin no-show, como decían los docs).

### Fase 2 (23-oct): el round robin del team

Teams, team events, webhooks y conexión de calendarios **solo se crean en el dashboard**, nunca por API key ni MCP
(docs de API keys y MCP). Mani creó en app.dcal.ai el team `piloto-retia` ("Piloto") con dos hosts y el team event
`piloto-round-robin` (id `1701768201235104`, round robin, 30 min, conferencing). No creó webhook. Cuatro reservas de
prueba el 27-oct (9:00 a 10:30), mismo invitado ficticio; todas canceladas al terminar.

| Pregunta | Medido |
|---|---|
| `POST /v2/bookings` con `teamSlug` | 201; `hosts` trae al host asignado con su correo, y `metadata` intacta |
| Reparto entre los dos hosts | **No se pudo medir:** las 4 cayeron en el mismo host (`manuelmejiaarana@gmail.com`). Al reservarlas, esas horas desaparecieron de `/v2/slots`, así que el segundo host nunca estuvo libre ahí. Lo más probable (docs de scheduling methods): no ha aceptado la invitación o su horario no cubre esas horas |
| `GET /v2/bookings/{uid}` de una cita de team | Trae `eventTypeId` y `eventType.slug`, **no el team**. La frontera de programa va por un mapa `eventTypeId`→programa, como `programs.calendly_event_type` (ADR 0098) |
| `PATCH /v1/machine/bookings/{uid}` en una cita de team | **Funciona** (200, conserva el `uid`), aunque los docs dicen que `/v1` es solo para eventos personales. Eso aplica a reservar, no a reagendar |
| `/v2/.../reschedule` en una cita de team | 201, `uid` nuevo, se queda el mismo host (como dicen los docs) |
| Link de la reunión | `meetingUrl: null`: los calendarios conectados son de solo lectura (`canCreate: false`). Sin un calendario que reciba eventos no hay Meet, y en producción cada closer tiene que tenerlo |
| `GET /v2/calendars` | Muestra solo los calendarios del dueño de la key, no los de cada host |

### Lo que falta medir

- El reparto real del round robin, con el segundo host con horario activo. Michael (`michaelcast533`) ya entró al
  workspace y al team (23-oct).
- El Meet. El team event ya tiene `locations: [{kind: "conferencing"}]` (Online meeting); falta que **cada host**
  tenga en su página **Calendars** un calendario con **Add new events here** (docs `connect-a-calendar`, "Add an
  online meeting link"). Los de Mani salen `readOnly: true`, `source: "shared"`, `canCreate: false` en
  `GET /v2/calendars`: llegan compartidos desde la app de Dapta. Sin fuente verificada: si ahí no deja marcar
  destino, hay que conectar Google directo en dCal (**Connect another**) dando permiso de escritura.
  **Medido el 23-oct:** con el destino puesto, una reserva desde la página pública con un Gmail real creó el evento
  en el calendario del host y del invitado, con link de Meet. Pero `GET /v2/bookings/{uid}` siguió devolviendo
  `meetingUrl: null`: **el CRM no puede leer el link de la API** (falta ver si llega por el webhook). Reserva
  `d75ceb2d-…` cancelada por API (200, idempotente).
- El webhook (pasos 2 y 6): qué llega de una cita de team y el `postMessage` del embed. Necesita un webhook creado
  en el dashboard hacia un receptor de prueba.
- Cancelar una cita pasada (la API no deja crear una en el pasado; se mide cuando una de prueba se venza).
- El webhook, sabiendo ya lo que trae (docs `webhooks/payload-reference`): una cita de team llega solo con `uid`,
  `status` y `startUtc`, sin correo, host ni link; reagendar por `PATCH /v1` conserva el `uid`. dCal exige una URL
  `https://` pública (rechaza `localhost`): el receptor de prueba va por un túnel temporal (cloudflared), no al CRM.

### Cómo entraría dCal desde el formulario (24-oct, docs)

| Camino | Qué pasa |
|---|---|
| Redirigir al link de dCal al terminar (Typeform "Redirect on completion", sin fuente verificada; dForms, `logic/ending-screen`) | El lead reescribe nombre y correo (dCal no prellena, `share/embed`) y el envío no trae el id de la cita: cita suelta si cambia el correo (ADR 0049) |
| Scheduler de dForms | Solo Calendly (`dforms/builder/question-types/content-steps`) |
| Embed de dCal en la landing tras el formulario | El `postMessage` trae `uid`, `startUtc` y `eventTypeSlug`, nunca el correo: unirlo al lead pide un endpoint público nuevo. Frágil |
| Agentes de Dapta (voz o texto) | Nativo: reservan en la conversación. Sirve para WhatsApp o llamada, no reemplaza el formulario |
| **Pantalla de agenda del CRM** (recomendado) | El formulario redirige a una página del CRM con id opaco; muestra `/v2/slots` y reserva con `POST /v2/bookings` con el correo del lead y el `deal_id` en `metadata` (medido en fases 1 y 2). Sin reescribir datos, la cita nace en su deal, independiente del proveedor de formularios. Costo: frente nuevo y dependencia crítica de un producto en piloto |

## Fuera

- Tocar los formularios de los programas, los webhooks de Calendly o el CRM de producción.
- La decisión de migrar: sale de este piloto, como ADR nuevo.

## Done cuando

- [ ] Cada pregunta de los pasos 3 a 6 tiene respuesta medida, escrita en este ticket.
- [ ] Recomendación para Mani: migrar (con qué frente de trabajo), esperar a que Dapta conecte dForms con dCal, o
  quedarse en Calendly.
- [ ] Nada de lo creado en dCal queda activo sin que Mani lo sepa.
