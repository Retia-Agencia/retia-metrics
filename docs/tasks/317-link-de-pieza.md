---
id: 317
etapa: media
serves: "ADR 0108 · propuesta.md §6 paso 1 (empezar a medir)"
depends: [316]
status: done
---

# 317 — El link de cada pieza y el link fijo del creador

## Por qué

Un dato que no se captura hoy no se recupera. Cada pieza publicada tiene que llevar un link que el emparejador
reconozca.

## Alcance

- `generarLink` (`lib/atribucion/link-de-captacion.ts`) gana el caso pieza: fuente principal del programa de la pieza +
  `utm_source` (red), `utm_medium=contenido` (`UTM_MEDIUM_CONTENIDO`), `utm_campaign` legible
  (`<tipo>_<creador>_<aaaammdd>`, o sin fecha si es permanente), `utm_content` = código. Derivado, nunca guardado.
- Botón "copiar link" en cada pieza; el link fijo del creador sale de su pieza permanente.

## Done cuando

- `tests/link-de-captacion.test.ts`: el link de una pieza cae en Orgánico por `resolverCanal` y el guardián sigue
  mordiendo una URL con `utm_source` armada fuera del módulo.
- Pieza de un creador sin programa: sin botón y con el porqué.
