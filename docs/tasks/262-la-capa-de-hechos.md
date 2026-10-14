---
id: 262
etapa: hub
serves: "docs/hub.md §8, contratos C-1 y C-2 (Mani, 14-oct: métricas como consultas bien construidas, reutilizables y escalables; nada escrito a mano para el estado de hoy)"
depends: [246]
status: en curso (Mani, sesión O10 + Codex, 14-oct)
---

# 262 — La capa de hechos: cada métrica es una consulta reutilizable, con dimensiones, filtros y orden

## Objetivo

Que toda métrica nueva del Hub se construya como una agregación sobre un **hecho** (una consulta tipada de
`lib/queries/`), que agrupa, filtra, ordena y pagina **en SQL** por cualquier dimensión, y cuya lista detrás de la
cifra sea la misma consulta sin agregar.

## Alcance

- **Dentro:** un hecho por cosa que se cuenta, como builder tipado de drizzle (Mani, 14-oct): **envío** (registro,
  por token), **agenda** (llamada creada), **cita** (llamada en su fecha, con show o no), **venta** (deal que entró a
  ganado), **abono**. El de **gasto** se agrega con el 120. Cada uno aplica `vigente()` y la frontera de programa.
- **Dentro:** las **dimensiones** de cada hecho, las que apliquen: día, semana y mes de Bogotá; programa
  (obligatorio, en el tipo, ADR 0043); cohorte; área, canal y cuenta (la regla del 246, escrita también en SQL);
  campaña, conjunto y anuncio (cuando exista el árbol, 120); closer o dueño; etapa. Una dimensión nueva es código;
  sus valores salen de los datos.
- **Dentro:** **filtros y orden genéricos**: una lista blanca tipada de dimensiones filtrables y de columnas
  ordenables por hecho, que se traduce a `WHERE` y `ORDER BY`. Nada de filtrar en memoria lo que puede filtrar la base.
  Paginación en SQL para las listas (ADR 0067).
- **Dentro:** la regla del área y del canal en SQL, **gemela** de la de TypeScript (246), con un test que **ejecuta
  las dos** contra los mismos casos y exige el mismo resultado (el molde de `claveDeCloserSql`, ADR 0030). Ojo con el
  regex dentro de una plantilla `sql`: pasa por dos capas de escape (`AGENTS.md`).
- **Dentro:** `hechosDelEmbudo` y `serie.ts` (089) son el punto de partida: se evolucionan a esta capa, no se escribe
  una paralela. Las consultas viejas del dashboard **no se reescriben en masa**: migran cuando un ticket las toca
  (ADR 0033).
- **Dentro:** índices justificados con `EXPLAIN` sobre una base sembrada a **10 veces el volumen de hoy** (la señal de
  re-pensar de `AGENTS.md`), y la nota de cierre con lo medido.
- **Fuera:** vistas de Postgres y tablas de agregados precalculados. Solo si una medición lo pide (ponytail: el techo
  es una pestaña que pasa del presupuesto a 10×; el camino es una vista o un agregado diario por migración).

## Done cuando

- [ ] Un hecho agrupado por cualquier combinación permitida de dimensiones da lo mismo que contar su lista, con test.
- [ ] Una dimensión que no está en la lista blanca no compila; un filtro sin programa tampoco.
- [ ] La regla del área da lo mismo en SQL y en TypeScript para todos los casos del 246, ejecutando las dos.
- [ ] El guardián de vigencia no marca ninguna lectura de la capa.
- [ ] Ninguna consulta de la capa hace subconsultas correlacionadas con la plantilla `sql` (`AGENTS.md`).
- [ ] Con 10 veces el volumen de hoy, agrupar un mes por día y área en un programa tarda menos de 1 s en PGlite
  (nota de cierre con el `EXPLAIN`).

## Notas

Lo construyen encima: 123, 248, 253, 254, 258. Si un ticket necesita una métrica que la capa no da, se agrega el
hecho o la dimensión aquí, nunca una consulta suelta.
