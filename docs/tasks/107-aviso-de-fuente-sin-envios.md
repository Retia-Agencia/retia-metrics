---
id: 107
etapa: E3
serves: "ADR 0055, por decidir 2 (cerrado por Mani el 27-sep) · reemplaza al 055 para las fuentes webhook"
depends: [106]
status: todo
---

# 107 — Una fuente que dejó de recibir se ve en la app

## Objetivo

Que alguien se entere de que un formulario dejó de mandar leads (secreto rotado en un lado y no en el
otro, webhook borrado en Typeform) antes de que se note en las ventas.

## Alcance

- La fuente muestra **"último envío hace X"**, calculado desde `submissions`, no guardado (ADR 0024).
- Pasado un umbral sin envíos, la fuente se marca en la app. **El umbral es configurable por fuente**
  (ADR 0012): no tiene el mismo ritmo un programa con pauta prendida que uno sin ella. Los valores por
  defecto los decidió Mani el 28-sep (abajo).
- También cuentan los sobres crudos (106) sin reprocesar: una fuente que recibe pero no procesa está
  igual de rota.
- **Fuera:** el canal (correo, WhatsApp). Es de la etapa 6.

## Done cuando

- [ ] Una fuente sin envíos por encima de su umbral aparece marcada; una con envíos recientes, no.
- [ ] Una fuente con sobres crudos pendientes aparece marcada.
- [ ] `npm test`, `npm run typecheck` y `npm run lint` limpios.

## Kiro

Sí, con revisión.

---

## Decisión de Mani, 2026-09-28: los umbrales

- **48 horas sin envíos:** la fuente se marca "sin respuestas".
- **5 días sin envíos:** la fuente se marca "muerta". Se marca, no se apaga (ADR 0055).
- **Si llega un envío después de la primera marca y antes de los 5 días:** la marca se quita y hay un
  aviso de que la fuente volvió.
- Configurables por fuente (ADR 0012); 48 h y 5 días son los valores por defecto.
- **Canal: solo dentro de la app por ahora** (Mani, 28-sep). Queda anotado para después: revisar si
  las alertas se mandan también por correo, de forma estandarizada y simple (`docs/plan.md` §7).
