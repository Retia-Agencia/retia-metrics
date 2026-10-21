# 0101: Un resultado de llamada se corrige con rastro, y una cita se resuelve en un solo lugar

- **Estado:** aceptado, 21-oct-2026 (Mani).
- **Confirma:** ADR 0026 (nada se borra; se corrige con quién, cuándo y por qué), ADR 0042 (toda escritura del CRM
  deja rastro), ADR 0096 (Calendly manda el orden; el CRM cancela en Calendly), ADR 0100 (un deal tiene una sola cita
  activa).
- **Enmienda:** ticket 177 ("Resultado" solo resuelve una cita `agendada`, nunca re-marca) y ticket 220 (Anotar
  reagenda con hora).

## Contexto

Dos casos del 20 y 21-oct en producción:

1. **Maru marcó Show en una llamada que fue No show y no lo pudo cambiar.** El botón Resultado solo aparece sobre una
   cita `agendada` y el servidor rechaza un resultado sobre una ya resuelta (`marcarShow`, `marcarFallida`,
   `reagendarLlamada`: 409). Ninguna otra pantalla lo permite y una llamada no se anula desde la UI. El error de dedo
   queda como un show **sin ningún aviso**: el deal pasó a Atendido, cuenta en la tasa de show y nadie puede arreglarlo
   sin un script.
2. **Juanjo quiso mover una cita de las 7:30pm a las 8pm del mismo día y no pudo.** Entró por Anotar → "La llamada no
   se hizo / se reagenda", que pide motivo y después la hora: dos puertas (Anotar y Resultado → Reagendada) hacen lo
   mismo con pasos distintos. Y solo le salían horas del día siguiente. Medido el 21-oct por la API de Calendly: su
   horario de ese día era de 7 a 10pm, así que las 8pm estaban dentro; lo más probable es el **aviso mínimo** de su
   evento (código `TOOSOON` de Calendly), que la API no expone. El CRM no le dijo de dónde salen las horas ni le dio
   una salida.

Lo que ya existía: `editarConRastro` deja cada cambio de `calls.resultado` en `change_log` (antes, después, quién,
cuándo) y la ficha lo muestra con `cambioLegible`. La documentación del cambio estaba; faltaba la acción.

## Decisión

### A. Un resultado se corrige, nunca se borra

1. **Un resultado de llamada se corrige con una escritura nueva con rastro**, no se borra ni se anula. Corregir y
   anular son distintos (ADR 0038): anular dice "este registro no existió"; corregir dice "existió y su resultado fue
   otro". Una llamada mal marcada sí existió.
2. **La corrección pide un motivo en texto** (obligatorio, 3 a 500 caracteres) y lo guarda en el rastro y en una nota
   del actor en el deal: "Corrigió el resultado de la llamada del 20-oct 9:30am: Show → No show. Motivo: …". Así la
   historia se lee en la ficha sin abrir `change_log`.
3. **Qué se puede corregir:** entre `show`, `no_show` y `cancelada`, sobre una llamada vigente de un deal que el actor
   puede trabajar (`puedeTrabajarDeal`: el dueño o quien administra; el developer pasa). `reagendada` y `agendada` no
   se corrigen por aquí: una reagendada tiene una sucesora y deshacerla es otra operación; una agendada se resuelve
   con Resultado.
4. **La etapa del deal sigue al resultado corregido por el motor, nunca a mano** (`moverEtapa()`):
   - **Show → No show o Cancelada:** si el deal está en **Atendido**, queda en Atendido con pendiente **Re-agenda**
     (PR2, con el motivo de re-agenda si se elige). Si la cita era de un deal que ya avanzó (Compromiso Verbal,
     Ganado parcial o completo, Cierre perdido), **se rechaza** con el porqué: corregir una llamada no deshace una
     venta en silencio; primero se corrige el deal.
   - **No show o Cancelada → Show:** si el deal está en Agendado o en Atendido con pendiente Re-agenda, pasa a
     **Atendido** y se limpia el pendiente (E8, o la flecha que la tabla tenga). Si la tabla no tiene la flecha, se
     agrega en `lib/deals/etapas.ts` con su test, nunca se escribe la etapa a mano.
   - **No show ↔ Cancelada:** cambia solo el resultado; el pendiente Re-agenda ya está.
   - Todo en **una transacción**: el resultado y el movimiento van juntos o nada.
