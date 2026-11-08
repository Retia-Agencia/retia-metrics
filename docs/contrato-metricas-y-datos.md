# Contrato de métricas y datos

> **Qué es.** Las reglas para agregar, cambiar, probar y retirar una métrica, una tabla o una columna, con el guardián que
> hace cumplir cada una. Es el par de `docs/mcp.md` §4 para la capa de datos. Nació en el ticket 385 (F6, 7-nov-2026), que
> es auditoría: este documento es **redactado, no implementado**. Marca con 🔒 lo que hoy hace cumplir un test de `tests/`,
> con 🟡 lo que **solo se propone** (el test no existe todavía) y con 👁 lo que queda en **revisión manual**, con su olor
> nombrado. Nada de lo marcado 🟡 está construido: lo construyen los hijos de F7.
>
> **Qué NO es.** No redefine ninguna cifra (eso es `docs/metricas.md`, único diccionario) ni sustituye al ADR 0115 (N1 a
> N9, la vara). Lo que esas reglas ya dicen se cita, no se copia.

## 0. Estado de este documento (leer primero)

- **Decisiones de Mani del 7-nov** (ticket 385 §4, no se reabren): (1) **registro tipado de métricas en código** como fuente
  de verdad, con test de que `docs/metricas.md` no diverge; (2) **números dorados como test sobre una base sembrada
  determinista**, no sobre producción; (3) **tablas de hechos primero**; (4) **cifras antes de F4** (353, 354 y lo que queda
  del 351), **forma después de F5** (358 a 361).
- **El registro tipado (F4) todavía no existe.** Donde este contrato dice "la entrada del registro", hoy el único sustituto es
  la fila de `docs/metricas.md` más su función; el paso se marca 🟡 hasta que el registro exista. Mientras tanto la fila del
  diccionario es la fuente, como dice el ADR 0115 N8.
- **Los números dorados de F0** (`docs/auditoria-datos-2026-11/f0-linea-base.md`) son una foto de producción del 7-nov, útil
  para comparar fases. **No** son el test de regresión: F2 midió que 7 de los 11 casos adversariales no existen en
  producción (`f2-paridad.md` §3), así que el test se escribe sobre datos sembrados (§4).
- Hallazgos que motivan reglas, por id: F1 (`f1-inventario.md`, H-01 a H-18), F2 (`f2-paridad.md`, F2-01 a F2-07), F3
  (`f3-modelo-de-datos.md`, F3-01 a F3-19).

## 1. Agregar una métrica

Orden obligatorio. Cada paso dice qué falla si se omite.

