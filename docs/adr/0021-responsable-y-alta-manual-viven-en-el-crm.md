# 0021 — El responsable de una persona y el alta manual viven en el CRM, no en Sheets

**Fecha:** 2026-09-16 · **Estado:** aceptado (Mani, en `/grill-with-docs`; pedido de Michael)

Michael pidio el 16-sep que toda persona tenga un closer responsable y que el closer la cree o se
la asigne "en la plataforma, como en Kapso". Leido al pie de la letra, eso choca con ADR 0004
(Sheets es la fuente de verdad de los leads). Revisamos las hojas en vivo: los formularios de los
dos programas no tienen ninguna columna de closer ni de responsable. El dato no existe hoy en
ningun lado.

**Decidimos que ADR 0004 cubre lo que el formulario captura, y nada mas.** El responsable y las
personas creadas a mano son del CRM, igual que las llamadas y ventas desde ADR 0008:

- **El responsable es un campo de la persona que solo escribe la app.** El sync nunca lo lee ni
  lo pisa, y la app no lo escribe de vuelta a la hoja. Se guarda como el mismo `closerId` en
  texto de ADR 0011, no como relacion a `users`.
- **Asignar:** un closer se asigna personas sin responsable; solo un gerente cambia a una persona
  que ya tiene responsable. Cada cambio va a `change_log`.
- **"Sin responsable" es un estado valido.** El sync sigue trayendo personas sin responsable y no
  hay reparto automatico ni backfill. "Siempre tiene responsable" es una meta operativa que la app
  hace visible (cuantas faltan), no una restriccion de la base.
- **Alta manual:** el closer crea una persona que no paso por el formulario (WhatsApp, masivos)
  con correo obligatorio y queda como su responsable. Se marca que entro por el CRM. Si despues
  aplica por el formulario, el sync la encuentra por correo (ADR 0005), completa sus datos y pasa
  a contar como del formulario; ante conflicto en un campo del formulario, gana la hoja.
- **Metricas:** las personas manuales cuentan en el embudo, pero se pueden separar por su entrada.
  El CPL usa solo las del formulario, porque la pauta solo paga esas.

Se descartaron dos alternativas. Escribir el responsable tambien en la hoja cumplia la letra de
ADR 0004, pero exigia escritura a Sheets y dejaba una columna editable a mano: dos verdades. Una
columna que el equipo llena en la hoja contradecia el pedido de Michael de asignarlo en la app.

## Enmienda 2026-09-21 (plan v2, ADR 0037): el responsable se muda al Deal y se llama owner

**Lo que se conserva, entero:** este dato es del **CRM y no de Sheets** (el sync nunca lo lee ni lo
pisa, y la app no lo escribe de vuelta a la hoja); **"sin responsable" sigue siendo valido**; no hay
reparto automatico ni backfill; **el alta manual sigue existiendo** con correo obligatorio y su
marca de entrada; y las personas manuales **cuentan en el embudo pero no en el CPL**, porque la
pauta solo paga las del formulario.

**Lo que cambia, y por que:**

- De `people.responsable_closer_id` (texto copiado, ADR 0011) a **`deals.owner_user_id`, FK real a
  `users`**. El responsable era de la **persona**; el owner es de la **oportunidad**. Una persona
  puede tener dos deals cerrados por dos closers distintos en dos cohortes, y con el campo sobre la
  persona eso no se puede representar sin mentir.
- Al ser FK a `users` deja de ser texto libre, y con eso desaparece por este flanco el riesgo del
  ADR 0011 (`Andre` en vez de `Andrea`). ADR 0011 sobrevive **solo** para lo historico que entre
  por la migracion one-time de la etapa 7, donde la hoja escribio un nombre y no hay usuario al que
  apuntar.
- **El reclamo reemplaza a la asignacion.** Los deals nacen sin owner: **Pendiente Setteo** es una
  tabla donde el closer reclama, y **Unclaimed** son los Agendados sin owner. Un gerente sigue
  pudiendo asignar y reasignar, y cada cambio sigue yendo a `change_log`. La rotacion ciega del
  script desaparece.
- 🩸 Que este campo se podia mover sin dolor lo dice la medicion del 21-sep: **0 personas** tienen
  responsable. La funcion existe desde el ticket 026 y nunca se uso.

---

## Enmienda 2026-09-21 (ADR 0044): el CPL deja de preguntar por `entrada`

Faltaba escribirla aquí aunque el ADR 0044 la declaró. Con el enlace de captación del closer, un lead de
Comercial entra por el formulario, así que `entrada = 'formulario'` deja de significar "lo pagó la
pauta". **La regla "las personas creadas a mano no cuentan en el CPL" se reemplaza por:** el
denominador del CPL cuenta los leads cuyo canal resuelve al área Pauta (ADR 0044 punto 6, ADR 0051).

## Enmienda 2026-09-24 (ADR 0049): el dueño de un Agendado de Calendly

Si el deal no tiene dueño y el host del Round Robin es un closer registrado en el programa, el host
queda como dueño sin reclamar. El reclamo sigue siendo el camino para todo lo demás, y "sin dueño"
sigue siendo un estado válido.
