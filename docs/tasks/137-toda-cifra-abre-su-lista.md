---
id: 137
etapa: NC1
serves: "ADR 0067 puntos 5 y 6 · comercial.md GC-34, GC-35"
depends: [136]
status: todo
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

- [ ] Para cada métrica clicable, el test compara la cifra con sus filas y muerde si se separan.
- [ ] Una cifra de 3.000 filas abre el resumen al instante y la lista pagina sin traer las 3.000.
- [ ] En "todos", la lista sale partida por programa y cada subtotal cuadra con la cifra de ese programa.
- [ ] Recorrido visual: clic en cada cifra, resumen, confirmar, lista; consola limpia; 390 px.

## Codex

Sí, esfuerzo `medium`, con revisión visual.
