## Agent skills

This repo is set up for agentic engineering. **Desde el 27-sep-2026 la documentación vive en un solo
lugar, sin copias entre documentos.** Léelos en este orden:

1. **Este archivo** (`AGENTS.md`): las reglas duras, los contratos, los comandos y las convenciones.
2. **Plan + tickets** (`docs/plan.md`, `docs/tasks/`) — **el punto de entrada del trabajo**: el norte, los
   **doce componentes del CRM cruzados con los actores** (desde el 2-oct; antes tres tracks), el orden por hitos, qué componente cumple cada criterio
   de aceptación y **la lista única de decisiones abiertas**. Cada ticket cabe en una ventana de
   contexto limpia y cita lo que sirve. Nunca se salta del producto al código sin pasar por un ticket.
   **`docs/tasks/README.md` es el único tracker de avance**: se toma un ticket cuyas dependencias estén
   todas en `done`, y al cerrarlo se marca ahí y se pone `status: done` en su archivo.
   **`docs/plan-reparto.md`** complementa el plan con el reparto para dos personas con varias sesiones
   cada una: **olas de tickets listos** (desde el 1-oct), la cola de migraciones, los archivos calientes y los
   **checkpoints** donde se corre la suite completa. La ola vigente está en su §4.
   **`docs/manuales/mapa-crm.html`** es el mapa visual del CRM (actores × componentes, traspasos, bordes y lo que
   falta): una vista de `overview.md` §4, `plan.md` §4 y `structure.md` §8. **No se edita suelto**: cuando
   cambian esos tres, se regenera.
   **`docs/analytics.md`** mapea la reunión con Pauta (29-sep) al alcance: lo pedido y lo medido, las
   decisiones DP-1 a DP-25, el grid de requisitos con su ticket (116 a 126) y el modelo de datos. Es contexto e
   historia: **sus fórmulas (§6) ya no rigen**; las definiciones viven solo en `docs/metricas.md`.
   **Jerarquía (ADR 0115, N8):** sobre qué hace hoy el código manda el código; sobre qué debería hacer, **ADR vigente >
   ticket > documento de reunión** (`analytics.md`, `comercial.md`, `hub.md`). Una enmienda reescribe en el mismo commit
   el título y el índice del ADR, la fila de `metricas.md` y el vocabulario de `overview.md` §11.
   **`docs/comercial.md`** mapea la reunión con Gerencia (30-sep), que fue la fuente de verdad hasta el ADR 0115: el
   pipeline pasa a las etapas, etiquetas y propiedades de 30X, el valor vendido lo escribe el closer y la
   comisión es un porcentaje, hay meta del mes y de la cohorte, y la v1 es comercial. Léelo antes de tocar
   etapas, dinero, metas o el Hub.
   **`docs/hub.md`** (14-oct) es el plan del **Hub**, que reemplaza al Dashboard y a Metas (ADR 0086 a 0090): el
   audit medido, los frentes con sus tickets (244 a 262) y los contratos C-1 y C-2 (§8). Léelo antes de tocar
   métricas, pauta, atribución o el Hub.
   **`docs/weekly-2026-11-03.md`** (9-nov) resume lo que pidió Daniel Tovar en el weekly del 3-nov (ROAS por cohorte de envío, tres columnas de dinero,
   productos y SKUs, media) y a qué ticket va cada pedido; es documento de reunión (N8: manda ADR > ticket > él).
   **`docs/weekly-2026-11-13.md`** (13-nov) cruza el weekly del 13-nov con el estado del CRM: salida de Daniel y Michael, el Hub
   terminado a más tardar la segunda semana de diciembre y la sesión presencial del 20-nov. Mismo rango N8.
   **`docs/paid-media-2026-11-09.md`** (9-nov) extrae la reunión con Paid Media (7-nov), los reportes diario y semanal de
   Paid Media de 30X y la tabla KPI del Excel: el catálogo depurado de métricas de pauta cruzado con el CRM, las decisiones
   D-1 a D-7, el reparto del **412** en sesión padre e hijas y sus briefs. Documento de reunión (N8). Léelo antes de tocar
   Hub › Pauta, `gasto_pauta`, `objetivos` o el sync de Meta.
   **`docs/metricas.md`** (15-oct) es **el diccionario de métricas, la única tabla de definiciones**: de qué tabla
   sale cada cifra, qué cuenta y qué no, con qué fecha y moneda, en qué función vive y cómo verificarla. Una métrica
   nueva o un cambio de fórmula lo actualiza en el mismo commit.
   **`docs/media/`** (26-oct, **subproyecto de prioridad alta**) es la centralización de la operación de media en el
   CRM y el cockpit (`../pipeline-creacion-contenido`): el crudo de la sesión "Creación Media Ops Machine" (20-oct), la
   extracción con los 18 pedidos, la propuesta, el roadmap y las decisiones abiertas, y el deck para gerencia. Empieza
   por su `README.md`. Todavía no es plan aprobado: léelo antes de tocar roles, UTM de stories, Grain o el Hub.
