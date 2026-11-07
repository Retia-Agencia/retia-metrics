---
id: 385
etapa: mcp
serves: "Auditoría COMPLETA de métricas y datos del CRM (obligatoria, Mani 7-nov) · ADR 0115 (N1 a N9) · ADR 0012 · C-1 y C-2 de docs/hub.md §8 · ADR 0119"
depends: [348]
status: todo
---

# 385 — Auditoría completa de métricas y datos del CRM: una definición por cifra, modelo de datos justificado, consultas centralizadas y contrato de mantenimiento

> **Decisión de Mani, 7-nov (no se re-abre): esto se hace sí o sí, y a nivel de TODO el CRM.** El MCP no es el alcance, es
> lo que lo dejó en evidencia: una IA que lee el CRM sin que nadie le explique nada repite sus ambigüedades en voz alta.
> El ticket nació como "integridad de las tools del MCP" (6-nov); se ensancha. Las tools del MCP pasan a ser **una más de
> las superficies** que se auditan, junto con el Hub, Metas, Students, Mi día, Deals, Leads, los CSV, las gráficas y el
> mensaje de WhatsApp. El orden que pidió Mani: **(1) depurar métricas, (2) normalizar y verificar la base,
> (3) centralizar queries y fórmulas con su detalle, (4) contrato del repo para mantenerlas y ampliarlas.**
>
> **Para una sesión sin contexto.** Es un ticket grande y de investigación: **no lo implementes de corrido.** Las fases F0
> a F3 producen un informe y decisiones; al terminar F3 se parte en tickets hijos (uno por causa, no por síntoma, como
> hizo la auditoría del 30-oct) y cada hijo sigue el flujo normal. Lee antes: `docs/metricas.md` completo,
> `docs/auditoria-metricas-2026-10-30.md`, el ADR 0115, `docs/mcp.md` y `AGENTS.md` (integridad de los datos).

## 1. Por qué (la evidencia, con sus fechas)

**30-oct: la primera auditoría.** El CRM no tenía un error de fórmula aislado: tenía varias respuestas para la misma
pregunta y la suite en verde (ROAS ×2,2 del real, % de show sobre una de cada cinco citas, comisión corta en un 40 %,
"vendidos de la cohorte" en 32 y 27 en la misma pantalla). De ahí salieron los tickets 351 a 362 y el ADR 0115 con las
nueve reglas de norte (N1 a N9).

**7-nov: la primera prueba real del MCP** (Mani, Claude Code contra producción, Tactical, octubre). La IA devolvió
17 ventas, USD 25.350 vendidos, 18.175 recaudados, 7.175 por cobrar, y escribió esto de su cuenta, sin que nadie se lo
pidiera: *"el desglose por grupo de deals muestra 11 vendidos frente a las 17 ventas de arriba. No sé explicar la
diferencia con lo que devolvió el CRM."* También: *"de las 360 agendas, 290 siguen sin resultado marcado; solo el 20 %
está cubierto."*

Qué sabemos y qué no, sin inventar:

- **La diferencia 17 contra 11 no es necesariamente un error de cálculo; es un nombre.** Por el diccionario
  (`docs/metricas.md` §3.1, filas "Ventas" y "% de cierre") **Ventas** son los deals vendidos *en el rango* (por la fecha
  de la venta, `ventasConDiaEn`), y **% de cierre** es *deals con show que hoy están vendidos ÷ deals con show*. Con 33
  shows, 11/33 = 33,3 %, que es justo el % que mostró. Quien divide 17/33 obtiene 51,5 % y cree que el CRM se equivoca.
  Las dos cifras se llaman "cierres" en la salida, y miden cosas distintas (N4: *un nombre por concepto*). **Inferido de
  las cifras y del diccionario; se confirma en F2 reconstruyéndolo desde la base.**
- **Las unidades del embudo no son la misma.** 360 agendas (citas agendadas en el rango), 290 sin resultado, cobertura
  del 20 % y 33 shows con 44,6 % de show (implica un grupo de ~74) **no se reconcilian con una suma simple**: las agendas
  cuentan citas y el grupo de las tasas cuenta deals con cita ya ocurrida. Es parte de F2 reconstruirlo desde las tablas.
