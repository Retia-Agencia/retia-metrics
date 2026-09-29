---
id: 111
etapa: E3
serves: "plan.md §4.3d · ADR 0004 · ADR 0054 · plan-reparto §3 y E1 (carril Alejo)"
depends: [106, 048]
status: done
---

# 111 — Traslado de leads y envíos desde Sheets, una sola vez

## Objetivo

Producción solo tiene los leads que entraron por el webhook desde el 28-sep. Lo que está en las hojas
entra **una vez**, por la misma puerta que el webhook (`ingerirEntradas`), para que el CRM tenga la
historia sin inventar nada.

## Alcance

- **Dentro:** leer la pestaña fuente de cada programa (`docs/structure.md` §10: nunca las vistas
  derivadas ni los respaldos, que rompen el dedup o inflan los conteos) con `lib/sheets/`, y pasar cada
  fila por `ingerirEntradas`. Idempotente: correrlo dos veces no duplica.
- **Dentro:** el Estado **como lo escribió la hoja** (ADR 0054: el CRM traduce, no califica).
- **Dentro:** las 55 de `Forms viejo` ([079]), en la misma corrida.
- **Dentro:** un script en `scripts/` con `actorDelScript()` (ADR 0029) y modo ensayo que solo cuenta.
- **Fuera:** deals, llamadas, abonos y lo abierto de gestión (077 a 081, en el corte del hito B).

## Done cuando

- [x] El ensayo reporta cuántos leads, envíos y contactos crearía, por programa, y cuadra con la hoja
      deduplicada por `(programa, correo)`.
- [x] Corrió en producción con el ok de Mani, y la conciliación del [110] marca cero faltantes.
- [x] Un lead trasladado que vuelve a llenar el formulario no se duplica (prueba de costura de E1).
- [x] Cierra [048] y [049], y la parte de datos del [050].

## Estado al 28-sep (noche)

- `npm run trasladar` (ensayo por defecto) y `npm run trasladar -- --aplicar` en `main`. Aparta los tokens
  que el programa ya tiene (la hoja y el webhook traen el mismo token de Typeform; sin eso, los envíos
  del webhook se duplicaban como envíos de la hoja). Prueba de costura en `tests/costura-e1.test.ts`.
- ⚠️ **El primer ensayo contra las hojas reales se cortó a los 12 min sin terminar.** La ingesta va lead
  por lead (`update "leads"` por fila) a través del pooler: ~3.300 filas de Tactical no caben en un
  tiempo razonable, y el ensayo tiene una transacción abierta en producción todo ese rato (bloquea al
  webhook sobre los mismos leads). No quedó nada escrito (se revirtió). **Antes de `--aplicar`:**
  (1) que la ingesta escriba los leads por lotes (regla de AGENTS.md "Rendimiento y escala": el sync
  pasó de 161 s a 4 s con lotes de 200), y (2) que el script imprima el avance por fuente, no solo al
  final. Alternativa si (1) es grande: correr el ensayo contra la base local (`npm run db:local`).

## Cierre (28-sep, sesión 43)

- La causa de la lentitud era `recalcularResumen`: un `UPDATE` y un `INSERT` de bitácora por lead. Ahora
  es un `UPDATE ... FROM (VALUES)` por lote de 200 (`actualizarResumenes`, con casts y fechas en ISO).
- Ensayo cotejado contra la hoja deduplicada por (programa, correo): ComunicArte esperaba 2.488 y entraron
  2.465 (diferencia 23 = 23 unidos por teléfono); Tactical esperaba 2.919 y entraron 2.877 (42 = 46 unidos
  por teléfono menos 4 envíos sin correo que se pegaron a un lead existente).
- `--aplicar` en producción: ComunicArte 2.478 leads, 2.739 envíos, 4.986 contactos; Tactical 2.891 leads,
  4.199 envíos, 5.843 contactos. Un segundo ensayo crea 0. Conciliación del 110 en 0 en los dos.
- Quedan para revisión humana: 18 envíos de Tactical sin correo ni teléfono conocido (sin lead), 2 teléfonos
  de otro lead, 1 Estado `Cerrado` no reconocido y 1 sin Estado.
