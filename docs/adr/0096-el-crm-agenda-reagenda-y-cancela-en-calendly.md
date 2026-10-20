# 0096: El CRM agenda, reagenda y cancela en Calendly; una llamada del CRM siempre es una cita real

- **Estado:** aceptado, 19-oct-2026 (Mani, `/grill-with-docs`). Se construye en el 280.
- **Enmienda:** ADR 0049 (Calendly era solo lectura: el CRM recibía las citas y nunca las escribía).
- **Confirma:** ADR 0049 punto 3 (una cita se cuelga de un deal solo sin duda), ADR 0076 (la cita entrega el deal del
  setter al host y el setter conserva el crédito), ADR 0057 (un token de Calendly por programa), ADR 0043 (el programa
  es frontera).

## Contexto

Hasta hoy el CRM solo lee Calendly (webhook, ADR 0049). Reagendar desde la ficha del deal crea una llamada que existe
solo en la base: sin evento, sin Google Meet y sin correo al lead. Los closers lo descubren tarde. Nicolás (14-oct y
19-oct, grupo Nuevos closers Retia) reagendó en el CRM y la cita no apareció en Calendly; otra vez Calendly no lo dejó
mover una cita y tuvo que esperar. Gerencia pidió que se pueda reagendar "en cualquier momento". El A-148 (237) ya
mostró el otro lado: reagendar en los dos lados duplica la llamada.

Medido el 19-oct (solo lectura, API con el token de cada programa):

- Los tres programas están en el plan **Teams** (pagado). La Scheduling API (`POST /invitees`) exige Standard o más, y
  la reserva dispara las mismas notificaciones, invitación de calendario y Meet que una reserva por la página.
- **No hay endpoint de reagendar.** Se cancela con `POST /scheduled_events/{uuid}/cancellation`, que **rechaza un evento
  pasado** (`Event in the past`). Desde la API, reagendar es reservar la nueva y cancelar la vieja.
- `start_time` tiene que ser un hueco libre del tipo de evento; fuera de la disponibilidad, la API rechaza la reserva.
- El evento del formulario de Comunícate con Confianza es **round robin** (Nicolás y Juanjo): Calendly escoge el host y
  la API no deja forzarlo. Cada closer tiene además eventos personales en la organización del programa.

## Decisión

1. **Toda cita que el CRM crea es una cita real en Calendly.** Agendar, reagendar y cancelar desde el CRM escriben en el
   Calendly del programa, con su token. Una llamada "solo en la base" deja de existir como camino de la ficha. No hay
   escape para "llamada fuera de Calendly": abriría el mismo desfase que esto cierra.
2. **El evento depende de la etapa del deal:**
   - Deal en **setteo** (`ETAPAS_DE_SETTEO`, aún sin llamada): se reserva en el **round robin del programa**, con el
     código del deal en el `tracking` (el mismo `utm_content` del link del setter). Calendly escoge el host y el webhook
     entrega el deal por el camino del ADR 0076: cambia el dueño y el setter queda con el crédito. El CRM no reasigna
     nada por su cuenta.
   - **Cualquier otra etapa** (Agendado, Atendido, con Re-agenda, Seguimiento...): se reserva en el **evento personal
     del dueño** para ese programa. El dueño no cambia.
   Se descartó reservar siempre en el round robin (una reagenda de un deal de Nicolás le podía caer a Juanjo) y dejar
   que el closer escogiera (la propiedad del deal la decidiría un clic).
3. **El evento personal vive en la membresía** (`miembros_programa`, el par closer × programa, donde ya está su correo
   de Calendly). Se escoge de un selector que lista por API los eventos de ese closer en el Calendly del programa;
   nadie pega URIs. Sin evento configurado, el CRM no deja agendar fuera de setteo y dice qué falta.
4. **Solo horas disponibles.** El diálogo muestra los huecos del evento que toca (`event_type_available_times`) y el
   closer escoge uno. Si quiere otra hora, abre disponibilidad en su Calendly.
5. **Calendly manda el orden, y no hay cola:**
   1. Reservar la nueva en Calendly. Si falla, no se escribe nada y el closer ve el error.
   2. Escribir el CRM: la vieja queda `reagendada` (con su motivo) y nace la nueva con su huella `calendly:<uuid>`,
      fecha, host y link del Meet. Si este paso falla, el `invitee.created` del webhook la cuelga igual (por el código
      del deal o por el correo, ADR 0049); la huella impide el duplicado cuando llegan los dos.
   3. Cancelar la vieja en Calendly **solo si es futura**. Si falla, el deal muestra un aviso con "reintentar"; la
      vieja ya no cuenta porque el CRM la marcó en el paso 2. Una cita pasada no se cancela (la API no deja): queda
      en el CRM como `reagendada`.
   Como la vieja ya está `reagendada` cuando llega el `invitee.canceled` propio, el webhook no la toca
   (`marcarFallida` solo cambia llamadas `agendada`). Se descartó cancelar primero (si la reserva falla, el lead pierde
   la cita y recibe un correo de cancelación) y una cola de reintentos (infraestructura que hoy no existe, para cinco
   usuarios).
6. **"En cualquier momento" sale de agendar, no de mover.** Como el CRM reserva una cita nueva en vez de mover la
   vieja, no importa si la vieja ya pasó, se canceló o fue no-show: un deal con Re-agenda se agenda igual.
7. **Alcance:** agendar, reagendar y cancelar. El no-show sigue siendo solo del CRM (nadie decide con el no-show de
   Calendly). Las acciones mantienen las rejas de hoy (`dealAbiertoDelActor`, `trabajaLeads`).

## Consecuencias

- El CRM pasa a **escribir** en un servicio externo desde una acción de usuario. Cada escritura en Calendly le llega
  al lead como correo; un error aquí se ve afuera, no solo en la base.
- La reagenda por la API no aparece en Calendly como reagenda (`rescheduled` sale `false`): son una cancelación y una
  reserva sueltas. La relación entre las dos la guarda el CRM, no Calendly.
- Configurar un closer en un programa ahora incluye escoger su evento personal.
- Los closers dejan de tener que reagendar "en un solo lugar" a mano: el lugar es el CRM. Reagendar directo en
  Calendly sigue funcionando por el webhook (ADR 0049, 237).
- El 278 (integraciones) cambia de dónde lee el token el lector de Calendly; el 280 no lo espera.
