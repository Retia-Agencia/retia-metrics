---
id: 137
etapa: NC1
serves: "ADR 0067 puntos 5 y 6 · comercial.md GC-34, GC-35"
depends: [136]
status: done
---

# 137 — Toda cifra abre su lista: primero el resumen, después las filas

## Objetivo

Clic en cualquier cifra del dashboard y llegar a las filas que la forman, sin ahogarse en miles de filas.

## Alcance

- **Dentro:** el contrato de métrica: cada métrica del dashboard sabe devolver **su cifra y sus filas desde
  la misma consulta y los mismos filtros** (programa, área, canal, closer, periodo). Una métrica sin filas no se
  pinta clicable. Test comparativo: la suma o el conteo de las filas da la cifra, para cada métrica.
- **Dentro:** paso 1, el **resumen**: cuántos, partidos por closer, etapa y antigüedad, en un panel.
- **Dentro:** paso 2, solo si se confirma: la **lista completa** en su propia vista, paginada en el servidor,
  ordenada por antigüedad, con el total arriba y los filtros visibles como chips. Los filtros viajan por la URL
  con ids opacos (ningún dato personal en la URL).
- **Dentro:** la lista es de lo que la cifra cuenta: abonos (caja), llamadas (agendas, shows, sin Grain),
  deals (ventas, creados), leads. Toda fila lleva closer, etapa, antigüedad y enlace a su deal.
- **Dentro:** en "todos los programas", una sección y un subtotal por programa (ADR 0048).
- **Dentro:** el lector de las filas pasa por `vigente()` (guardián de vigencia).
- **Fuera:** el color por antigüedad (después, GC-35).

## Done cuando

- [x] Para cada métrica clicable, el test compara la cifra con sus filas y muerde si se separan.
- [x] Una cifra de 3.000 filas abre el resumen al instante y la lista pagina sin traer las 3.000.
- [x] En "todos", la lista sale partida por programa y cada subtotal cuadra con la cifra de ese programa.
- [x] Recorrido visual: clic en cada cifra, resumen, confirmar, lista; consola limpia; 390 px.

## Cierre (1-oct-2026, Alejo)

Empezó Codex y se quedó sin cuota a mitad; terminó y revisó Claude. Contrato en `docs/structure.md` §9.
Métricas clicables: caja, shows, agendas, cierres y leads. Su universo vive en `lib/queries/metricas-filtros.ts`
y lo usan la cifra del dashboard, el resumen y la lista. El resumen se agrega en Postgres y se parte en tres
desgloses (closer, etapa y antigüedad). La lista pagina en el servidor (50) y está en `/p/[programa]/dashboard/lista`.

- "Todos": `resumenDeMetrica` y `listaDeMetrica` aceptan varios programas y devuelven una sección y un subtotal
  por programa, con su test. La pantalla de "todos" la monta el 095.
- "3.000 filas": el resumen es un `GROUP BY` y la lista un `limit/offset` en Postgres. Probado con paginación
  real; no se sembraron 3.000 filas.
- El test de los desgloses mordió un closer partido en dos por mayúsculas (`Ana` y `  ANA  `, ADR 0030):
  ahora se agrupa con `claveDeCloser`.
- Recorrido contra la base local: cada cifra abre su resumen y cuadra con la cifra (caja 3.546,65 + 4.643,65 =
  8.190,30; cierres 9 + 5; leads 65 + 63 + 31). "Ver la lista completa" abre la vista con chips y total. La
  paginación va y vuelve (65 agendas: 50 + 15) y "Ver deal" abre el deal. Con un closer elegido, leads no es
  clicable y el enlace lleva el código opaco del closer. Claro y oscuro; consola sin errores. A 390 px no hay
  desborde y la tabla de la lista se desplaza dentro de su tarjeta.
- El recorrido destapó y se arregló: leads sin conectar, la advertencia `nativeButton` de Base UI en los
  botones-enlace, las columnas del resumen desalineadas y las etiquetas cortadas a 390 px.

## Codex

Sí, esfuerzo `medium`, con revisión visual.
