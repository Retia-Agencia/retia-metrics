---
id: 176
etapa: O3
serves: "docs/anotaciones.md A-77, A-78, A-79, A-80; ADR 0077 punto 6; ADR 0075"
depends: [168]
status: todo
---

# 176 — Transición y Llamadas, segunda pasada: tres verbos claros y un solo "Resultado"

Sesión **S9**, ola O3 parte 2. Arranca cuando el pulido de la parte 1 (rama `o3-pulido-parte1`) esté en `main`: toca
los mismos archivos de la ficha. Sin migración.

## Por qué existe

Mani recorrió el 168 (3-oct) y la tarjeta Transición sigue sin entenderse: "Registrar" tiene botones que **mueven la
etapa** (Contacto e Intento en Potencial, Registrado y En gestión, `lib/deals/actividad-mueve.ts`) y otros que dejan
el deal en espera (Seguimiento, Otra llamada, Próxima cohorte). "Para avanzar" hace la tarjeta muy grande. Y en
Llamadas cada cosa es un botón.

## Decisiones (sesión central con Mani, 3-oct)

**Regla:** si cambia la etapa, es **Mover a**. Nada que cambie la etapa vive en otro grupo.

1. **Transición con tres grupos, cada uno con un verbo:**
   - **Mover a** (cambia la etapa): un botón por etapa destino. En Potencial, Registrado y En gestión, los destinos
     **Contactado** y **En gestión** registran el contacto o el intento al moverse (el pop-up pide canal y nota), así
     que esos movimientos dejan de estar en "Registrar". Lo decide la misma `etapaTrasActividad`: el botón se pone en
     Mover a si la actividad cambia la etapa, en Registrar si no.
   - **Dejar en espera** (misma etapa, queda un pendiente con fecha): Seguimiento (Próximo contacto), Otra llamada
     (Re-agenda) y Próxima cohorte. Una línea arriba: "el deal no cambia de etapa".
   - **Registrar actividad** (no cambia nada, queda en Actividades): **un solo botón** que abre un pop-up con el tipo
     (Contacto, Intento, Nota), canal y nota. Una línea arriba dice para qué sirve: "cuenta para los tres intentos
     y para el aviso de estancado".
2. **"Para avanzar" sale de la tarjeta.** Lo que falta para cada destino se muestra **en el pop-up de esa
   transición** (el que ya usa el Kanban, ADR 0075): si falta algo, se ve qué es y cómo darlo ahí mismo (por ejemplo,
   el link de Grain para pasar a Atendido); si no falta nada, se confirma. La tarjeta queda con los tres grupos y la
   insignia del camino principal sobre su botón. Las propiedades en rojo de la etapa actual (143) siguen en la franja
   Transición, en una línea.
3. **Llamadas: un solo botón "Resultado" y el Grain como campo.** En la llamada activa (y en el detalle de la llamada):
   - **Link de Grain** (la grabación y transcripción) es un campo de texto **siempre visible**, que guarda al pegar o
     al salir del campo. Pegarlo sin resultado marca la llamada como show y pasa el deal a Atendido (ADR 0058, lo de
     hoy).
   - Los botones de hoy ("Link de Grain", "No se dio", "Poner fecha de la cita", "Elegir resultado") se van y queda
     **uno: "Resultado"**, con Show, No show, Cancelada y Reagendada, cada opción con la línea de lo que provoca (no
     show y cancelada dejan el deal en Re-agenda). "Poner fecha de la cita" pasa a ser un campo de la cita cuando el
     sistema la creó sin fecha.
   - Lo mismo en Calls y en el Inbox ("Llamadas que ya pasaron sin resultado"): la fila abre el detalle con Resultado
     y Grain, sin botones sueltos.
