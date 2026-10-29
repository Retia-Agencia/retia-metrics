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

## A confirmar antes de construir (daily del 28-oct, F5)

- **El esquema lo define media**, no un prompt libre: la lista exacta de lo que quieren extraer de cada llamada
  (`mapa-mece.md` §4, M-f). Salida estructurada con ese esquema, versionado.
- **Dos fuentes**: la **llamada** (con su escalón) y la **clase** (sin escalón; Michael las pasa como MD con programa y
  nombre, y entran por el banco de insumos, 338). Cada insight guarda su fuente y, si es de llamada, su escalón.
- **El peso del escalón se aplica al armar el reporte (330), no al extraer**: así cambiar los pesos (pregunta 10) no
  obliga a re-extraer.

## Done cuando

- Tests con la IA simulada: frontera de programa, idempotencia, versión del prompt, el filtro de datos personales
  muerde una cita con un teléfono.
- 20 llamadas reales extraídas en la base local y revisadas por Mani.