- **El hueco de datos es real y es de captura, no de fórmula:** 290 citas de octubre sin resultado marcado hacen que el
  % de show y de cierre estén subestimados o incompletos. Ya estaba medido en la auditoría del 30-oct (C-02, 19 a 21 %).
- **Una de las dos llamadas del MCP falló y no quedó en la bitácora.** La captura dice "Used retia-crm 2 times (1
  failed)" y `mcp_llamadas` solo tiene las dos llamadas buenas. Causa probable: el modelo mandó un `periodo` que no existe
  ("octubre"; los atajos son hoy, ayer, mañana, esta/semana pasada, este/mes pasado y desde el inicio), el esquema lo
  rechazó **antes** del handler y por eso no se auditó. Dos arreglos en F5: auditar los rechazos de validación y aceptar un
  mes concreto (`AAAA-MM`) sin obligar a armar `custom` con dos fechas.

**Estado real de los arreglos del 30-oct (verificado el 7-nov contra los archivos y los commits):** de los doce tickets de
corrección, **solo el 352 está `done`**. El 357 está reemplazado. El 356 tiene el código y el backfill hechos y el tracker
sin cerrar; el 351 y el 362 tienen casillas abiertas; y **siete no se empezaron: 353 (llamada: show, no show y sin
resultado), 354 (cada hecho con su día; registro, lead y "sin UTM"), 355 (pauta: un cargador y una tabla), 358 (formato
único y la regla del vacío), 359 (pantalla sin jerga), 360 (filtros: un nombre por parámetro) y 361 (retiro de lo muerto)**.
Esta auditoría **no los reemplaza ni los repite**: F0 los reclasifica con evidencia (hecho, parcial, vigente, obsoleto) y
F6 decide el orden contra los hallazgos nuevos. Re-auditar sin cerrar lo ya diagnosticado repetiría el error.

## 2. Principio rector

Toda cifra visible, en cualquier superficie, responde a esta cadena y se puede recorrer hacia atrás sin saltos:

`nombre de negocio` → `definición escrita (docs/metricas.md)` → `UNA función (SQL) y su gemela (TS)` → `tablas y columnas fuente` →
`ancla de fecha, moneda, vigencia (anulados) y frontera de programa` → `cobertura (qué parte no se puede calcular)`.

Si un eslabón falta, está duplicado o está distinto según la superficie, es un hallazgo. Las reglas N1 a N9 del ADR 0115
**siguen siendo la vara**; esta auditoría las verifica con datos reales y las completa donde falten (ver F6).

## 3. Fases

Cada fase termina con un entregable verificable. Las fases F0 a F3 son **de solo lectura** (código y `SELECT` contra
producción con ids opacos, sin escribir, mirando el ref de la connection string). Nada de migraciones aquí.

### F0. Línea base y limpieza del terreno

1. **Congelar las cifras de hoy ("números dorados").** Para cada programa activo y cada uno de tres periodos (el último mes
   cerrado, el mes en curso al día de hoy, un rango personalizado de 14 días), guardar las cifras que el Hub, Metas,
   Students y el MCP devuelven. Se guardan en `docs/` con fecha y hash del commit: sirven de comparación en cada fase y,
   si Mani decide, de test de regresión (ver F6).
2. **Reclasificar los tickets 351 a 362** (tabla: id, estado real, qué falta, vigente u obsoleto por el 352/357, a qué
   hallazgo nuevo se parece). Cerrar los que ya están hechos (356, 351 si sus dos casillas son de verificación) con su
   evidencia. Resolver las contradicciones del tracker que aún queden (N9).
3. **Leer y actualizar el ADR 0115** contra el código de hoy: ¿cada regla N1 a N9 tiene todavía su guardián y el guardián
   muerde? Un guardián que ya no cae sobre nada es una creencia (AGENTS.md).

### F1. Inventario de métricas, de todas las superficies