4. **Facturación se explica sola (A-80).** Hoy se abona en **Contactado, Calificado, Atendido, Compromiso Verbal y
   Ganado Pago Parcial** (`aceptaAbono`, `lib/deals/etapas.ts`): las etapas con flecha a Ganado. En las demás, en vez
   de esconder "Registrar abono", se muestra deshabilitado con la razón ("Se abona desde Contactado; este deal está en
   Agendado"). Cada acción de la tarjeta lleva su línea: Registrar abono (el deal pasa a Ganado), Cambiar cohorte,
   Editar descuento (cambia el valor vendido), Acuerdo de pago (la fecha límite y la de pago). Ningún dato nuevo.

## Archivos

`components/deals/ficha/ficha-transicion.tsx`, `ficha-alertas.tsx`, `ficha-llamadas.tsx`, `ficha-pago.tsx`,
`components/deals/pregunta-de-etapa.ts`, `responder-pregunta.tsx`, `dialogo-mover.tsx`, `detalle-de-llamada.tsx`,
`llamadas-programa.tsx`, `inbox-llamadas-de-hoy.tsx`, y las acciones de llamadas que ya existen (`lib/deals/llamadas.ts`)
solo si "Resultado" necesita juntar dos en una. **No toca** el motor (`mover-etapa.ts`, `requisitos.ts`): las reglas
no cambian, cambia cómo se ofrecen.

Tests: `tests/pregunta-de-etapa.test.ts` (ninguna respuesta que mueva la etapa queda fuera de Mover a: guardián
nuevo), `tests/acciones-ficha-deal.test.ts`, `tests/llamadas-del-deal.test.ts`.

## Done cuando

- En ninguna etapa hay un botón fuera de "Mover a" que cambie la etapa (test que recorre las once etapas).
- La tarjeta Transición no tiene "Para avanzar"; cada pop-up dice lo que falta y deja darlo ahí.
- La llamada activa tiene el campo de Grain visible y un solo botón "Resultado"; igual en Calls y el Inbox.
- "Registrar abono" fuera de su etapa se ve deshabilitado con la razón.
- `npm run build` en verde; recorrido en `dev:local` como closer, clic en cada botón de cada grupo en tres etapas
  distintas, consola abierta, escritorio y 375 px.

## Estado de la sesión (S9, O3 parte 2)

Implementadas las cuatro decisiones (solo UI de la ficha; el motor, `mover-etapa.ts`, `requisitos.ts` y
`schema.ts` no se tocaron). `npm run typecheck` y `npm run lint` quedan limpios. **No se corrió la suite**
(instrucción de la sesión): el `npm run build` y el recorrido en `dev:local` quedan pendientes porque el
worktree tiene `node_modules` enlazado.

### Hecho

- **Decisión 1 — tres grupos en Transición.** `components/deals/pregunta-de-etapa.ts` suma
  `cambiaLaEtapa`, `actividadesQueNoMueven`, `TIPOS_DE_ACTIVIDAD` y `gruposDeTransicion`, que parte las
  respuestas en `moverA` (cambian la etapa, incluidas Contacto/Intento que mueven según
  `etapaTrasActividad`), `enEspera` (misma etapa con pendiente) y `actividades` (los tipos que NO mueven).
  La regla única: si cambia la etapa, va en Mover a. `ficha-transicion.tsx` dibuja los tres grupos: "Mover a"
  (botones de etapa), "Dejar en espera" (línea "El deal no cambia de etapa") y "Registrar actividad" (UN botón
  que abre el pop-up con tipo Contacto/Intento/Nota, canal y nota; línea "Cuenta para los tres intentos y para
  el aviso de estancado"). El pop-up de actividad con selector de tipo vive en `responder-pregunta.tsx`
  (`registrarActividad`).
- **Decisión 2 — fuera "Para avanzar".** La tarjeta ya no lista `alertas.paraAvanzar`; las propiedades en rojo
  de la etapa actual quedan en una línea y la insignia "Camino principal" se pinta sobre el botón de su
  destino (sale de `alertas.paraAvanzar[].caminoFeliz`). Lo que falta para cada destino lo sigue mostrando el
  pop-up de la transición (`DialogoMover`, que ya ensaya el motor con `revisarMovimientoAccion`): no se tocó.
- **Decisión 3 — Llamadas con Grain como campo y un solo "Resultado".** Nuevo `campo-grain.tsx` (campo
  siempre visible que guarda al pegar o al salir, por `pegarGrainAccion`) y `acciones-de-llamada.tsx`
  (componente compartido: Grain + botón "Resultado" con Show/No show/Cancelada/Reagendada, cada opción con su
  línea). Show no abre sub-flujo: pone el foco en el campo de Grain. No show/Cancelada → `marcarFallidaAccion`;
  Reagendada → `agregarLlamadaAccion`; "Poner fecha de la cita" pasó a campo (`completarAgendadaAccion`).
  Se usa en `ficha-llamadas.tsx`, y la fila de `llamadas-programa.tsx` e `inbox-llamadas-de-hoy.tsx` abre el
  `detalle-de-llamada.tsx`, que ahora muestra Grain + Resultado; sin botones sueltos. No se creó `marcarShow`
  ni se tocó el motor.
- **Decisión 4 — Facturación se explica sola (A-80).** `ficha-pago.tsx`: fuera de `aceptaAbono` el botón
  "Registrar abono" se ve deshabilitado con la razón ("Se abona desde Contactado; este deal está en …"). Cada
  acción lleva su línea (Registrar abono → pasa a Ganado; Editar descuento → cambia el valor vendido; Acuerdo
  de pago → fija la fecha límite y la de pago). Sin datos nuevos.
- **Guardián nuevo** en `tests/pregunta-de-etapa.test.ts`: recorre las once etapas (con y sin pendiente) y
  falla si una respuesta que cambia la etapa queda fuera de "Mover a", si una de "Dejar en espera" cambia la
  etapa, o si "Registrar actividad" ofrece un tipo que mueve. Los tests existentes de ese archivo se
  mantuvieron (siguen usando `respuestasPorDestino`, que no se quitó).
- `tests/acciones-ficha-deal.test.ts` y `tests/llamadas-del-deal.test.ts` **no se tocaron**: prueban server
  actions y funciones del motor, que esta sesión no cambió.

### Supuesto a confirmar con Mani

- **Show no abre sub-flujo.** La opción "Show" del menú "Resultado" conserva la línea "Se marca al pegar el
  link de Grain; el deal pasa a Atendido" y, al elegirla, solo pone el foco en el campo "Link de Grain" ya
  visible (no hay acción `marcarShow`, no se tocó el motor). Confirmar que ese es el gesto esperado y no un
  botón que marque show directamente.

### Pendiente

- `npm run build` en verde y el recorrido en `dev:local` como closer (clic en cada botón de cada grupo en tres
  etapas distintas, consola abierta, escritorio y 375 px). No se hizo en esta sesión por el `node_modules`
  enlazado del worktree.
- "Se movió" y "No asistió o canceló" de la etapa Agendado quedan en "Dejar en espera" (no cambian la etapa);
  revisar en el recorrido que ese encuadre se lea bien para quien no es técnico.
