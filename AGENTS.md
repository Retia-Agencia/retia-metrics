<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Retia Metrics

CRM y dashboard comercial interno de Retia para sus programas (hoy Comunicarte y Tactical
Investor). Lee los leads de Google Sheets, deduplica, registra llamadas, ventas y abonos,
calcula el embudo y proyecta la cohorte.
Uso restringido: no hay ninguna vista publica y no existe el auto-registro.


## Lee antes de actuar

| Documento | Léelo cuando |
|---|---|
| [skills.md](docs/agents/skills.md) | Antes de usar o crear un skill. |
| [restricciones.md](docs/agents/restricciones.md) | Si una restricción no queda clara. |
| [contratos.md](docs/agents/contratos.md) | Antes de tocar un contrato o una consulta del Hub. |
| [feedback-loops.md](docs/agents/feedback-loops.md) | Antes de escribir código o tests y al verificar un cambio. |
| [convenciones.md](docs/agents/convenciones.md) | Antes de escribir código o tests. |

## Restricciones no-negociables

- Toda tasa usa personas deduplicadas por correo, nunca filas. (detalle: docs/agents/restricciones.md#dedup-obligatorio-por-correo)
- El programa integra la identidad del lead; dos programas jamás se cruzan y solo agregan magnitudes compatibles. (detalle: docs/agents/restricciones.md#programa-como-frontera)
- El origen conserva UTM literal y responsable por FK; clasificación y emparejamiento siguen las reglas centrales. (detalle: docs/agents/restricciones.md#origen-del-lead)
- Las métricas cumplen las nueve reglas N1 a N9 y sus guardianes. (detalle: docs/agents/restricciones.md#norte-de-las-metricas)
- Caja recaudada y ventas cerradas son métricas separadas; nunca se infieren entre sí. (detalle: docs/agents/restricciones.md#caja-y-ventas-separadas)
- La misma pregunta tiene una sola definición compartida; preguntas distintas conservan funciones distintas. (detalle: docs/agents/restricciones.md#definicion-unica)
- Un registro anulado no cuenta en ninguna métrica; toda lectura declara vigencia. (detalle: docs/agents/restricciones.md#registros-anulados)
- La meta pertenece a la cohorte, no se reparte entre closers ni se fuerza la suma de responsables. (detalle: docs/agents/restricciones.md#meta-de-cohorte)
- Nunca conviertas moneda en silencio; muestra siempre su unidad. (detalle: docs/agents/restricciones.md#moneda-visible)
- Toda fecha de negocio usa Bogotá explícitamente y solo las dos implementaciones centrales. (detalle: docs/agents/restricciones.md#fechas-de-bogota)
- Solo sábados y domingos dejan de ser hábiles; los festivos cuentan como hábiles. (detalle: docs/agents/restricciones.md#dias-habiles)
- El rol se enforza en el servidor, en cada ruta; esconder botones no es seguridad. (detalle: docs/agents/restricciones.md#rol-en-servidor)
- Las capacidades y el alcance se preguntan mediante funciones centrales; nunca por comparaciones manuales de rol. (detalle: docs/agents/restricciones.md#capacidades-por-rol)
- El developer es el dueño y no se le restringe nada; toda capacidad nueva lo incluye centralmente. (detalle: docs/agents/restricciones.md#developer-dueno)
- Gerente y closer son disjuntos; las excepciones de visibilidad, edición y Hub son únicamente las documentadas. (detalle: docs/agents/restricciones.md#gerente-y-closer-disjuntos)
- Nada es público salvo los endpoints nombrados, con sus secretos, contratos y límites de datos exactos. (detalle: docs/agents/restricciones.md#nada-publico)
- Las rutas usan ids opacos; solo el buscador permite texto personal en query strings. (detalle: docs/agents/restricciones.md#ids-opacos)
- Los secretos viven solo en ubicaciones autorizadas y las excepciones nombradas conservan escritura, lectura y auditoría restringidas. (detalle: docs/agents/restricciones.md#secretos)
- UI/UX tiene prioridad de integridad: cada pantalla cumple el contrato de entendimiento y el orden pedido por gerencia. (detalle: docs/agents/restricciones.md#ui-ux)
- Cada dato vive en la pantalla de su objeto; antes de agregar algo, busca qué quitar. (detalle: docs/agents/restricciones.md#dato-en-su-objeto)
- Organiza por dominio; rutas coordinan, negocio vive en lib y no existen carpetas genéricas para ocultar acoplamiento. (detalle: docs/agents/restricciones.md#organizacion-por-dominio)
- Reorganiza solo tras medir y encontrar una frontera estable; conserva comportamiento y valida el dominio y la suite. (detalle: docs/agents/restricciones.md#crecimiento-medido)
- Las instancias viven en la base y los tipos en código; el catálogo sigue el molde y preserva filas usadas. (detalle: docs/agents/restricciones.md#instancias-y-tipos)
- La identidad normalizada de closer tiene una sola implementación en memoria, SQL e índice; conserva el texto original. (detalle: docs/agents/restricciones.md#identidad-de-closer)
- Toda fila de catálogo, incluso desde scripts, usa el molde y deja rastro con actor; solo aplican excepciones nombradas. (detalle: docs/agents/restricciones.md#catalogo-por-molde)
- El sync de Sheets está retirado; los leads entran por webhook y Sheets solo sirve para traslado o migración. (detalle: docs/agents/restricciones.md#sync-de-sheets-retirado)
- El Deal es central; venta significa Abonado o Completo y toda etapa cambia únicamente mediante moverEtapa. (detalle: docs/agents/restricciones.md#deal-central)
- Anular corrige captura y no cuenta; Cierre Perdido es resultado de negocio y sí cuenta. (detalle: docs/agents/restricciones.md#anular-no-es-perder)
- El formulario origina leads y el CRM todo lo demás; no se escribe de vuelta a Sheets. (detalle: docs/agents/restricciones.md#fuentes-de-verdad)
- Un mapeo incompleto falla por encabezado con MapeoInvalidoError; nunca adivina posiciones. (detalle: docs/agents/restricciones.md#mapeo-ruidoso)
- Un centinela no es dato; cada fuente declara su vacío y evita contaminar dedup y fechas. (detalle: docs/agents/restricciones.md#centinelas)
- Toda operación sobre el set completo se procesa por lotes para caber en una función de Vercel. (detalle: docs/agents/restricciones.md#sync-en-lotes)
- Diseña para la escala real; si crece diez veces, revisa la lectura completa. (detalle: docs/agents/restricciones.md#escala-real)

## Detalle operativo

- Skills y orden de lectura: [docs/agents/skills.md](docs/agents/skills.md).
- Contratos transversales: [docs/agents/contratos.md](docs/agents/contratos.md).
- Comandos y verificación: [docs/agents/feedback-loops.md](docs/agents/feedback-loops.md).
- Convenciones de implementación: [docs/agents/convenciones.md](docs/agents/convenciones.md).

## Permissions

The agent runs with a permission floor so it can work autonomously without deleting things. Destructive commands are denied in `.claude/settings.json` (Claude Code); other tools keep their own config. Widen the allow-list per project; keep the destructive deny-list.

## Agents & local skills

This repo can grow its own automation when a need repeats — not required, and there are no placeholder files or folders. When it earns its place:

- **Local skills** → `.claude/skills/<name>/` — a repeatable procedure you want deterministic (built with skill-creator).
- **Local agents** → `.claude/agents/<name>/` — a role with its way of working embedded: `AGENT.md` (what it does) + `MEMORY.md` (what it learned about this codebase) + optional `templates/`, `scripts/`, and references to skills (e.g. a UI agent references `impeccable`). Write it by hand once the need is proven; there is no generator to run, and an agent built before the need is real is worse than none. When a trigger applies, launch the subagent automatically, not only on manual command — the override still holds.

**Review principle (portable, every tool):** the review is done by a *different model/session than the one that wrote the code* — it validates the output against the spec and the architecture before the commit. This is the "cadenero". The reviewer is not tied to a fixed model; any strong reasoner in a fresh session works. Whoever builds it as an agent leaves the frontmatter without a pinned `model:` and states the rule in the body.
