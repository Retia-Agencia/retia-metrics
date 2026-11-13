# El MCP del CRM: arquitectura y contrato de mantenimiento

> **Para quién:** quien mantenga o amplíe el MCP (hoy Mani como developer). Es la fuente única de *cómo está armado* y
> *cómo se cambia sin romperlo*. El *por qué* de cada decisión vive en el [ADR 0119](./adr/0119-el-mcp-del-crm.md); el avance en
> los tickets 348, 383, 384, 385 y 386; cómo conectarse y revocar, en `operations.md` §8.1. Si algo de aquí contradice al
> código, manda el código (ADR 0115 N8) y este archivo se corrige en el mismo commit.
> Última revisión: 13-nov-2026.

## 1. Qué es y dónde vive

Un **servidor MCP remoto dentro de la propia app de Next** (no hay otro servicio ni otro repo). Responde en
`/api/mcp`, corre en el mismo despliegue de Vercel (runtime Node) que el CRM y lee la misma base. Se despliega con el
mismo `git push` a `main`. Habla *Streamable HTTP* y es **sin estado**: cada petición HTTP arma su propio servidor y lo
descarta, así que escala como cualquier route handler.

Lo mantiene quien mantenga el repo: no hay nada que operar aparte. La lectura es abierta dentro del rol y del alcance:
`capacidades` descubre qué consultas existen, `buscar` encuentra una persona sin exigir conocer el programa y las consultas
de hechos cubren listas y conteos sin crear una herramienta por pregunta. Cambiar una herramienta es cambiar TypeScript en
`lib/mcp/`, probarlo y empujar.

```
Cliente de IA (Claude Code, claude.ai, ChatGPT...)
   │  POST /api/mcp   Authorization: Bearer retia_mcp_…
   ▼
app/api/mcp/route.ts ── withMcpAuth ──► verificarToken (lib/mcp/token.ts)
   │                                      └─ hash sha256 → mcp_tokens ⋈ users(activo)
   ▼
atender(): sesionDeToken (lib/mcp/sesion.ts)   ← rol y alcance FRESCOS desde users
   │
   ▼
createMcpHandler → registrarHerramientas (lib/mcp/servidor.ts)
   │   solo registra las herramientas cuyo `puede(contexto)` es verdadero para ese rol
   ▼
por cada tools/call:
   1. tope por minuto            (lib/mcp/bitacora.ts → mcp_llamadas)
   2. sesión otra vez + `vista`  (solo developer puede "ver como")
   3. zod .parse(entrada)        (esquema estricto de la herramienta)
   4. herramienta.ejecutar()     (lib/mcp/herramientas/*.ts)  ──► lib/queries/*  (la MISMA consulta que usa la pantalla)
   5. registrarLlamada           (sin argumentos; con a quién se suplantó)
```

## 2. Qué archivos dictan qué

