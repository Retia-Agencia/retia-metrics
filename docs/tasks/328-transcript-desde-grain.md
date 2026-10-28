---
id: 328
etapa: media
serves: "ADR 0112 puntos 1 y 2 · propuesta.md §3.2"
depends: []
status: todo
---

# 328 — El transcript desde el link de Grain

## Alcance

- `lib/grain/`: el único módulo que conoce la página pública de Grain. Dado un link, devuelve hablantes, tiempos y
  texto, o un error tipado. Prueba con un link real (solo lectura) antes de escribir el parser; fixtures en los tests.
- Migración: `transcripciones` (llamada, texto crudo como llegó, leído en, error, intentos). Ninguna proyección de
  media la lee.
- Al guardar `calls.link_grain`, la lectura corre después de responder (`after()`), sin bloquear la ficha.
- Cron diario: llamadas con link y sin transcript, o con error y pocos intentos.
- Alarma en la salud de fuentes cuando las lecturas fallan, con conteo y lista.

## Done cuando

- Tests: parser con fixtures, reintento, idempotencia, el error queda guardado y prende la alarma.
- Un link real de producción leído de punta a punta en la base local.
