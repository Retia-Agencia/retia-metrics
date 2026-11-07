---
id: 348
etapa: mcp
serves: "Daily del 28-oct (F5): darle vida al CRM, paso 1 · ADR 0119 (fase 1) · contrato C-1 y C-2 · ADR 0115"
depends: []
status: todo
---

# 348 — El MCP del CRM, fase 1: la base, solo lectura, solo developers, desde Claude Code

> **Para una sesión sin contexto.** El MCP es un proyecto grande en tres tickets: **348 (este, la base)**, 383 (OAuth y
> todos los roles) y 384 (escrituras). El diseño está cerrado en el **ADR 0119**: léelo entero antes de escribir una
> línea y no re-litigues sus decisiones. Lo que este ticket construye lo usan los otros dos **sin cambiarlo**: si algo
> de aquí obliga a reescribirse en el 383 o el 384, está mal hecho.

## Qué es y para qué

Un servidor MCP (Model Context Protocol: el estándar con el que una IA como Claude o ChatGPT usa herramientas de un
sistema externo) que vive **dentro de esta misma app de Next**. Cada persona del equipo conecta su propia IA y consulta
o trabaja el CRM desde el chat, **como ella misma**, viendo exactamente lo que la app le muestra y nada más. Lo pidió la
daily del 28-oct (Michael y Mani): MCP primero, luego Juanito ampliado, luego IA interna; con un MCP el CRM no paga
inferencia, la paga cada cuenta.

La fase 1 la usan **solo los developers, desde Claude Code, solo leyendo**. Sirve para validar las herramientas, la
identidad, el alcance y la frontera de programa antes de abrirlo a nadie.

## Antes de empezar, lee (en este orden)

1. `docs/adr/0119-el-mcp-del-crm.md`: el diseño completo y por qué.
2. `AGENTS.md` entero, en especial: "Restricciones no-negociables" (programa como frontera, dedup, vigencia, alcance,
   el developer sin restricciones, "nada de la app es público" con la excepción del MCP ya nombrada), la tabla de
   "Contratos" y "Conventions" (Next 16 es distinto: lee `node_modules/next/dist/docs/` antes de escribir una ruta; el
   `proxy.ts`; `revalidatePath`; migraciones).
3. `docs/metricas.md` §0: qué función responde cada concepto. El MCP no define ninguna métrica: las pide.
4. ADR 0028 y ticket 172 ("ver como" solo lee), ADR 0048 y 0094 (alcance), ADR 0025 (developer), ADR 0115 (las nueve
   reglas de norte de las métricas; N3 cobertura y N5 vocabulario aplican a lo que devuelve el MCP).
5. La spec de autorización de MCP: https://modelcontextprotocol.io/specification/latest/basic/authorization (para que
   la 401 de este ticket ya sea la que el 383 necesita).
