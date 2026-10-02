---
id: 156
etapa: O2
serves: "docs/anotaciones.md A-34, A-35, A-36, A-37, A-38, A-39 · ADR 0075"
depends: [155]
status: todo
---

# 156 — La operación comercial intuitiva: Transición por etapa destino, alertas en su recuadro, comprobante sin reja y el closer ve lo suyo

## Objetivo

Que un closer nuevo mueva un deal sin memorizar el flujo. Sale de la llamada de onboarding del 2-oct
(`docs/anotaciones.md`, recorrido 5) y lo decide el ADR 0075. **Sin migración.**

## Alcance

1. **A-34 · Link de la reunión.** En los formularios de llamada de la ficha (agregar, completar la agendada,
   re-agendar), la etiqueta pasa de "Link de Calendly (opcional)" a "Link de la reunión (opcional)", con ayuda
   "Calendly, Meet, Zoom o el que acordaron". En la fila de la llamada, el enlace dice "Cita en Calendly" solo si la
   llamada es de origen Calendly; si no, "Abrir reunión". Los mensajes de zod de `lib/deals/llamadas.ts` dicen
   "El link de la reunión no es una URL válida." La columna no se renombra (ADR 0075 punto 6).
2. **A-35 · El comprobante no bloquea.** `lib/deals/requisitos.ts` deja de exigir `comprobante` en las flechas de
   pago y en E13. "¿Hay un abono vigente sin comprobante?" se responde en UN lugar (junto a `saldo` o en
   `lib/deals/`, usando `vigente(abonos)`) y lo leen: la alerta roja de la ficha ("Hay un abono sin comprobante"),
   la tarjeta del Kanban y "Lo mío que necesita atención" del Inbox (`lib/queries/inbox.ts`). En la fila del abono
   (Facturación), un botón "Pegar comprobante" lo escribe con `editarConRastro` (solo dueño del deal o quien
   administra, la misma reja que registrar el abono). La ayuda del campo en el formulario cambia a "Si no lo tienes
   ahora, lo pegas después."
3. **A-36 · Alertas en su recuadro.** `FichaAlertas` deja de ir encima de la cabecera. Va como bloque propio (misma
   tarjeta que los demás), al lado de Transición: en escritorio, dos columnas (Transición ancha, Alertas angosta);
   a 375 px, apiladas con Transición primero. Sin alertas, el recuadro dice "Nada pendiente" en vez de desaparecer.
4. **A-37 · Sección "Transición".** Reemplaza a `FichaPregunta`. Para el deal de hoy (`respuestasDe(etapa,
   pendiente)`):
   - **Etapas:** un botón por cada etapa destino a la que lleva al menos una respuesta, en el orden del pipeline,
     con el nombre de pantalla (`nombreDeEtapa`) y su tono (`etapa-tono.ts`, `<Badge variant>`; nada de color a
     mano, `docs/structure.md` §9). Ganado Parcial y Completo son un solo botón "Ganado · registrar pago".
   - **Sin cambiar de etapa:** las respuestas que dejan el deal en su columna (pendientes y el intento en En
     gestión), como botones secundarios.
   - La función que agrupa respuestas por destino se saca de `pregunta-de-etapa.ts` (hoy `llevaA` es privada) y la
     usan la ficha y el Kanban: una sola respuesta a "¿a qué etapas puede ir este deal y con qué respuesta?".
     `tests/pregunta-de-etapa.test.ts` gana el caso: toda respuesta que cambia de etapa cae en exactamente un botón.
5. **A-38 · Un solo pop-up.** El clic en un botón de etapa y soltar la tarjeta en esa columna del Kanban abren el
   MISMO componente (recibe deal y etapa destino). Una respuesta: se abre directa. Varias: el pop-up las ofrece
   arriba y, al escoger, muestra lo que pide esa flecha. Dentro, lo de hoy: los campos de `dialogo-mover.tsx`, el
   formulario del abono o el de llamada según la respuesta, y el ensayo verde/rojo del motor. El Kanban borra su
   selector propio de respuestas.
6. **A-39 · El closer ve lo suyo.** Una función en `lib/auth/` responde "¿qué deals ve esta sesión?": `todos`
   (gerente, developer) o `dueno: userId` (closer, y developer en "ver como closer"). La consulta del Kanban
   (`lib/queries/kanban.ts`) la recibe como argumento obligatorio y, en `dueno`, ignora el `owner` de la URL. El
   selector "Dueño" no se pinta para un closer. La ficha `/p/[programa]/deals/[id]`: un closer la abre si el deal
   es suyo o no tiene dueño; si es de otra persona, `notFound()`. El Inbox no cambia (sigue mostrando "sin dueño"
   para reclamar). El Dashboard no cambia (ADR 0048).

## Fuera de alcance

- El handoff setter → closer y el link de agenda (157).
- Los parciales fuera de la cola del setter: Mani lo deja como está hasta hablarlo con Michael y Gerencia (A-41).

## Done cuando

- Typecheck, lint, `npm run build` (toca componentes cliente) y los tests del cambio en verde; la suite la valida el
  CI.
- Tests: requisitos (un abono sin comprobante mueve a Ganado Parcial y a Completo, y la consulta de la alerta lo
  devuelve; anulado no cuenta), agrupación por destino, y el alcance de deals (un closer con `owner` ajeno en la
  query recibe solo los suyos; la ficha de un deal ajeno da 404; developer y gerente ven todo).
- Recorrido en `dev:local` como `mani.closer` y como gerente: mover desde la ficha y arrastrando en el Kanban por
  todas las etapas del seed (153), pegar un comprobante después, y **forjar** la ficha y la consulta de un deal
  ajeno. Consola sin errores. Las anotaciones A-34 a A-39 quedan resueltas con fecha.
