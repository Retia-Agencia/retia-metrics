# 0075 — El deal se mueve con botones de etapa destino, el comprobante no bloquea y el closer ve solo sus deals

- **Estado:** aceptado · 2-oct-2026 (Mani, tras la llamada de onboarding con los closers nuevos). Se construye en el
  [156](../tasks/156-operacion-comercial-intuitiva.md).
- **Enmienda:** ADR 0072 punto 1 (la cara de la pregunta: se presenta por **etapa destino**, no por respuesta);
  ADR 0037 y 0071 en el requisito `comprobante` (deja de ser reja para entrar a Ganado); ADR 0048 solo para las
  **listas operativas de deals** de un closer (el Dashboard sigue con "todos ven todo" en su programa).
- **Confirma:** ADR 0037 (solo `moverEtapa()` escribe la etapa; a Ganado solo con un abono), ADR 0070 (Re-agenda,
  Seguimiento y Próxima cohorte son pendientes, no etapas), ADR 0025 (el developer no se restringe; en "ver como
  closer" la vista solo estrecha, ADR 0028).
- **Fuente:** `docs/anotaciones.md`, recorrido 5 (A-34 a A-39).

## Contexto

En la llamada de onboarding del 2-oct con los dos closers nuevos, Mani recorrió el CRM en vivo y salió esto: mover un
deal pide memoria (hay que saber qué respuesta lleva a qué columna), las alertas tapan la cabecera, un abono sin
comprobante no deja cerrar la venta aunque la plata ya entró, y un closer ve el tablero de todos y puede escoger
dueño. Prioridad de Mani: *"que el manejo comercial sirva 100%"* y que sea **súper intuitivo**.

## Decisión

1. **Sección "Transición" en la ficha, por etapa destino.** Un botón por cada etapa a la que el deal puede ir hoy,
   con el nombre y el tono de esa etapa (`<Badge variant>`). Debajo, aparte, **"Sin cambiar de etapa"**: lo que deja
   el deal en su columna (Seguimiento, Próxima cohorte, Otra llamada, Registrar intento en En gestión). Los botones
   salen de la MISMA tabla que hoy (`PREGUNTA_DE_ETAPA` y el mapa del motor); no se inventa una flecha. Ganado Pago
   Parcial y Completo son **un solo botón**, "Ganado · registrar pago": el monto decide cuál (ADR 0037).
2. **Un solo pop-up de transición**, el mismo para el botón de la ficha y para soltar una tarjeta en el Kanban.
   Recibe el deal y la etapa destino; si a esa etapa se llega por una sola respuesta, la abre; si hay varias, las
   ofrece dentro del mismo pop-up. Pide lo que la flecha pide y muestra en verde y rojo lo que el motor exige (el
   ensayo que ya existe). Si a esa etapa no se puede ir, el Kanban devuelve la tarjeta como hoy.
3. **Las alertas son su propio recuadro**, al nivel de los otros bloques de la ficha, junto a Transición. Ya no van
   como franja encima de la cabecera.
4. **El comprobante no bloquea.** Un abono sin comprobante mueve el deal a Ganado igual. Mientras un abono vigente
   del deal no tenga comprobante, sale una **alerta roja** ("Hay un abono sin comprobante") en la ficha, la tarjeta y
   "Lo mío que necesita atención" del Inbox, y el comprobante se puede pegar después sobre ese abono, con rastro.
   La caja cuenta el abono desde que se registra (ADR 0013): el comprobante es soporte, no condición del dinero.
5. **Un closer ve solo sus deals en el Kanban y en la lista de deals.** Sin selector de dueño. La ficha de un deal
   la abre si es suyo o si no tiene dueño (para reclamarlo desde el Inbox); la de un deal de otra persona responde
   404. Gerente y developer ven todo y conservan el selector; el developer en "ver como closer" ve lo suyo. La
   respuesta "¿qué deals ve esta sesión?" vive en UN lugar de `lib/auth/` y la consulta del Kanban la recibe como
   tipo: la vista de un closer **no se puede pedir** sin acotar al dueño.
6. **El link de una reunión es cualquier link.** Una cita agregada o re-agendada a mano (lo hablado con la persona)
   acepta el link que sea: Calendly, Meet, Zoom. La pantalla dice "Link de la reunión". La columna sigue llamándose
   `link_calendly` (renombrarla no cambia ninguna métrica; queda como deuda nombrada).

## Consecuencias

- `lib/deals/requisitos.ts` deja de pedir `comprobante` en las flechas de pago y en E13; el código de requisito
  pasa a ser una alerta. Los tests que esperaban el rechazo cambian de sentido: ahora se espera que pase y que la
  alerta exista.
- El Kanban deja de importar el "escoger entre respuestas" propio: usa el pop-up de la ficha.
- Que un closer no vea un deal ajeno se prueba **forjando la petición** (la ficha por URL y la consulta con un
  `owner` ajeno en la query string), no mirando que el selector no aparezca.
