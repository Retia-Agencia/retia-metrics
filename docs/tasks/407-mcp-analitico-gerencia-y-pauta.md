---
id: 407
etapa: mcp
serves: "ADR 0119 · pedido de Mani del 8-nov: acceso analítico libre pero controlado para gerencia y pauta"
depends: [383, 397, 399, 403]
status: en curso  # fase 1 en producción el 18-nov; faltan la llamada real por un cliente y la fase 2
---

# 407 — MCP analítico para gerencia y pauta: datos libres bajo contrato, y un agente proactivo

> **Para una sesión sin contexto.** Lee `docs/mcp.md` entero, el ADR 0119, `docs/contrato-metricas-y-datos.md` y
> `lib/metricas/registro.ts`. Hoy gerente y paid trafficker usan las mismas 11 herramientas fijas que el resto; este ticket
> les da una segunda familia **analítica** y deja a los demás roles (closer, customer success) con herramientas
> deterministas de operación.

## Pedido (Mani, 8-nov)

Para gerencia y pauta, que solo hacen métricas: en vez de definir una herramienta por pregunta, darles acceso **más libre
pero controlado** a la base junto con la definición de las métricas que piden a menudo, para que su agente pueda recuperar
**cualquier dato, métrica o análisis** y se pueda **confiar** en él. Una interfaz clara con un contrato, cerca de la base
cruda pero con las métricas y los cálculos hechos de forma eficiente. Y un MCP **proactivo**: que vaya más allá del pedido
(comparaciones, visualización, análisis más profundo).

## Estado de partida (verificado 8-nov)

- El MCP **no está abierto a otros roles**: solo el developer emite tokens (`puedeConectarIa`). Las herramientas ya filtran
  por rol con `puede()`, y gerente y paid trafficker ya ven `resumen_del_hub`, `consultar_metrica`, `pauta_roas` y
  `origen_del_programa`. Abrirlo es el 383.
- Las métricas oficiales viven en `lib/queries/` y su ficha en `lib/metricas/registro.ts`, pero el registro tiene aún 29
  pendientes: un agente con SQL libre hoy tendría que reinventar "venta", "show" o "lead" (ADR 0115 N1).

## Diseño propuesto (a grillar antes de construir)

1. **Capa semántica de solo lectura, no SQL sobre las tablas crudas.** Un esquema `mcp_lectura` con una vista por hecho
   (envíos, agendas, citas, ventas, abonos, gasto, leads), con las columnas ya limpias (día de Bogotá, moneda, etapa, dueño,
   área y canal derivados) **y con nombres, correos y teléfonos tal cual vienen del CRM: no se censura nada** (decisión de
   Mani, 8-nov; gerencia necesita llegar al detalle de un deal concreto). Lo que ve cada rol es lo que la app le muestra
   (un closer, lo suyo; gerencia, todos los programas que le tocan). Las vistas son las únicas que ve el rol de base del
   MCP. Alternativa descartada: SQL libre sobre `public`, porque saca la frontera de programa (ADR 0043) de la base y deja
   a cada agente reescribir el predicado de una venta.
2. **Una herramienta `consultar_datos`**: un `SELECT` solo sobre esas vistas, en una transacción de solo lectura con
   `statement_timeout`, tope de filas y el alcance de la sesión impuesto **por la base** (los programas visibles de la
   persona se fijan con `set_config` en la transacción y las vistas filtran por ellos). Si el agente se equivoca no ve
   otro programa. Cada llamada va a `mcp_llamadas`.
3. **El contrato de métricas viaja con la herramienta**: `definiciones_de_metricas` (o un recurso MCP) devuelve el registro
   (ficha + fórmula en lenguaje de negocio + ancla de fecha + criterio de closer + cobertura) para que el agente use la
   misma definición. Regla del servidor: **si la pregunta es una métrica registrada, se responde con `consultar_metrica`**
   (cifra oficial, con cobertura); `consultar_datos` es para explorar. **Toda respuesta dice cómo se calculó, en palabras de
   negocio:** la fórmula, qué cuenta y qué no, con qué fecha y moneda, y el periodo y programa. Si coincide con una métrica
   del CRM, lo dice con su nombre («es *Ventas*, igual que el Hub»); si no, dice «no es una cifra del Hub» y muestra
   la fórmula. Así quien la lee juzga sin entender de SQL. La fórmula de una métrica registrada sale de su ficha.
