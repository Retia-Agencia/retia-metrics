---
id: 383
etapa: mcp
serves: "ADR 0119 (fases 2 y 3): el MCP para todos los roles desde claude.ai, Claude Code y cualquier proveedor"
depends: [348]
status: todo
---

# 383 — El MCP del CRM, fase 2: el CRM emite sus propios tokens (OAuth) y entran todos los roles

> **Para una sesión sin contexto.** Lee primero el **ADR 0119** y el ticket **348** (la base: tokens, sesión desde el
> token, herramientas, bitácora). Este ticket **no toca las herramientas ni la validación del token**: agrega una
> segunda forma de emitir tokens (OAuth) que caen en la misma tabla `mcp_tokens`, y abre el MCP a todos los roles. Si te
> ves cambiando `lib/mcp/herramientas/` o el verificador del 348, para y revisa: algo está mal planteado.

## Por qué hace falta

Verificado el 6-nov (fuentes en el ADR 0119):

- **claude.ai** (web, Desktop, celular) solo da identidad por persona con **OAuth**; los headers fijos están en beta y
  son para una credencial compartida, que el 348 prohíbe.
- **ChatGPT** exige OAuth 2.1 con PKCE y **no acepta** API keys.
- **Claude Code** acepta las dos cosas; con OAuth la persona se conecta con `/mcp` sin pegar ningún token.

Quienes usan el CRM no son técnicos: nadie debería copiar un token. Con este ticket, el Owner del plan de Claude agrega
**un** conector y cada persona hace clic en "Conectar", entra con su Google de siempre y listo.

## Antes de empezar, lee

1. `docs/adr/0119-el-mcp-del-crm.md` y `docs/tasks/348-mcp-del-crm.md`.
2. La spec de autorización de MCP, completa:
   https://modelcontextprotocol.io/specification/latest/basic/authorization, y sus páginas de *Authorization Server
   Discovery*, *Client Registration* y *Security Considerations*.
3. Cómo se conecta cada cliente: https://claude.com/docs/connectors/custom (y la página "Authentication for
   connectors" que enlaza), https://code.claude.com/docs/en/mcp (sección OAuth), y
   https://developers.openai.com/apps-sdk/build/auth.
4. `lib/auth/config.ts` y `lib/auth/index.ts` (Auth.js con Google, `pages.signIn = "/login"`), `proxy.ts`.
5. AGENTS.md "Secretos" (el molde de un secreto que se muestra una vez y no se loguea).

## Decisiones cerradas (ADR 0119)

- El servidor de autorización es **el propio CRM**, sobre el login de Google que ya existe. Nada de WorkOS, Clerk ni
  otro proveedor: el rol y el alcance salen solo de `users`.
- Registro de clientes por **CIMD** (Client ID Metadata Documents). El registro dinámico (DCR) está obsoleto en la spec.
- El acceso dura poco y se **renueva solo**; la persona vuelve a autorizar solo tras inactividad larga o revocación.
- Cualquier cuenta de IA puede conectarse (punto 10 del ADR).

## Qué se construye

### 1. Descubrimiento

- `/.well-known/oauth-protected-resource` (ya existe desde el 348): sumarle `authorization_servers: ["<origen de la
  app>"]` y `scopes_supported: ["lectura", "escritura"]` (sin `offline_access`, lo dice la spec).
- `/.well-known/oauth-authorization-server` (RFC 8414): `issuer`, `authorization_endpoint`, `token_endpoint`,
  `revocation_endpoint`, `response_types_supported: ["code"]`, `grant_types_supported: ["authorization_code",
  "refresh_token"]`, `code_challenge_methods_supported: ["S256"]` (ChatGPT lo exige),
  `token_endpoint_auth_methods_supported: ["none"]` (clientes públicos con PKCE),
  `client_id_metadata_document_supported: true`, `authorization_response_iss_parameter_supported: true`.
- Las dos rutas van en `esRutaPublica` de `proxy.ts`, con su comentario.

### 2. Registro de clientes por CIMD

- El `client_id` que manda el cliente es una **URL https** donde vive su documento de metadatos (nombre, `redirect_uris`,
  logo). El CRM lo descarga y valida que el `redirect_uri` pedido esté en la lista.