6. El README de `mcp-handler` (https://github.com/vercel/mcp-handler) y, una vez instalado, su código en `node_modules`:
   la API exacta (`createMcpHandler`, `withMcpAuth`, `protectedResourceHandler`) se verifica contra la versión
   instalada, no contra la memoria.

## Decisiones cerradas (ADR 0119, no se re-abren)

- Un solo servidor, dentro de la app, en TypeScript. Nada de servidor aparte ni Python ni API REST nueva.
- Cada herramienta es un **adaptador delgado**: zod → sesión del token → función de `lib/`. Cero SQL propio.
- Permiso = **rol ∩ scope del token**. El rol decide qué, el scope (`lectura` | `escritura`) decide si escribe.
- El token personal **no vence**; se quita revocándolo. Rol y alcance se revalidan contra `users` en **cada** llamada.
- "Ver como" existe solo para el developer y **solo lee**.
- Datos personales: **lo mismo que la app le muestra a ese rol**, ni más ni menos.
- Topes blandos, nunca un cupo diario. Bitácora de cada llamada.

## Arquitectura

```
Claude Code ──HTTP + Authorization: Bearer retia_mcp_…──▶ app/api/mcp/route.ts  (mcp-handler)
                                                            │
                                    1. autenticar  ─────────┤ lib/mcp/token.ts   (hash → fila → usuario activo)
                                    2. sesión      ─────────┤ lib/mcp/sesion.ts  (Session igual a la de la app)
                                    3. herramientas por rol ┤ lib/mcp/herramientas/*.ts (registro exhaustivo)
                                    4. llamar lib/ ─────────┤ lib/queries/*, lib/auth/alcance.ts …
                                    5. bitácora + tope ─────┘ lib/mcp/bitacora.ts
```

Todo lo del MCP vive en **`lib/mcp/`** (dominio propio, ADR 0033) y la ruta solo coordina. Ningún componente ni pantalla
importa de `lib/mcp/` salvo Mi espacio para emitir y revocar tokens.

### 1. La ruta

- `app/api/mcp/route.ts`, exporta `GET` y `POST` con `createMcpHandler` de **`mcp-handler` 2.x** sobre
  **`@modelcontextprotocol/server` 2.x** (requiere zod ^4.2 y Node 20+; el repo ya tiene zod 4). Se instalan en este
  ticket y no antes (ADR 0006). Ojo: hoy `node_modules` trae `@modelcontextprotocol/sdk` 1.30 **de rebote por shadcn**;
  no lo uses: el 2.x es otro paquete.
- Servidor **sin estado** (stateless): cada llamada se autentica sola. Consecuencia: no hay "sesión MCP" donde guardar
  una vista o un programa elegido; todo viaja como argumento.
- Envuelto en `withMcpAuth` con un verificador propio (`lib/mcp/token.ts`). Sin token, token desconocido o revocado:
  **401 sin cuerpo útil** con `WWW-Authenticate: Bearer resource_metadata="<url>/.well-known/oauth-protected-resource"`.
  Servir ya ese documento (`protectedResourceHandler`) aunque en la fase 1 no haya servidor de autorización: el 383 solo
  le agrega `authorization_servers`.
- **`proxy.ts`**: hoy manda a `/login` todo lo que no esté en `esRutaPublica`. Hay que agregar `/api/mcp` y
  `/.well-known/oauth-protected-resource` con un comentario como los del semáforo. Sin esto el MCP responde un redirect
  a una página de login y Claude Code lo reporta como "servidor roto", sin pista.
- Ruta dinámica (`force-dynamic` o lo que pida Next 16 para un route handler: verificar en sus docs). Nada de caché.

### 2. Tokens (`lib/mcp/token.ts` + tabla nueva)

- Formato: `retia_mcp_` + 32 bytes aleatorios (`crypto.randomBytes`) en base64url. El prefijo deja que un escáner de
  secretos lo reconozca.
- Tabla **`mcp_tokens`**: `id`, `user_id` (FK a `users`), `nombre` (lo escribe la persona: "Claude Code de mi Mac"),
  `hash` (sha256 del token, **índice único**), `scope` (`lectura` | `escritura`), `tipo` (`personal` en esta fase; el
  383 agrega `oauth`: deja la columna ya, con un check o enum de dos valores), `creado_en`, `ultimo_uso_en`,
  `revocado_en`, `revocado_por_user_id`. El 383 le suma columnas (cliente, vencimiento, refresh); no la diseñes para que
  eso obligue a migrar datos.
- El valor se muestra **una sola vez** al crearlo y nunca se guarda en claro, ni en `change_log` ni en logs (molde de
  `escribirSecreto` de `lib/catalogo/fuentes.ts`, AGENTS.md "Secretos").
- Verificar: hash del header → fila → `revocado_en` nulo → usuario existe y `activo`. Cualquier falla, 401. Actualizar
  `ultimo_uso_en` (como mucho una vez por minuto, para no escribir en cada llamada).
- Crear y revocar dejan rastro en `change_log` (quién, cuándo, qué token por id y nombre; **nunca** el valor).

### 3. La sesión desde el token (`lib/mcp/sesion.ts`) — la pieza más delicada

Casi todo `lib/` recibe un `Session` de next-auth (`programasVisibles`, `alcanceDeDeals`, `rolDeVista`…) y lo arman las
guardas desde la cookie. El MCP no tiene cookie. Hay que construir **el mismo objeto `Session`** (tipo en
`types/next-auth.d.ts`: `id`, `rol`, `operaComoCloser`, `closerId`, `alcanceLimitado`, `suplantadoPor`) con **la misma
lógica** que `revalidarToken` (`lib/auth/revalidacion.ts:57`).

- **No copies esa lógica.** Extrae de `revalidarToken` una función que dado un usuario devuelva esos campos, y que la
  usen las dos (la regla de AGENTS.md: si dos lugares responden la misma pregunta, la respuesta vive en un módulo).
  Con un test que compare las dos salidas para un gerente con alcance, uno sin alcance, un closer y un developer.
- **"Ver como"** hoy se resuelve leyendo la cookie `vista` dentro de `leerRolDeVista` y `leerSesionEfectiva`
  (`lib/auth/vista.ts`). El MCP pasa la vista como **argumento opcional `vista`** de cada herramienta (mismo formato que
  la cookie: `gerente`, `closer`, `usuario:<id>`…). Extrae el cuerpo de esas funciones a variantes que reciban la vista
  como parámetro (la de la cookie pasa a ser un envoltorio que la lee y llama a la nueva). Comportamiento idéntico:
  solo el developer la puede usar; con otro rol, la vista se **rechaza con error** (no se ignora en silencio, así el
  modelo no cree que está viendo como otro).
- Con suplantación, **toda herramienta de escritura se niega** (reja del ticket 172, `lib/auth/guards.ts:54`). En esta
  fase no hay escrituras, pero el chequeo vive en la sesión del MCP desde ya para que el 384 no lo pueda olvidar.
- Guardián existente que te va a morder: `tests/rol-de-vista-centralizado.test.ts` falla si alguien decide alcance o
  permiso leyendo `session.user.rol` crudo. Usa `rolDeVista` (o su variante sin cookie) y, si una lectura es de
  identidad, nómbrala como excepción en ese test con la razón.

### 4. Herramientas (`lib/mcp/herramientas/`)

**Molde de cada herramienta** (un archivo por familia, un registro exhaustivo en `lib/mcp/herramientas/index.ts`, como
`PROVEEDORES` en `lib/ingesta/proveedores.ts`):

- `nombre` en snake_case español (`consultar_metrica`), `descripcion` en español escrita **para el modelo**: qué
  responde, qué no, unidades, que las fechas son de Bogotá, que el dinero siempre trae su moneda, cómo paginar. La
  calidad de esta descripción decide si el modelo la usa bien: es parte del trabajo, no un adorno.
- `entrada`: esquema zod `.strict()`. `programa` (slug) **obligatorio** en toda herramienta que lea datos de un
  programa; se resuelve con `programaVisiblePorSlug` (`lib/auth/alcance.ts`). Un programa fuera del alcance responde
  **"No existe ese programa"**, igual que el 404 de la app: nunca "no tienes permiso" (eso confirma que existe).
- `puede(sesion)`: la capacidad que decide si la herramienta aparece, escrita con las funciones de `lib/auth/roles.ts`
  (`trabajaLeads`, `manejaPauta`, `veEquipoComercial`, `esAdministrador`…). **Nunca `rol === "..."`** (AGENTS.md: eso
  deja afuera al developer y es un bug).
- `anotaciones`: `readOnlyHint: true` en todas las de esta fase.
- `ejecutar`: llama la función de `lib/` y devuelve **texto legible + `structuredContent`** con la misma información.
  Formato por `lib/format.ts` (miles con punto, USD con dos decimales, `—` cuando no se puede calcular, `0` es cero).
  Toda razón trae su **cobertura** (N3): si el dato es parcial, lo dice.
- Errores: un `ErrorDeApp` sale como resultado de herramienta con `isError: true` y su mensaje en español; un error
  interno **nunca** filtra detalle (contrato de `respuestaDeError` en `lib/errors.ts`, `tests/errores.test.ts`).
- Las listas se paginan **en el servidor** (C-1), con `pagina` de entrada y "hay más" en la salida. Tope de 50 filas
  por página (`TAMANO_PAGINA` de `metricas-con-filas.ts`).
- Cada fila que tenga deal o lead devuelve también el **enlace a su ficha en la app** (URL absoluta con id opaco), para
  que la persona abra en el CRM lo que el chat le mostró.

**🩸 La regla que más cuidado pide: la proyección por rol vive hoy en las páginas.** Ejemplo:
`app/(app)/hub/lista/page.tsx` decide quién ve qué con `proyectarParaTablero(lista, esAdmin)` y
`proyectarParaPauta(lista, veEquipo)`; el Hub del programa aplica `sinListas` (`lib/queries/vista-metrica.ts:497`) a
quien no `veEquipoComercial`. Si la herramienta vuelve a decidir eso por su cuenta, el día que alguien cambie la página
el MCP mostrará otra cosa **sin un solo error**. Cuando una herramienta necesite una decisión que hoy está escrita en una
página, **primero muévela a una función de `lib/` que importen la página y la herramienta**, con su test, y recién
después escribe la herramienta.

**Las cuatro familias de la fase 1** (funciones de partida; verifica firmas y quién las llama antes de usarlas):

| Herramienta | Qué responde | Envuelve | Capacidad |
|---|---|---|---|
| `programas_visibles` | Los programas que esta persona ve (nombre, slug) | `programasVisibles` (`lib/auth/alcance.ts`) | toda sesión |
| `resumen_del_hub` | Las cifras del Hub de un programa en un periodo (ventas, caja, shows, agendas, tasas con cobertura) | `resolverContextoDeVista` + `armarVistaDelDashboard` (`lib/queries/vista-dashboard.ts`), con la misma proyección que la página del Hub | quien abre el Hub (las mismas guardas que `app/(app)/p/[programa]/hub/page.tsx`) |
| `consultar_metrica` | El número de una métrica y su lista detrás (por closer, etapa, antigüedad, paginada) | `resumenDeMetrica`, `listaDeMetrica`, `desglosesDelResumen` (`lib/queries/metricas-con-filas.ts`); la métrica es un `z.enum` de `Metrica`, el periodo se resuelve con `lib/periodo.ts` | como la página de lista, con `proyectarParaTablero`/`proyectarParaPauta` |
| `buscar_leads` | Leads que casan con un texto (sin tildes) | `leadsQueCasan` (`lib/queries/busqueda-de-leads.ts`), mínimo `MINIMO_TEXTO_BUSQUEDA` | quien ve Leads del programa |
| `ficha_de_lead` | La ficha de un lead: contactos, envíos, deals | `fichaDeLead` (`lib/queries/ficha-lead.ts`), con `fichaSinDetalleDeCitas` y `veSoloLoBasicoDelLead` donde la página los aplica | como la ficha en la app |
| `ficha_de_deal` | La ficha de un deal: etapa, dueño, llamadas, abonos, bitácora, alertas | `fichaDeDeal` y `alertasDelDeal` (`lib/queries/ficha-deal.ts`) | `dealVisiblePara` (`lib/auth/alcance-deals.ts`) |
| `tablero_de_deals` | Los deals abiertos por etapa, con filtros del tablero; para un closer, los suyos | `tableroKanban` (`lib/queries/kanban.ts`) con `alcanceDeDeals` | como la pestaña Deals |
| `bandeja` | Lo que pide atención hoy: llamadas sin resultado, sueltas, sin dueño | `inboxDelPrograma`, `llamadasSueltasDelPrograma`, `seccionesSinDueno` (`lib/queries/inbox*.ts`) | como la pestaña Inbox |
| `cartera_vencida` | Saldos vencidos del programa | `carteraVencida` (`lib/queries/cartera.ts`) | como donde la app la muestra |
| `pauta_roas` | ROAS y embudo de pauta por campaña, conjunto o anuncio, con cobertura | `cargarRoasDePauta` (`lib/queries/roas-de-pauta.ts`) | `manejaPauta` |
| `origen_del_programa` | De dónde llegan los leads: canal, área, "sin UTM", con conteo y porcentaje | `origenDelPrograma` (`lib/queries/origen.ts`) | como Hub › Origen |

"Mi día" ya no existe como pantalla (se fundió en Mi espacio, ticket 172): para el closer lo cubren `tablero_de_deals`
y `bandeja` acotados a él. Si al construirlas descubres que una función de esta tabla no es la que usa la pantalla, **manda
la pantalla**: usa la que ella usa.

### 5. Bitácora y tope (`lib/mcp/bitacora.ts` + tabla nueva)

- Tabla **`mcp_llamadas`**: `id`, `token_id`, `user_id`, `user_id_vista` (a quién se suplantó, si aplica),
  `herramienta`, `program_id` (nulo si no aplica), `resultado` (`ok` | `error` | `denegado` | `tope`), `codigo_error`,
  `duracion_ms`, `cliente` (nombre y versión que manda el cliente MCP al iniciar), `creado_en`. Índice
  `(token_id, creado_en)`.
- **Nunca** se guardan los argumentos de texto libre (una búsqueda trae nombres o correos). Si quieres saber qué se
  pidió, guarda solo los argumentos de catálogo (métrica, periodo, página).
- Se escribe al terminar cada llamada sin demorar la respuesta (`after()` de Next si Next 16 lo sigue ofreciendo:
  verificar en sus docs).
- **Tope blando por token:** 300 llamadas en los últimos 60 s (contadas con el índice). Al pasarlo, la herramienta
  responde `isError` con "Muchas consultas seguidas: espera N segundos" y la fila queda con `resultado = tope`. No hay
  cupo diario. El número es inicial y se ajusta mirando la bitácora.

### 6. Emitir y revocar (Mi espacio)

- Sección nueva en `/mi-espacio` ("Conexiones de IA"), visible **solo si `esAccesoTotal`** en esta fase (el 383 la abre
  a todos). Lista los tokens propios (nombre, scope, creado, último uso), botón para crear (pide nombre y scope) y para
  revocar. Al crear, muestra el token una vez con el comando listo para copiar:
  `claude mcp add --transport http retia-crm https://<host>/api/mcp --header "Authorization: Bearer <token>"`.
- Server actions con `requireRole` y la capacidad, rastro en `change_log`. Sistema de diseño Tinta
  (`docs/structure.md` §9) y el contrato de entendimiento: es una pantalla para no técnicos en el 383.
- Una sola lectura de la sección no puede devolver jamás el valor de un token (test).

## Migración

Tablas `mcp_tokens` y `mcp_llamadas` en `lib/db/schema.ts`. **La migración la genera y la aplica la sesión principal,
nunca un agente delegado** (AGENTS.md). Lee el SQL que genera `drizzle-kit` antes de aplicarlo. Son tablas nuevas: no
hace falta `lock_timeout`, pero la FK sobre `users` sí toca esa tabla, así que mira `pg_stat_activity` antes. La base de
`npm run dev` **es producción**: pruebas en `npm run db:local` + `npm run dev:local`.

## Tests (todos con `crearBaseReutilizable()`, molde de `tests/helpers/base-de-prueba.ts`)

- **Paridad con la app:** para un programa y un periodo sembrados, `consultar_metrica` y `resumen_del_hub` dan el mismo
  número que la función que usa la página. Con el caso que las haría divergir (una venta anulada, un deal de otro
  programa, N2 del ADR 0115).
- **Identidad:** token válido entra; token revocado → 401; usuario desactivado con token vivo → 401 en la siguiente
  llamada; token de otro formato → 401.
- **Sesión igual a la de la app:** la función extraída de `revalidarToken` da lo mismo para los cuatro casos de arriba.
- **Frontera de programa:** un closer pide un programa donde no tiene membresía → "No existe ese programa". Forjado: la
  llamada se arma a mano, no por la lista de herramientas.
- **Herramientas por rol:** cada rol recibe exactamente las herramientas de su capacidad; llamar una que no le toca
  (forjando la llamada) falla igual que si no existiera.
- **Ver como:** el developer con `vista: "usuario:<id de un closer>"` ve lo mismo que ese closer; un closer que manda
  `vista` recibe error.
- **Proyección:** un paid trafficker no recibe closers, deals ni montos en `consultar_metrica` (lo que `proyectarParaPauta`
  quita).
- **Bitácora:** cada llamada deja su fila; una `buscar_leads` no guarda el texto buscado.
- **Tope:** la llamada 301 dentro de 60 s responde el aviso y no ejecuta.
- **Guardianes nuevos** (mordidos en los dos sentidos, como los de `tests/vigencia-centralizada.test.ts`):
  - `lib/mcp/` no contiene `db.select`, `db.insert`, `sql\`` ni `.from(` salvo en `token.ts` y `bitacora.ts` (sus
    propias tablas).
  - toda herramienta del registro declara `puede`, `entrada` `.strict()` y `readOnlyHint`.
  - ninguna herramienta escribe `rol ===`.
- Los guardianes que ya existen tienen que seguir en verde sin excepciones nuevas salvo las nombradas aquí:
  vigencia, rastro, rol de vista, búsqueda sin tildes, contrato de extensión (ningún slug de programa escrito).

## Done cuando

- [ ] Un developer crea su token en Mi espacio, corre el `claude mcp add` que la pantalla le da y, en Claude Code contra
      `dev:local`, usa las once herramientas de la tabla.
- [ ] La misma pregunta ("¿cuántas ventas tuvo Tactical en octubre?") da la misma cifra en el MCP y en el Hub (test y
      prueba a mano).
- [x] Todos los tests de arriba en verde; typecheck, lint y `npm run build` limpios (el build es obligatorio: hay un
      componente cliente nuevo en Mi espacio).
- [x] Revisión con el método de AGENTS.md "Y para una regla de PERMISO… hay que forjar la petición": se arma a mano una
      llamada JSON-RPC con `curl` a `/api/mcp` como closer pidiendo otro programa y como paid trafficker pidiendo una
      ficha de deal, y se ve el rechazo. *(7-nov: cubierto en `tests/mcp-ruta.test.ts` con la ruta real: closer sobre programa ajeno, paid trafficker sin la herramienta, token revocado o inactivo y entradas desmedidas.)*
- [x] `docs/metricas.md` no cambia (el MCP no define métricas). `docs/operations.md` suma cómo conectarse y cómo revocar.
- [ ] Tracker y `status:` de este archivo iguales (N9).

## Fuera de este ticket

OAuth y los demás roles (383). Cualquier escritura (384). Tarjetas visuales (MCP Apps). Un skill de "cómo preguntarle al
CRM": se escribe cuando la fase 1 muestre qué preguntas se hacen de verdad (la bitácora lo dice).
