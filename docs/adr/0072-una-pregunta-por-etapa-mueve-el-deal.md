# 0072 — Una pregunta por etapa mueve el deal, también al arrastrar

- **Estado:** aceptado · 2-oct-2026 (Mani, preguntas M-1 a M-6 del manual de gestión comercial §0). Se construye
  con el 142 (preguntas y flechas), el 143 (lo que tiene que tener cada etapa), el 128 (alertas) y el hub del
  closer (orden de la cola).
- **Enmienda:** ADR 0070 punto 6 (Seguimiento también en Calificado y en Compromiso Verbal) y ADR 0071 punto 5
  (la pregunta de Atendido pasa a ser una de varias). **Confirma:** ADR 0037 (solo el motor escribe la etapa; a
  ganado solo por un abono; no hay relojes).
- **Fuentes:** [`insumos/30x-ciclo-de-vida.md`](../insumos/30x-ciclo-de-vida.md) (el método: *el comercial
  llena propiedades, el sistema mueve los deals*), [`manual-gestion-comercial.md`](../manual-gestion-comercial.md) §0.

## Contexto

En 30X cada etapa tiene una sola propiedad que el comercial llena, y su respuesta mueve el deal. Retia solo
tenía esa pregunta en Atendido ("¿Cómo terminó?", seis botones). Mani quiere que mover un deal sea intuitivo
para los closers, sin perder el arrastre del Kanban.

## Decisión

1. **Cada etapa tiene UNA pregunta, y su respuesta es la flecha del motor** (M-1). La respuesta elige el destino
   y pide el dato de esa flecha; `moverEtapa()` valida y escribe, como siempre.

   | Etapa | Pregunta | Respuestas → a dónde va |
   |---|---|---|
   | Potencial, Registrado | ninguna | registrar la primera actividad → En gestión (ADR 0071) |
   | En gestión | ¿Se logró el contacto? | Sí → Contactado · No → se anota el intento y se queda (al tercero, alerta, ADR 0071) |
   | Contactado | ¿Califica? | Sí → Calificado · Negocia → Compromiso Verbal (Mani, 2-oct) · No → Cierre perdido (motivo) |
   | Calificado | ¿Qué pasó? | Agendó → Agendado (la cita) · Negocia → Compromiso Verbal · Pagó → registrar abono (ganado) · Interesado, más adelante → Seguimiento (fecha) · Próxima cohorte · Descartado → Cierre perdido |
   | Agendado | ¿Cómo va la cita? | Terminó → Atendido · Se movió → nueva fecha, se queda · No asistió o canceló → Re-agenda (ADR 0070) · Descartar → Cierre perdido |
   | Atendido | ¿Cómo terminó? | los seis botones (ADR 0071) |
   | Compromiso Verbal | ¿Cómo va la negociación? | Pagó → registrar abono (ganado) · Revisando propuesta → Seguimiento (fecha), se queda · Descartado → Cierre perdido |
   | Ganado Pago Parcial | (ninguna) | otro abono; con saldo en cero → Ganado Pagado Completo |

2. **El Kanban se sigue arrastrando, y soltar abre la pregunta** (M-2). Arrastrar a una columna muestra la
   pregunta de la etapa de origen con la respuesta que lleva a esa columna ya elegida, y debajo **lo que el deal
   tiene y lo que le falta** para entrar (los requisitos del motor, en verde y en rojo). Si no hay flecha a esa
   columna, la tarjeta vuelve a su lugar y se dice por qué. Soltar en una columna de ganado abre "registrar
   abono": a ganado solo se entra por la plata (ADR 0037).
3. **Seguimiento también en Calificado y en Compromiso Verbal** (M-3), además de Atendido. En Calificado es el
   lead **ya contactado** que está interesado pero todavía no agenda (en 30X, "Interesado → queda en Calificado
   con próximo contacto"): exige una actividad de contacto previa, así que nunca se le pone a quien solo llenó
   el formulario. En Compromiso Verbal es "revisando la propuesta": el deal se queda ahí con su fecha (distinto
   del retroceso del ADR 0070 punto 3, cuando el sí se echa para atrás). Mientras tenga Seguimiento con fecha,
   la alerta de compromiso vencido usa esa fecha.
4. **Nada se automatiza en la v1: solo alertas** (M-4). Ni cadencias de WhatsApp, ni recordatorios de la cita,
   ni nutrición de perdidos, ni tareas a T+n. Todo lo que 30X automatiza aquí es una alerta calculada al leer
   (128), y la acción la hace una persona.
5. **Lead Value ordena la cola, y el closer puede cambiar el orden** (M-5). Lead Value hace de la prioridad
   (el HVM de 30X; ADR 0069 punto 4). La cola del closer se puede ordenar por: **prioridad** (Lead Value),
   **días en la etapa**, **última actividad** y **próximo paso** (la fecha de seguimiento, de la cita o la fecha
   límite, la más cercana o vencida primero). El orden por defecto es el de 30X: prioridad, después la etapa
   más cercana al cierre, y la antigüedad desempata.
6. **El origen del deal se pide al entrar a Atendido** (M-6), no en Compromiso Verbal: es el área declarada
   ("¿cómo nos conoció?", 121), que deja de pedirse en Compromiso Verbal y en ganado porque ya viene de antes.
   Una venta sin llamada (por chat) la pide en su flecha, porque no pasó por Atendido.

## Consecuencias

- El 142 lleva las preguntas como parte de la tabla de flechas (una respuesta = una flecha con su dato). La ficha
  muestra la pregunta de la etapa actual; el Kanban la abre al soltar.
- El 143 es el "tiene / le falta" del punto 2 y de la ficha: la misma función de requisitos, una sola respuesta.
- Los históricos de la hoja siguen exentos del área declarada (ADR 0059, 0065).