| Archivo | Dicta |
|---|---|
| `app/api/mcp/route.ts` | La puerta: autenticación del bearer, 401 vacío con challenge, armado del servidor por petición. Sin lógica de negocio. |
| `app/.well-known/oauth-protected-resource/**` y `lib/mcp/recurso-protegido.ts` | Metadata pública RFC 9728 para que el cliente descubra cómo autenticarse. El 383 llena aquí los servidores OAuth. |
| `proxy.ts` | `/api/mcp` y `/.well-known/oauth-protected-resource*` son públicos para la cookie de Auth.js (el MCP valida su propio bearer). |
| `lib/mcp/token.ts` | Emitir, verificar y revocar tokens (formato `retia_mcp_…`, solo se guarda el hash, scope lectura/escritura). **Uno de los cuatro límites con SQL.** |
| `lib/mcp/vistas-previas.ts` | Guarda, consume atómicamente una sola vez y conserva el resultado de las vistas previas de escritura. |
| `lib/mcp/sesion.ts` | Convierte un token en una `Session` del CRM con rol y alcance revalidados en cada llamada. Es lo que hace que quitar a alguien lo saque ya. **SQL permitido.** |
| `lib/mcp/bitacora.ts` | Tope de 300 llamadas/minuto por token y registro de cada llamada. **SQL permitido.** |
| `lib/mcp/servidor.ts` | Registra las herramientas, aplica el flujo de arriba, traduce errores a `isError` sin filtrar detalles internos. |
| `lib/mcp/instrucciones.ts` | El campo `instructions` del servidor: qué herramienta usar para qué y cómo responder en lenguaje de negocio. |
| `lib/mcp/herramientas/tipos.ts` | El contrato TypeScript de una herramienta (`Herramienta`). |
| `lib/mcp/herramientas/index.ts` | **El registro exhaustivo** `HERRAMIENTAS`. Una herramienta que no está aquí no existe. |
| `lib/mcp/herramientas/{programas,metricas,operacion,decisiones,hechos,capacidades}.ts` | Las herramientas, agrupadas por familia. Adaptadores delgados. |
| `lib/mcp/vocabulario.ts` | Vocabulario canónico de identificadores y alias retrocompatibles de entrada. |
| `lib/queries/hechos/registro.ts`, `lib/queries/resolver-filtros.ts` | Registro exhaustivo de hechos consultables y resolución de nombres o ids antes de consultar. |
| `lib/mcp/herramientas/{programa,periodo}.ts`, `lib/mcp/enlaces.ts` | Piezas compartidas: resolver un programa visible, el periodo en formato MCP (atajo, `custom` con desde y hasta, o un mes `AAAA-MM`; el esquema del mes y su rango viven en `lib/periodo.ts` y los comparte con la URL), los enlaces al CRM. |
| `lib/auth/roles.ts` | **Quién puede qué.** Cada herramienta pregunta a una función de aquí; nunca compara un rol a mano. |
| `lib/queries/*` | Las consultas y reglas que las pantallas **y** las herramientas comparten (filtros, proyecciones por rol, alcance). El MCP no define ninguna métrica. |
| `lib/db/schema.ts` (`mcpTokens`, `mcpLlamadas`) y `drizzle/0117_*` | Las dos tablas propias del MCP (RLS activo). |
| `app/oauth/autorizar/**`, `app/(app)/mi-espacio/acciones.ts` y `components/mi-espacio/conexiones-de-ia.tsx` | Consentimiento, conexiones propias y revocación. La tarjeta muestra la dirección del MCP (`urlDelRecurso()` de `lib/oauth/origen.ts`, calculada en la página y pasada por props) con los pasos de Claude y ChatGPT (ticket 409). Todos conectan mediante `puedeConectarIa`; solo el developer emite claves manuales con `puedeCrearTokenPersonal`. |
| `tests/mcp-*.test.ts` | Las pruebas, incluido el guardián de dominio y el de contrato (§6). |

## 3. Las herramientas y quién las ve

Las consultas son de solo lectura. Las escrituras siguen el molde preparar → confirmar → deshacer, requieren scope de escritura y desaparecen durante una suplantación. El developer pasa toda guarda (ADR 0025). "Programa visible" = el alcance del usuario (ADR 0048/0094).
`tools/list` depende de la credencial, no de una vista por llamada; con «Ver como», `capacidades` devuelve `acciones: []` y el servidor vuelve a validar cada herramienta contra el rol efectivo.

