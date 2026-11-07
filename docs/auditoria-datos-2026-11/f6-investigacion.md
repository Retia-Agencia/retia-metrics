# F6, punto 7: investigación previa al contrato de métricas y datos

Ticket 385, §F6 punto 7. Solo lectura y web, 7-nov-2026. Cada afirmación externa trae la URL que se abrió y leyó hoy con WebFetch. Lo que no se pudo abrir o la página no dice queda marcado "sin fuente verificada". Estilo de referencia: `docs/mcp.md` §4 (reglas numeradas, cada una con su fuente y su guardián).

## 0. Resumen y recomendación

| Patrón | Veredicto para este repo |
|---|---|
| Registro de métricas como código (idea de MetricFlow, LookML, Cube), **sin instalar su motor** | **Adoptar la idea**, en TypeScript, dentro de `lib/` |
| Matriz de bus de Kimball (métricas contra dimensiones conformes) | **Adoptar como tabla en `docs/metricas.md` + test** |
| Dimensiones conformes | **Ya es la práctica del repo**; solo falta hacerla explícita y verificable |
| Contrato de datos (campos de ODCS) | **Adoptar los campos como vocabulario**, no el formato ni la CLI |
| Pruebas con fixtures (dbt unit tests) + comparación de dos salidas (audit_helper) | **Adoptar el método** para paridad entre superficies |
| dbt Semantic Layer/MetricFlow, Cube, Looker, Malloy, `datacontract-cli`, Datafold | **Descartar** a esta escala (§6) |

## 1. Capas semánticas y "metrics as code"

### 1.1 dbt Semantic Layer / MetricFlow

- **Qué es.** MetricFlow genera el SQL de las métricas que se definen una vez en YAML dentro del proyecto dbt, y esos YAML se versionan en git como la fuente única. Fuente: https://docs.getdbt.com/docs/build/about-metricflow
- **Por qué existe.** Sin él, cada analista escribe su propio SQL para la misma métrica y los resultados se separan; agregar un desglose significa otra consulta a mano. Misma URL.
- **Piezas.** Modelos semánticos con entidades (llaves de unión), dimensiones (para agrupar) y métricas simples. Encima, métricas ratio, derivadas, acumuladas y de conversión. Misma URL. Cada métrica lleva `name`, `type`, `description`, `label`, `filter` y el `agg_time_dimension` que fija su ancla de fecha; el grano (día, mes) se elige al consultar, no en la definición, y solo hacia un grano igual o más grueso que el nativo. Fuente: https://docs.getdbt.com/docs/build/metrics-overview
- **Límites.** Soporta Snowflake, BigQuery, Databricks, Redshift y Postgres "(dbt v1 only)"; la especificación nueva exige dbt 1.12 o superior. https://docs.getdbt.com/docs/build/about-metricflow. Si el Semantic Layer exige un plan de pago de dbt: **sin fuente verificada** (la página de métricas remite a otras que no se abrieron).
- **Qué implica aquí.** Exige adoptar un proyecto dbt para algo que hoy son consultas drizzle dentro de la app. Eso es una dependencia y un segundo lenguaje de modelado para ~3 programas. **No se instala** (ADR 0006). Lo que sí sirve es el **molde conceptual**: la anatomía de una métrica (nombre, tipo, entidad, dimensiones permitidas, ancla de fecha, filtro) es justo la fila de `docs/metricas.md`. La distinción simple/ratio/derivada es útil: una razón (tasa, ROAS) se define como numerador y denominador **ambos métricas ya definidas**, que es lo que N3 pide con la cobertura.

### 1.2 Cube

- **Qué es.** Modelo de datos con cubos (una tabla base y sus uniones, normalmente uno por tabla), medidas (valores cuantitativos), dimensiones (atributos para agrupar o filtrar) y vistas que "sit on top of cubes" como fachada y que sirven para gobernanza y para limitar lo que ve cada usuario. Se consulta por API. Fuente: https://docs.cube.dev/docs/data-modeling/overview
- **Por qué existe.** Convertir tablas en métricas y dimensiones gobernadas que reutilizan BI y agentes de IA. Misma URL.
- **Límites.** Bases soportadas y preagregaciones: **sin fuente verificada** (la página no los menciona). Que corra como servicio aparte: la página lo insinúa por la API REST pero no lo afirma.
- **Qué implica aquí.** Es un servicio más que operar, con su propio control de acceso, que **duplicaría** el motor de roles y alcance (`lib/auth/alcance.ts`, ADR 0048) y la frontera de programa. Descartar. La idea reutilizable es la **vista como fachada**: lo que se expone es un subconjunto nombrado del modelo, igual que el MCP expone un `outputSchema` y no la vista interna de la pantalla (`docs/mcp.md` §4 regla 10).

