# 0100: Un deal tiene una sola cita activa; la reserva más reciente reemplaza a la anterior

- **Estado:** aceptado, 20-oct-2026 (Mani).
- **Enmienda:** ADR 0049 (una cita nueva sobre un deal con otra cita futura ya no se agrega como una llamada más).
- **Confirma:** ADR 0076 (un deal con llamada es de quien da la llamada), ADR 0096 (Calendly manda el orden; el CRM
  cancela en Calendly), ADR 0043 (el programa es frontera).

## Contexto

Medido el 20-oct en producción. Dos leads llenaron el formulario **dos veces**, con un día de diferencia, y en cada envío
reservaron en el Calendly que trae el formulario. Ninguno usó el enlace "Reschedule" (`old_invitee` vacío), así que
para Calendly fueron dos citas sueltas y las dos quedaron activas:

- Veronica Palacio (Comunicarte): una cita con Maru (reservada el 16-oct) y otra con Andrea (reservada el 17-oct),
  las dos el 21-oct. El deal pasó a Andrea, pero la cita de Maru siguió viva: dos closers iban a llamar al mismo lead.
- Adriana Arango (Tactical): dos citas con Maru, el 21-oct y el 22-oct.

Hoy el CRM agrega la segunda cita como otra llamada `agendada`, le pasa el deal al host nuevo y no toca la vieja. La
cita vieja sigue bloqueando la agenda de un closer, Juanito le manda su push antes de la llamada, y en el Inbox
aparece como una llamada más. Ningún error lo delata. Las dos se cancelaron a mano el 20-oct.

## Decisión

1. **Un deal tiene a lo sumo UNA cita futura activa, en el CRM y en Calendly.** Esa cita define al dueño del deal
   (ADR 0076): quien la hospeda es el dueño.
2. **La reserva que llega reemplaza a la que había.** Cuando entra una cita nueva en un deal que ya tiene otra llamada
   futura en `agendada`, se trata como una reagenda:
   - la llamada vieja pasa a `reagendada`, con una nota del sistema en el deal que dice qué cita la reemplazó;
   - el dueño pasa al host de la nueva (lo que ya hace `darDealAlHost`, con la regla del setter del 20-oct);
   - la cita vieja **se cancela en Calendly** con el token del programa, si es futura. Una cita que queda viva bloquea
     horario sin razón y dispara pushes de Juanito para una llamada que no va a pasar.
3. **La regla aplica por TODAS las puertas por donde entra una cita**, y vive en una sola función que todas llaman:
   - el envío del formulario que trae la cita (`con_calendly`, ticket 052);
   - el webhook `invitee.created` de Calendly (cita que el lead reservó por otro link);
   - una suelta que se cuelga a mano de un deal;
   - el CRM, que ya lo hace al reagendar (ADR 0096): se mantiene, y debe pasar por la misma función.
   "La más reciente" es la que llega al CRM de último. Un reintento de una cita que el CRM ya conoce (misma huella) no
   reemplaza nada.
4. **Calendly manda el orden, igual que en el ADR 0096.** Primero se escribe el CRM (vieja `reagendada`, nueva
   `agendada`) en una transacción; la cancelación en Calendly va **después**, fuera de la transacción. Si falla, el
   deal muestra el aviso de cancelación pendiente con "reintentar" que ya existe para el 280. La vieja ya no cuenta
   en el CRM porque quedó `reagendada`, y el `invitee.canceled` que devuelve Calendly no la toca (`marcarFallida` solo
   cambia llamadas `agendada`), así que el deal **no** cae a Re-agenda.
5. **Alerta:** la reagenda queda en la ficha del deal (nota del sistema) y como novedad de Calendly
   (`cita_reagendada`, tipo que ya existe). Si el dueño cambió, el closer que perdió la cita recibe el aviso de cambio
   de dueño que ya existe.
6. **Fuera de alcance:** las llamadas **pasadas** que siguen en `agendada` sin resultado. Esas no se reemplazan ni se
   cancelan (la API no cancela un evento pasado); son de la alerta "Llamadas que ya pasaron sin resultado" del Inbox.

## Alternativas descartadas

- **Dejar las dos citas y que el closer decida.** Es lo de hoy: dos closers con el mismo lead y nadie se entera.
- **Que gane la cita más cercana en el tiempo.** Contradice lo que hizo el lead: si reservó otra vez, la intención
  vigente es la última.
- **No cancelar en Calendly, solo en el CRM.** El horario sigue bloqueado, el lead recibe recordatorios de las dos y
  Juanito manda pushes de más.

## Consecuencias

- El CRM cancela en Calendly desde un webhook y desde la ingesta, no solo desde una acción del closer. El lead recibe
  el correo de cancelación de la cita vieja, que es coherente con la reserva que él mismo hizo.
- `docs/structure.md` (sección de llamadas) dibuja la regla y sus cuatro puertas.
- Un lead que reserve dos citas a propósito (dos llamadas distintas) no es un caso del negocio hoy: si aparece, se
  agenda desde el CRM y esta regla se revisa.
