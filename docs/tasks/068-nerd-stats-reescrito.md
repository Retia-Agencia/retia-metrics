---
id: 068
etapa: E5
serves: "plan v2 §6 etapa 5 · tarea E5-5 · ticket 025, ADR 0025"
depends: [064]
status: todo
---

# 068 — `nerd-stats` reescrito sobre el modelo nuevo

## Objetivo

Que la vista de salud siga contestando lo mismo con las tablas nuevas: corridas de sync y sus
errores, cambios recientes de configuracion, version desplegada y estado del cron.

## Alcance

- **Dentro:** reescribir `lib/queries/nerd-stats.ts` sobre leads, submissions y deals.
- **Dentro:** lo que el modelo nuevo hace visible y antes no: cuantos envios por corrida, cuantas
  fuentes **rotas** (ticket 055), y cuantos leads marcados "unido por telefono" sin resolver
  (ticket 050).
- **Dentro:** `sync_runs.fuentes_leidas` se conserva tal cual (ADR 0031). Las corridas viejas que
  no lo tienen muestran `—`, **nunca un nombre inventado**.
- **Fuera:** la bitacora de escrituras del CRM. Esa es la pantalla de D6 y es el ticket 076.

## Done cuando

- [ ] `/nerd-stats` funciona y sigue siendo exclusiva por guarda de rol (sin escribir `"developer"`
      a mano en ningun `requireRole`: eso lo resuelve `esAccesoTotal`, ADR 0025).
- [ ] Las corridas sin `fuentes_leidas` muestran `—`.
- [ ] Las fuentes rotas y los leads marcados se ven desde aqui.

## Kiro

Si.
