---
id: 327
etapa: media
serves: "ADR 0111 punto 2e"
depends: [324, 325]
status: todo
---

# 327 — Apagar el cockpit

## Alcance

- Confirmar con coordinación de media que no usa ninguna pantalla del cockpit; dejarlo en solo lectura con aviso que
  apunta al CRM; tras dos semanas sin uso, apagar su despliegue. La base del cockpit no se borra: se respalda.
- Lo hace Mani; los pasos y el respaldo quedan en `docs/operations.md`.
