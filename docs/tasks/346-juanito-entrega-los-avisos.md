---
id: 346
etapa: avisos
serves: "ADR 0114 (el lado de Juanito)"
depends: [340, 343]
status: todo
---

# 346 — Juanito entrega los avisos y reenvía las confirmaciones

Toca el repo de Juanito (`30X/repos/Juanito`): cada cambio en el VPS lo aprueba Mani.

## Alcance

- Cron cada 5 min en horario hábil: `POST /api/avisos/pendientes`, entregar por su cola anti-ban (correo → número con
  su directorio y su opt-in; el grupo, por su id) y confirmar con `POST /api/avisos/entregados`.
- Después de interpretar la respuesta de confirmación (18.CN), reenviarla a `POST /api/avisos/confirmaciones`; si el
  CRM no responde, reintentar (es idempotente).
- Encender la pregunta de confirmación del Push 2 en las conexiones de Retia (`CALENDLY_CONFIRMACION_PUSH2`), si no
  está.
- **Apagar el Push 5 (link al Sheet) para Retia** cuando 341 esté vivo.
- Alinear el directorio: todo closer activo de Retia en el CRM resuelve a un número (hoy falta al menos Nicolás, de
  Francisco, en `src/calendly/closers.js`).

## Done cuando

- Un aviso de prueba de cada tipo llega a su destino y queda como entregado en el CRM.
- Una respuesta "1 3" en un programa de Retia aparece como confirmación en la ficha del deal.
