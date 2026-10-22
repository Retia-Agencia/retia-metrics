# 0102: Lead Value mide poder económico e intención

- **Estado:** aceptado, 22-oct-2026 (Mani). Vigente para todo envío que entre después de editar cada formulario
  (ticket 295).
- **Enmienda:** el estándar de puntaje de `docs/dapta/README.md` (1-oct, ADR 0069), en lo que dice de `lead_value`.
  **Confirma:** ADR 0069 punto 4 (Lead Value no enruta: no decide la etapa), ADR 0072 M-5 (Lead Value ordena la cola),
  decisión A8 (el CRM no califica: el formulario calcula y el CRM guarda como llegó, ADR 0004).
- **Fuentes:** loom de Nicolás (22-oct, Wispr Flow "Improving Lead Tagging and Follow-up"),
  `docs/manuales/pipeline-comercial.md` §5 (medición y simulación sobre producción).

## Contexto

Lead Value salía solo del ingreso y la situación profesional; urgencia e inversión no sumaban nada salvo su opción
descalificante. Nicolás lo vio en una llamada: una lead que pidió facilidades de pago salió MUY ALTO VALOR y no
asistió. Medido el 22-oct sobre los deals con cita resuelta de los tres programas con pauta:

- "Sí, pero necesito facilidades de pago" vende 7 % (5 de 75) contra 21 % (15 de 72) de "tengo capacidad".
- "Puede esperar" vende 8 % (5 de 66) contra 19 % (15 de 81) de "muy urgente".
- 128 de 144 citas caían en MUY ALTO VALOR: la etiqueta no separaba a quién priorizar.

## Decisión

1. **Cada respuesta de baja intención baja Lead Value un nivel**, además de lo que ya baja un descalificante:
   - Inversión "Sí, pero necesito facilidades de pago": −1 nivel.
   - Urgencia "Estoy interesado pero puede esperar": −1 nivel.
   - Las dos se suman (un lead con las dos baja dos niveles). Piso: BAJO VALOR.
2. **No esconden el Calendly ni cambian Lead Quality.** No son descalificantes: la persona sigue viendo la agenda y
   sigue siendo `High` si no tiene descalificantes. Solo cambia la etiqueta que ordena el trabajo.
3. **El orden de cálculo:** nivel por puntos de valor (30-50 MUY ALTO, 15-29 ALTO, 0-14 VALOR MEDIO) → −1 si tiene uno o
   más descalificantes → −1 por cada respuesta de baja intención → piso BAJO VALOR.
4. **Vale para los formularios de Retia** (Typeform y Dapta). Un formulario que no tenga alguna de las dos preguntas no
   baja por ella. **Excepción (Mani, 22-oct): AI Second Brain Jurídico (Form30x) no aplica.** Form30x calcula todo con un
   solo `score` y reglas por franjas (`scoreTagRules`): restar por intención dejaría el score negativo y el lead en `Low`,
   que cambia su etapa de entrada. Además, sus etiquetas van al HubSpot de 30X y la medición es de los programas de
   Retia: cambiarlo lo decide 30X.
5. **Los leads que ya entraron conservan su Lead Value.** No se recalcula hacia atrás (ADR 0004). Toda comparación por
   Lead Value se parte en la fecha en que cada formulario cambió (ticket 295 la registra por programa).

## Consecuencias

- Simulado sobre los datos de hoy, cada nivel vende menos que el de arriba: 23, 15, 6 y 0 % (antes 13, 21, 0 y sin
  citas). MUY ALTO pasa de 549 leads a 133.
- **La llamada calificada del Hub baja** (ADR 0063: cuenta las citas de MUY ALTO y ALTO). Sobre los datos de hoy habría
  sido 102 de 144 en vez de 142. Se avisa a Gerencia y a Pauta antes de editar el primer formulario.
- "ALTO VALOR" sigue nombrando varios perfiles (30-50 con un descalificante o una respuesta de baja intención, o 15-29
  limpio). Se acepta: la etiqueta ordena, y el perfil exacto está en las respuestas del envío.
- La muestra es de 144 citas. A los 30 días de aplicar se repite la tabla de `pipeline-comercial.md` §5 con los
  leads nuevos; si los niveles no separan, se revisa el peso.
