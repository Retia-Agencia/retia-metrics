# 0081: Mover o anotar; los pendientes salen de lo anotado

- **Estado:** aceptado, 9-oct-2026 (Mani, grill tras la reunión con Michael, Andre y el equipo de Tactical). Se
  construye en los tickets 215 a 220.
- **Enmienda:** ADR 0071 (los intentos y la alerta de los tres intentos se retiran), ADR 0072 punto 1 (En gestión
  ya no anota un intento; el No es una anotación) y punto 6 (el origen declarado se retira, ver 216), ADR 0070 (un
  pendiente ya no se elige con un botón: sale de un dato de la anotación), ADR 0062 punto 5 (la burbuja "sin UTM ·
  según el comercial" se va con el origen declarado).
- **Confirma:** ADR 0037 (solo el motor escribe la etapa; a ganado solo por un abono), ADR 0072 punto 2 (arrastrar
  abre el mismo diálogo que el botón), ADR 0078 (Corregir).

## Contexto

En la reunión del 9-oct los closers registraron llamadas reales de la víspera en el CRM. La tarjeta de Transición
tenía tres bloques ("Mover a", "Registrar actividad", "Dejar en espera") y las acciones vivían además en las
tarjetas Llamadas y Pago: botones de varios tamaños y colores en varios lugares. Nadie tenía claro qué botón
usar, y un cambio que hacía el sistema (Show → Atendido) pasaba sin que nadie lo notara. Mani: *"o se mueve de
etapa o no se mueve, pero se le hace una anotación"*.

## Decisión

1. **Hay dos gestos sobre un deal y solo dos: Mover y Anotar.** Mover cambia la etapa. Anotar no la cambia, pero
   actualiza el deal. La tarjeta de Transición queda con los botones de etapa y un botón **Anotar**, nada más.
2. **Mover abre UN diálogo, el mismo del arrastre, y adentro pide lo que la etapa destino necesita.** Si para
   entrar a Atendido hace falta la llamada con Show y su Grain, el diálogo muestra esa llamada (compacta, se
   abre al tocarla) y ahí se marca el resultado y se pega el link. Para ganado, ahí se registra el abono. Para
   Agendado, ahí va la cita. Las tarjetas Llamadas y Pago quedan como historial: ver, corregir y anular, sin
   botones de registrar algo nuevo.
3. **Anotar es un botón que abre su diálogo, con lo que la etapa permite:** comentario libre (siempre), próximo
   contacto (fecha), "quiere la próxima cohorte", y en Agendado o Atendido "la llamada no se hizo / se reagenda"
   con motivo y, opcional, la fecha de la llamada nueva (también la de un Meet que no pasó por Calendly).
4. **Los pendientes salen de lo anotado; el closer nunca elige un tag.** Próximo contacto con fecha → Seguimiento.
   "Quiere la próxima cohorte" → Próxima Cohorte. No-show o reagenda → Re-agenda. Siguen siendo flechas del
   motor (`moverEtapa` con la misma etapa y un pendiente); lo que cambia es la puerta, no la regla.
5. **Cada anotación queda en Actividades con su comentario y el pendiente que puso.** Varios seguimientos son
   varias anotaciones, cada una con su fecha de próximo contacto.
6. **Anotar sobre un deal en Potencial o Registrado lo pasa a En gestión** (y lo avisa). Contactado se elige
   con su botón de mover.
7. **Se retiran los intentos y la alerta de los tres intentos.** El valor `intento` del enum queda por las filas
   que ya existen; nadie lo escribe más.
8. **Después de cada Mover o Anotar sale un aviso con lo que cambió de verdad** ("El deal pasó a Atendido",
   "Quedó en Seguimiento hasta el 12-oct", "Se creó la llamada del 14-oct"). Se queda hasta que se cierra a mano.
   No hay aviso en vivo de lo que cambia por fuera (Calendly): eso llega al hub de Notificaciones.

## Consecuencias

- Toda acción del closer sobre un deal se aprende con una sola pregunta: ¿cambia la etapa o no?
- El reporte de motivos de reagenda sigue agrupando por motivo; "Otro" exige texto, que va al comentario.
- Las métricas de contacto pierden los intentos fallidos. Mani lo decidió: no se usaban.
- Si un día vuelve un pendiente nuevo, entra como dato de la anotación que lo pone, no como un botón más.