| Herramienta | Título | Cuándo usarla | Roles |
|---|---|---|---|
| `programas_visibles` | Programas visibles | Para saber qué programas puede consultar la persona y obtener su slug | todos |
| `capacidades` | Capacidades | Para descubrir las consultas y, con detalle esquema, sus filtros, dimensiones y medidas | todos |
| `resumen_del_hub` | Resumen del Hub | Para responder con las cifras principales de un periodo: ventas, dinero, citas, realizadas y tasas | gerente, paid trafficker |
| `consultar_metrica` | Consultar una métrica | Para explicar una métrica, filtrarla o abrir sus desgloses y filas | gerente, paid trafficker, closer (según la métrica) |
| `consultar_hechos` | Consultar hechos | Para listar o agrupar envíos, agendas, citas, ventas, abonos y gasto nativo | gerente, paid trafficker (sin trabajo por closer) |
| `buscar` | Buscar en el CRM | Para encontrar una persona, sus deals, llamadas y último traspaso, con una sección por programa | gerente, closer |
| `buscar_leads` | Buscar personas | Para encontrar una persona por nombre, correo o teléfono | gerente, closer |
| `ficha_de_lead` | Ficha de una persona | Para consultar el detalle de una persona ya identificada | gerente, closer, customer success (proyección reducida) |
| `ficha_de_deal` | Ficha de un deal | Para consultar la historia operativa de un deal ya identificado | gerente, closer |
| `tablero_de_deals` | Tablero de deals | Para ver o filtrar el pipeline comercial completo, paginado | gerente, closer |
| `opciones_de_filtros` | Opciones de filtros | Para descubrir los valores permitidos por el rol; pauta no recibe dueños ni dimensiones por closer | gerente, closer, paid trafficker |
| `bandeja` | Bandeja de pendientes | Para ver el trabajo operativo pendiente del día | gerente, closer |
| `cartera_vencida` | Cartera vencida | Para saber quién tiene saldos vencidos, paginado | gerente, closer, customer success |
| `pauta_roas` | ROAS de pauta | Para evaluar pauta por total, campaña, conjunto o anuncio | gerente, paid trafficker |
| `origen_del_programa` | Origen del programa | Para entender de dónde llegaron los registros | gerente, paid trafficker |
| `preparar_accion` | Preparar una acción | Para revisar antes y después, permisos y requisitos sin cambiar el negocio | quien tenga scope de escritura; la acción decide el rol |
| `confirmar_cambio` | Confirmar un cambio | Para aplicar una vista previa vigente una sola vez, solo tras el sí explícito | quien tenga scope de escritura y no esté suplantando |

Las acciones disponibles son `mover_etapa`, `deshacer_evento`, `marcar_show`, `pegar_grain`,
`corregir_resultado`, `registrar_abono`, `cambiar_plataforma_de_abono`, `anular_deal`,
`anular_abono`, `anular_llamada`, `marcar_fallida` y `asignar_llamada_suelta`. Todas llaman el mismo caso de uso que la app y vuelven a
validar el alcance: un deal, una llamada o un abono de otro programa responde 404 y no revela que
existe.

**Decisión de Mani del 13-nov (deshacer igual que la app):** solo `mover_etapa` y `registrar_abono`
devuelven un evento para deshacer. `registrar_abono` devuelve el evento de creación del abono: al deshacerlo, el abono deja de contar
y el deal recalcula su etapa. `marcar_show`, `pegar_grain`, `corregir_resultado`,
`marcar_fallida` y `asignar_llamada_suelta` no se deshacen en un paso, igual que la app; la vista
previa indica cómo corregir el resultado. `cambiar_plataforma_de_abono` tampoco: la app no deshace
ese cambio ("un pago mal registrado se deshace anulando el abono"), y si quedó mal se vuelve a
cambiar. `anular_deal`, `anular_abono` y `anular_llamada` tampoco
se deshacen, igual que la app, y su vista previa dice «Una anulación no se puede deshacer». Esto
corrige la afirmación de D3 de que toda escritura se deshace.

**Decisión de Mani del 13-nov:** sin enlace del comprobante el abono se registra en la app,
donde se adjunta el archivo y se revisa antes de mover el deal. Por eso `comprobante_url` es
obligatorio solo en `registrar_abono` del MCP; no cambia la regla de la app.

`marcar_fallida` y `asignar_llamada_suelta` entran como en la app. La vista previa avisa solo si
la operación tocará Calendly. La escritura del CRM se confirma primero y la cancelación en
Calendly corre después del commit; si falla, la escritura no se revierte, queda pendiente y el
deal recibe una nota para reintentar. Esta es una decisión de Mani del 13-nov. Con el mismo
mecanismo, `pegar_grain` agenda la lectura de la grabación en Grain solo después del commit de la
fila (revisión adversarial del 13-nov): si la fila falla, no queda ninguna lectura agendada.

Quedan pendientes `reagendar`/`agendar`, la **reversión compuesta de una operación** y
**deshacer una anulación** (una regla nueva de app bajo ADR 0026/0038). Crear plataforma no será
una acción: es mantenimiento de catálogo.

`detalle` decide entre la proyección `compacta` y `completa` en `buscar`, `ficha_de_lead` y
`tablero_de_deals`. En el tablero, `vista` nombra exclusivamente las columnas del Kanban
(`llamada`, `setteo` o `todo`); sus valores válidos salen del mismo esquema que usa la pantalla.

## 4. Contrato de herramientas (qué se exige y de dónde sale)

