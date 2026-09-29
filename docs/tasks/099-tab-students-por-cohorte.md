---
id: 099
etapa: E6
serves: "ADR 0050 · ADR 0037 (Student es vista) · propuesta 24-sep §3.2b"
depends: [060, 061, 097]
status: todo
---

# 099 — La tab Students: la lista de estudiantes por cohorte

## Objetivo

Reemplazar las pestañas `Estudiantes <cohorte>` de las hojas. **La cohorte es por programa y define la
lista de estudiantes**: un estudiante confirmado pertenece a una cohorte de un programa (Mani, 24-sep).

## Alcance

- **Dentro:** deals en Abonado o Completo, filtrados por cohorte (por defecto la activa), con saldo,
  cuotas pactadas, cartera vencida y `onboarded_at`.
- **Dentro:** el cambio de cohorte de un estudiante, con quién y por qué (el caso de los 12 de
  ComunicArte que pasaron de agosto a septiembre).
- **Decidido:** "estudiante" es la vista de los deals en `abonado` o `completo`, con su lead,
  pertenecientes a cada cohorte de cada programa. No se calcula una nueva categoría.
- **Decidido:** Students no lleva checklist de onboarding. Solo muestra y filtra `onboarded_at`.
  El onboarding lo marca el closer dueño del deal; gerente y developer también pueden marcarlo.
- **Fuera:** la factura electrónica, los accesos y los bonos, salvo que la reunión los meta.

## Done cuando

- [ ] La lista por cohorte cuadra con los deals en Abonado o Completo de esa cohorte.
- [ ] Una cuota vencida se ve con su número y su fecha.
- [ ] Recorrido visual con la consola abierta.

## Kiro

Sí, con revisión visual.

## ✅ Reunión con los closers 2026-09-24 ([reunión con los closers del 24-sep](../overview.md), resumen en la propuesta §0): onboarding sin checklist

El onboarding (meterlo al grupo y mandarle el correo con los accesos) pasa fuera del CRM. Lo que
pidieron es un **tracker sí/no** para que quien lo hace vea qué le falta, por programa y cohorte:
alcanza con `onboarded_at` (ticket 063) como columna y filtro. **Sin checklist.** La nota y la fecha
límite del acuerdo de pago (ADR 0053, ticket 061) van como columnas aquí; las cuotas no.
La decisión de producto es que la vista incluya ambos estados (`abonado` y `completo`) y que el
onboarding sea una marca operativa del CRM, no una lista de tareas.