### 1.3 LookML (Looker)

- **Qué es.** Lenguaje de archivos de proyecto con modelo, vista, explore, dimensiones (van al `GROUP BY`) y medidas (agregados); cada proyecto vive en su propio repositorio git y Looker genera el SQL. Fuente: https://docs.cloud.google.com/looker/docs/lookml-terms-and-concepts
- **Qué implica aquí.** Producto de BI comercial; no aplica. Confirma el mismo patrón (definir una vez dimensiones y medidas en texto versionado), pero no aporta nada que MetricFlow no aporte ya.

### 1.4 Malloy

- **Qué es.** Lenguaje abierto con modelo semántico consultable que compila a SQL; maneja cálculos de nivel de detalle, porcentaje del total y agregación segura a través de uniones. Soporta BigQuery, PostgreSQL y DuckDB; la propia página lo describe como trabajo en progreso. Fuente: https://docs.malloydata.dev/documentation/
- **Qué implica aquí.** Lo relevante es "agregación segura a través de uniones": es el mismo riesgo que el repo ya documenta (contar filas en vez de personas, ventas contadas dos veces). Pero adoptarlo es un lenguaje y un compilador nuevos, en estado de trabajo en progreso. Descartar; citarlo solo como precedente del problema.

### 1.5 Lo que las cuatro comparten (y es lo que se toma)

Una definición declarativa y versionada por métrica, un conjunto cerrado de dimensiones por el que se puede cortar, el ancla de fecha explícita, y una capa que **genera** el SQL en vez de que cada consumidor lo escriba. En este repo el equivalente de "genera el SQL" ya existe parcialmente: `lib/queries/hechos/*` agrupa, filtra y lista con la misma consulta (`docs/metricas.md` §1, contrato C-2).

## 2. Dimensiones conformes y matriz de bus (Kimball)

- **Qué son.** Dimensiones cuyas columnas comparten nombre y dominio entre tablas, se definen una vez con el gobierno de datos del negocio y se reutilizan en todas las tablas de hechos; dan consistencia analítica y son "the essence of integration". Cuando un atributo conforme es el encabezado de fila, los resultados de hechos distintos se alinean en el mismo informe (drill-across). Fuente: https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/conformed-dimension/
- **Matriz de bus.** Filas = procesos de negocio; columnas = dimensiones; las celdas marcan qué dimensión aplica a qué proceso. Se lee por fila para validar que una dimensión está bien definida para ese proceso y por columna para ver dónde una dimensión debe compartirse. También sirve para priorizar trabajo fila por fila. Fuente: https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/enterprise-data-warehouse-bus-matrix/
- **Qué implica aquí.** El repo ya aplica el principio sin nombrarlo: programa, closer (`lib/closers/identidad.ts`), canal/área (`resolverCanal`), cohorte y día de Bogotá (`lib/queries/hechos/fechas.ts`) son una definición con un módulo. Los hechos son los de `docs/metricas.md` §1 (envío, agenda, cita, venta, abono, gasto). Lo que **falta** es la matriz: hoy no hay una tabla única que diga "el hecho abono admite programa, cohorte, closer y origen; no admite calidad", y ese vacío es donde nacen las cifras que discrepan (el "17 contra 11" del ticket). Recomendación: una tabla hechos × dimensiones en `docs/metricas.md`, con tres valores por celda (aplica, no aplica con razón escrita, no aplica aún), y un test que compare esa tabla con la lista blanca de dimensiones de cada módulo de `hechos/`. Es el filtro de "dimensiones que la métrica **no** admite y por qué" que F1 ya exige como columna.
- **Excepción propia, no de Kimball:** el programa aquí es frontera y no filtro (AGENTS.md), y Kimball asume una sola empresa que suma entre dimensiones. La matriz debe marcar el programa como dimensión que **nunca se cruza** salvo magnitudes sumables (ADR 0048). Sin fuente verificada de que Kimball trate ese caso: es decisión del repo.
- **Límites.** Kimball trata de bodegas con cargas ETL; aquí no hay bodega, las consultas leen las tablas operativas. Se toma el vocabulario y la matriz, no el modelo estrella ni las tablas de dimensión físicas (sería una migración enorme sin beneficio a ~3 programas).

## 3. Contratos de datos

### 3.1 ODCS (Open Data Contract Standard)