Estas reglas se aplican a **toda** herramienta nueva o modificada. Las marcadas con 🔒 las hace cumplir un test
(`tests/mcp-contrato.test.ts` y `tests/mcp-guardian.test.ts`); las demás se revisan a mano.

**Identidad y permisos**
1. 🔒 **Cada herramienta declara `puede(contexto)` con una función de `lib/auth/roles.ts`.** Nunca `rol === "..."` ni
   `session.user.rol`. Si ninguna función encaja, la pregunta nueva se agrega en `roles.ts`. *(ADR 0025, 0119.)*
2. **Una herramienta no inventa una proyección por rol: reutiliza la de la pantalla** y la prueba contra ella. *(ADR 0115 N1/N2.)*
3. **El programa es una frontera.** Todo acceso pasa por `programaVisible`; un programa ajeno responde "No existe ese programa", igual que uno inexistente (404, no 403). *(ADR 0043/0048.)*
4. 🔒 **`lib/mcp/` no hace SQL** salvo `token.ts`, `sesion.ts` y `bitacora.ts`. Los datos salen de `lib/queries/`. *(ADR 0119.)*
5. Los identificadores que entran o salen son **ids opacos o códigos opacos**, nunca correos ni teléfonos en un id. *(AGENTS.md.)*

**Entrada**
6. 🔒 **Esquema zod `.strict()`**, parámetros con nombres del vocabulario único de `lib/mcp/vocabulario.ts`, y **toda cadena con tope de longitud** (`max`). Los alias de entrada se normalizan al nombre canónico antes de validar; `id` conserva compatibilidad solo donde la herramienta declara a qué identificador equivale. El servidor **valida todas las entradas** (spec MCP, "Security Considerations").
7. **Listas largas se paginan en SQL** con `total`, `hay_otra_pagina` y un tope por defecto; nada se carga entero para recortarlo en memoria. *(Anthropic, "Writing tools for agents": paginación, filtros y truncado con valores por defecto.)*
8. **Pocas herramientas de alto alcance:** `buscar` resuelve la búsqueda global y `consultar_hechos` las listas y conteos base; no se envuelve cada consulta en una herramienta nueva. *(Anthropic, ídem: consolidar y preferir búsqueda.)*

**Salida**
9. Toda respuesta trae **texto legible para una persona de negocio** y `structuredContent` con el dato. Cada monto lleva su moneda; "—" significa que no se puede calcular; toda tasa trae su cobertura. *(ADR 0115 N3/N5.)*
10. **No se devuelve la vista interna de una pantalla tal cual.** Cada herramienta traduce la consulta canónica a un objeto con nombres de negocio; publica su `outputSchema` con una descripción por campo y el servidor valida `structuredContent` antes de responder. Las claves de cifras salen de `lib/vocabulario-metricas.ts`, y unidad y monedas de `lib/metricas/registro.ts` cuando ya existe ficha. `salida` es obligatoria en `Herramienta` y el servidor la publica y la valida siempre. Las etapas salen como `{clave, nombre}` y el dinero como `{valor, moneda, legible}`. *(ADR 0115 N4/N8; Anthropic: devolver campos de alta señal y no identificadores crípticos.)*
11. **Cada entidad enlaza al CRM** (`lib/mcp/enlaces.ts`), para que el modelo cite y la persona verifique.
12. **Errores accionables.** Un error de negocio se devuelve como `isError: true` con un mensaje que dice qué corregir; un filtro por nombre o id que no resuelve falla con sus opciones, **nunca se convierte en cero filas silenciosas**. Un error interno responde "Error interno." sin detalle (🔒 `mcp-ruta`). Los errores de protocolo (herramienta desconocida) los maneja el SDK. *(Spec MCP, "Error Handling".)*