Un registro tabular (en `docs/auditoria-datos-2026-11.md`, una fila por métrica **y por superficie**) con estas columnas:

| Columna | Qué contiene |
|---|---|
| Nombre de negocio | el que ve la persona hoy, **en cada superficie** (si difiere, ya es hallazgo N4) |
| Definición | enlace a la fila de `docs/metricas.md`; si no existe, "sin definición" |
| Función SQL / gemela TS | archivo y nombre; si hay más de una, se listan todas |
| Fuente | tabla y columnas, y el filtro de vigencia (`vigente()`) |
| Ancla de fecha | fecha del hecho, no de captura; zona Bogotá |
| Unidad y moneda | conteo de personas, de deals, de citas; USD, COP o ambas; conversión explícita o no |
| Filtros que admite | programa (frontera), cohorte, closer, origen, calidad; los que **no** admite y por qué |
| Cobertura | qué parte del universo no se puede calcular y cómo se informa |
| Quién la llama | pantallas, MCP, WhatsApp, CSV, gráficas; cada llamador fuera de `tests/` (N7) |

Superficies a recorrer (lista cerrada; si aparece una más, se agrega):
Hub (Hoy, Comercial, Dinero, Pauta, Origen) · Metas y cohorte · Students y cartera · Mi día y Bandeja · Deals (tablero y
ficha) · Leads (lista y ficha) · Dashboard por programa y su lista detrás de cada cifra · reporte de WhatsApp y semáforo
(ADR 0089) · exportables CSV · gráficas y series (`lib/series-pasos.ts`) · **las once tools del MCP**.

**Método para no depender de memoria:** (a) recorrer `docs/metricas.md` y marcar qué filas no tienen función; (b) buscar
en `lib/`, `app/`, `components/` y `scripts/` toda agregación (`count(`, `sum(`, `avg(`, `group by`, reducciones en memoria
sobre filas de negocio) fuera de los módulos que el diccionario nombra: cada una es un candidato a duplicado; (c) por cada
etiqueta visible con números ("ventas", "cierres", "agendas", "show", "caja", "vendido", "recaudado"), rastrear de dónde
sale. Semilla de sospechosos ya vistos: las funciones con "venta" en `lib/queries/` (`ventasConDiaEn`, `vendidosEn`,
`ventasDeLaCohorte`, `ventasDelRangoConValor`, `ventasPorCohorte`, `ventasDelFiltro`, `ventasDelPrograma`,
`dineroDeVentas`, `leerCohortesYVentas`) y los 76 módulos de `lib/queries/`: el diccionario dice que la venta es una
(DA-1), el inventario verifica que **cada llamador use esa y no una vecina**.

### F2. Paridad cruzada con datos reales

Por cada métrica con más de una superficie, **comparar todas las superficies entre sí y contra una reconstrucción
independiente desde las tablas** (un `SELECT` escrito a mano que no importe nada de `lib/queries/`), con datos de
producción, para los tres programas y los tres periodos de F0. Más los casos adversariales que hacen divergir a dos
implementaciones correctas por separado:

- registros anulados (llamadas, abonos, deals) y deals que pasan de Abonado a Cierre Perdido (deja de ser venta);
- el mismo correo en dos programas (dos leads, nunca se cruzan) y personas con varios deals y varios envíos;
- moneda: USD, COP, tickets con descuento, abonos adicionales, devoluciones, conversión con TRM del día;
- bordes de fecha: venta entre las 7 p. m. y la medianoche de Bogotá, rangos que cruzan cohortes, días no hábiles;
- cohortes: la misma venta contada en el rango y en la cohorte, deals sin cohorte, cohortes cerradas sin `fechaInicioVentas`;
- cobertura: citas sin resultado, gasto de Meta que empieza después que las ventas, comisión sin porcentaje congelado.

**Salida:** lista de divergencias con severidad (la misma escala del 30-oct: crítica, alta, media, baja), con la consulta
que las reproduce. **El caso 0 es el de arriba (17 contra 11 y las unidades del embudo).** Cada divergencia se clasifica:
*error de cálculo*, *dos definiciones vivas*, *mismo concepto con dos nombres*, *dos conceptos con el mismo nombre*,
*dato faltante en la captura* o *esperado y mal explicado*. La clase decide el arreglo (ver F4 y F5).