- 🩸 **Descargar una URL que manda un tercero es una puerta de SSRF** (que te hagan pedir una dirección interna). Reglas
  duras: solo `https`, sin IPs privadas ni `localhost` como host del documento, tiempo máximo corto (5 s), tamaño máximo
  (p. ej. 64 KB), sin seguir redirects a otro host, y caché del documento por un rato con su respuesta. Test para cada
  regla. Lee la sección CIMD de *Security Considerations* de la spec.
- Tabla **`oauth_clientes`** (caché + historial): `client_id` (la URL), `nombre`, `redirect_uris`, `obtenido_en`,
  `bloqueado_en` (para cortar un cliente entero si hiciera falta).
- **Verificar al arrancar qué método usa cada cliente** y anotarlo aquí: claude.ai tiene "Use Claude's published
  identity" (CIMD). Claude Code dice que, si el servidor no tiene DCR, se registra una app y se pasa `--client-id`: hay
  que comprobar si usa CIMD. Si un cliente que necesitamos **solo** sabe DCR, se decide con Mani entre agregar DCR
  (`registration_endpoint`, obsoleto pero vigente) o un cliente pre-registrado; no se agrega por defecto.
- Redirect URIs conocidas (verificar): claude.ai `https://claude.ai/api/mcp/auth_callback` y
  `https://claude.com/api/mcp/auth_callback`; Claude Code usa un callback en `localhost` con puerto; ChatGPT, el de su
  documento.

### 3. Autorizar (la página que ve la persona)

- Ruta `/oauth/autorizar` (página, no route handler). Recibe `response_type=code`, `client_id`, `redirect_uri`,
  `code_challenge`, `code_challenge_method=S256`, `scope`, `state`, `resource`.
- Sin sesión de la app: redirige a `/login` con `callbackUrl` de vuelta a esta misma URL (Auth.js ya lo soporta). La
  allowlist de `users` sigue rigiendo: quien no está activo no pasa, igual que en la app.
- Con sesión: **pantalla de consentimiento** en Tinta (`docs/structure.md` §9): "**Claude** quiere usar el CRM como
  **Ana Pérez (Closer)**", qué podrá hacer (solo consultar / consultar y hacer cambios con tu confirmación), y dos
  botones. Para no técnicos: nada de "scope", "client_id" ni URLs crudas en la pantalla (N5).
- El scope `escritura` solo se ofrece si el rol puede escribir algo (`trabajaLeads`, `marcaOnboarding` o
  `esAccesoTotal`); si no, se concede `lectura` aunque el cliente pida más.
- Validar que `resource` sea la URL canónica del MCP (`https://<host>/api/mcp`, sin barra final). Otra cosa: error.
- Al aceptar: código de autorización de un solo uso, **10 minutos**, guardado con hash en **`oauth_codigos`**
  (`hash`, `user_id`, `client_id`, `redirect_uri`, `code_challenge`, `scope`, `resource`, `vence_en`, `usado_en`).
  Redirige a `redirect_uri` con `code`, `state` e **`iss`** (RFC 9207).
- Un "ver como" activo en la app **no** se hereda: el token es siempre de la persona real (el developer suplanta por el
  argumento `vista` del 348).

### 4. Token

- `POST /api/oauth/token` (route handler, público en `proxy.ts`):
  - `grant_type=authorization_code`: valida el código (existe, no usado, no vencido, mismo `client_id` y
    `redirect_uri`), verifica PKCE (`sha256(code_verifier)` = `code_challenge`), marca el código usado y emite el par.
    Un código usado dos veces **revoca todo lo emitido con él** (señal de robo, recomendación de OAuth 2.1).
  - `grant_type=refresh_token`: rota el refresh (el viejo deja de servir) y emite un acceso nuevo.
- Acceso: **1 hora**. Refresh: rota en cada uso y **vence tras 90 días sin uso** (propuesta: confírmala con Mani al
  arrancar; el ADR dice "inactividad larga").
- Los dos van a `mcp_tokens` con `tipo = 'oauth'` y columnas nuevas: `client_id`, `resource`, `vence_en`,
  `refresh_hash` (único), `refresh_vence_en`. El verificador del 348 solo suma "si tiene `vence_en`, que no haya
  pasado" y "que `resource` sea este servidor" (audiencia, RFC 8707). Nada más cambia.
- Revalidar al usuario contra `users` en cada refresh **y** en cada llamada (ya lo hace el 348).
- `POST /api/oauth/revocar` (RFC 7009) para que el cliente pueda desconectarse.

### 5. Abrir a todos los roles

