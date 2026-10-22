---
id: 296
etapa: deals
serves: "Un closer de llamada abre el Kanban en sus columnas y ve las re-agendas aparte (ADR 0103; A-157, A-158)"
depends: []
status: ready
---

# 296 — Kanban: columna Re-agenda y vistas Llamada, Setteo y Todo

## Por qué

ADR 0103 (Mani, 22-oct), del loom de Nicolás. Anotaciones A-157 y A-158.

## Qué

1. `lib/queries/kanban.ts`: una columna derivada "Re-agenda" (deals con `pendiente = 'reagenda'`, en Agendado o
   Atendido), a la izquierda de Agendado; Agendado y Atendido sin esos deals. Totales recalculados por columna.
2. Parámetro `vista` en la URL (`llamada`, `setteo`, `todo`; validado con zod, `todo` por defecto) que decide qué
   columnas se devuelven. La lista de vistas es un dato en un solo lugar, junto a `ETAPAS_EN_ORDEN`.
3. La última vista de cada persona se recuerda y se usa al entrar sin `vista` en la URL.
4. Tarjeta en la columna Re-agenda: dice de qué etapa viene. Arrastrar respeta las flechas del motor (PR1, PR2, la cita
   nueva limpia el pendiente).

## Done cuando

- Tests: la suma de Re-agenda + Agendado + Atendido es igual a la de antes; cada vista devuelve sus columnas; un
  `vista` inválido cae en `todo`.
- Recorrido en `dev:local` con un closer: entra en Llamada, ve las re-agendas aparte, cambia de vista, recarga y
  conserva la suya. `npm run build` limpio (toca componentes cliente).