### F3. Auditoría del modelo de datos (normalización y verificación)

Alcance: **primero las tablas que alimentan métricas** (hechos: envíos, leads, contactos, deals, historial de etapas,
llamadas, abonos, gasto, árbol de Meta, cohortes, usuarios y membresías), después el resto de las 64 de `lib/db/schema.ts`.
Por tabla, un registro con:

1. **Forma normal.** 1FN (jsonb o arreglos donde debería haber filas, columnas repetidas); 2FN y 3FN (dependencias
   transitivas, atributos que dependen de otro atributo y no de la llave).
2. **Cada denormalización, justificada o con propuesta de quitarla**, con su costo. Ya conocidas: `lead_contactos.program_id`
   (denormalizada a propósito para enforzar el dedup por programa), el resumen del lead que se recalcula desde sus envíos,
   `deals.etapa` junto con `deal_etapa_historial`, el `closer_id` como texto copiado en llamadas (ADR 0030) frente a la FK
   `owner_user_id`, nombres de campaña y de anuncio como texto en los envíos (UTM, ADR 0004: no se reescribe). La
   justificación debe responder: ¿qué se rompe si se quita? ¿qué garantiza que no diverge de su fuente? ¿tiene test?
3. **Texto que debería ser FK o enum** y al revés: enums que el código no usa para decidir (ADR 0012: un catálogo existe
   solo si el código decide con su valor).
