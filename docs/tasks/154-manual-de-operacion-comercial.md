---
id: 154
etapa: NC2
serves: "Capacitación de closers (operations.md §12.4); la parte de closer del 149"
depends: [153, 203]
status: in_progress
---

# 154 — El manual de operación comercial de Retia (artifact para los closers)

**Origen:** Mani, 2-oct: los closers nuevos (y los actuales) necesitan un manual para operar el CRM. Se hace al
final, cuando la operación está probada (153) y migrada (078).

## Objetivo

Un artifact que explica a un closer cómo opera Retia en el CRM: el flujo de 30X traducido a los términos y la realidad
de Retia (las 11 etapas, qué mueve el sistema solo y qué mueve el closer, los pendientes), el camino de un lead desde
el formulario hasta student, el camino solo por WhatsApp, las alertas de la ficha, el Inbox, abonos y saldo, students
y onboarding, su cuenta de Calendly por programa (152), y los errores típicos. Sale de
`docs/manual-gestion-comercial.md`, del motor y de lo que destapó la lista del 153, no de memoria.

## Avance

- **2-oct (Mani):** borrador en [`docs/manuales/operacion-comercial.html`](../manuales/operacion-comercial.html), con
  las reglas de los manuales en [`docs/manuales/README.md`](../manuales/README.md). Sigue el flujo lead → deal →
  etapas → cierre → dinero → students, y cierra con "lo que le falta al CRM". Lead Quality y Lead Value se
  explicaron con la lógica de los dos Typeform leída por API el 2-oct. Sigue al motor donde el ADR 0072 todavía no
  se construyó: el área declarada se pide en Compromiso Verbal y en la venta, no en Atendido.
- **4-oct a 14-oct:** el manual se actualizó con Memorable, Mi espacio, el Inbox en dos barras, Corregir, Mover a y
  Anotar por etapa, cohortes por definir y el Hub (250).
- **15-oct: el 078 ya no aplica.** El corte en cero (203, 7-oct) lo reemplazó y la operación arrancó en el CRM sin
  migrar; esa dependencia queda cumplida por el 203.
- **Falta para cerrarlo (15-oct):**
  1. **El 153:** que Mani recorra la lista de pruebas como closer. Es lo único que bloquea.
  2. **Dos cambios del 8-oct que el manual no cuenta:** en Inbox › Sin deal, una suelta también tiene **Crear deal**
     (205), y una suelta se cuelga sola cuando llega el formulario del mismo correo (206). Hoy el manual solo dice
     "cuelga citas sueltas" (sección del Inbox y la referencia "Llamada suelta").
  3. **Revisar "Lo que le falta al CRM"** (§8 · Referencia) contra lo que ya se construyó, y los ajustes A-19 a
     A-26 de `docs/anotaciones.md`.
