---
id: 329
etapa: media
serves: "ADR 0112 punto 3 y 5 · propuesta.md §3.3"
depends: [328]
status: todo
---

# 329 — Los insights de cada llamada

## Alcance

- Migración: `insights_llamada` (llamada, programa denormalizado para la frontera, tipo de insight, texto, cita sin
  datos personales, nivel de conciencia, lo que dijo que vio, modelo y versión del prompt).
- Extracción con IA por AI Gateway (modelo y prompt versionados en un módulo), una vez por transcript; re-extraer
  solo si cambia la versión del prompt. Orden explícita de quitar nombres, teléfonos y correos de las citas, y un
  filtro determinista después que los busca.
- Tope de gasto mensual configurable; al llegar, para y avisa. El valor inicial lo confirma Mani.

## Done cuando

- Tests con la IA simulada: frontera de programa, idempotencia, versión del prompt, el filtro de datos personales
  muerde una cita con un teléfono.
- 20 llamadas reales extraídas en la base local y revisadas por Mani.
