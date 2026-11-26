import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Guardianes de arquitectura que antes leian el codigo con regex en `tests/` (contrato de tests, "Cuando NO
 * entra"): una regla que cabe en ESLint falla en el editor y no cuesta suite. Cada regla nombra su motivo y sus
 * excepciones por archivo. `no-restricted-imports` y `no-restricted-syntax` son UNA sola regla por archivo
 * (la ultima configuracion gana), asi que `restringir()` arma, para cada archivo exento, el conjunto completo
 * menos las reglas que lo eximen (por nombre o por un glob `carpeta/**`; los globs van primero y los archivos
 * exactos despues, para que un archivo dentro de un glob conserve las exenciones del glob).
 */
const CODIGO = [
  "lib/**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}",
  "app/**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}",
  "components/**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}",
  "scripts/**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}",
];

const REGLAS_DE_ARQUITECTURA = [
  {
    // Antes: tests/enlace-guardian.test.ts. `Enlace` decide el prefetch (docs/tasks/442-prefetch-decidido.md).
    paths: [{ name: "next/link", message: "Usa <Enlace> de components/enlace.tsx: es el unico que decide el prefetch." }],
    excepto: ["components/enlace.tsx"],
  },
  {
    // Antes: tests/graficas-guardian.test.ts (ADR 0091). ECharts vive detras del envoltorio.
    patterns: [{ group: ["echarts", "echarts/**"], message: "ECharts solo se importa desde components/graficas/ (ADR 0091)." }],
    excepto: ["components/graficas/**"],
  },
  {
    // Antes: tests/anclas-de-fecha-guardian.test.ts. AGENTS.md: fechas de Bogota solo por las dos implementaciones centrales.
    // `.` en lugar de la comilla: esquery no admite `/` ni escapes dentro de un regex de selector.
    selectors: [
      { selector: "TemplateElement[value.raw=/AT TIME\\s+ZONE\\s+.America.Bogota./i]", message: "Ancla de dia de Bogota escrita a mano: usa lib/queries/hechos/fechas.ts." },
      { selector: "Literal[value=/AT TIME\\s+ZONE\\s+.America.Bogota./i]", message: "Ancla de dia de Bogota escrita a mano: usa lib/queries/hechos/fechas.ts." },
    ],
    excepto: ["lib/queries/hechos/fechas.ts"],
  },
  {
    // Antes: tests/calendario-guardian.test.ts. La aritmetica de calendario y dias habiles vive en un solo modulo.
    selectors: [
      { selector: "CallExpression[callee.property.name='getUTCDay']", message: "Aritmetica de calendario fuera de lib/dias-habiles.ts." },
      { selector: "FunctionDeclaration[id.name=/^(sumarDias|lunesDe)$/]", message: "Helper de calendario duplicado: usa lib/dias-habiles.ts." },
    ],
    excepto: ["lib/dias-habiles.ts"],
  },
  {
    // Antes: tests/calendly-colgar-guardian.test.ts (ticket 096, ADR 0049). Una llamada colgada del deal equivocado no lanza error.
    selectors: [
      { selector: "Property[key.name='origen'][value.value='calendly']", message: "Una llamada de Calendly solo la escriben sus escritores autorizados (ADR 0049)." },
      { selector: "Literal[value=/^calendly:/]", message: "La huella de Calendly la arma huellaDeCita (lib/calendly/huella.ts)." },
      { selector: "TemplateElement[value.raw=/^calendly:/]", message: "La huella de Calendly la arma huellaDeCita (lib/calendly/huella.ts)." },
    ],
    excepto: [
      "lib/calendly/colgar-llamada.ts",
      "lib/ingesta/regla-de-deals.ts",
      "lib/deals/llamadas.ts",
      "lib/calendly/huella.ts",
    ],
  },
  {
    // Antes: tests/base-portable.test.ts (ADR 0047 punto 8). El driver de la base y los SDK del proveedor viven en
    // lib/db/ (y el storage en lib/archivos/): asi mudar de Neon a Supabase fue cambiar una variable.
    paths: [
      { name: "postgres", message: "El driver de la base vive solo en lib/db/ (ADR 0047)." },
      { name: "pg", message: "El driver de la base vive solo en lib/db/ (ADR 0047)." },
    ],
    patterns: [
      { group: ["drizzle-orm/postgres-js", "drizzle-orm/neon-http", "drizzle-orm/neon-serverless", "drizzle-orm/node-postgres"], message: "El driver de drizzle vive solo en lib/db/ (ADR 0047)." },
      { group: ["@supabase/*", "@neondatabase/*"], message: "El SDK del proveedor vive solo en lib/db/ o lib/archivos/ (ADR 0047)." },
    ],
    selectors: [
      { selector: "NewExpression[callee.name='Pool']", message: "Un pool de conexiones vive solo en lib/db/ (ADR 0047)." },
    ],
    excepto: ["lib/db/**", "lib/archivos/**"],
  },
  {
    // Antes: tests/migracion-escritor-guardian.test.ts (ADR 0059). `abrirDealHistorico` abre un deal en cualquier etapa
    // sin pasar por `queLeFalta`: una pantalla que lo use crea un Completo sin abono y no lanza ningun error.
    // Se caza cualquier MENCION (un import con alias o un callback tambien), no solo la llamada.
    selectors: [
      { selector: "Identifier[name=/^(abrirDealHistorico|registrarAbonoHistorico|registrarLlamadaHistorica)$/]", message: "Lo historico solo lo escribe la migracion (ADR 0059): lib/migracion/." },
      { selector: "Property[key.name='huellaMigracion']", message: "Marcar una fila como migrada es de la migracion (ADR 0059)." },
      { selector: "TSPropertySignature[key.name='huellaMigracion']", message: "Marcar una fila como migrada es de la migracion (ADR 0059)." },
    ],
    // `schema.ts` DEFINE la columna y `deshacer/registro.ts` la CLASIFICA (ADR 0117); ninguno la escribe.
    excepto: [
      "lib/deals/mover-etapa.ts",
      "lib/deals/historico.ts",
      "lib/db/schema.ts",
      "lib/deshacer/registro.ts",
      "lib/migracion/**",
    ],
  },
  {
    // Antes: guardian de tests/migracion-deshacer.test.ts. Solo la reversa de la migracion borra filas operativas.
    selectors: [
      { selector: "CallExpression[callee.property.name='delete'][arguments.0.name=/^(deals|calls|abonos|dealActividades|dealEtapaHistorial)$/]", message: "Solo lib/migracion/deshacer.ts borra deals, llamadas, abonos, actividades o historial." },
    ],
    excepto: ["lib/migracion/deshacer.ts"],
  },
  {
    // Antes: guardian de tests/archivos.test.ts. Solo lib/archivos conoce las rutas REST del almacen.
    selectors: [
      { selector: "Literal[value=/.storage.v1/]", message: "Las rutas REST del almacen son de lib/archivos/." },
      { selector: "TemplateElement[value.raw=/.storage.v1/]", message: "Las rutas REST del almacen son de lib/archivos/." },
    ],
    excepto: ["lib/archivos/**"],
  },
  {
    // Antes: tests/busqueda-sin-tildes.test.ts. `ilike` se salta las tildes: la busqueda pasa por sinTildes/unaccent.
    selectors: [
      { selector: "CallExpression[callee.name='ilike']", message: "No uses ilike: se salta las tildes. Busca con la normalizacion sin tildes." },
      { selector: "CallExpression[callee.property.name='ilike']", message: "No uses ilike: se salta las tildes. Busca con la normalizacion sin tildes." },
    ],    solo: ["lib/**", "app/**", "components/**"],
  },
  {
    // Antes: guardian de tests/actividades-del-deal.test.ts. La actividad `intento` esta retirada; registrarActividad la rechaza.
    selectors: [
      { selector: "Property[key.name='tipo'][value.value='intento']", message: "La actividad de tipo intento esta retirada: nadie la escribe." },
    ],
  },
  {
    // Antes: tests/ingesta-estado.test.ts (ADR 0069). La tabla estados_llegada se borro con la 0059; resucitarla hace que
    // la variable `estado` del formulario vuelva a decidir en silencio.
    selectors: [
      { selector: "Identifier[name='estadosLlegada']", message: "estados_llegada esta retirada (ADR 0069): solo schema.ts la nombra." },
    ],
    excepto: ["lib/db/schema.ts"],
  },
  {
    // Antes: tests/ingesta-estado.test.ts (ADR 0054 y 0061). La ingesta guarda el Estado que manda el formulario; no lo calcula.
    selectors: [
      { selector: "Identifier[name='calificarEnvio']", message: "La ingesta no califica el Estado desde las respuestas (ADR 0054 y 0061)." },
    ],
    solo: ["lib/ingesta/**"],
  },
  {
    // Antes: tests/ingesta-estado.test.ts. 29-sep de Tactical: la regla de deals comparaba contra un valor del Estado.
    selectors: [
      { selector: "Literal[value=/^(descartado|setteo_no_calificado|con_calendly)$/]", message: "La regla de deals no compara contra un valor del Estado escrito (29-sep de Tactical)." },
    ],
    solo: ["lib/ingesta/regla-de-deals.ts"],
  },
  {
    // Antes: tests/ingesta-estado.test.ts (B4 de la auditoria 114). Los titulos de pregunta de Typeform los dice la plantilla
    // del programa o el mapeo de la fuente, no `lib/ingesta/`. `adaptador-dapta.ts` usa llaves FIJAS de Dapta, no titulos (ticket 130).
    selectors: [
      { selector: "Literal[value=/correo electr|whatsapp|nombre completo|agenda aqu|celular|ganas mensualmente/i]", message: "Un titulo de pregunta de Typeform no vive en lib/ingesta/: sale de la plantilla o del mapeo de la fuente." },
      { selector: "TemplateElement[value.raw=/correo electr|whatsapp|nombre completo|agenda aqu|celular|ganas mensualmente/i]", message: "Un titulo de pregunta de Typeform no vive en lib/ingesta/: sale de la plantilla o del mapeo de la fuente." },
    ],
    solo: ["lib/ingesta/**"],
    excepto: ["lib/ingesta/adaptador-dapta.ts"],
  },
  {
    // Antes: tests/link-de-captacion.test.ts (ADR 0051, AGENTS.md). Un solo generador de links con UTM.
    selectors: [
      { selector: "CallExpression[callee.property.name=/^(set|append)$/][arguments.0.value='utm_source']", message: "Los links con UTM los arma lib/atribucion/link-de-captacion.ts (ADR 0051)." },
      { selector: "NewExpression[callee.name='URLSearchParams'] > ObjectExpression > Property[key.name='utm_source']", message: "Los links con UTM los arma lib/atribucion/link-de-captacion.ts (ADR 0051)." },
      { selector: "TemplateElement[value.raw=/[?&]utm_source=$/]", message: "Los links con UTM los arma lib/atribucion/link-de-captacion.ts (ADR 0051)." },
    ],
    excepto: ["lib/atribucion/link-de-captacion.ts"],
  },
  {
    // Antes: guardian de tests/closer-identidad.test.ts (ADR 0030, ticket 028). La identidad de un closer se compara por
    // el modulo (normaliza mayusculas y espacios); una comparacion cruda parte a un closer en dos sin error.
    // Las formas autorizadas (`claveDeCloserSql(calls.closerId)`, `igualCloser(...)`) envuelven la columna y no son hijas directas.
    selectors: [
      { selector: "CallExpression[callee.name='eq'][arguments.0.property.name=/^(closerId|responsableCloserId)$/]", message: "Compara closers con igualCloser (lib/closers/identidad.ts, ADR 0030)." },
      { selector: "CallExpression[callee.property.name='groupBy'] > MemberExpression[property.name=/^(closerId|responsableCloserId)$/]", message: "Agrupa por claveDeCloserSql o claveCloserSql (lib/closers/identidad.ts, ADR 0030)." },
      { selector: "BinaryExpression[operator=/^[!=]==$/] > MemberExpression[property.name=/^(closerId|responsableCloserId)$/]", message: "Compara closers con mismoCloser (lib/closers/identidad.ts, ADR 0030)." },
    ],
    excepto: ["lib/closers/identidad.ts"],
  },
  {
    // Antes: guardian de tests/captacion-del-closer.test.ts (ADR 0044 punto 2). Solo la ingesta escribe quien trajo al lead.
    selectors: [
      { selector: "Property[key.name='traidoPorUserId']", message: "Solo la ingesta escribe traido_por_user_id (ADR 0044 punto 2)." },
      { selector: "TSPropertySignature[key.name='traidoPorUserId']", message: "Solo la ingesta escribe traido_por_user_id (ADR 0044 punto 2)." },
    ],
    excepto: ["lib/ingesta/ingerir.ts", "lib/db/schema.ts"],
  },
  {
    // Antes: guardian de tests/filtros-url.test.ts. Un buscador de lista guarda `q` en la URL: BuscadorUrl.
    selectors: [
      { selector: "JSXAttribute[name.name='buscador'] > JSXExpressionContainer > JSXElement > JSXOpeningElement > JSXIdentifier[name!='BuscadorUrl']", message: "Los buscadores de listas deben guardar q en la URL con BuscadorUrl." },
    ],
  },
  {
    // Antes: tests/fuentes-webhook.test.ts. El secreto del webhook se escribe solo por escribirSecreto (lib/catalogo/fuentes.ts).
    selectors: [
      { selector: "CallExpression[callee.property.name='set'] > ObjectExpression > Property[key.name='secretoWebhook']", message: "Solo escribirSecreto (lib/catalogo/fuentes.ts) actualiza el secreto del webhook." },
    ],
    excepto: ["lib/catalogo/fuentes.ts"],
  },
  {
    // Antes: guardian de tests/volver.test.ts. El unico lugar que arma `desde=` es lib/navegacion/volver.ts (enlaceConVuelta).
    selectors: [
      { selector: "Literal[value=/desde=|[?]desde/]", message: "Usa enlaceConVuelta (lib/navegacion/volver.ts) en vez de concatenar ?desde a mano." },
      { selector: "TemplateElement[value.raw=/desde=|[?]desde/]", message: "Usa enlaceConVuelta (lib/navegacion/volver.ts) en vez de concatenar ?desde a mano." },
    ],
    solo: ["app/**", "components/**"],
  },
  {
    // Antes: tests/respuestas-sin-callejon.test.ts. 30-oct: `router.push(ficha?accion=...)` y ninguna pantalla leia `?accion=`.
    selectors: [
      { selector: "Literal[value=/[?&]accion=/]", message: "Ninguna pantalla lee ?accion=: la respuesta abre su pop-up donde se toma." },
      { selector: "TemplateElement[value.raw=/[?&]accion=/]", message: "Ninguna pantalla lee ?accion=: la respuesta abre su pop-up donde se toma." },
    ],
    solo: ["app/**", "components/**", "lib/**"],
  },
  {
    // Antes: tests/volver-de-listas.test.ts. Toda lista nace con su vuelta: el href a hub/lista lo arman solo estos dos constructores.
    selectors: [
      { selector: "Literal[value=/hub.lista[?]/]", message: "Arma el href de una lista con urlDeLista (lib/queries/vista-metrica.ts)." },
      { selector: "TemplateElement[value.raw=/hub.lista[?]/]", message: "Arma el href de una lista con urlDeLista (lib/queries/vista-metrica.ts)." },
      { selector: "BinaryExpression[operator='+'][left.value=/hub.lista$/][right.value=/^[?]/]", message: "Arma el href de una lista con urlDeLista (lib/queries/vista-metrica.ts)." },
    ],
    solo: ["app/**", "components/**", "lib/**"],
    excepto: ["lib/queries/vista-metrica.ts", "lib/queries/vista-todos.ts"],
  },
  {
    // Antes: guardian de tests/mcp-acciones.test.ts. Un solo lugar inserta en deal_etapa_historial: el motor (ADR 0037).
    selectors: [
      { selector: "CallExpression[callee.property.name='insert'][arguments.0.name='dealEtapaHistorial']", message: "Solo moverEtapa (lib/deals/mover-etapa.ts) escribe el historial de etapas." },
    ],
    excepto: ["lib/deals/mover-etapa.ts"],
  },
  {
    // Antes: guardian de tests/otros-programas-del-correo.test.ts (ADR 0043 punto 6, ticket 091). La unica visibilidad cruzada
    // de un lead la llama SOLO la ficha del Lead: una metrica que la importe podria sumar dos programas.
    selectors: [
      { selector: "Identifier[name='otrosProgramasDelCorreo']", message: "otrosProgramasDelCorreo es solo de la ficha del Lead (ADR 0043 punto 6)." },
      { selector: "ImportDeclaration[source.value=/otros-programas-del-correo/]", message: "otrosProgramasDelCorreo es solo de la ficha del Lead (ADR 0043 punto 6)." },
    ],
    excepto: [
      "lib/queries/otros-programas-del-correo.ts",
      "lib/leads/ficha/cargar-datos.ts",
      "components/leads/ficha-lead.tsx", // solo importa el TIPO para pintar el aviso
    ],
  },
  {
    // Antes: guardian de tests/por-solicitud.test.ts. Cada llamada a unaVezPorSolicitud nombra literalmente la pregunta,
    // o dos lecturas distintas comparten clave sin error.
    selectors: [
      { selector: "CallExpression[callee.name='unaVezPorSolicitud']:not([arguments.1.type='Literal']):not([arguments.1.callee.name='claveDe'])", message: "unaVezPorSolicitud exige la pregunta como cadena literal (o claveDe con cadena literal)." },
      { selector: "CallExpression[callee.name='unaVezPorSolicitud'][arguments.1.callee.name='claveDe'][arguments.1.arguments.0.type!='Literal']", message: "unaVezPorSolicitud exige la pregunta como cadena literal (o claveDe con cadena literal)." },
    ],
    solo: ["lib/**"],
  },
  {
    // Antes: guardianes de tests/ingesta-regla-de-deals.test.ts (hallazgos A1 y A3 del ticket 114). La lista de etapas que una
    // cita mueve a Agendado vive UNA vez en lib/deals/etapas.ts (la de la ingesta ya habia divergido de las otras dos copias),
    // y RESULTADOS_FALLIDOS vive UNA vez en mover-etapa.ts.
    selectors: [
      { selector: "Identifier[name='ETAPAS_QUE_AVANZAN_A_AGENDADO']", message: "Esa lista local esta retirada: importa unaCitaMueveAAgendado de lib/deals/etapas.ts." },
    ],
  },
  {
    selectors: [
      { selector: "FunctionDeclaration[id.name='unaCitaMueveAAgendado']", message: "unaCitaMueveAAgendado se declara solo en lib/deals/etapas.ts: importala." },
    ],
    excepto: ["lib/deals/etapas.ts"],
  },
  {
    selectors: [
      { selector: "VariableDeclarator[id.name='RESULTADOS_FALLIDOS']", message: "RESULTADOS_FALLIDOS se declara solo en lib/deals/mover-etapa.ts: importala." },
    ],
    excepto: ["lib/deals/mover-etapa.ts"],
  },
  {
    // Antes: tests/rol-de-vista-centralizado.test.ts (ticket 028 y 032, ADR 0025 punto 5, ADR 0028). Nadie decide alcance ni permiso
    // leyendo `session.user.rol` crudo ni comparando un `.rol` con un literal: la respuesta es `rolDeVista(session)` y las
    // capacidades centrales. `actor.rol !== "closer"` dejo al developer sin poder crear personas, sin error. Solo app/, lib/ y scripts/.
    // Forma A: cualquier `.rol` contra un literal de rol, en cualquier orden y con ==, !=, === o !==.
    selectors: [
      { selector: "BinaryExpression[operator=/^[!=]==?$/][left.property.name='rol'][right.value=/^(gerente|closer|developer)$/]", message: "No compares un rol con un literal: usa las capacidades centrales (ADR 0025 punto 5, ADR 0028)." },
      { selector: "BinaryExpression[operator=/^[!=]==?$/][right.property.name='rol'][left.value=/^(gerente|closer|developer)$/]", message: "No compares un rol con un literal: usa las capacidades centrales (ADR 0025 punto 5, ADR 0028)." },
    ],
    solo: ["app/**", "lib/**", "scripts/**"],
    // Validacion de FORMULARIO (que campos exige el rol que se asigna), no autorizacion de un actor.
    excepto: ["lib/catalogo/usuarios.ts"],
  },
  {
    // Forma B: `session.user.rol` crudo, sin proyectar por la vista. Las excepciones leen el rol como IDENTIDAD ("quien eres
    // realmente"), no como proyeccion de una pantalla: la definicion misma, el callback de Auth.js que lo escribe, el cambio de
    // vista y su selector, /api/me, el aterrizaje al entrar y el mensaje de un Mi espacio vacio.
    selectors: [
      { selector: "MemberExpression[property.name='rol'][object.property.name='user']", message: "No leas session.user.rol crudo: usa rolDeVista(session) (ADR 0028)." },
    ],
    solo: ["app/**", "lib/**", "scripts/**"],
    excepto: [
      "lib/auth/vista.ts",
      "lib/auth/config.ts",
      "app/(app)/acciones-vista.ts",
      "app/(app)/layout.tsx",
      "app/api/me/route.ts",
      "app/page.tsx",
      "app/login/page.tsx",
      "app/(app)/mi-espacio/page.tsx",
    ],
  },
  {
    // Antes: tests/mcp-guardian.test.ts. El MCP no hace SQL propio: lee y escribe por las funciones de la app (mismos filtros y
    // alcance que la pantalla). Solo su token, su sesion, su bitacora y sus vistas previas tocan su tabla.
    selectors: [
      { selector: "MemberExpression[object.name='db'][property.name=/^(select|insert|update)$/]", message: "El MCP no hace SQL propio: usa las funciones de la app (lib/mcp/token.ts, sesion.ts, bitacora.ts y vistas-previas.ts son las unicas con tabla propia)." },
      { selector: "CallExpression[callee.property.name='from']", message: "El MCP no hace SQL propio: usa las funciones de la app." },
      { selector: "TaggedTemplateExpression[tag.name='sql']", message: "El MCP no hace SQL propio: usa las funciones de la app." },
    ],
    solo: ["lib/mcp/**"],
    excepto: ["lib/mcp/token.ts", "lib/mcp/sesion.ts", "lib/mcp/bitacora.ts", "lib/mcp/vistas-previas.ts"],
  },
  {
    // Antes: tests/mcp-guardian.test.ts. Ninguna herramienta del MCP decide el rol a mano: llega en el contexto ya resuelto.
    selectors: [
      { selector: "BinaryExpression[operator=/^===?$/][left.name='rol'][right.type='Literal']", message: "Una herramienta del MCP no decide el rol a mano: usa sus capacidades (puede)." },
      { selector: "BinaryExpression[operator=/^===?$/][right.name='rol'][left.type='Literal']", message: "Una herramienta del MCP no decide el rol a mano: usa sus capacidades (puede)." },
    ],
    solo: ["lib/mcp/**"],
  },
  {
    // Antes: tests/explicaciones-de-recorridos.test.ts. El catalogo y el constructor de explicaciones son puros: sin valores
    // de la base ni de las consultas (los tipos si se pueden importar).
    patterns: [
      { group: ["@/lib/db", "@/lib/db/**", "@/lib/queries", "@/lib/queries/**"], allowTypeImports: true, message: "Este modulo es puro: no importa valores de la base ni de las consultas." },
    ],
    solo: ["lib/metricas/explicacion.ts", "lib/escalones.ts"],
  },
  {
    // Antes: guardian de tests/configuracion-del-programa.test.ts. 14-nov: vincular la cuenta de Meta desde el recorrido de un programa
    // INACTIVO respondia "No autorizado": la accion preguntaba `programaEnAlcance`, que solo ve programas activos. Toda accion que
    // un editor del recorrido llama autoriza con `exigirAccesoAlPrograma` (ADR 0094 punto 4, ADR 0132).
    selectors: [
      { selector: "CallExpression[callee.name='programaEnAlcance']", message: "Las acciones del recorrido autorizan con exigirAccesoAlPrograma: programaEnAlcance solo ve programas activos (ADR 0094 punto 4, ADR 0132)." },
    ],
    solo: [
      "app/(app)/p/[programa]/programa/acciones-programa.ts",
      "app/(app)/p/[programa]/programa/acciones-integraciones.ts",
      "app/(app)/p/[programa]/programa/acciones-fuentes.ts",
      "app/(app)/p/[programa]/programa/acciones-meta.ts",
      "app/(app)/p/[programa]/programa/acciones.ts",
      "app/(app)/ajustes/usuarios/acciones.ts",
    ],
  },
  {
    // Antes: guardian de tests/series-pasos.test.ts. Las series del Hub toman su eje de `lib/series-pasos.ts` (paso por defecto
    // segun el largo del periodo, comparacion dia a dia): ni un numero de meses escrito a mano ni su propio `moverMes`.
    selectors: [
      { selector: "CallExpression[callee.name='moverMes']", message: "Una serie del Hub no compara por su cuenta: usa el eje de lib/series-pasos.ts." },
      { selector: "CallExpression[callee.object.name='Array'][callee.property.name='from'][arguments.0.properties.0.key.name='length'][arguments.0.properties.0.value.type='Literal']", message: "Una serie del Hub no escribe un numero fijo de puntos: su largo sale del periodo (lib/series-pasos.ts)." },
      { selector: "Literal[value=/Últimos (seis|\\d+) meses|independientemente de “Comparar con”/]", message: "Una serie del Hub no fija una ventana de meses ni ignora Comparar con." },
    ],
    solo: [
      "lib/queries/series-dinero.ts",
      "lib/series-pasos.ts",
      "components/dashboard/graficas-de-dinero.tsx",
      "components/dashboard/dinero.tsx",
      "components/deals-contra-agendas.tsx",
    ],
  },
  {
    // Antes: guardian de tests/alcance-de-sesion.test.ts (ADR 0048 punto 1, ticket 094). "Que programas ve esta sesion" tiene UNA
    // respuesta (lib/auth/alcance.ts); una consulta con su propio join a `miembros_programa` se desincroniza sin lanzar error.
    // Las excepciones NO limitan una lectura al alcance de una sesion; son una de estas cuatro cosas:
    //  - la definicion: schema.ts (la tabla) y alcance.ts (la funcion);
    //  - el lado de ESCRITURA: acceso-programa.ts, catalogo/usuarios.ts, mutations/personas.ts, queries/programas.ts (alcance de
    //    edicion) y las acciones que resuelven el programa de la membresia que van a tocar antes de autorizarla;
    //  - la IDENTIDAD de un miembro, sin sesion: host de una cita (calendly/*), dueno de un deal (deals/duenos.ts,
    //    setter-por-defecto.ts), closer que trajo al lead (atribucion/captacion-del-closer.ts), nombre de un dueno entre los
    //    miembros (queries/resolver-filtros.ts) y destinatarios de un aviso (avisos-cs/pendientes.ts);
    //  - la configuracion de una membresia por id (app/(app)/acciones-calendly.ts).
    selectors: [
      { selector: "Identifier[name='miembrosPrograma']", message: "El alcance se pregunta con lib/auth/alcance.ts (programasVisibles, idsDeProgramasVisibles, programaEnAlcance), no con un join propio a miembros_programa (ADR 0048)." },
    ],
    solo: ["lib/**", "app/**"],
    excepto: [
      "lib/db/schema.ts",
      "lib/auth/alcance.ts",
      "lib/catalogo/acceso-programa.ts",
      "lib/catalogo/usuarios.ts",
      "lib/mutations/personas.ts",
      "lib/queries/programas.ts",
      "lib/queries/resolver-filtros.ts",
      "lib/avisos-cs/pendientes.ts",
      "lib/atribucion/captacion-del-closer.ts",
      "lib/deals/duenos.ts",
      "lib/deals/setter-por-defecto.ts",
      "lib/calendly/colgar-llamada.ts",
      "lib/calendly/cuentas.ts",
      "lib/calendly/escritura.ts",
      "lib/calendly/pertenencia.ts",
      "lib/calendly/round-robin.ts",
      "app/(app)/acciones-calendly.ts",
      "app/(app)/ajustes/usuarios/acciones.ts",
      "app/(app)/p/[programa]/programa/acciones-programa.ts",
    ],
  },
  {
    // Antes: tests/filtros-fecha-listas.test.ts (ticket 141). La "ultima actividad" de un deal tiene UNA definicion
    // (lib/queries/ultima-actividad.ts) que importan el Inbox y la lista de deals; dos copias dan dos fechas para el mismo deal.
    selectors: [
      { selector: "FunctionDeclaration[id.name='ultimaActividadPorDeal']", message: "ultimaActividadPorDeal se define solo en lib/queries/ultima-actividad.ts: importala." },
    ],
    excepto: ["lib/queries/ultima-actividad.ts"],
  },
  {
    // Antes: guardian de tests/caja-vacia-guardian.test.ts (D-3 de la auditoria del 18-nov). «Entro a caja» sin abonos se pintaba de
    // cuatro maneras (—, USD 0, un texto, nada). Por N5 una suma sin filas es 0 en la moneda del programa y el unico sitio que lo
    // decide es `cajaConMonedaDelPrograma` (lib/queries/dashboard.ts): nadie pregunta si la caja esta vacia ni fabrica un cero.
    // components/cifra-con-lista.tsx es un subtotal de LISTA (la mayoria de las listas no tiene montos), no «Entro a caja».
    selectors: [
      { selector: "MemberExpression[property.name='length'][object.name='caja']", message: "No preguntes si la caja esta vacia: el vacio ya viene como 0 desde la fuente (cajaConMonedaDelPrograma)." },
      { selector: "MemberExpression[property.name='length'][object.property.name='caja']", message: "No preguntes si la caja esta vacia: el vacio ya viene como 0 desde la fuente (cajaConMonedaDelPrograma)." },
      { selector: "ObjectExpression:has(> Property[key.name='moneda'][value.value='USD']):has(> Property[key.name='total'][value.value=0])", message: "No fabriques una caja en cero a mano: usa cajaConMonedaDelPrograma." },
      { selector: "Literal[value=/ningún abono/i]", message: "No pintes un texto propio para la caja vacia." },
      { selector: "TemplateElement[value.raw=/ningún abono/i]", message: "No pintes un texto propio para la caja vacia." },
      { selector: "JSXText[value=/ningún abono/i]", message: "No pintes un texto propio para la caja vacia." },
    ],
    solo: ["app/**", "components/**", "lib/**"],
    excepto: ["lib/queries/dashboard.ts", "components/cifra-con-lista.tsx"],
  },
  {
    // Antes: tests/embudo-comercial.test.ts. El area de un deal sale de la derivacion central (`dimensionesDeOrigen`,
    // lib/queries/hechos/origen.ts); un `case` propio en SQL la desincroniza de las demas cifras.
    selectors: [
      { selector: "VariableDeclarator[id.name='areaDelDeal'][init.type='TaggedTemplateExpression']", message: "El area del deal sale de dimensionesDeOrigen (lib/queries/hechos/origen.ts), no de un SQL propio." },
    ],
    solo: ["lib/queries/embudo-comercial.ts"],
  },
];

function restringir(reglas) {
  const aReglas = (activas) => ({
    "no-restricted-imports": [
      "error",
      { paths: activas.flatMap((r) => r.paths ?? []), patterns: activas.flatMap((r) => r.patterns ?? []) },
    ],
    "no-restricted-syntax": ["error", ...activas.flatMap((r) => r.selectors ?? [])],
  });
  // `lugar` es un archivo o un glob `carpeta/**`; uno cubre a otro si es el mismo o su carpeta contiene al otro.
  const cubre = (lugar, otro) => lugar === otro || (lugar.endsWith("/**") && otro.startsWith(lugar.slice(0, -2)));
  const aplica = (regla, lugar) =>
    (regla.solo ?? []).length === 0 || regla.solo.some((s) => cubre(s, lugar))
      ? !(regla.excepto ?? []).some((e) => cubre(e, lugar))
      : false;
  // Un bloque por cada carpeta o archivo que alguna regla nombra: globs primero y, entre ellos, de general a especifico;
  // al final los archivos exactos. ESLint se queda con el ULTIMO bloque que cubre un archivo, y ese bloque calcula
  // las reglas del lugar mas especifico que lo contiene.
  const lugares = [...new Set(reglas.flatMap((r) => [...(r.solo ?? []), ...(r.excepto ?? [])]))]
    .sort((a, b) => Number(b.endsWith("/**")) - Number(a.endsWith("/**")) || a.length - b.length);
  return [
    { files: CODIGO, rules: aReglas(reglas.filter((r) => (r.solo ?? []).length === 0)) },
    ...lugares.map((lugar) => ({ files: [lugar.replace(/[[\]]/g, "\\$&")], rules: aReglas(reglas.filter((r) => aplica(r, lugar))) })),
  ];
}

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Worktrees de otras sesiones: cada uno es una copia del repo y lint se queda sin memoria.
    ".claude/**",
  ]),
  ...restringir(REGLAS_DE_ARQUITECTURA),
]);

export default eslintConfig;