2b. **`docs/mcp.md`** (7-nov) — la arquitectura del MCP del CRM (`/api/mcp`), qué archivo dicta qué, las herramientas por rol
   y **el contrato de mantenimiento** para ampliar herramientas y roles; lo vigilan `tests/mcp-contrato.test.ts` y
   `tests/mcp-guardian.test.ts`. Léelo antes de tocar `lib/mcp/`.
2c. **`docs/contrato-metricas-y-datos.md`** (7-nov, F6 del ticket 385) — el contrato para agregar, cambiar, probar y retirar una
   métrica, una tabla o una columna, con qué guardián existe hoy en `tests/` (🔒), cuál solo se propone (🟡) y cuál es revisión
   manual con su olor nombrado (👁), y la investigación con fuentes. **Empieza por su "Resumen": la definición vive en
   `docs/metricas.md`, el nombre en `overview.md` §11 y la consulta en `lib/queries/hechos/` y los módulos de concepto; una
   consulta nueva se crea ahí, nunca en una pantalla, en `lib/mcp/` ni en un script.** Es el par de `docs/mcp.md` para la capa de datos; el
   **registro tipado de métricas** (`lib/metricas/registro.ts`, ADR 0120, diseño en `docs/diseno-registro-de-metricas.md`) ya
   existe con cinco conceptos y un trinquete de pendientes; los guardianes 🟡 todavía no están construidos. Léelo antes de tocar `lib/queries/`, `lib/db/schema.ts` o
   `docs/metricas.md`.
2d. **`docs/diseno-cifra-y-pauta.md`** (10-nov) — **el diseño aprobado de cómo se muestra una métrica en todo el Hub (la Cifra y
   su explicación) y de Hub › Pauta en dos vistas**. Su norte visual es el boceto `docs/bocetos/una-forma-de-metrica.html`, que Mani
   aprobó "tal cual": una pantalla nueva se compara lado a lado con él. Toda cifra se explica al abrirla (qué mide, fórmula con
   variables, cada número y etiqueta, filtros y lista) sin una sola referencia técnica. Léelo antes de tocar una cifra o Pauta.
   🎯 **Referencia visual PERMANENTE (Mani, 10-nov): así se ven TODOS los componentes y layouts del CRM**, no solo Pauta.
   Fuente de verdad en el repo: `docs/bocetos/una-forma-de-metrica.html` (se abre con doble clic). Copia publicada (privada, de
   Mani): https://claude.ai/artifact/HSVdjQ6QdPdHeQ9obbEAPS. Si discrepan, manda el HTML del repo. Toda pantalla nueva o tocada se
   compara lado a lado con él en claro, oscuro y 375 px antes de empujar.
