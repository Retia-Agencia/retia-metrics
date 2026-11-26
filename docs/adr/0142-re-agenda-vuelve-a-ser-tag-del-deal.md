# 0142: Re-agenda vuelve a ser un tag del deal

- **Estado:** aceptado, 25-nov-2026 (ticket 498).
- **Reemplaza parcialmente:** ADR 0103, solo en su columna derivada. Conserva las tres vistas del Kanban.
- **Confirma:** ADR 0070 (Re-agenda es un pendiente, no una etapa).

## Contexto

La columna derivada Re-agenda separaba deals que seguían en Agendado o Atendido y obligaba a mantener una segunda definición de columna en memoria y SQL.

## Decisión

1. El tablero vuelve a tener una columna por etapa. La vista Llamada empieza en Agendado.
2. Un deal con `pendiente = 'reagenda'` permanece en la columna de su etapa y muestra el tag **Por reagendar**.
3. El tablero permite filtrar los tags Por reagendar, Seguimiento y Sin tag. El filtro es el mismo en la pantalla y en `tablero_de_deals`.
4. Las transiciones y el valor persistido `reagenda` no cambian.