5. **Calendly no se toca al corregir.** Una corrección es del pasado (la llamada ya ocurrió o no); no se cancela ni se
   recrea nada en Calendly.
6. **Regla general, para lo que venga:** toda acción de un closer sobre un registro operativo (llamada, deal, abono,
   actividad) tiene que poder corregirse desde la app, con rastro y motivo, sin script. Cuando una pantalla nueva
   escribe un estado, la pregunta "¿cómo se deshace esto si me equivoco?" se contesta en el mismo ticket.

### B. La cita se resuelve en un solo lugar

7. **El botón Resultado de la llamada es la única puerta para resolver o mover una cita viva** (Show, No show,
   Cancelada, Reagendada). **Anotar ya no ofrece hora**: su opción "La llamada no se hizo / se reagenda" queda solo
   para dejar el pendiente Re-agenda con su motivo cuando el deal **no** tiene una cita `agendada`; si la tiene, Anotar
   dice "Esta cita se resuelve desde Resultado" en vez de la opción. Agendar una cita nueva sobre un deal sin cita viva
   sigue siendo el botón **Agendar** de la ficha.
8. **El selector de horas dice de dónde salen.** Arriba de las horas: de qué evento de Calendly salen (el del dueño o
   el round robin), **el horario de ese evento** leído en vivo de Calendly (`event_type_availability_schedules`, por
   día, en hora de Bogotá) y una línea fija: "Calendly además esconde horas por aviso mínimo, buffers, límites diarios
   y choques con tu calendario. Eso se cambia en Calendly." El CRM no inventa el porqué de cada hueco: la API no lo da.
9. **Hora fuera de Calendly.** Debajo del selector, la opción "Poner una hora fuera de Calendly": fecha y hora (Bogotá)
   y el link de la reunión (obligatorio, URL). Crea la llamada con origen `crm`, sin reservar en Calendly, por las
   mismas funciones de `lib/deals/llamadas.ts` (`agregarLlamada`, `reagendarLlamada` con `fechaAgenda`), así que la
   regla de una sola cita activa (ADR 0100) y la cancelación de la vieja en Calendly siguen aplicando. La pantalla
   advierte: "Esta hora no queda bloqueada en Calendly: otro lead puede reservarla."
   - **Quién:** quien puede trabajar el deal (el mismo permiso de reagendar). Si se quiere restringir a quien
     administra, es un cambio de una línea en la acción y se anota aquí.
   - Sirve en todas las puertas que usan el selector (Resultado → Reagendada, Agendar, Mover a Agendado).

## Alternativas descartadas

- **Dejar que Resultado vuelva a marcar cualquier llamada.** Sin motivo ni nota, el cambio solo vive en `change_log`
  y un closer no lo ve; y "re-marcar" sobre una reagendada rompe la sucesora.
- **Corregir anulando la llamada y creando otra.** Anular dice "no existió" y la llamada sí existió; además pierde la
  huella de Calendly.
- **Un script cada vez.** Es lo que pasa hoy: depende de que alguien con acceso a la base esté disponible.
- **Mostrar el aviso mínimo exacto.** La API de Calendly no lo devuelve (medido el 21-oct: el recurso del evento no
  trae ese campo). Se explica la regla y se da la salida manual.

## Consecuencias

- `components/deals/ficha/acciones-de-llamada.tsx` gana "Corregir resultado" en una llamada resuelta y
  `components/calendly/selector-de-hora.tsx` gana el horario y la hora manual; Anotar pierde el selector de hora.
- Una cita con origen `crm` no tiene `invitee` en Calendly: Juanito y el Inbox la tratan como cualquier llamada
  `agendada`, y su link es el que puso el closer.
- `docs/structure.md` (llamadas) dibuja Corregir y las tres puertas de hora.
- Tickets: 291 (corregir resultado) y 292 (Resultado como única puerta, horario visible, hora manual).