| # | Paso | Guardián |
|---|---|---|
| 1 | **Nombre de negocio** nuevo en el glosario de `docs/overview.md` §11. Un nombre por concepto; si el universo difiere de una cifra vecina, **el nombre lo dice** (caso F2-01: "Ventas" y "% de cierre" medían universos distintos con rótulo casi igual). | 🔒 `tests/hub-vocabulario-guardian.test.ts` (solo jerga visible en el Hub). 🟡 guardián de rótulos sobre todas las superficies (hoy H-10/H-11: "Show", "Realizadas", "Asistencia"; "Recaudado", "Caja", "Entró a caja" para lo mismo). Olor 👁: dos rótulos distintos con la misma función detrás. |
| 2 | **Fila completa en `docs/metricas.md`**: de qué tabla sale, qué cuenta y qué no, **unidad** (persona, deal o cita), **ancla de fecha**, moneda, vigencia, dimensiones que admite y las que **no** (con la razón), cobertura. Una métrica nueva entra aquí antes de llegar a una pantalla. | 🟡 test registro contra diccionario (§0, decisión 1). Hoy 👁: olor = función citada en el diccionario sin llamador fuera de `tests/` o métrica visible sin fila (F1 §3 "Métricas sin definición", categoría D). |
| 3 | **Un hecho de origen** de `lib/queries/hechos/` (envío, agenda, cita, venta, abono, gasto). La métrica es una agregación sobre el hecho, con una **lista blanca de dimensiones**; la lista detrás de la cifra es la misma consulta sin agregar (C-2, `docs/hub.md` §8). | 🔒 `tests/metricas-con-filas.test.ts` (cifra contra todas las páginas de su lista). 👁 olor: una consulta suelta para una métrica, o filtrar en memoria lo que puede filtrar la base. |
| 4 | **UNA función (SQL) y su gemela TS**, en el módulo que la tabla "Conceptos" de `docs/metricas.md` §0 nombra para ese concepto. Nadie reescribe el predicado (N1). | 🔒 por concepto donde existe: `tests/venta-una-definicion.test.ts` (venta), `tests/vigencia-centralizada.test.ts` (vigente), `tests/saldo-centralizado.test.ts` (dinero), `tests/anclas-de-fecha-guardian.test.ts` (`AT TIME ZONE` solo en `hechos/fechas.ts`), `tests/calendario-guardian.test.ts` (calendario solo en `lib/dias-habiles.ts`), `tests/closer-identidad.test.ts`. 🟡 los conceptos sin guardián: show/ocurrió (siete envolturas, H-15), cita sin resultado (cinco predicados, H-07), lead y registro (H-04), "sin UTM" (tres definiciones, H-17), agenda (H-02). El ticket 354 ya cerró el ancla de fecha, el calendario y la categoría de UTM; 353 queda con show y cita sin resultado. |
| 5 | **Entrada en el registro tipado** (nombre de negocio, tipo simple/razón/derivada, hecho, dimensiones permitidas, ancla, unidad, moneda, vigencia, cobertura, función y gemela). Una **razón** se define como numerador y denominador que ya son métricas del registro. | 🟡 todo el paso (F4). Es la decisión 1; la investigación lo respalda (§7.1). |
| 6 | **Programa como frontera.** Una tasa, meta, costo o ROAS **no compila** en la vista "todos los programas"; solo se suman conteos, caja USD y gasto. | 🔒 el tipo de `lib/queries/agregado-programas` (ADR 0048). 🟡 matriz hechos × dimensiones con test contra las listas blancas (§7.2). |
| 7 | **Vigencia.** Toda lectura de `calls`, `deals`, `abonos`, `deal_actividades` pasa por `vigente()` o `incluyendoAnulados()`. | 🔒 `tests/vigencia-centralizada.test.ts`. |
| 8 | **Moneda a la vista**, sin conversión silenciosa; formato solo por `lib/format.ts`. | 🔒 `tests/format.test.ts`, `tests/gasto-paridad.test.ts` (gasto convertido). 🟡 caso de moneda mezclada: producción tiene COP y USD en el mismo programa (F3-12) y la TRM no se ejerce con ningún abono real (F2 §3). |
| 9 | **Cobertura (N3).** Toda razón devuelve qué parte del universo no pudo calcular; la pantalla dice "parcial" o "—", nunca una razón con medio dato. Hoy solo ROAS y costo por agenda usan `RazonConCobertura` (H-13). | 🔒 `tests/cobertura.test.ts` para el tipo. 🟡 que **toda** razón lo use (hoy tres formas conviven). |
| 10 | **Paridad probada** con el caso que haría divergir dos implementaciones (§4). | 🔒 un test comparativo por concepto donde existe; 🟡 por métrica nueva, lo exige la revisión de este contrato hasta que haya registro. |
| 11 | **Lista detrás de la cifra** y `urlDeLista` con `origen`. | 🔒 `tests/metricas-con-filas.test.ts`, `tests/volver-de-listas.test.ts`. |
| 12 | **Superficies que la exponen**: pantalla, MCP, WhatsApp, CSV, gráfica. Cada una importa la función; ninguna agrega por su cuenta. La del MCP se escribe con `docs/mcp.md` §5. | 🔒 `tests/mcp-guardian.test.ts` (sin SQL en `lib/mcp/`), `tests/graficas-guardian.test.ts`, `tests/semaforo-endpoint.test.ts`. 👁 olor: `count(`, `sum(` o reducciones sobre filas de negocio fuera de los módulos del diccionario (F1 método (b)). |
| 13 | **Toda fecha de negocio sale de Bogotá**: `hoyEnBogota()` y `parsearFecha`; un `Date` nunca va interpolado en una plantilla `sql`. | 🔒 `tests/anclas-de-fecha-guardian.test.ts`, `tests/fecha-cruda-guardian.test.ts`. |

