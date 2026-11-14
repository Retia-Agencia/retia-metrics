# Briefs para Codex (14-nov), cada uno cabe en una sesión limpia

Reglas comunes a todos: leer `AGENTS.md`; effort `medium`; **no corre `db:generate` ni `db:migrate` ni la suite completa**
(si hace falta una migración, para y lo dice); commits con archivos nombrados; no toca `lib/hub/` ni los componentes de
Comercial, Dinero y Hoy (carril P, Alejo); al terminar: typecheck, lint y los tests de su ticket, y un resumen de qué cambió y
qué no verificó. Claude revisa el diff y marca el ticket.

## B-1 · 411 F4, medición del MCP (la migración 0143 ya está aplicada)
**Hecho ya:** `mcp_llamadas.bytes_respuesta` y `mcp_llamadas.consultas` existen (nulas) en `lib/db/schema.ts`.
**Hacer:** (1) `lib/mcp/bitacora.ts` escribe los dos campos por llamada: bytes = largo en UTF-8 de la respuesta serializada; consultas =
número de sentencias SQL que ejecutó la herramienta (contador por llamada, sin tocar cada herramienta una por una: un envoltorio
en el punto donde ya se mide `duracion_ms`). (2) `scripts/informe-mcp.ts` agrega por herramienta p50 y p95 de bytes y el promedio
de consultas, y marca las respuestas por defecto sobre un tope de bytes que se define como constante con su razón. (3) Un script de
solo lectura que corra `EXPLAIN` de las consultas de `lib/queries/hechos/` contra la base local sembrada a 10× el volumen de hoy y
liste las que hacen Seq Scan sobre tablas grandes.
**Tests:** `tests/mcp-bitacora-medicion.test.ts` (una llamada real por `/api/mcp` deja bytes > 0 y consultas ≥ 1; una llamada
anterior sin valores no rompe el informe).
**No hace:** migraciones, índices nuevos (solo los lista), cambios de respuesta de ninguna herramienta.
**Listo cuando:** casilla "F4 Medición" del ticket 411 marcada con el comando del informe y su salida.

## B-2 · 411 F5, evaluaciones de preguntas reales
**Hacer:** `tests/mcp-evaluaciones.test.ts` con 8 a 10 preguntas reales (la de Alexander del 9-nov, la cesión de A-177, ventas de la
semana por closer, cartera vencida, ROAS de un programa, deal por etapa…) sobre una base sembrada; cada una declara las
herramientas esperadas y el **número máximo de llamadas** (la pregunta del 9-nov: 1). El test ejecuta la secuencia mínima contra los
handlers reales y falla si hace falta más de lo declarado. `capacidades()` ya existe (F3): solo se verifica que cada pregunta se
descubra desde ahí.
**No hace:** conectar un cliente real (lo hace Mani, ver abajo), herramientas nuevas.
**Listo cuando:** casilla "F5 Descubrimiento y evaluaciones" marcada.
**Lo que NO es de Codex (Mani con Claude):** `claude mcp add` contra producción y comparar una cifra (ventas de un programa en un mes
cerrado) en MCP, Hub y mensaje de WhatsApp.

## B-3 · 358 formato y nombres de las cifras del mensaje de WhatsApp (DM-1 resuelta: los colores 🟢🟡🔴 se quedan)
**Los rótulos de estado NO cambian** (Mani, 14-nov): el mensaje sigue con 🟢🟡🔴 y "verde/amarillo/rojo".
**Hacer:** cada cifra de `lib/reporte-whatsapp/mensaje.ts` toma su rótulo de `lib/vocabulario-metricas.ts` y su formato de
`lib/format.ts`; claves nuevas en `lib/reporte-whatsapp/conceptos.ts` para gasto y agendas (con 429 D-2: `agendas_meta` tiene clave
propia); dorado: el mismo día sembrado da el mismo número en el mensaje y en Hub › Pauta (`tests/numeros-dorados-pauta.test.ts` es el molde).
**No hace:** cambia el cálculo, ni toca Juanito (manda el texto tal cual).

## B-4 · 427 PDF del reporte diario de todos los programas (decisión: `window.print()`, sin servidor)
**Hacer:** una hoja `@media print` para `/hub` ("todos"; `app/(app)/hub/page.tsx`, `components/dashboard/reporte-diario.tsx`,
`components/dashboard/descargar-reporte.tsx` ya existen): una sección por programa visible para la sesión, solo magnitudes sumables
en el total y tasas, meta y ROAS por programa lado a lado; pie "Datos del CRM al <fecha y hora> (Bogotá)" y la URL. El paid trafficker
no ve el equipo comercial (`sinListas`). Sin librerías nuevas (ADR 0006).
**Tests:** un cuadro de tres programas sembrado da por programa las mismas cifras que Hub › Hoy; el paid trafficker no ve nada del equipo.
**Ojo:** `lib/hub/` y los componentes de Hoy son del carril P. Si hace falta tocarlos, parar y pedírselo a Alejo; el CSS de impresión y el
componente del reporte son de este ticket.
**Listo cuando:** casillas 2 a 4 del 427; la vista previa de impresión se mira a mano (Mani).

## B-5 · 428 aviso de registros pendientes por closer (decisiones D-1 a D-4 escritas en el ticket; D-2 y D-3 provisionales)
**Hacer:** (1) `lib/pendientes-de-closer/contrato.ts` (`.strict()`, molde `lib/alertas/contrato.ts` y `tests/semaforo-endpoint.test.ts`): por closer,
sus deals con lo que le falta a cada uno y el texto armado en el CRM. (2) Endpoint `POST /api/pendientes/avisos` con secreto en cabecera (molde
`app/api/salud/alertas`): devuelve los avisos que toca mandar ahora y `/confirmar` marca los mandados (molde `estudiantes-nuevos`, ADR 0128). (3) Lo que
cuenta como pendiente sale de lo que ya calcula la bandeja: `lib/queries/inbox.ts`, `porMarcarPorCloser` de `lib/deals/resultados-de-llamada.ts`; cero
cálculo nuevo. (4) El destinatario es el WhatsApp del closer (`usuarios_whatsapp`, ya existe).
**Migración:** probablemente una tabla de avisos enviados (como la del 408). **Para y avisa**: la genera Claude.
**Tests:** un closer solo recibe lo suyo (forjar con otro), 401 sin secreto, no repite dentro de la ventana de silencio.
**No hace:** Juanito (ticket aparte en su repo), ni cambia la bandeja.

## B-6 · 429 las tres filas sin fuente (casi todo documentos; puede hacerlo Claude)
Medir qué cuenta hoy el código de Envíos (`lib/queries/hechos/`), reescribir las filas de `docs/metricas.md` con la regla de `objetivo_semana`
(`lib/metricas/pendientes.ts`) y dar clave propia a `agendas_meta` en `lib/metricas/registro.ts`, con ficha. Decisiones ya escritas en el ticket 429.
