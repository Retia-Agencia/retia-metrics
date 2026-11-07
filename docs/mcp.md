# El MCP del CRM: arquitectura y contrato de mantenimiento

> **Para quién:** quien mantenga o amplíe el MCP (hoy Mani como developer). Es la fuente única de *cómo está armado* y
> *cómo se cambia sin romperlo*. El *por qué* de cada decisión vive en el [ADR 0119](./adr/0119-el-mcp-del-crm.md); el avance en
> los tickets 348, 383, 384, 385 y 386; cómo conectarse y revocar, en `operations.md` §8.1. Si algo de aquí contradice al
> código, manda el código (ADR 0115 N8) y este archivo se corrige en el mismo commit.
> Última revisión: 7-nov-2026.

## 1. Qué es y dónde vive

Un **servidor MCP remoto dentro de la propia app de Next** (no hay otro servicio ni otro repo). Responde en
`/api/mcp`, corre en el mismo despliegue de Vercel (runtime Node) que el CRM y lee la misma base. Se despliega con el
mismo `git push` a `main`. Habla *Streamable HTTP* y es **sin estado**: cada petición HTTP arma su propio servidor y lo
descarta, así que escala como cualquier route handler.

Lo mantiene quien mantenga el repo: no hay nada que operar aparte. Cambiar una herramienta es cambiar TypeScript en
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
| `lib/mcp/token.ts` | Emitir, verificar y revocar tokens (formato `retia_mcp_…`, solo se guarda el hash, scope lectura/escritura). **Una de las tres únicas con SQL.** |
| `lib/mcp/sesion.ts` | Convierte un token en una `Session` del CRM con rol y alcance revalidados en cada llamada. Es lo que hace que quitar a alguien lo saque ya. **SQL permitido.** |
| `lib/mcp/bitacora.ts` | Tope de 300 llamadas/minuto por token y registro de cada llamada. **SQL permitido.** |
| `lib/mcp/servidor.ts` | Registra las herramientas, aplica el flujo de arriba, traduce errores a `isError` sin filtrar detalles internos. |
| `lib/mcp/instrucciones.ts` | El campo `instructions` del servidor: qué herramienta usar para qué y cómo responder en lenguaje de negocio. |
| `lib/mcp/herramientas/tipos.ts` | El contrato TypeScript de una herramienta (`Herramienta`). |
| `lib/mcp/herramientas/index.ts` | **El registro exhaustivo** `HERRAMIENTAS`. Una herramienta que no está aquí no existe. |
| `lib/mcp/herramientas/{programas,metricas,operacion,decisiones}.ts` | Las once herramientas, agrupadas por familia. Adaptadores delgados. |
| `lib/mcp/herramientas/{programa,periodo}.ts`, `lib/mcp/enlaces.ts` | Piezas compartidas: resolver un programa visible, el periodo en formato MCP, los enlaces al CRM. |
| `lib/auth/roles.ts` | **Quién puede qué.** Cada herramienta pregunta a una función de aquí; nunca compara un rol a mano. |
| `lib/queries/*` | Las consultas y reglas que las pantallas **y** las herramientas comparten (filtros, proyecciones por rol, alcance). El MCP no define ninguna métrica. |
| `lib/db/schema.ts` (`mcpTokens`, `mcpLlamadas`) y `drizzle/0117_*` | Las dos tablas propias del MCP (RLS activo). |
| `app/(app)/mi-espacio/acciones.ts` y `components/mi-espacio/conexiones-de-ia.tsx` | Emitir y revocar tokens (hoy solo el developer: `puedeConectarIa`). |
| `tests/mcp-*.test.ts` | Las pruebas, incluido el guardián de dominio y el de contrato (§6). |

## 3. Las herramientas y quién las ve

Todas son de solo lectura hoy. El developer pasa toda guarda (ADR 0025). "Programa visible" = el alcance del usuario (ADR 0048/0094).

| Herramienta | Para qué | Roles |
|---|---|---|
| `programas_visibles` | Los programas que la persona puede consultar y su slug | todos |
| `resumen_del_hub` | Cifras del periodo: ventas, caja, agendas, shows, tasas | gerente, paid trafficker |
| `consultar_metrica` | Una métrica con desgloses, filtros y filas | gerente, paid trafficker, closer (según la métrica) |
| `buscar_leads` | Buscar personas por nombre, correo o teléfono | gerente, closer |
| `ficha_de_lead` | Ficha de una persona | gerente, closer, customer success (proyección reducida) |
| `ficha_de_deal` | Ficha operativa de un deal | gerente, closer |
| `tablero_de_deals` | El tablero de Deals con sus filtros | gerente, closer |
| `bandeja` | Pendientes del día | gerente, closer |
| `cartera_vencida` | Saldos vencidos de Students | gerente, closer, customer success |
| `pauta_roas` | ROAS por campaña, conjunto o anuncio | gerente, paid trafficker |
| `origen_del_programa` | De dónde llegan los registros | gerente, paid trafficker |

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
6. 🔒 **Esquema zod `.strict()`**, parámetros con nombres inequívocos, y **toda cadena con tope de longitud** (`max`). El servidor **valida todas las entradas** (spec MCP, "Security Considerations").
7. **Listas largas se paginan o se acotan** con un tope por defecto, y la respuesta dice cómo pedir la siguiente página. Una respuesta sin tope es un riesgo de contexto y de costo. *(Anthropic, "Writing tools for agents": paginación, filtros y truncado con valores por defecto.)*
8. **Prefiere pocas herramientas de alto valor** a envolver cada consulta, y una búsqueda con filtros a "listar todo". *(Anthropic, ídem: consolidar y preferir búsqueda.)*

