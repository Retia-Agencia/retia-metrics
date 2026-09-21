---
id: 063
etapa: E4
serves: "plan v2 §6 etapa 4 · tarea E4-7 · insumo §2.7 y §2.8, spec §2 (enmendada)"
depends: [060]
status: todo
---

# 063 — `onboarded_at` y el cambio de cohorte con su fila de historial

## Objetivo

Lo unico del onboarding que entra al CRM, y el unico movimiento extraordinario que un deal admite
sobre su cohorte.

## Alcance

- **Dentro:** `deals.onboarded_at`, **timestamp y no booleano**, para saber **cuando**. Es la
  enmienda de la spec §2 del 21-sep: del onboarding entra este dato y nada mas.
- **Dentro:** mover un deal de cohorte, con **quien y por que** en el rastro. 🩸 Asi se
  representan los 12 "cohorte pasada" de ComunicArte: compraron en agosto y se movieron a
  septiembre. **No hace falta una relacion N:N.**
- **Dentro:** la cohorte se sigue asignando sola al cerrar (la activa del programa, spec §4).
- **Fuera:** accesos, bonos, factura, cedula. Siguen fuera (insumo §2.7).
- **Fuera:** Students como tabla. **Es una vista**: deals en Abonado o Completo. Las listas por
  programa y cohorte son filtros.

## Done cuando

- [ ] `onboarded_at` se puede poner y queda con su rastro.
- [ ] Cambiar de cohorte deja fila con quien y por que.
- [ ] Students es una consulta sobre `etapa`, no una tabla ni una columna.
- [ ] La meta sigue siendo **de la cohorte** y no se reparte entre closers (ADR 0023).

## Kiro

Si.
