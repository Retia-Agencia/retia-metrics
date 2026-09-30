---
id: 126
etapa: E7
serves: "docs/analytics.md PT-08, PT-47"
depends: []
status: todo
---

# 126 — El embudo del formulario

## Objetivo

Lo que pidió Pauta: *"qué porcentaje inicia, pasa datos de contacto a la siguiente etapa"*, para mejorar el
formulario.

## Lo medido el 29-sep

El endpoint `insights/{form}/summary` de Typeform da, por pregunta, vistas y abandonos (Tactical: 7.977
vieron la primera pregunta y 3.342 se fueron ahí; 823 vieron el Calendly y 358 se fueron). Es **agregado y
sin canal**. Por canal, el CRM tiene lo suyo desde el primer parcial: dejó datos, completó, llegó al
Calendly, agendó.

## Alcance

- **Dentro:** leer el Insights de cada formulario al abrir la sección (con caché corta), sin guardarlo, y
  pintar el embudo por pregunta con la hora de la lectura.
- **Dentro:** el embudo por canal desde los envíos del CRM (registro = token, 123).
- **Dentro, por decidir antes de construir (🟡):** dónde vive el token de la API de Typeform en
  producción. Propuesta: con la fuente, con las reglas del secreto del webhook (ADR 0055, 0057). Hoy solo
  existe el token de desarrollo en `.env.local`.
- **Dentro:** verificar si el Insights acepta un rango de fechas; si no, la pantalla dice "histórico
  acumulado".
- **Fuera:** editar el formulario.

## Done cuando

- [ ] El embudo por pregunta cuadra con el panel de Typeform el día de la prueba.
- [ ] El embudo por canal no cuenta dos veces un parcial y su completa.

## Kiro

Sí, con revisión.