4. **Integridad que la base garantiza o no:** unicidad, `CHECK`, FK con su `ON DELETE`, índices parciales (el de "un deal
   abierto por lead y programa"), `NOT NULL` donde un nulo significa "no sé" y rompe una métrica (N6: se exige al escribir).
5. **Verificación con datos de producción (`SELECT`):** huérfanos, duplicados que el índice debería impedir, centinelas
   (el valor que cada fuente escribe cuando no sabe: ADR de centinelas), fechas imposibles, montos negativos, deals sin
   cohorte, abonos que superan el ticket, registros anulados sin quién ni por qué, `change_log` que habla de filas
   inexistentes. Cada hallazgo con su conteo.
6. **Columnas, tablas e índices muertos** (N7: reemplazar es borrar): la tabla `canales` que "ya no lee nadie", `sync_runs`
   (solo lectura), restos de `estados_llegada`, columnas sin llamador. Cada una con su conteo de lecturas en el código.
7. **Índices:** los justificados con `EXPLAIN` a 10× el volumen de hoy (C-2) para las consultas de las métricas; los que
   nadie usa. Sin tocar nada: solo el informe.

**Qué NO se hace aquí:** normalizar a ciegas sobre la base de producción. Cada propuesta de cambio de esquema pasa por ADR,
por la cola de migraciones y por las reglas de AGENTS.md (leer el SQL de `drizzle-kit generate`, `SET lock_timeout`, desplegar
primero el código que no usa lo que se quita, y la migración la aplica la sesión principal).

### F4. Centralización de consultas y fórmulas

Solo después de F1 a F3, con la lista de duplicados y divergencias delante. Principios (a decidir con Mani en un grill, ver
"Decisiones abiertas"):

1. **Los hechos son consultas reutilizables (C-2).** Hechos: envío, agenda, cita, venta, abono, gasto. Cada métrica es una
   agregación sobre un hecho, con dimensiones de una lista blanca; la lista detrás de la cifra es la misma consulta sin
   agregar. Donde hoy hay una consulta suelta para una métrica, se reemplaza y se borra (N7).
2. **Un registro de métricas tipado** (propuesta, a decidir): un objeto por métrica con `id`, nombre de negocio, definición
   legible, unidad, ancla de fecha, función, dimensiones permitidas y manejo de cobertura. De ahí salen o contra él se
   verifican: la tabla de `docs/metricas.md` (un test falla si divergen), las etiquetas de las pantallas, el WhatsApp y el
   esquema de salida del MCP. Una métrica que no está en el registro no existe para ninguna superficie.
3. **Cada concepto del §0 de `docs/metricas.md` con un solo módulo y su guardián** (como `tests/venta-una-definicion.test.ts`),
   incluidos los conceptos que hoy no tienen: unidad "persona" frente a "deal" frente a "cita", cobertura, moneda convertida.
4. **Paridad probada con el caso que las haría divergir** (N2), por métrica, desde los casos adversariales de F2.

### F5. Nombres, presentación y las tools del MCP

1. **Un nombre por concepto, de un solo vocabulario (N4/N5)**, en pantallas, WhatsApp y MCP. El glosario de
   `docs/overview.md` §11 es el único lugar. Caso inmediato: "Ventas" (en el rango) frente a "Vendidos del grupo" y "% de cierre".
   Una cifra que tiene dos universos lo dice en su nombre, no en una nota.
2. **Esquema de salida propio de cada tool del MCP (`outputSchema`)**, con nombres de negocio y una descripción por campo.
   Hoy `resumen_del_hub` devuelve el objeto interno de la vista entero (con `dinero.ventas`, `embudo.cierres`), y por eso
   la IA cita nombres de backend. La salida se deriva del registro de F4, no se escribe a mano.
3. **Estandarizar las once tools** según `docs/mcp.md` §4: descripción corta que empieza por cuándo usarla, `title` legible,
   anotaciones completas, `consultar_metrica` con menos parámetros a la vista, nombres consistentes.
4. **Auditar también los rechazos de validación** (el fallo del 7-nov no quedó en `mcp_llamadas`) y aceptar un **mes
   concreto** (`AAAA-MM`) además de los atajos.
5. **EXPLAIN y paridad por tool** (lo que decía el ticket original): cada una con su fila de F1, su `EXPLAIN` a 10×
   volumen y su test contra la pantalla.
6. **Medir el descubrimiento** (ticket 387, frente B): 15 a 20 preguntas reales con herramienta y cifra esperadas, antes y
   después de los cambios de descripciones.

### F6. Contrato del repo para mantener y ampliar métricas y datos

El mismo tipo de contrato que ya existe para el MCP (`docs/mcp.md` §4), pero para **la capa de datos y métricas**,
escrito al final porque debe codificar lo que F1 a F5 enseñen y no suposiciones. Es parte de este ticket, no un
seguimiento opcional. Contiene como mínimo:

1. **Agregar una métrica:** checklist ordenado (definición en `docs/metricas.md` con su fila completa, función única y
   gemela, entrada en el registro de F4, nombre en el glosario, ancla de fecha, moneda, vigencia, frontera de programa,
   cobertura, test de paridad con el caso adversarial, lista detrás de la cifra, superficies que la exponen) y qué guardián
   falla si falta algo.
2. **Cambiar una fórmula:** una enmienda que reescribe en **el mismo commit** el ADR (título e índice), la fila del
   diccionario, el vocabulario, los números dorados de F0 y los tests (N8). Qué hacer con el histórico (¿se recalcula
   hacia atrás? la regla de la fecha ancla).
3. **Agregar una tabla o una columna:** justificación de forma normal, `NOT NULL` y `CHECK` donde corresponda, `vigente()` si
   se anula, programa como frontera, índice justificado con `EXPLAIN`, rastro en `change_log`, qué métricas toca. Regla de
   denormalización: solo con justificación escrita, con un test que compare la copia con su fuente.
4. **Cómo se prueba una cifra:** los números dorados como regresión (si Mani lo aprueba en el grill), contra una base
   sembrada determinista y no contra producción; la paridad entre superficies como test, no como revisión.
5. **Cómo se retira algo:** reemplazar es borrar, cada función que cita el diccionario tiene un llamador fuera de `tests/`.
6. **Dónde vive el contrato:** un documento propio enlazado desde `AGENTS.md` (junto a `docs/mcp.md`) y guardianes en
   `tests/`; el que no se pueda hacer cumplir con un test queda marcado como "revisión manual" con su olor nombrado.
7. **Investigación previa a redactarlo, con fuentes verificadas:** cómo se resuelve esto en la práctica reciente (capas
   semánticas y "metrics as code", dimensiones conformes, contratos de datos). **Sin fuente verificada todavía**: buscar y
   citar antes de escribir, como se hizo para el contrato del MCP, y no copiar un patrón por moda.

### F7. Tickets hijos, orden y migraciones

Al cerrar F3 se escribe el plan: tickets hijos por causa (con dependencias y archivos calientes, como en
`docs/plan-reparto.md`), orden sugerido (primero lo que da cifras falsas hoy, luego duplicados, luego nombres, luego
limpieza), y la cola de migraciones con su ADR cada una. Los siete tickets abiertos del 30-oct se reubican aquí.

## 4. Decisiones abiertas (a resolver con Mani en un grill antes de F4)

1. ¿Registro de métricas tipado como fuente de verdad del diccionario, o el diccionario sigue siendo la fuente y el código
   lo verifica? (Recomendación: registro tipado, con test de que `docs/metricas.md` no diverge. A confirmar tras F1.)
2. ¿Números dorados como test de regresión? ¿Sobre una base sembrada, o sobre un volcado anonimizado de producción?
3. ¿Alcance de F3: todas las tablas desde el inicio, o primero las de hechos y las demás en un segundo pase?
   (Recomendación: hechos primero.)
4. ¿Se detiene el trabajo de pantallas nuevas del Hub mientras F2 no cierre? Una pantalla nueva sobre una cifra ambigua
   multiplica el problema.
5. Los siete tickets abiertos del 30-oct: ¿se ejecutan antes de F4 (y cambian lo auditado) o después (y se auditan
   primero)? (Recomendación: los de cifras falsas, 351, 353 y 354, antes; los de forma, 358 a 361, después de F5.)

## 5. Qué NO es este ticket

Implementar las correcciones (son los hijos de F7), migrar la base (cola de migraciones con ADR), construir gráficas o un
panel del MCP (ticket 387), abrir el MCP a otros roles (383) ni habilitar escrituras (384). El 386 (integridad de las tools
de operación) comparte método con F5 y se coordina con este.

## 6. Done cuando

- [ ] F0: números dorados guardados con fecha y commit; los tickets 351 a 362 reclasificados con evidencia; el ADR 0115
      verificado contra el código (cada guardián muerde).
- [ ] F1: el inventario existe en `docs/auditoria-datos-2026-11.md`, una fila por métrica y superficie, con las nueve
      columnas completas; toda agregación fuera de los módulos del diccionario está listada o justificada.
- [ ] F2: matriz de paridad con las divergencias clasificadas por severidad y clase; el caso 0 (17 contra 11 y las
      unidades del embudo) explicado desde la base.
- [ ] F3: informe por tabla con forma normal, cada denormalización justificada o con ticket para quitarla, los conteos de
      integridad de producción y la lista de lo muerto con sus llamadores.
- [ ] F4: decisiones abiertas resueltas con Mani y el diseño de la centralización escrito (ADR si cambia una regla).
- [ ] F5: nombres unificados en el glosario; `outputSchema` y estándar de descripción en las once tools; rechazos de
      validación auditados; mes concreto aceptado; `EXPLAIN` y paridad por tool.
- [ ] F6: el contrato de métricas y datos escrito con fuentes verificadas, enlazado desde `AGENTS.md`, con sus guardianes.
- [ ] F7: tickets hijos escritos con dependencias, el orden decidido y la cola de migraciones.
- [ ] Tracker y `status:` iguales (N9).

## 7. Pendientes del MCP absorbidos aquí (de la primera prueba, 7-nov)

Quedan cubiertos por F5; se listan para que ninguno se pierda: salida con nombres de backend; dos "ventas" sin distinguir;
latencia del cliente mitigada con las instrucciones del servidor (`lib/mcp/instrucciones.ts`), pendiente de estandarizar las
descripciones y medir otra vez; rechazos de validación sin auditar; ausencia de un mes concreto en el periodo.