**Descubrimiento (que el modelo escoja bien y rápido)**
13. 🔒 **Nombre en `snake_case` ASCII, único, de 1 a 64 caracteres**, con la forma `verbo_o_sustantivo` consistente con las demás. *(Spec MCP: nombres únicos, 1 a 128 caracteres y solo letras, números, `_`, `-`, `.`.)*
14. **Descripción como para una persona nueva en el equipo:** primero cuándo usarla, luego qué devuelve y qué no hace; términos propios explicados. Corta y sin repetir lo que dice el esquema. *(Anthropic: escribe las descripciones como para un recién llegado y refínalas con evaluaciones.)*
15. 🔒 **Toda herramienta aparece en `INSTRUCCIONES_MCP`** (`lib/mcp/instrucciones.ts`) con la pregunta que resuelve, y en la tabla de §3. Sin esto el cliente no la encuentra a tiempo (el 7-nov una consulta tardó ~40 s en el cliente, no en el servidor: 96 ms y 890 ms medidos en `mcp_llamadas`).
16. 🔒 **Título y anotaciones:** cada herramienta publica un título legible. Las lecturas declaran `readOnlyHint` e `idempotentHint`; `confirmar_cambio` declara ambos falsos y `destructiveHint` verdadero. `openWorldHint` es siempre falso. Las anotaciones son pistas no confiables para el cliente: **la seguridad la dan las guardas del servidor, nunca la anotación**. *(Spec MCP.)*
17. **La lista de herramientas es determinista y puede variar por credencial**, nunca por conexión: hoy se filtra por rol con `puede`. Mantener el orden de `HERRAMIENTAS` estable ayuda a la caché de prompts del cliente. *(Spec MCP, "Capabilities".)*

**Operación**
18. 🔒 **Toda llamada deja rastro sin argumentos** y hay **tope por minuto**. **También un rechazo del esquema** (el SDK valida antes del handler: `auditarRechazosDeEntrada` en `lib/mcp/servidor.ts` envuelve ese paso): queda `error` con `ENTRADA_INVALIDA:<campos que fallaron>`, sin valores (`tests/mcp-rechazos.test.ts`). Los accesos OAuth duran una hora, el refresh 90 días, los tokens personales nuevos un año y `mcp_llamadas` conserva 90 días. *(Spec MCP: limitar la tasa y registrar el uso.)*
19. **No hay passthrough de tokens.** El servidor solo acepta tokens emitidos para él (`retia_mcp_…`) y nunca reenvía el del cliente a otro servicio. *(MCP, "Security Best Practices": token passthrough es un anti-patrón.)*
20. **Las escrituras se descubren por `capacidades` y entran por `preparar_accion` + `confirmar_cambio`** (decisión D1, 12-nov): vista previa de diez minutos, confirmación humana explícita, consumo atómico una sola vez, scope `escritura`, rastro con origen `mcp` y deshacer (ADR 0042/0117). Cada fila del lote se confirma en su propia transacción y se rechaza si el deal cambió. El resultado de cada fila se guarda en la MISMA transacción que la fila: una fila con resultado se aplicó y una sin resultado no. Confirmar de nuevo con el mismo token devuelve lo guardado y no vuelve a aplicar nada. **Riesgo aceptado (13-nov):** si ese reintento llega mientras la primera confirmación todavía aplica filas, dice «no se aplicó» de las que aún no terminan; preparar de nuevo no duplica nada, porque su huella ya cambió y la fila se rechaza.

## 5. Recetas

**Agregar una herramienta de lectura**
1. Si la pregunta ya la responde una pantalla, extrae su consulta a `lib/queries/` (si no está) y úsala en las dos.
2. Define la herramienta en el archivo de su familia (`herramientas/*.ts`) con la forma de `tipos.ts`.
3. Regístrala en `HERRAMIENTAS` (`herramientas/index.ts`).
4. Agrégala a `INSTRUCCIONES_MCP` y a la tabla de §3.
5. Tests en el archivo de su familia: permiso por rol, programa ajeno, paridad con la pantalla, entrada inválida.
6. `npm run typecheck`, `npm run lint` y `npm test -- tests/mcp-*.test.ts`. Los guardianes fallan si olvidaste algo.

**Cambiar quién puede usar una herramienta:** edita la función de `lib/auth/roles.ts` que la herramienta usa (o agrega una) y su test en `tests/roles-operacion.test.ts`. No toques la herramienta.

**Abrir el MCP a otro rol** (ticket 383, hecho): `puedeConectarIa` admite todos los roles; cada persona autoriza con Google, `tools/list` se filtra por las capacidades del rol y la revisión de petición forjada cubre herramientas y programas ajenos. Solo el developer conserva la creación manual de tokens personales mediante `puedeCrearTokenPersonal`.