## 2. Cambiar una fórmula (N8)

Una enmienda se reescribe **en el mismo commit**, o no se hace (ADR 0115 N8; sobre qué hace el código manda el código, sobre
qué debería hacer manda ADR vigente > ticket > documento de reunión):

1. El **ADR** vigente: título **e** índice (`docs/adr/README.md`). Si no hay ADR que la cubra, uno nuevo con el siguiente número libre.
2. La **fila de `docs/metricas.md`** y, si cambia el significado, `docs/overview.md` §11 (vocabulario).
3. La **entrada del registro** (🟡 cuando exista).
4. Los **números dorados** (§4) que la cifra toca, con el motivo del cambio en el mensaje del commit.
5. Los **tests** de paridad y de la lista detrás de la cifra.
6. Cualquier **superficie** que repita el texto de la definición (MCP, WhatsApp).

Guardián: 🟡 propuesto: un test que compare el título del ADR citado por la fila con el título del ADR (hoy 👁; olor: una
fila de `metricas.md` que cita un ADR cuyo título ya no dice lo que ella dice).

**El histórico.** Las cifras se calculan al leer desde los hechos, no se guardan; cambiar la fórmula **reclasifica hacia atrás**
(como `resolverCanal`, ADR 0087, que deriva el área al leer). Eso es lo deseado salvo para dos cosas, que **se congelan al
escribir**: la comisión (porcentaje congelado en la venta) y todo lo que ya es un hecho escrito. Una fórmula que necesite un
valor que no se guardó **no se retro-calcula inventando**: se declara cobertura parcial desde la fecha en que el dato existe
(N3; caso real: el gasto de Meta empieza el 1-oct y los deals el 6-oct, `f3` §0). 🟡 "regla de la fecha ancla": toda métrica
nombra su ancla en el registro; cambiarla es cambiar la fórmula y sigue este mismo paso. Fuente: ticket 385 F6 punto 2 y
ADR 0115; la regla del histórico es lectura del diseño actual, **sin fuente verificada** de que se haya decidido por escrito.

## 3. Agregar una tabla o una columna

Antes de proponerla, **busca qué quitar** (ADR 0077). Un catálogo existe solo si el código decide con su valor o una métrica lo
agrupa (ADR 0012). Checklist:

1. **Forma normal justificada.** 1FN (sin jsonb ni arreglos donde debería haber filas), 2FN/3FN (cada atributo depende de la
   llave). La justificación va en la migración y en `docs/structure.md`.
2. **`NOT NULL` y `CHECK` donde un nulo significa "no sé" y rompe una métrica (N6: se exige al escribir, no se parcha al leer).**
   Caso F3-02: `calls.resultado` es `NOT NULL DEFAULT 'agendada'`, y "agendada" y "no sé qué pasó" son el mismo valor; 730 citas
   pasadas siguen así. Una columna cuyo valor por defecto es también el valor "sin dato" es el olor. Moneda: `CHECK` sobre el
   conjunto de monedas (F3-12: seis tablas con moneda en texto libre).
3. **`vigente()`** si el registro se anula, con quién, cuándo y por qué.
4. **Programa como frontera:** la columna `program_id` y, para un hijo de una tabla con programa, una **FK compuesta
   `(padre_id, program_id)`** (propuesta F3-03: hoy la garantía vive solo en el código; 0 filas divergen, pero nada lo impide).
5. **Índice justificado con `EXPLAIN` a 10× el volumen de hoy** (C-2). Un índice con 0 usos en `pg_stat_user_indexes` es muerto
   (F3-04: `calls_cohorte_closer_idx`).
6. **Rastro en `change_log`** por `crearConRastro`/`editarConRastro` y `textoDeBitacora`; toda columna con rastro se clasifica
   en `lib/deshacer/registro.ts`.