- **Qué es.** Un estándar que fija los campos de un contrato de datos en YAML. Quince secciones, entre ellas Fundamentals, Schema, Data Quality, Service-Level Agreement, Team, Roles, Authoritative Definitions, Tags y Variables. Hay JSON Schemas de apoyo y el texto del estándar manda sobre ellos si difieren. Fuente: https://bitol-io.github.io/open-data-contract-standard/latest/
- **Versión vigente y quién lo mantiene:** la página no los dice (apunta a repos de bitol-io); **sin fuente verificada** de versión y mantenedor.
- **Por qué existe.** Que quien produce un dato declare esquema, calidad y niveles de servicio, para que los consumidores no dependan de que "nada cambie". (Inferencia mía a partir de las secciones; la página no lo enuncia.)

### 3.2 datacontract-cli

- Herramienta Python de código abierto que valida un contrato, lo prueba contra datos reales (esquema, presencia de campos, duplicados, conteo de filas) y lo exporta; soporta ODCS de forma nativa y Postgres como fuente. Fuente: https://github.com/datacontract/datacontract-cli
- La página https://datacontract.com/ se abrió pero devolvió solo el título: **sin fuente verificada** de su contenido.

### 3.3 Contratos de modelo de dbt

- Un contrato es una garantía de **forma**: nombres de columna, tipos y restricciones; si el SQL no produce esa forma, el build falla en vez de cambiar la tabla debajo de los consumidores. Se recomienda para modelos "públicos" y no al inicio, cuando el modelo todavía cambia. Distingue **forma** (contrato, falla al construir) de **contenido** (data tests, después de construir). Los cambios que rompen: quitar una columna, cambiar un tipo, quitar una restricción. En Postgres la lista de restricciones aplicadas varía por plataforma. Fuente: https://docs.getdbt.com/docs/mesh/govern/model-contracts
- **Qué implica aquí.** Los equivalentes ya existen: el esquema de drizzle con `NOT NULL`, `CHECK` e índices únicos hace de contrato de forma **en la base** (AGENTS.md: "la garantía vive en un índice único, no solo en el código"), y el `outputSchema` zod `.strict()` de las herramientas del MCP y del endpoint del semáforo hace de contrato de forma **en la salida** (`tests/semaforo-endpoint.test.ts`, `docs/mcp.md` §4). La regla de dbt que sí se toma: **separar forma de contenido** y escribir como "cambio que rompe" (quitar o renombrar un campo de salida, cambiar su unidad o moneda) el que exige enmienda de ADR y de los números dorados.
- **Qué se toma de ODCS (y solo eso).** Los nombres de los campos como vocabulario de la ficha de cada métrica: dueño (quién responde por ella), esquema (qué devuelve y con qué unidad), calidad (qué cobertura y qué chequeos), SLA (frescura: cuándo se actualiza el dato fuente, que ya existe como "frescura del dato" en las gráficas). No se adopta el YAML ODCS ni la CLI: es una dependencia Python y un segundo formato que mantener, para un contrato cuyos consumidores son pantallas de la misma app y un MCP de la misma base de código. Cuando haya un consumidor **externo** estable (otro equipo leyendo estas cifras), volver a evaluarlo.
- **Límite.** Un contrato que no se puede hacer cumplir con un test es una creencia (AGENTS.md). Por eso cada campo de la ficha de métrica debe tener su guardián o quedar marcado "revisión manual".

## 4. Pruebas de paridad y reconciliación entre superficies

- **Pruebas unitarias con fixtures (dbt).** Validan la lógica con entradas estáticas escritas a mano y comparan con filas esperadas, antes de materializar; se recomiendan en desarrollo y CI, no en producción; sirven para lógica compleja (fechas, `case`, ventanas), errores ya reportados (regresión), casos límite que aún no existen en los datos y refactors planeados; **no** para agregaciones simples como `min()`. Se distinguen de las pruebas de datos, que miran los datos reales después de construir. Fuente: https://docs.getdbt.com/docs/build/unit-tests
- **Comparación de dos salidas (`audit_helper`).** Macros para comprobar que dos salidas coinciden al refactorizar o migrar: `compare_queries` compara dos consultas fila a fila y, por defecto, cuenta filas únicas de cada lado e idénticas; `compare_row_counts` compara solo conteos. El README marca `compare_queries` y `compare_relations` como "legacy" con reemplazos (`compare_and_classify_*`). Fuente: https://github.com/dbt-labs/dbt-audit-helper. Que Datafold dejó de mantener su `data-diff` abierto el 17-may-2024: https://www.datafold.com/blog/dbt-audit-helper-vs-data-diff/ (dato de un resultado de búsqueda, **la página no se abrió**: sin fuente verificada).
- **Qué implica aquí.** Los dos métodos ya son los del repo sin ese nombre, y se pueden fijar como regla:
  1. **Paridad entre superficies = un test que invoca las dos funciones reales con la misma base sembrada y compara.** Es el patrón de `tests/saldo-centralizado.test.ts` (ADR 0024) y de N2. La idea del escalón de `audit_helper` se toma tal cual: primero comparar el **conteo**, luego, solo si difiere, la **lista de ids** que sobran y faltan, para que el fallo diga qué filas explican la diferencia y no solo "17 distinto de 11".
  2. **Los números dorados (F0) son el equivalente de la prueba unitaria con fixture**: salen de una base **sembrada y determinista**, no de producción (decisión abierta 2 del ticket). dbt lo respalda: sus pruebas unitarias son estáticas y se corren en CI, no contra datos vivos.
  3. **El caso adversarial se escribe como fixture antes que el arreglo** (regresión de un error ya visto): es la recomendación textual de dbt para "bugs previamente reportados".
  4. **Reconciliación contra producción es auditoría puntual (F2), no un test de CI**: un `SELECT` independiente que no importa nada de `lib/queries/`, con ids opacos. Ya lo prescribe el ticket; ninguna fuente lo contradice.
  5. No probar agregaciones triviales por separado (dbt lo desaconseja); sí cada borde que haga divergir dos implementaciones correctas (anulados, 7 p. m. a medianoche de Bogotá, cohorte, moneda).