2e. **`docs/estudio-rendimiento-y-conexion.md`** (14-nov) — **la conexión a la base cuelga y cruza parámetros** (pooler de
   Supabase en modo transaction + `postgres-js` con `prepare: false`; causa raíz del 243 y de los 504 de Programa y de las
   rutas de salud), el costo medido de las consultas (52 por render de Nerd Stats), el prefetch de la navegación y el
   borrador del contrato de rendimiento. Insumo de una sesión propia, sin plan aprobado. Léelo antes de tocar `lib/db/`,
   agregar consultas a una pantalla o diagnosticar un 504.
3. **`docs/overview.md`** — qué es la herramienta de principio a fin: el problema, los programas, los
   roles y sus historias de usuario, el recorrido de un lead, las métricas, el alcance, los criterios de
   aceptación, de dónde salió y **el vocabulario del dominio** (§11). Es el contrato de producto (lo que
   antes era la spec) y el glosario: léelo antes de nombrar variables, funciones o archivos.
4. **`docs/structure.md`** — los diagramas y los componentes, técnicos y operacionales: la operación de
   hoy, los flujos, **el motor de etapas y su tabla de transiciones**, la arquitectura, el modelo de
   datos, la ingesta, la atribución, las pantallas y quién ve qué, **el sistema de diseño "Tinta"**
   (§9, **obligatorio antes de tocar cualquier pantalla**: ningún color, sombra ni radio a mano, un solo
   acento morado, cinco tonos de estado por `<Badge variant>`, toda cifra comparable en `cifra`), **el
   mapa de las hojas de Sheets** (§10, antes de tocar `lib/sheets/` o el traslado: qué pestaña es
   fuente, cuáles son vistas derivadas que romperían el dedup y cuáles son respaldos que inflan los
   conteos) y la migración.
5. **`docs/operations.md`** — cómo se opera: entornos, las URLs de cada programa, **cómo se configura un programa de punta a punta (§2.1: programa, Calendly, formulario, fuente, secreto)**, variables, base de
   datos, scripts, despliegue, secretos, incidentes, deuda y datos de validación.
6. **ADRs** (`docs/adr/`, índice en `docs/adr/README.md`) — las decisiones vigentes, cada una reescrita
   para decir lo que se va a construir, y el índice de las retiradas (el código cita sus números).
   Léelas antes de cambiar un área decidida; no se re-litigan. Una nueva toma el siguiente número libre.
7. **Anotaciones de UI y UX** (`docs/anotaciones.md`) — la bandeja de lo que sale de recorrer la app a
   mano (cambios, aclaraciones, usabilidad; quienes la usan no son técnicos). Toda anotación nueva de
   interfaz se agrega ahí con su id `A-NN`, y si cabe en un ticket, el ticket la cita por id. Léela antes
   de tocar una pantalla.
8. **Handoff** (`docs/agents/handoff.md`) — memoria de sesiones: se lee al arrancar y se actualiza al
   cerrar. Referencia tickets, no los duplica.

Los documentos que se fundieron el 27-sep (spec, plan v2, propuesta del 24-sep, revisión del 22-sep,
diseño, sistema de diseño, glosario, mapa de las hojas, auditoría del 19-sep e insumos) siguen en git
(`git show da68cdf:<ruta>`). **`docs/plan.md` §8 dice dónde quedó cada referencia vieja** que citen un
ticket o un comentario del código.

Available skills (the pipeline is **spec → plan → build**): `/spec` (el contrato de producto de este
repo vive en `docs/overview.md`), `/plan` (`docs/plan.md` + tickets), `/grill-me`, `/grill-with-docs`
(alinea y documenta antes de construir; aquí escribe ADR en `docs/adr/` y vocabulario en
`docs/overview.md` §11), `/tdd` (red-green-refactor), `/diagnose` (disciplined debugging),
`/improve-codebase` (deepen modules), `/handoff` (compact a session).

Keep this file current yourself: when a feedback-loop command turns out wrong or missing, or a durable convention emerges that no linter enforces, update the relevant section below directly rather than letting it drift.

