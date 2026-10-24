---
id: 311
etapa: hub
serves: "Mani, 24-oct (recorrido de Hub › Origen): 'origen del lead y cómo cuenta cada UTM es la misma vaina' · AGENTS.md: una pregunta, un módulo · C-2 (docs/hub.md §8)"
depends: [248, 309]
status: done
---

# 311 — Hub › Origen: una sola tarjeta por canal, que se abre en sus UTM

## Por qué

El 248 trajo a Origen, sin fundirlas, tres tarjetas que responden la misma pregunta ("¿de dónde vienen los registros y
cuántos agendan?") a distinto detalle, cada una con su propia consulta (`app/(app)/p/[programa]/hub/page.tsx`,
`SeccionOrigen`):

- **Cómo cuenta cada UTM** (`origenDelPrograma`, `lib/queries/origen.ts`): por par UTM, envíos, agendas, área, canal,
  cuenta, regla y traza.
- **Origen del lead por canal** (`embudoPorCanal(hechosDelEmbudo(...))`).
- **Registros contra agendas por canal** (`registrosYAgendasPorCanal`, `lib/queries/registros-agendas-canal.ts`).

Mani no entendió cuál mirar, y son tres conteos que pueden separarse sin un error. Además, la columna "Traza" (N3 a N0)
es vocabulario interno: "eso no lo entiende nadie".

## Alcance

- **Dentro:** una tarjeta, **Origen de los registros**: una fila por canal (área · canal) con registros, agendas y % de
  agenda, ordenada por registros; cada fila se despliega en sus pares `utm_source / utm_medium` con las mismas columnas
  y la regla en palabras (`textoDeRegla`), con la marca **nuevo**. Sin UTM y Macros sin expandir siguen visibles con su
  conteo y su porcentaje. Paginada o con "ver todos" cuando los pares pasan de un umbral: la lista crece con cada par
  nuevo que llega.
- **Dentro:** **una sola consulta** detrás de la tarjeta, sobre el hecho de envío del 262 (agrupada por canal y por par
  en SQL); `registrosYAgendasPorCanal` y `embudoPorCanal` de Origen se borran si nadie más los llama (`grep` antes).
- **Dentro:** cada cifra abre la lista unificada del 309 con su filtro (canal o par).
- **Dentro:** sale la columna "Traza" de la tabla. La tarjeta "Traza de envíos Paid" queda como está (Mani no la pidió
  en este ticket).
- **Dentro:** `docs/metricas.md` (sección de Origen) nombra la única función y retira las filas de las que se borran.
- **Fuera:** Plantillas en uso por cuenta y el embudo del formulario (312, 313).

## Done cuando

- [x] Origen tiene una tarjeta de origen, no tres; la suma de registros por canal da el total de "Leads" de Hoy en el
  mismo rango, con test.
- [x] La suma de los pares de un canal da la fila del canal, con test.
- [x] Un paid trafficker ve la tarjeta de sus programas; un closer que forja la ruta recibe 404.
- [x] Recorrido con clic en todo lo que se abre, escritorio y 375 px, consola limpia.
