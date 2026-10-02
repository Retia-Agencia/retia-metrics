---
id: 154
etapa: NC2
serves: "Capacitación de closers (operations.md §12.4); la parte de closer del 149"
depends: [153, 078]
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
- **Falta para cerrarlo:** cerrar 153 y 078, y revisar el manual contra lo que quede (sobre todo la sección "lo que
  le falta al CRM" y los ajustes A-19 a A-26).
