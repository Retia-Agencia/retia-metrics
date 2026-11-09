---
id: 408
etapa: NC2
serves: "ADR 0115 (N9); AGENTS.md → Norte de las métricas"
depends: []
status: done
---

# 408 — Guardián de la regla N9: el tracker no se desalinea

**Origen:** auditoría del tracker del 9-nov: 112 inconsistencias entre el `status:` de cada archivo, sus casillas y la
fila de `README.md`, casi todas de tickets anteriores a la regla N9 (ADR 0115).

## Objetivo

Que un ticket nuevo no pueda quedar `done` con casillas vacías, ni marcado en el tracker sin estar cerrado, ni sin fila,
y que los históricos que ya incumplen solo puedan encoger (trinquete, mismo molde que `lib/metricas/pendientes.ts`).

## Alcance

- `tests/tracker-n9-guardian.test.ts` (sin base, solo lee `docs/tasks/`): R1 `done` ⇒ casillas de «Done cuando»
  marcadas; R2 marca `[x]` ⇔ status ∈ {done, reemplazado, descartado} (`en main` no cuenta); R3 toda fila existe.
- `tests/helpers/n9-excepciones.ts`: `EXCEPCIONES_HISTORICAS` (`"<id>:<regla>"`) y `TOPE_DE_EXCEPCIONES`.
- Revisión a mano de 142, 143, 151, 152, 156 y 157 (ver abajo).

## Done cuando

- [x] El guardián falla con un ticket nuevo que incumple, con una excepción que ya cumple y con una lista que crece;
  probado con casos sintéticos en los dos sentidos (`tests/tracker-n9-guardian.test.ts`).
- [x] Fila nueva en la tabla «Contratos» de `AGENTS.md`.
- [x] 142 y 151 coherentes (`done`, casillas marcadas); 143, 152, 156 y 157 pasan a `en main` con su fila sin `[x]`:
  les falta el recorrido de Mani (143, 156, 157) o el build y el recorrido forjado (152).
- [x] Typecheck y lint limpios; el test del guardián en verde.

## Fuera de alcance

Auditar uno por uno los tickets históricos con casillas vacías (convención anterior a N9): quedan en la lista de
excepciones y se borran de ella al cerrarse bien. 158 no tiene fila en el tracker (entrada `158:R3`).