- La sección "Conexiones de IA" de Mi espacio se abre a **todo usuario activo**: lista tokens personales y conexiones
  OAuth (cliente, scope, último uso), con "Desconectar". El token personal manual sigue existiendo pero queda **solo
  para developers** (los demás se conectan por OAuth).
- **Ajustes › Usuarios** (`app/(app)/ajustes/usuarios/`): quien `administraUsuarios` ve las conexiones de cada persona
  de su alcance y puede revocarlas. Desactivar a un usuario ya las corta (revalidación), pero revocar deja el rastro
  explícito.
- Herramientas: las de la fase 1 ya filtran por capacidad. Revisar con cada rol (gerente, gerente con alcance limitado,
  closer, paid trafficker, customer success, media) qué recibe y que coincida con lo que ve en la app. **Media** hoy no
  ve nada comercial (ADR 0107): recibe solo `programas_visibles` salvo que Mani diga otra cosa.

### 6. Operación

- `docs/operations.md`: cómo agregar el conector en claude.ai (Owner del plan Team o Enterprise: Organization settings ›
  Connectors › Add › Custom, URL `https://<host>/api/mcp`, "Use Claude's published identity"), cómo se conecta un
  miembro, cómo en Claude Code (`claude mcp add --transport http retia-crm https://<host>/api/mcp` y luego `/mcp`) y en
  ChatGPT. **Pregunta a Mani quién es el Owner del plan de Claude del equipo**: lo necesitas para la prueba.
- Las llamadas de claude.ai y ChatGPT salen de la nube de cada proveedor, no de la máquina de la persona: el endpoint
  tiene que ser público (Vercel ya lo es). No hay preview con base (AGENTS.md: los previews no tienen `DATABASE_URL`):
  el flujo completo se prueba en local con Claude Code y, para claude.ai, en producción con un usuario de prueba.

## Migración

`oauth_clientes`, `oauth_codigos` y las columnas nuevas de `mcp_tokens`. La aplica la sesión principal. `mcp_tokens`
ya tendrá filas: `ALTER TABLE` con `SET lock_timeout = '5s';` al inicio (AGENTS.md, 0043) y columnas nuevas
nullable, sin reescribir las existentes.

## Tests

- Flujo completo con un cliente de prueba (los tests hacen de cliente): descubrimiento → autorizar → token → llamada a
  una herramienta → refresh → la llamada sigue funcionando.
- PKCE: `code_verifier` equivocado → rechazado. Método `plain` → rechazado.
- Código: vencido, reutilizado (y que reutilizarlo revoque lo emitido), con otro `redirect_uri` u otro `client_id` →
  rechazado.
- `resource` de otro servidor → rechazado; token emitido para otro `resource` → 401 en `/api/mcp`.
- Refresh viejo tras rotar → rechazado. Refresh tras 90 días sin uso → rechazado.
- Usuario desactivado → su refresh y su acceso dejan de servir en la siguiente llamada.
- Scope: un paid trafficker que pide `escritura` recibe `lectura`.
- CIMD: cada regla anti-SSRF con su caso (http, IP privada, documento gigante, redirect a otro host, `redirect_uri`
  que no está en el documento).
- Ningún secreto (código, acceso, refresh) aparece en `change_log`, en la bitácora ni en una respuesta que no sea la de
  `/api/oauth/token` (guardián o test de lectura).

## Done cuando

- [ ] El Owner agrega el conector en claude.ai; un closer y un gerente se conectan con su propia cuenta desde web,
      Desktop y celular, y cada uno ve solo lo suyo.
- [ ] En Claude Code, un closer se conecta con `/mcp` sin pegar ningún token.
- [ ] **Fase 3:** el mismo flujo pasa en ChatGPT sin código nuevo (si algo falla, se anota aquí qué pidió y se decide con
      Mani; no se parcha por cliente).
- [ ] Desconectar desde Mi espacio o revocar desde Ajustes › Usuarios corta en la siguiente llamada.
- [ ] Tests de arriba en verde; typecheck, lint y `npm run build` limpios; recorrido de la pantalla de consentimiento
      en escritorio y celular (`npm run test:humo` sigue verde).
- [ ] `docs/operations.md` con la guía de conexión; tracker y `status:` iguales.

## Fuera de este ticket

Escrituras (384). DCR o clientes pre-registrados, salvo que un cliente lo exija y Mani lo apruebe. Restringir qué
proveedores se aceptan (el ADR dice cualquiera; si cambia, se bloquea por `oauth_clientes.bloqueado_en`).
