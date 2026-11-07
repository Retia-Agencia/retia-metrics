---
id: 385
etapa: mcp
serves: "ADR 0119 · ADR 0115 (N1 a N3: un concepto un módulo, paridad probada, cobertura) · C-2 de docs/hub.md §8"
depends: [348]
status: todo
---

# 385 — Integridad de las tools de métricas del MCP y auditoría del modelo de datos

> **Distinción (Mani, 6-nov):** el 348, el 383 y el 384 **montan el MCP** (servidor, identidad, roles, adaptadores).
> Este ticket y el 386 **definen y verifican las tools**: que lo que devuelven sea correcto, eficiente y coherente.
> Son trabajo aparte y no se dan por hechos porque el MCP ya responda.

## Qué se verifica

1. **Las tools no tienen consultas propias.** Cada tool de métricas es un adaptador sobre una función de `lib/queries/`
   (la misma que usa la pantalla). Se audita que ninguna tool lea tablas por su cuenta (el guardián de `lib/mcp/` lo
   exige) y que cada métrica tenga **una** definición, la de `docs/metricas.md` §0.
2. **Las consultas detrás están optimizadas y probadas.** Por cada métrica que expone una tool: `EXPLAIN` a 10× el volumen
   de hoy (C-2), índices justificados, paginación en SQL, y paridad con la cifra de la pantalla con el caso que las haría
   divergir (anulados, otro programa, moneda). El resultado queda escrito junto a la función o en `docs/metricas.md`.
3. **El modelo de datos sirve a lo que se pregunta.** Revisión de las tablas contra las cuatro formas normales:
   redundancia, columnas denormalizadas (hoy `lead_contactos.program_id`, el resumen del lead que se recalcula),
   dependencias transitivas, textos que deberían ser FK. Cada denormalización existente se **justifica o se propone
   quitar** con su costo; nada se normaliza a ciegas sobre la base de producción (migraciones: AGENTS.md).
4. **Cobertura (N3).** Toda tool que devuelve una razón dice su cobertura; se verifica tool por tool.

## Entregable

Un informe en `docs/` con hallazgos por tabla y por métrica, y tickets hijos para lo que haya que cambiar. Sin migraciones
dentro de este ticket: las propuestas pasan por ADR y por la cola de migraciones.

## Done cuando

- [ ] Cada tool de métricas tiene su fila: función de `lib/`, definición en `docs/metricas.md`, `EXPLAIN`, test de paridad.
- [ ] Informe de formas normales con cada denormalización justificada o con ticket para quitarla.
- [ ] Tracker y `status:` iguales (N9).

## Hallazgos de la primera prueba real (Mani, 7-nov, Claude Code contra producción)

Pregunta: "¿cuántas ventas tuvo Tactical en octubre?". Respuesta: 17 ventas, USD 25.350 vendidos, 18.175 recaudados, 7.175 por cobrar.

1. **Una métrica, un solo lugar, y las derivadas con su cálculo escrito.** El modelo vio dos números para "ventas" en la
   misma respuesta: 17 (ventas del periodo) y 11 (deals vendidos dentro del grupo del embudo, la base de las tasas: citas
   ocurridas con show). Los dos son correctos en el Hub, pero miden cosas distintas y el MCP los entrega sin distinguirlos.
   La auditoría de este ticket debe: (a) listar cada métrica que `resumen_del_hub` y `consultar_metrica` exponen, con su
   única función de origen y su fórmula; (b) renombrar o separar lo que hoy comparte nombre; (c) probar que MCP y Hub dan
   la misma cifra por programa y periodo. También quedó medido un hueco de datos real: 290 citas de octubre sin resultado
   marcado (cobertura del 20 %), que hace subestimar el cierre sobre shows.
2. **El resultado de `resumen_del_hub` es el objeto interno de la vista (`vista`) completo**, con nombres de campo de
   backend (`dinero.ventas`, `embudo.cierres`). Por eso el modelo cita campos en la fuente. Definir un esquema de salida
   propio, con nombres de negocio y descripciones por campo (`outputSchema`), y dejar la vista interna fuera. Ya se
   mitigó la forma de responder con las instrucciones del servidor (`lib/mcp/instrucciones.ts`, 7-nov); el esquema propio
   es la solución de fondo.
3. **Latencia: no es del servidor.** La bitácora midió 96 ms (`programas_visibles`) y 890 ms (`resumen_del_hub`); los ~40 s
   fueron del cliente cargando y escogiendo herramientas. Mitigado con `instructions` (qué herramienta usar para qué).
   Pendiente de estandarizar en las once: descripción corta que empiece por "Usa esto cuando…", `title` legible,
   anotaciones completas (`readOnlyHint`, `idempotentHint`, `openWorldHint: false`) y `consultar_metrica` con menos
   parámetros visibles de golpe (hoy es la descripción más larga y el esquema más ancho). Medir otra vez después.
