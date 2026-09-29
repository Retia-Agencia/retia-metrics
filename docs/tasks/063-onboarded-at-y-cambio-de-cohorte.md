---
id: 063
etapa: E4
serves: "plan v2 §6 etapa 4 · tarea E4-7 · insumo §2.7 y §2.8, spec §2 (enmendada)"
depends: [060]
status: done
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

- [x] `onboarded_at` se puede poner y queda con su rastro.
- [x] Cambiar de cohorte deja fila con quien y por que.
- [x] Students es una consulta sobre `etapa`, no una tabla ni una columna.
- [x] La meta sigue siendo **de la cohorte** y no se reparte entre closers (ADR 0023).

## Kiro

Si.

## Cierre (28-sep, sesión 43) — decisiones de Mani

- **Onboarding:** lo marca el closer dueño del deal, o quien administra (gerente y developer). Solo a un
  estudiante (Abonado o Completo). Es un timestamp, se escribe una vez (marcar de nuevo es 409, no pisa la
  fecha) y queda en `change_log`. Corregir un onboarding marcado por error no existe todavía.
- **Cambio de cohorte:** solo estudiantes; cohorte nueva del mismo programa, distinta y **futura o activa**;
  motivo en texto libre, obligatorio. **La venta cuenta donde asiste** (`deals.cohort_id` pasa a la nueva).
  Quién y cuándo: `change_log`; el porqué: una nota en `deal_actividades`, en la misma transacción. Si la
  fecha límite de pago pasa del inicio de clases de la cohorte nueva, se baja a ese inicio (tope del 061) y
  la nota lo dice.
- **Students es una consulta** (`estudiantesDe(db, programId, {cohortId?})`): deals vigentes en Abonado o
  Completo, de UN programa; no hay tabla ni columna.
- 🩸 **Hueco encontrado:** nadie asignaba `deals.cohort_id` al cerrar (el ticket lo daba por hecho). Ahora lo
  hace `registrarAbono` la primera vez que el deal recibe plata: la cohorte activa del programa. Si no hay
  activa, el cobro entra igual y el deal sigue sin cohorte (`cohorteAsignada: null`; la pantalla debe
  decirlo, no se bloquea un cobro real).