4. **Proactividad** por diseño, no por suerte: (a) las instrucciones del servidor piden ofrecer siempre una comparación con
   el periodo anterior, un desglose y una gráfica; (b) cada respuesta de `consultar_metrica` trae `siguientes_pasos`
   (comparar con el periodo anterior, abrir por canal o campaña, ver la lista, enlace al Hub); (c) *prompts* MCP para los
   análisis habituales (cierre de mes, calidad de leads por campaña, ROAS por anuncio). La gráfica la hace el cliente o,
   más adelante, MCP Apps (387).

## Riesgos y por qué importan

- **Confianza**: sin el registro completo (403) el agente inventa definiciones; por eso depende de él.
- **Frontera de programa y rol**: se garantizan en la base (vistas y alcance por sesión), no en el prompt. Los datos personales no se ocultan: se protegen con el rol y el alcance, igual que en la app.
- **Costo y tiempo**: tope de filas y de tiempo; vistas sobre los índices que ya existen; materializar solo si una medición lo pide.
- **Tentación de saltarse las herramientas oficiales**: toda respuesta muestra su fórmula y dice si es una cifra del Hub; las oficiales no se recalculan.

## Preguntas abiertas para Mani

1. ¿Pauta puede ver dinero de ventas y comisiones, o solo gasto, ROAS, origen y calidad de leads?
(Resuelto 8-nov: no se censura ningún campo que la app ya muestre a ese rol, nombres incluidos. Closer y customer success
ven nombres porque su trabajo es operar; el MCP de operación mantiene sus herramientas deterministas.)

## Done cuando

- [x] Grill con Mani y ADR del diseño (esquema `mcp_lectura`, alcance por sesión, fórmula en cada respuesta): `docs/adr/0135-el-mcp-lee-datos-con-sql-por-un-usuario-de-base-propio.md`. El `set_config` de la idea original se descartó: el agente lo puede llamar.
- [x] Migración de las vistas y del rol de solo lectura: `drizzle/0152_mcp_lectura_407.sql`, **aplicada en producción el 18-nov** con el ok de Mani. El rol `mcp_lectura_login` tiene LOGIN con contraseña aleatoria (no está escrita en ningún archivo) y `DATABASE_URL_MCP_LECTURA` está en Vercel › Production como sensible. Prueba real por el pooler: sin alcance ve 0 programas; `set_config('role','postgres')`, `public.deals` y fijar el alcance dos veces se rechazan. Tras el deploy de `87677ab8`, `capacidades` ya lista `consultar_datos` para el developer.
- [x] `consultar_datos` y `definiciones_de_metricas` con tests: programa ajeno, escritura rechazada, tope de filas y de tiempo, alcance por rol (pauta no ve al equipo comercial; closer y customer success no tienen la herramienta), la fórmula en cada respuesta, paridad de cada vista con su módulo de `lib/queries/hechos`.
- [ ] `siguientes_pasos` en `consultar_metrica`, *prompts* MCP y paridad con `consultar_metrica` en cada métrica registrada (fase 2, junto con que `lib/queries/hechos` lea las vistas).
- [x] Una sola definición por hecho (21-nov, decisión de Mani): `crm_definicion.*` en SQL sin alcance, las vistas de `mcp_lectura` la envuelven (migración `drizzle/0160_definiciones_unicas_407.sql`, **sin aplicar** hasta el ok de Mani), `lib/queries/hechos/agenda.ts` y `cita.ts` la leen; envíos, ventas, abonos y gasto siguen en TypeScript, comparados en `tests/mcp-definicion-unica.test.ts`.
- [ ] Revisión de petición forjada con el token de un gerente limitado y de un paid trafficker (por la ruta real, con la migración aplicada).
- [x] Escape probado contra Postgres real: `tests/mcp-lectura-postgres.test.ts` (`set_config('role')`, `SET ROLE`, `RESET ROLE`, `query_to_xml`, segunda llamada a `fijar_alcance`, tiempo, alcance concurrente).
