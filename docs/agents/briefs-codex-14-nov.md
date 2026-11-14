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

## B-4 · 427 página propia del reporte diario, todos los programas (Mani, 14-nov: no es un Ctrl+P del Hub)
**Hacer:** ruta `/hub/reporte` (`app/(app)/hub/reporte/page.tsx`), pensada como documento corto: **1. El día** (meta contra real de cupos y leads;
caja del día; por programa agendas, realizadas, show, ventas y % de cierre; y lo mismo por closer), **3. La semana** (meta de la semana, a la fecha y
real; meta diaria para llegar a la del corte) y **4. El corte** (vendidos contra meta de la cohorte y cumplimiento), un programa al lado del otro,
con el pie "Datos del CRM al <fecha y hora> (Bogotá)". Referencia visual y de contenido: `/Users/mani/Desktop/mani/work/retia/reportes diarios/Reporte-Diario-Retia-2026-09-15-v5.pdf`.
Botón "Guardar como PDF" = `window.print()` sobre esta página, con `@media print` (sin librerías, ADR 0006). **Cero cálculo nuevo**: cada cifra sale de lo que Hub › Hoy
y Comercial ya calculan (módulos de `lib/queries/`), solo magnitudes sumables en el total; tasas, meta y ROAS por programa, nunca sumadas (ADR 0048).
Solo programas activos y visibles para la sesión. El paid trafficker no ve el equipo comercial (`sinListas`).
**No entra:** "Los masivos" y los párrafos narrativos por closer (el CRM no los tiene).
**Tests:** tres programas sembrados dan por programa las mismas cifras que Hub › Hoy; el paid trafficker no ve closers; un programa fuera del alcance responde 404.
**Ojo:** `lib/hub/` y los componentes de Comercial, Dinero y Hoy son del carril P: se importan los módulos de `lib/queries/`, no se editan.

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

## B-7 · Retirar del código lo de Second Brain Jurídico y Form30x (el programa ya se borró de la base el 14-nov)
**Hecho ya (Claude):** programa y todo lo suyo borrado de producción (respaldo en `work/retia/backups/second-brain-juridico-2026-11-14.json`, fuera del repo);
`CALENDLY_ACCESS_TOKEN_SB_JURIDICO` y `FORM_30X_API_KEY` fuera de `.env.local` y de Vercel.
**Hacer:** quitar `lib/form30x/` (`api.ts`), el proveedor `form30x` de `lib/ingesta/proveedores.ts` y su adaptador (`lib/ingesta/adaptador-form30x.ts`), el valor
del enum `proveedor_formulario` **solo si ninguna fila lo usa (migración: la genera Claude)**, los fixtures `tests/fixtures/form30x-*.json`, los tests que
los usan, el guardián del 272, el comentario de `lib/calendly/pertenencia.ts` y la mención en `tests/calendly-filtro-evento.test.ts`; marcar los ADR 0092 y 0093
como retirados en `docs/adr/README.md` (índice de retirados) y limpiar `docs/operations.md`. **Ojo:** el valor del enum se quita al final y aparte; typecheck,
lint y los tests de ingesta (`tests/contrato-proveedores.test.ts`, `tests/ingesta-*.test.ts`) deben seguir verdes.
**No toca:** Typeform, Dapta, Calendly de los otros programas.
