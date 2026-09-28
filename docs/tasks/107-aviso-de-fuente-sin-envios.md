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
  (ADR 0012): no tiene el mismo ritmo un programa con pauta prendida que uno sin ella. 🔴 El valor por
  defecto lo decide Mani.
- También cuentan los sobres crudos (106) sin reprocesar: una fuente que recibe pero no procesa está
  igual de rota.
- **Fuera:** el canal (correo, WhatsApp). Es de la etapa 6.

## Done cuando

- [ ] Una fuente sin envíos por encima de su umbral aparece marcada; una con envíos recientes, no.
- [ ] Una fuente con sobres crudos pendientes aparece marcada.
- [ ] `npm test`, `npm run typecheck` y `npm run lint` limpios.

## Kiro

Sí, con revisión.
