# 0076 — El setter entrega el deal al closer por la cita: cuatro caminos de una llamada, cada uno con su llave

- **Estado:** aceptado · 2-oct-2026 (Mani). Se construye en el [157](../tasks/157-handoff-del-setter-al-closer.md).
- **Enmienda:** ADR 0049 (cómo se cuelga una llamada: se agrega la llave del deal antes del correo, y una suelta
  solo la cuelga su host o quien administra).
- **Confirma:** ADR 0049 punto 6 (una suelta nunca se asigna sola), ADR 0037 (un lead tiene a lo sumo un deal
  abierto por programa), ADR 0043 (el programa es frontera).

## Contexto

Setter y closer son personas distintas con el mismo rol `closer` en el CRM (Mani, 2-oct). El setter toma deals del
Inbox, los trabaja y le manda al lead el link de Calendly del programa (round robin). El closer atiende la llamada y
sigue el deal hasta cerrarlo. Regla de Mani: **un deal con llamada es SIEMPRE de quien da la llamada**, y el manejo
de las llamadas *"debe quedar súper mapeado y con visibilidad total; no puede haber fallos"*.

Hoy el host de Calendly ya se queda con el deal (`darDealAlHost`), pero nada guarda quién lo setteó, el
emparejamiento es solo por correo, y cualquier closer puede colgar una suelta.

Se descartó que el setter **suelte** el deal (sin dueño) para que el closer lo reclame: si el lead nunca agenda, el
deal queda huérfano sin que nadie lo vea, y cualquier closer podría quedarse con un deal cuya llamada es de otro.

## Decisión

1. **Handoff: el setter marca "Link enviado" y el deal SIGUE siendo suyo**, en su etapa. El botón copia el link de
   agenda del deal y escribe la marca (`deals.handoff_en`, con su fila en `change_log`). El setter no agenda a mano.
2. **La alerta de "link enviado sin cita": 1 día hábil** (Bogotá, sábados y domingos no cuentan) después de la marca
   sin llamada vigente en el deal. Sale en rojo en la ficha, la tarjeta y "Lo mío que necesita atención" del setter.
   Le dice que el lead no ha agendado: o se enfrió y hay que empujarlo, o agendó por otra puerta y su llamada está
   suelta. Desaparece sola cuando la cita entra (el deal ya no es del setter).
3. **El crédito del setter es un campo.** Cuando una cita pasa el deal de un dueño a otro, el dueño anterior queda
   en `deals.setter_user_id` (FK a `users`), una sola vez: un re-agendamiento no lo pisa. Un deal que llegó agendado
   desde el formulario no tiene setter. "Agendas y ventas por setter" es un `group by`.
4. **Una llamada entra por uno de cuatro caminos, y cada uno tiene su llave:**

   | Cómo agenda el lead | Llave | Si no casa |
   |---|---|---|
   | A · El Calendly del formulario | el id del invitado que trae el envío `con_calendly` (052, ya existe) | Pendiente Setteo con nota del sistema (052) |
   | B · El link de agenda que mandó el setter | `utm_content` = código opaco del deal (el `tracking` del invitado, verificado el 2-oct contra la API) | sigue al camino C |
   | C · Un link genérico | el correo, si es de un solo lead con un solo deal abierto (ADR 0049) | queda **suelta** |
   | D · Re-agenda hablada con la persona | el closer la agrega en su propio deal, con el link que sea (ADR 0075 punto 6) | no aplica |

   El link de agenda del deal es `programs.calendly_url` + `utm_source=crm&utm_medium=setter&utm_content=<código>`:
   **calculado, nunca guardado** (ADR 0024), sin ningún dato personal. Ese `utm_content` lo lee solo el emparejador
   de Calendly, excepción nombrada en el guardián de UTM. Un código de otro programa no casa (frontera).
5. **Una suelta la cuelga solo su host, o quien administra.** La llamada sabe su host (`calls.calendly_host_email`
   contra la membresía del programa). Al colgarla, el deal pasa al host y se escribe el setter igual que en el punto
   3. La fila de la suelta sugiere los deals abiertos del programa con el mismo nombre o teléfono. Una suelta cuyo host
   no tiene cuenta registrada en el programa la cuelga quien administra. Ninguna suelta abre un deal nuevo si el lead
   ya tiene uno abierto (140).
6. **Visibilidad:** los cuatro caminos, la regla del punto 5 y la alerta del punto 2 quedan dibujados en
   `docs/structure.md` (sección de llamadas) y en el manual de operación comercial (154).

## Consecuencias

- Una migración: `deals.setter_user_id` y `deals.handoff_en`. Va a la cola de migraciones (`plan-reparto.md`).
- `darDealAlHost` escribe el setter; el webhook, la regla del 052 y la suelta asignada a mano lo llaman, así que no
  hay código aparte por camino.
- Cada camino tiene su prueba, y la del punto 5 se muerde forjando la petición: un closer que no es el host intenta
  colgar una suelta y recibe 403 con la base quieta.