7. **Qué métricas toca**, listadas en el ticket y en `docs/metricas.md`.
8. **Denormalización: solo con justificación escrita** que responda tres preguntas: ¿qué se rompe si se quita?, ¿qué garantiza
   que no diverge de su fuente?, ¿tiene test que compare la copia con su fuente? Las existentes están en `f3` §2.1 (por ejemplo
   `lead_contactos.program_id`, el resumen del lead, `deals.etapa` con su historial). Un `text` copiado donde existe una FK
   (`closer_id` frente a `owner_user_id`, ADR 0030) se resuelve por `lib/closers/identidad.ts`, nunca por comparación cruda.
9. **Migración:** `SET lock_timeout = '5s'` si hay DDL sobre tabla caliente; el SQL de `drizzle-kit generate` se **lee** antes
   de aplicar; si quita columnas, primero se despliega el código sin ellas; **la genera y aplica la sesión principal**, no un
   subagente (AGENTS.md).

| Garantía | Guardián |
|---|---|
| Índices únicos de dedup y de cupo del deal | 🔒 `tests/modelo-crm-indices.test.ts` |
| Migraciones aplican limpias y una sola escritura de datos por script | 🔒 `tests/migraciones.test.ts`, `tests/migracion-escritor-guardian.test.ts` |
| Toda escritura del CRM deja rastro | 🔒 `tests/rastro-operativo.test.ts`, `tests/bitacora-jsonb.test.ts`, `tests/texto-de-bitacora.test.ts` |
| Fila de catálogo se borra solo si no se usó | 🔒 `tests/catalogo.test.ts` |
| Ningún programa escrito en el código | 🔒 `tests/contrato-extension.test.ts` |
| Cada tabla/columna nueva tiene su justificación, su `CHECK` y sus lectores | 👁 revisión de la migración. Olor: columna sin lector a los 30 días, texto libre donde hay conjunto cerrado, copia sin test contra su fuente. 🟡 propuesto: test que lista las columnas de `schema.ts` sin ninguna lectura fuera de `schema.ts` y exige que estén en una lista nombrada (F3-06, F3-13, F3-14 miden hoy 0 lectores). |
| Garantía de programa entre tabla hija y padre | 🟡 FK compuesta (F3-03); hoy 👁. |

## 4. Cómo se prueba una cifra

1. **Base sembrada determinista, no producción.** Los números dorados de F0 se **regeneran** sobre un conjunto de datos
   fabricado a mano y versionado, que incluye los casos que producción no tiene (F2 §3): venta que pasa de Abonado a Cierre
   Perdido, venta sin cohorte, sin valor vendido, cortesía, abono en otra moneda, abono adicional y devolución, rango que cruza
   cohortes, cohorte cerrada sin `fechaInicioVentas`, anuladas, venta entre las 7 p. m. y la medianoche de Bogotá, mismo correo
   en dos programas. Las bases de los tests ya son PGlite con todas las migraciones (`tests/helpers/base-de-prueba.ts`, ADR 0020).
   🟡 el conjunto sembrado y su test (hijo de F7). Hoy 👁: los dorados son una foto de producción, que **no** se corre en CI.
2. **Paridad entre superficies = un test que invoca las dos funciones reales con la misma base y compara.** Es el patrón de
   `saldo-centralizado` (ADR 0024) y de N2. Escalón (de `audit_helper`, §7.4): primero el **conteo**; solo si difiere, la **lista
   de ids** que sobran y faltan, para que el fallo diga qué filas explican la diferencia y no solo "17 distinto de 11".
3. **El caso adversarial se escribe como fixture antes que el arreglo** (regresión de un error ya visto).
4. **No se prueban agregaciones triviales por separado**; sí cada borde que haga divergir dos implementaciones correctas
   (anulados, 7 p. m. a medianoche, cohorte, moneda).
5. **Reconciliación contra producción = auditoría puntual (F2), no test de CI:** un `SELECT` independiente que no importe nada
   de `lib/queries/`, solo lectura, con ids opacos, mirando el ref de la connection string (`hfqmiyiuyqapdsbywrag`).
6. **Un test de paridad solo caza la divergencia que su fixture contiene.** La defensa es acumular cada divergencia hallada
   como fixture. Y una función de `lib/` que nadie llama puede estar mal desde el día que se escribió: antes de darla por
   probada, `grep` de sus llamadores (AGENTS.md, recorrido del 20-sep).
