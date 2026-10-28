---
id: 332
etapa: media
serves: "ADR 0112 punto 7 · propuesta.md §3.4"
depends: [325, 330]
status: todo
---

# 332 — El agente del cruce: propuestas en el banco

## Alcance

- Lee solo `insights_llamada` ponderados, los formatos y referentes del banco de los creadores del programa, y el CTA
  que media elige al correrlo. Nunca transcripts.
- Corre solo después del reporte semanal y a demanda (programa, creador, rango). Deja propuestas sin fecha en el banco,
  cada una con los insights de los que sale; media las califica con la escala del banco. No crea piezas ni fechas.
- Mismo tope de gasto del 329. Un creador sin programa no recibe propuestas.

## Done cuando

- Tests con la IA simulada: frontera de programa, trazabilidad propuesta → insights, no escribe en `piezas`.
- Una corrida real revisada con coordinación de media.