- **Límite.** Un test de paridad solo caza la divergencia que su fixture contiene. Sin fuente verificada de una receta general que la complete; la defensa es el catálogo de casos adversariales de F2 acumulado como fixtures.

## 5. Qué recomiendo codificar en el contrato (sin dependencias nuevas)

1. **Registro tipado de métricas en TypeScript** (nombre de negocio, tipo simple/razón/derivada, hecho de origen, dimensiones permitidas, ancla de fecha, unidad y moneda, vigencia, cobertura, función SQL y gemela). Es la decisión abierta 1 del ticket; esta investigación la respalda con el molde de MetricFlow/LookML/Cube, y la razón se define por referencia a otras dos métricas del registro. Un test verifica que `docs/metricas.md` y el registro no divergen.
2. **Matriz hechos × dimensiones** en `docs/metricas.md` (bus de Kimball), con test contra las listas blancas de `lib/queries/hechos/`.
3. **Ficha de métrica con campos tomados de ODCS** (dueño, esquema, calidad, frescura), cada uno con guardián o "revisión manual".
4. **Paridad como test sobre base sembrada**, con el escalón conteo y luego ids, y cada divergencia hallada en F2 convertida en fixture.
5. **Cambio de salida que rompe** (quitar, renombrar o cambiar unidad) = enmienda en el mismo commit (N8) más números dorados.

## 6. Qué NO aplica a esta escala, y por qué

| Descartado | Razón |
|---|---|
| dbt + MetricFlow | Requiere un proyecto dbt y un segundo lenguaje de modelado; Postgres solo con dbt v1 y la especificación nueva pide dbt 1.12 (https://docs.getdbt.com/docs/build/about-metricflow). La app ya genera sus consultas con drizzle. ADR 0006. |
| Cube | Servicio aparte con su propio control de acceso que duplicaría roles, alcance y frontera de programa (https://docs.cube.dev/docs/data-modeling/overview para su modelo; que corre como servidor no está afirmado en la página). |
| Looker/LookML | Producto de BI comercial (https://docs.cloud.google.com/looker/docs/lookml-terms-and-concepts); el patrón ya está cubierto por las otras fuentes. |
| Malloy | Descrito como trabajo en progreso (https://docs.malloydata.dev/documentation/). |
| `datacontract-cli` y YAML ODCS | Herramienta Python y formato nuevos sin consumidor externo que los exija (https://github.com/datacontract/datacontract-cli). Reevaluar si aparece un consumidor externo estable. |
| Modelo estrella y tablas de dimensión físicas | Migración grande sin beneficio a ~3 programas; se toma la matriz, no el esquema (https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/conformed-dimension/ habla de un DW/BI, que aquí no existe). |
| Datafold `data-diff` | Su versión abierta dejó de mantenerse (resultado de búsqueda, no abierto: sin fuente verificada). |
| Contratos de modelo de dbt tal cual | Los da la base (`NOT NULL`, `CHECK`, únicos) y el `outputSchema` zod; solo se toma la separación forma/contenido (https://docs.getdbt.com/docs/mesh/govern/model-contracts). |

## 7. Pendientes sin fuente verificada

- Versión y mantenedor vigentes de ODCS.
- Contenido de datacontract.com.
- Bases soportadas y preagregaciones de Cube.
- Si el Semantic Layer de dbt exige plan de pago.
- Estado actual de `data-diff` de Datafold (solo un resultado de búsqueda).
- Cualquier cifra de rendimiento: ninguna fuente abierta la mide para esta escala; se mide en el repo con `EXPLAIN` (C-2).