**Cambiar una cifra:** no se cambia aquí. La métrica vive en `docs/metricas.md` y en su función; el MCP solo la expone.

## 6. Cómo se hace cumplir

- `tests/mcp-guardian.test.ts`: sin SQL fuera de los cuatro límites (`token`, `sesion`, `bitacora`, `vistas-previas`), sin roles a mano, y cada herramienta declara permiso, entrada estricta y anotaciones de lectura/escritura.
- `tests/mcp-contrato.test.ts`: nombres válidos y únicos, descripción presente, toda herramienta en las instrucciones y en este documento, y toda cadena de entrada con tope.
- `tests/mcp-ruta.test.ts`: la ruta real de punta a punta, con peticiones forjadas (token falso, revocado, inactivo, rol sin permiso, programa ajeno, vista ajena, entradas desmedidas, tope).

## 7. Deuda conocida

La caducidad de credenciales, la retención de 90 días, la paginación SQL, la búsqueda global, los filtros resueltos y la consulta genérica de hechos quedaron resueltos. El tope de 300 llamadas por minuto admite un sobrepaso pequeño bajo ráfaga, margen aceptado para el volumen actual. Quedan los `EXPLAIN` a 10× de las herramientas de operación y las evaluaciones de descubrimiento (386). `consultar_metrica` todavía usa `closer` como código opaco, un concepto distinto del dueño del deal; es candidato a renombrarse en F5.

**Alcance y límites del MCP (9-nov, ticket 411, ADR 0129):** la puerta de escritura ya tiene su primer caso de uso, mover de etapa y deshacerlo, con el mismo permiso y motor que la app. El destino sigue siendo una puerta total con reglas de orientación (todo lo que la app muestra o permite por rol, también por el MCP). Medido el 9-nov en `mcp_llamadas`: el servidor responde en 98 a 3.053 ms por
llamada (p95: `pauta_roas` 2,8 s, `tablero_de_deals` 2,0 s, `consultar_metrica` 1,0 s) y no se alcanzó el tope de 300/min; las
límites pendientes de las fases siguientes están en `docs/tasks/411-mcp-puerta-total-sin-limitaciones.md`.

**Familia analítica para gerencia y pauta:** idea del 8-nov en el ticket 407 (capa semántica de solo lectura, definiciones de métricas y respuestas proactivas); no se construye antes del 383, 397, 399 y 403.

## 8. Visualizaciones dentro del chat

Hoy el servidor devuelve **datos estructurados y texto**; la gráfica la hace el cliente. En Claude, el modelo puede
dibujar un gráfico o un artefacto a partir de `structuredContent` si se lo pides ("grafícalo"). Eso no requiere cambios aquí
y depende de que la salida sea limpia (ticket 385).

Para que **el servidor entregue la gráfica o el tablero ya hechos**, el estándar es **MCP Apps** (extensión oficial, SEP-1865): la
herramienta referencia un recurso `ui://` con HTML (`text/html;profile=mcp-app`) que el cliente muestra en un iframe
con sandbox y que habla con el servidor por JSON-RPC. Es opcional y se negocia por cliente. **Decisión (7-nov):** no se
construye todavía; primero la salida limpia del 385 (una gráfica sobre cifras ambiguas las hace más creíbles, no más
correctas). Cuando se haga, será el ticket 387 (junto con la administración visual y la evaluación de descubrimiento), que reutilice el tema de Tinta y las series de `lib/series-pasos.ts`.

## 9. Fuentes

- Anthropic Engineering, *Writing effective tools for agents* (consolidar, nombrar, devolver alta señal, paginar, describir, evaluar): https://www.anthropic.com/engineering/writing-tools-for-agents
- MCP, especificación de Tools (nombres, `title`, `outputSchema`, `structuredContent`, errores, seguridad): https://modelcontextprotocol.io/specification/latest/server/tools
- MCP, *Security Best Practices* (token passthrough, confused deputy): https://modelcontextprotocol.io/specification/latest/basic/security_best_practices
- MCP, SEP-1865 *MCP Apps* (interfaces interactivas): https://modelcontextprotocol.io/seps/1865-mcp-apps-interactive-user-interfaces-for-mcp
- Autorización y OAuth 2.1 para servidores MCP: ver las fuentes del ADR 0119.
