# 0067 — Número y porcentaje siempre, periodo A contra B, y toda cifra abre su lista

- **Estado:** aceptado · 1-oct-2026 (Mani, `/grill-with-docs` del lote 1). Generaliza a todo el dashboard el
  comparativo al mismo día hábil (DP-16) y el selector del 089. Se vuelve contrato de pantalla en
  `docs/structure.md` §9.
- **Relacionadas:** ADR 0023 (el filtro sale de la URL), ADR 0024 (una cifra, una definición), ADR 0043 y
  0048 (el programa es frontera; "todos" solo suma), ADR 0050 (navegación por objetos).
- **De dónde sale:** reunión con Gerencia del 30-sep (`docs/comercial.md` GC-34 a GC-38, §9.4, §9.7).

## Contexto

El dashboard de 30X compara *"this month so far"* el día 1 contra el mes entero, da porcentajes sin base y
cifras sin variación, usa ejes logarítmicos y no deja entrar al detalle. Dani: *"me toca calcular en la
cabeza"*, *"yo poder decidir contra qué periodo quiero contrastar"*, *"clic, clic, clic hasta la minucia"*.

## Decisión

1. **Número y porcentaje siempre.** Toda variación lleva el cambio absoluto y el relativo (*"358 → 4,
   −354, −99%"*); todo porcentaje lleva su base (*"50% de 12"*). Un porcentaje con base 0 se escribe "—",
   nunca ∞ ni 0%. Todo eje es lineal.
2. **Un solo selector de periodo: A contra B.** El usuario elige el rango A y el rango B, o un atajo:
   **hoy, ayer, mañana · esta semana, semana pasada · este mes, mes pasado · cohorte actual, cohorte
   anterior**. La semana va de lunes a domingo. El mismo control lo usan el dashboard, la lista de deals y
   la de leads.
3. **La comparación por defecto es contra el mismo punto del periodo anterior, por día hábil.** "Este mes"
   el día hábil 7 se compara contra los primeros 7 días hábiles del mes anterior, nunca contra el mes
   entero. Es la regla de Retia (solo se excluyen sábado y domingo).
4. **Todo en hora de Bogotá**, calculado en el servidor con `hoyEnBogota()`, nunca con la zona del navegador.
   El periodo vive en la URL, como todo filtro (ADR 0023).
5. **Toda cifra abre la lista de lo que cuenta**, en dos pasos:
   - **Primero un resumen:** cuántos, partidos por closer, etapa y antigüedad.
   - **Solo si se confirma, la lista completa**, en su propia vista, paginada en el servidor. Las métricas
     pueden sumar miles de filas.
   - La lista es **de lo que la cifra cuenta**: la caja abre sus abonos, las agendas sus llamadas, las
     ventas sus deals. Cada fila lleva closer, etapa, antigüedad y enlace a su deal.
   - **La cifra y su lista salen de la misma consulta**, con los mismos filtros: no pueden discrepar. Una
     métrica que no sabe devolver sus filas no se pinta.
6. **En "todos los programas" la lista se parte por programa**, una sección y un subtotal por programa.
   Nunca una lista mezclada: el programa sigue siendo frontera.

## Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| Comparar por día calendario | La cifra se movería por cuántos fines de semana caen en el rango, no por el negocio |
| Toda cifra abre una lista de deals | La caja abriría deals y la suma de la lista no daría la cifra |
| La lista completa de una vez, inline | Miles de filas encima de la gráfica; Mani pidió ver primero el resumen |
| En "todos", obligar a elegir programa antes | Un paso de más para una vista que ya está partida por programa |