**Salida**
9. Toda respuesta trae **texto legible para una persona de negocio** y `structuredContent` con el dato. Cada monto lleva su moneda; "—" significa que no se puede calcular; toda tasa trae su cobertura. *(ADR 0115 N3/N5.)*
10. **No se devuelve la vista interna de una pantalla tal cual.** Se devuelve un objeto con nombres de negocio y descripciones por campo. *(Anthropic: devolver campos de alta señal y no identificadores crípticos; pendiente en el 385: `outputSchema` propio.)*
11. **Cada entidad enlaza al CRM** (`lib/mcp/enlaces.ts`), para que el modelo cite y la persona verifique.
12. **Errores accionables.** Un error de negocio se devuelve como `isError: true` con un mensaje que dice qué corregir; un error interno responde "Error interno." sin detalle (🔒 `mcp-ruta`). Los errores de protocolo (herramienta desconocida) los maneja el SDK. *(Spec MCP, "Error Handling".)*

**Descubrimiento (que el modelo escoja bien y rápido)**
13. 🔒 **Nombre en `snake_case` ASCII, único, de 1 a 64 caracteres**, con la forma `verbo_o_sustantivo` consistente con las demás. *(Spec MCP: nombres únicos, 1 a 128 caracteres y solo letras, números, `_`, `-`, `.`.)*
14. **Descripción como para una persona nueva en el equipo:** primero cuándo usarla, luego qué devuelve y qué no hace; términos propios explicados. Corta y sin repetir lo que dice el esquema. *(Anthropic: escribe las descripciones como para un recién llegado y refínalas con evaluaciones.)*
15. 🔒 **Toda herramienta aparece en `INSTRUCCIONES_MCP`** (`lib/mcp/instrucciones.ts`) con la pregunta que resuelve, y en la tabla de §3. Sin esto el cliente no la encuentra a tiempo (el 7-nov una consulta tardó ~40 s en el cliente, no en el servidor: 96 ms y 890 ms medidos en `mcp_llamadas`).
16. 🔒 **Anotaciones:** `readOnlyHint` verdadero en todas las de lectura. Las anotaciones son pistas no confiables para el cliente: **la seguridad la dan las guardas del servidor, nunca la anotación**. *(Spec MCP.)*
17. **La lista de herramientas es determinista y puede variar por credencial**, nunca por conexión: hoy se filtra por rol con `puede`. Mantener el orden de `HERRAMIENTAS` estable ayuda a la caché de prompts del cliente. *(Spec MCP, "Capabilities".)*

**Operación**
18. 🔒 **Toda llamada deja rastro sin argumentos** y hay **tope por minuto**. Hoy los tokens no caducan y `mcp_llamadas` no tiene retención: se resuelve en el 383. *(Spec MCP: limitar la tasa y registrar el uso.)*
19. **No hay passthrough de tokens.** El servidor solo acepta tokens emitidos para él (`retia_mcp_…`) y nunca reenvía el del cliente a otro servicio. *(MCP, "Security Best Practices": token passthrough es un anti-patrón.)*
20. **Una escritura (ticket 384) no entra por una herramienta suelta:** lleva vista previa, confirmación humana, scope `escritura`, `crearConRastro` con origen `mcp` y deshacer (ADR 0042/0117). `soloLectura: true` en el tipo se cambia a propósito en ese ticket, no antes.

## 5. Recetas

**Agregar una herramienta de lectura**
1. Si la pregunta ya la responde una pantalla, extrae su consulta a `lib/queries/` (si no está) y úsala en las dos.
2. Define la herramienta en el archivo de su familia (`herramientas/*.ts`) con la forma de `tipos.ts`.
3. Regístrala en `HERRAMIENTAS` (`herramientas/index.ts`).
4. Agrégala a `INSTRUCCIONES_MCP` y a la tabla de §3.
5. Tests en el archivo de su familia: permiso por rol, programa ajeno, paridad con la pantalla, entrada inválida.
6. `npm run typecheck`, `npm run lint` y `npm test -- tests/mcp-*.test.ts`. Los guardianes fallan si olvidaste algo.

**Cambiar quién puede usar una herramienta:** edita la función de `lib/auth/roles.ts` que la herramienta usa (o agrega una) y su test en `tests/roles-operacion.test.ts`. No toques la herramienta.

**Abrir el MCP a otro rol** (ticket 383): hoy solo el developer emite tokens (`puedeConectarIa`). Antes de ampliarlo, resolver los huecos de la sección 7 y repetir la revisión de petición forjada.

**Cambiar una cifra:** no se cambia aquí. La métrica vive en `docs/metricas.md` y en su función; el MCP solo la expone.

## 6. Cómo se hace cumplir

- `tests/mcp-guardian.test.ts`: sin SQL fuera de los tres módulos, sin roles a mano, y cada herramienta declara permiso, entrada estricta y solo lectura.
- `tests/mcp-contrato.test.ts`: nombres válidos y únicos, descripción presente, toda herramienta en las instrucciones y en este documento, y toda cadena de entrada con tope.
- `tests/mcp-ruta.test.ts`: la ruta real de punta a punta, con peticiones forjadas (token falso, revocado, inactivo, rol sin permiso, programa ajeno, vista ajena, entradas desmedidas, tope).

## 7. Deuda conocida

Tokens sin caducidad; `mcp_llamadas` sin retención; `tablero_de_deals` y `cartera_vencida` sin paginar; el tope por minuto admite un sobrepaso pequeño bajo ráfaga; salidas aún con nombres internos (ticket 385, que se ensanchó el 7-nov a auditoría completa de métricas y datos del CRM) y sin `outputSchema`; sin `title` ni evaluaciones de descubrimiento (385/386).

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