7. **La suite completa no se corre en local**: la valida el CI de cada push y el checkpoint (AGENTS.md "Feedback loops").

Guardianes: 🔒 `tests/gasto-paridad.test.ts`, `tests/tasas-del-grupo.test.ts`, `tests/series-alineadas.test.ts`,
`tests/preguntas-disponibles-paridad.test.ts`, `tests/mcp-metricas.test.ts` (MCP contra pantalla).

## 5. Cómo se retira algo

**Reemplazar es borrar** (N7). Al introducir la función canónica, el mismo cambio borra las vecinas.

1. **Cada función que cita el diccionario tiene un llamador fuera de `tests/`.** Una que solo llama un test está muerta y no
   cuenta como cobertura. (F1 categoría E.)
2. Primero se **cambia a los llamadores**, luego se borra la función, el export, su fila en el diccionario y su test.
3. Columna o tabla muerta: se cuentan las **lecturas** en `lib/`, `app/`, `components/` y `scripts/` (conteo en el ticket);
   **0 lecturas y 0 filas pobladas** se elimina; con referencias solo se desactiva (ADR 0026). Ejemplos con conteo en F3:
   `sync_runs` (F3-15), `canales` (F3-16), columnas de `leads` (F3-06), `estados_llegada` (migración 0059).
4. Un campo de **salida** (MCP, endpoint del semáforo) que se quita o renombra, o cuyo unidad o moneda cambia, es un **cambio que
   rompe** y exige enmienda y números dorados (§2). Separar así forma de contenido sigue a dbt (§7.3).
5. Una pantalla que se retira deja un `redirect` temporal solo si hay enlaces vivos; el `redirect` también se retira cuando
   no quedan.

Guardianes: 🔒 `tests/vigencia-centralizada.test.ts` (nadie vuelve a leer lo retirado sin decidir), `tests/ingesta-estado.test.ts`
(nadie vuelve a leer `estadosLlegada`), `tests/contrato-extension.test.ts`. 🟡 propuesto: test que recorre las funciones citadas
en `docs/metricas.md` y falla si alguna no tiene llamador fuera de `tests/` (hoy 👁, ticket 361). Olor: función exportada de
`lib/queries/` con un solo llamador en `tests/`.

## 6. Dónde vive este contrato

- **Este documento**, enlazado desde `AGENTS.md` junto a `docs/mcp.md`.
- **Definiciones:** `docs/metricas.md` (única). **Vocabulario:** `docs/overview.md` §11. **Decisiones:** `docs/adr/`.
- **Futuro registro tipado** (🟡, F4): un módulo de `lib/` del que se verifica el diccionario. Hasta entonces la fila del
  diccionario manda.
- **Guardianes en `tests/`:** los marcados 🔒 arriba existen hoy. **Los 🟡 solo se proponen:** no se implementan en 385. Los
  👁 se revisan al revisar el cambio, con el olor nombrado.
- **Revisión:** la hace otra sesión o modelo distinto del que escribió el código, contra el "Done cuando" del ticket y este contrato.

## 7. Investigación previa, con fuentes verificadas

Detalle y límites en `docs/auditoria-datos-2026-11/f6-investigacion.md` (7-nov-2026, cada URL abierta ese día). Aquí solo lo que
fundamenta una regla. Lo no abierto o no dicho por la página queda **sin fuente verificada**.

1. **Registro de métricas como código, sin instalar su motor.** MetricFlow define cada métrica una vez en YAML versionado en
   git, con `name`, `type`, `filter` y `agg_time_dimension` (el ancla de fecha); el grano se elige al consultar:
   https://docs.getdbt.com/docs/build/about-metricflow y https://docs.getdbt.com/docs/build/metrics-overview. Cube (medidas,
   dimensiones, vistas como fachada): https://docs.cube.dev/docs/data-modeling/overview. LookML:
   https://docs.cloud.google.com/looker/docs/lookml-terms-and-concepts. **Se toma la anatomía, no el motor**: dbt exigiría un
   proyecto y un segundo lenguaje de modelado (Postgres solo con "dbt v1 only"; la especificación nueva pide dbt 1.12), y Cube
   sería un servicio aparte que duplicaría roles, alcance y frontera de programa (ADR 0006, 0048). Si el Semantic Layer exige
   plan de pago: **sin fuente verificada**. Bases y preagregaciones de Cube: **sin fuente verificada**.
