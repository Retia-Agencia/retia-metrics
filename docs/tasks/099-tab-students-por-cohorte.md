---
id: 099
etapa: E6
serves: "ADR 0050 · ADR 0037 (Student es vista) · propuesta 24-sep §3.2b"
depends: [060, 061, 097]
status: done
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

- [x] La lista por cohorte cuadra con los deals en Abonado o Completo de esa cohorte.
- [x] Una cuota vencida se ve con su número y su fecha (no hay cuotas, ADR 0053: "Vencida el <fecha> · N días").
- [x] Recorrido visual con la consola abierta (30-sep).

## Kiro

Sí, con revisión visual.

## ✅ Reunión con los closers 2026-09-24 ([reunión con los closers del 24-sep](../overview.md), resumen en la propuesta §0): onboarding sin checklist

El onboarding (meterlo al grupo y mandarle el correo con los accesos) pasa fuera del CRM. Lo que
pidieron es un **tracker sí/no** para que quien lo hace vea qué le falta, por programa y cohorte:
alcanza con `onboarded_at` (ticket 063) como columna y filtro. **Sin checklist.** La nota y la fecha
límite del acuerdo de pago (ADR 0053, ticket 061) van como columnas aquí; las cuotas no.
La decisión de producto es que la vista incluya ambos estados (`abonado` y `completo`) y que el
onboarding sea una marca operativa del CRM, no una lista de tareas.

---

## Construido (29-sep, Alejo)

- `/p/<programa>/students` con su tab en la nav (`lib/nav.ts`, ícono `GraduationCap`). Mismo alcance que Deals
  (ADR 0048): un programa fuera del alcance es 404.
- `studentsDelPrograma` en `lib/queries/estudiantes.ts`: los deals vigentes en Abonado o Completo, filtrados por
  cohorte (por defecto la activa; `?cohorte=todas`) y por onboarding. **Nada se recalcula:** el saldo sale de
  `saldosDeDeals` (ADR 0024) y lo vencido de `carteraVencida` (ADR 0053), como en el Kanban y el Inbox.
- Cada fila: etapa, cohorte (si se ven todas), onboarding con su fecha, dueño, saldo (`saldoLegible`), fecha
  límite o "Vencida el <fecha> · N días", y el acuerdo de pago. KPI: estudiantes, completos, sin onboarding, en
  cartera vencida.
- El onboarding y el cambio de cohorte **no** se hacen desde la lista: la fila lleva a la ficha del deal, donde ya
  están con su reja (063). Las cuotas no existen: la cartera vencida es la fecha límite (ADR 0053).
- Tests: `tests/students.test.ts` (la lista cuadra con los deals de la cohorte, saldo, vencida, onboarding,
  frontera) y `tests/roles.test.ts` (la tab). Probada en la base local (render del servidor, filtros, cohorte
  inválida, slug inexistente 404).

**Recorrido visual (30-sep, Alejo, base local):** claro, oscuro, 390 px sin desborde (medido con `zoom` 500/390: Chrome no baja de 500 px en Windows), consola limpia. Filtros de cohorte y onboarding (incluido el vacío), la fila lleva a la ficha con el mismo saldo, y una fecha límite pasada sale como "Vencida el 20 sep 2026 · 10 días" con el KPI en 1. Arreglo: un deal en Completo ya no muestra su fecha límite (`e5cb64e`). **Cerrado.**