2. **Dimensiones conformes y matriz de bus (Kimball).** Dimensiones definidas una vez y reutilizadas en todos los hechos:
   https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/conformed-dimension/;
   matriz procesos × dimensiones:
   https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/enterprise-data-warehouse-bus-matrix/.
   Se adopta como **tabla hechos × dimensiones en `docs/metricas.md`** con test contra las listas blancas de `lib/queries/hechos/`
   (🟡). El programa es la excepción propia del repo (frontera, no dimensión que se suma): **sin fuente verificada** de que
   Kimball trate ese caso; es decisión del repo. No se adopta el modelo estrella.
3. **Contratos de datos.** Forma frente a contenido; los cambios que rompen son quitar una columna, cambiar un tipo o quitar una
   restricción: https://docs.getdbt.com/docs/mesh/govern/model-contracts. ODCS fija los campos de un contrato (esquema,
   calidad, SLA, equipo): https://bitol-io.github.io/open-data-contract-standard/latest/ (versión y mantenedor vigentes:
   **sin fuente verificada**). `datacontract-cli` valida contra datos: https://github.com/datacontract/datacontract-cli
   (contenido de datacontract.com: **sin fuente verificada**). Se toma el **vocabulario** (dueño, esquema, calidad, frescura)
   para la ficha de cada métrica; **no** el YAML ni la CLI, que serían una dependencia Python sin consumidor externo. Se reevalúa
   si aparece uno estable. En este repo la forma ya la dan la base (`NOT NULL`, `CHECK`, únicos) y el `outputSchema` zod
   `.strict()`.
4. **Pruebas.** Las unitarias de dbt validan lógica con entradas estáticas, sirven para fechas, `case`, bugs ya reportados y
   casos que aún no existen en los datos, y no para agregaciones simples: https://docs.getdbt.com/docs/build/unit-tests.
   `audit_helper` compara dos salidas (conteo de filas, luego fila a fila): https://github.com/dbt-labs/dbt-audit-helper (su
   README marca `compare_queries` y `compare_relations` como "legacy"). El cierre de `data-diff` de Datafold es un resultado de
   búsqueda no abierto: **sin fuente verificada**. Cualquier cifra de rendimiento a esta escala: sin fuente, se mide con
   `EXPLAIN` (C-2).

**Descartado a esta escala:** dbt + MetricFlow, Cube, Looker, Malloy (https://docs.malloydata.dev/documentation/, descrito como
trabajo en progreso), `datacontract-cli`, YAML ODCS, Datafold y el modelo estrella físico. Razones en `f6-investigacion.md` §6.
Un contrato que no se puede hacer cumplir con un test es una creencia (AGENTS.md): por eso cada regla de arriba trae su guardián o
su olor.

## 8. Guardianes nuevos propuestos (no implementados)

Para los hijos de F7, en el orden en que cierran un hueco que hoy produce cifras creíbles y distintas:

1. **Registro contra diccionario:** el registro tipado y la tabla de `docs/metricas.md` no divergen (decisión 1).
2. **Guardián de rótulos** sobre todas las superficies, no solo el Hub (H-10, H-11, H-09).
3. **Matriz hechos × dimensiones** contra las listas blancas de `hechos/` (§7.2).
4. **Un guardián por concepto que hoy no lo tiene:** show/ocurrió, cita sin resultado, lead/registro, agenda, "sin UTM" (H-15, H-07, H-04, H-02, H-17).
5. **Toda razón usa `RazonConCobertura`** (H-13).
6. **Funciones del diccionario sin llamador fuera de `tests/`** (N7, ticket 361).
7. **Números dorados sobre base sembrada** con los casos de §4.
8. **Columnas sin lector fuera de `schema.ts`** contra una lista nombrada (F3-06, F3-13, F3-14).
