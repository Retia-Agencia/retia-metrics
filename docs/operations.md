# Operations del CRM de Retia

Cómo se opera la herramienta: entornos, URLs de cada programa, variables, base de datos, scripts,
despliegue, secretos, incidentes que enseñaron algo y la deuda que queda. Qué es el producto:
[`overview.md`](./overview.md). Cómo está hecho: [`structure.md`](./structure.md). Qué falta
construir: [`plan.md`](./plan.md). Las reglas duras del repo están en [`AGENTS.md`](../AGENTS.md) y
**mandan sobre este documento**.

Consolidado el 27-sep-2026 desde el handoff, los ADR 0018 y 0047, la estructura de las hojas y lo
medido ese día.

---

## 1. Entornos

| Entorno | App | Base | Estado al 28-sep |
|---|---|---|---|
| Producción (Vercel) | rama `main`, alias `retia-metrics-seven.vercel.app` | Supabase "CRM Retia" (desde el 28-sep; antes seguía en Neon) | ✅ |
| Local (Docker, desarrollo) | `npm run dev:local` (http://localhost:3000) | Postgres 17 local en Docker (puerto 54329, ticket 113) con datos de prueba | ✅ |
| Local (Producción) | `npm run dev` (http://localhost:3000) | Supabase de producción: pide ok de Mani para escrituras | ⚠️ |
| Preview (Vercel) | cada rama | ninguna: sin `DATABASE_URL` a propósito, se trabaja en `main` | — |

- **Supabase:** organización "Agencia - Dani", plan gratis. **Un solo proyecto, "CRM Retia", que es producción** (Mani, 28-sep): ref `hfqmiyiuyqapdsbywrag`,
  región `us-east-2`, vacío y sembrado (programas, cohortes, productos, fuentes, categorías y dos
  usuarios: un gerente y un developer), 24 migraciones aplicadas, RLS sin políticas en todas las tablas
  y Data API apagada. En plan gratis un proyecto **se pausa tras 7 días sin uso**: pasar producción a
  Pro (25 USD/mes) es la primera compra cuando haya operación real (ADR 0047).
- **Vercel:** team `agencia-dani`, proyecto `retia-metrics`, **plan Hobby** (verificado el 21-sep): el
  cron solo puede correr una vez al día. Hobby es para uso no comercial; pasar a Pro es la decisión R3
  (`plan.md` §7; Calendly ya no la exige: A5 se resolvió por webhook, sin cron).
- **Google Cloud:** proyecto `retia-growth`, dentro de la organización `retiagrowth.com`. Ahí viven la
  cuenta de servicio de lectura de hojas (`retia-metrics-sync@retia-growth.iam.gserviceaccount.com`) y
  el cliente OAuth del login. La pantalla de consentimiento es External y está publicada: cualquiera
  con cuenta de Google podría intentar entrar, y quien lo decide es la tabla `users` (sin
  auto-registro). `google-workspace-mcp` es el proyecto personal de Mani y no debe tener nada de la app.
- **Usuarios:** los gerentes comparten `administrativa@retiagrowth.com` (el perfil de Google aparece
  como "Alejandro Carvajal Parra"). Cada closer entra con su propia cuenta. 🔴 Los closers reales no
  están dados de alta en ninguna base de Supabase (ticket 007).

## 2. Los programas y sus URLs

🆕 **Mani, 27-sep: las URLs de cada programa se guardan completas en el repo.** Revierte la decisión
S-13 de la remediación de septiembre, que dejaba fuera los IDs de las hojas porque *"el permiso de una hoja es una casilla
que alguien puede cambiar a 'cualquiera con el enlace' sin enterarse de que el enlace ya está
publicado"*. Ese riesgo sigue: **las hojas se comparten solo con cuentas concretas y la cuenta de
servicio, nunca con "cualquiera con el enlace"**. Los scripts siguen leyendo los IDs de `.env.local`
(`SHEET_ID_COMUNICARTE`, `SHEET_ID_TACTICAL`).

| | ComunicArte | Tactical Investor |
|---|---|---|
| Hoja de Sheets | https://docs.google.com/spreadsheets/d/1NN6rlZXJJcgvWXYsbP99vLt9aj7FXVPd6ep4ULAcK54/edit | https://docs.google.com/spreadsheets/d/1DBKL4zwWWeJppe-6mzpJ4jT1G6MdEmT1Dd_uMiNBNwc/edit |
| Formulario (Typeform) | https://metodocomunicarte.typeform.com/to/nkMLdeh8 (identificado el 18-ago como el destino de los botones "Unirme" de la landing; confirmado por Mani el 27-sep) | https://postulacioness.typeform.com/to/GmPGBOf9 (confirmado por Mani el 27-sep; el ID distingue mayúsculas) |
| Landing | `programavirtual.eventoscomunicarte.com/landing.html` (el contenido vive en ese iframe) | 🔴 falta |
| Calendly | una organización por programa, un solo tipo de evento ("Postulación Método Comunicarte"); token verificado el 28-sep | una organización, evento "Postulación: De Cero a Tactical Investor"; token verificado el 28-sep (451 citas en ±3 meses) |
| `form_url` / `calendly_token` en la base (producción) | cargados por Mani el 28-sep desde `/ajustes/programas` | cargados por Mani el 28-sep |
| `web_url` / `calendly_url` en la base | vacías, y desde el 28-sep fuera del formulario (nada las lee) | vacías |

`programs.form_url` ya existe (ticket 109) y está cargado; cuando existan los destinos (ticket 092), el resto de estas URLs se cargan desde la app y
esta tabla queda como referencia.

## 3. Variables de entorno

Solo nombres; los valores viven en `.env.local` (permisos `600`, nunca en el repo ni abiertos en un
editor) y en Vercel.

| Variable | Para qué | Dónde |
|---|---|---|
| `DATABASE_URL` | la app: pooler de Supabase en modo transaction (6543), con `prepare: false` | local, Vercel |
| `DATABASE_URL_DIRECTA` | `drizzle-kit`: pooler en modo session (5432); la conexión directa es solo IPv6 | local |
| `SUPABASE_DB_PASSWORD` | `.env.local` arma las dos URLs con ella | local |
| `DB_PROD` | sin uso desde el 28-sep: hay una sola base y `DATABASE_URL` ya es producción | local |
| `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_URL` | login con Google (Auth.js) | local, Vercel |
| `GOOGLE_SERVICE_ACCOUNT_JSON_B64` | la cuenta de servicio que lee las hojas: "probar" y activar una fuente de hoja en `/ajustes/fuentes`, los scripts y el traslado | local, Vercel |
| `SHEET_ID_COMUNICARTE`, `SHEET_ID_TACTICAL` | los IDs de las hojas, para los scripts | local |
| `SCRIPT_ACTOR_EMAIL` | quién firma el rastro de un script que escribe en una base viva (ADR 0029) | local |
| `SEED_GERENTE_EMAIL`, `SEED_GERENTE_NOMBRE` | el gerente que siembra `seed:users` | local |
| `ENLACES_PAGO_JSON` | los enlaces de pago que carga `cargar-enlaces-pago` (el JSON lo tiene Mani) | local |

`npm run build` no necesita `.env.local`: el cliente de la base se crea de forma perezosa.

## 4. La base de datos

**Reglas** (las completas en `AGENTS.md`, convenciones):

- **Las migraciones las genera y aplica la sesión principal, nunca un subagente.** `drizzle-kit
  generate` es interactivo (pregunta si algo es un renombre; la opción por defecto es siempre `create`)
  y sin terminal se cuelga o falla.
- **El SQL que genera `drizzle-kit` se lee antes de aplicarlo, siempre.** La 0020 traía cuatro defectos,
  dos destructivos (habría borrado todos los leads con un `DROP TABLE ... CASCADE`).
- **Orden (desde el 28-sep, una sola base):** generar → leer y corregir el SQL → `npm test` (PGlite aplica todas) → aplicar en la base **con
  el ok de Mani**. Un `CHECK` o un índice único se crea después de arreglar los datos, en la misma
  migración.
- **Antes de escribir, mirar el ref del proyecto dentro de la connection string** (`postgres.<ref>@...`),
  no el nombre de la variable.
- **Lectura libre, escritura con permiso:** consultas de solo lectura contra producción, libres; toda
  escritura de datos pide el ok de Mani en esa conversación. Desde el 28-sep hay una sola base: todo lo
  que corre en local escribe en producción.
- **`drizzle-kit push` y `drop` están denegados** en `.claude/settings.json`: se saltan el historial.
- **Toda tabla nueva lleva RLS sin políticas** (lo exige `tests/rls-en-todas-las-tablas.test.ts`), y la
  Data API se apaga en cada proyecto de Supabase.
- **No se corre una semilla sobre una base con datos reales:** `seed:datos` reconcilia por nombre y
  duplica filas si los nombres cambiaron (ADR 0029).

**Producción quedó armada el 28-sep** sobre el proyecto que hacía de `dev` (ADR 0047, enmienda): ya tenía
todas las migraciones, la Data API apagada, la configuración sembrada y los motivos cargados. Falta:
cargar los enlaces de pago (`cargar-enlaces-pago`, el JSON lo tiene Mani) y dar de alta a los closers
reales desde `/ajustes/usuarios` (ticket 007).

### 4.1 Base local para desarrollo de pantallas (Ticket 113)

Para construir y probar pantallas (como el Kanban de Deals o el Inbox) sin escribir en la base de producción ni arriesgar datos reales:

1. **Levantar base local y sembrar (un solo comando):**
   ```bash
   npm run db:local
   ```
   Levanta Postgres 17 en Docker (`retia-metrics-db-local` en puerto `54329`), espera a que acepte conexiones, aplica todas las migraciones de `drizzle/` con `drizzle-kit migrate` y ejecuta la siembra (`scripts/seed-local.ts`).

2. **Iniciar la app contra la base local:**
   ```bash
   npm run dev:local
   ```
   Sobreescribe `DATABASE_URL` y `DATABASE_URL_DIRECTA` en el proceso hacia `postgresql://postgres:postgres@127.0.0.1:54329/retia_local` sin tocar `.env.local`.

3. **Guardia contra producción:**
   Tanto `db:local` como `dev:local` y `seed:local` verifican estrictamente que la URL apunte a `localhost` o `127.0.0.1`, y rechazan cualquier host de Supabase o producción.

4. **Reinicio limpio:**
   ```bash
   docker compose down -v && npm run db:local
   ```

5. **Variables de Auth.js y Login Local:**
   La app requiere `AUTH_SECRET`, `AUTH_GOOGLE_ID` y `AUTH_GOOGLE_SECRET` configuradas en `.env.local` (o entorno) con redirect URI `http://localhost:3000/api/auth/callback/google` en Google Cloud para autenticar mediante Google OAuth contra los usuarios sembrados (`users`). Un modo de login local desacoplado de Google OAuth queda pendiente como tarea de producto.

## 5. Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` · `build` · `start` | la app |
| `npm run dev:local` | la app apuntando exclusivamente a la base local de Docker (sin tocar `.env.local`) |
| `npm run db:local` | levanta Docker Postgres 17, espera conexión, migra y siembra la base local (ticket 113) |
| `npm run seed:local` | re-siembra la base local con datos de ejemplo (idempotente) |
| `npm test` · `typecheck` · `lint` | los tres chequeos; una etapa no se cierra sin los tres limpios |
| `npm run db:generate` · `db:migrate` · `db:studio` | migraciones (ver §4) |
| `npm run setup` | arma el `.env.local` |
| `npm run seed:users` · `seed:datos` | sembrar una base **vacía** |
| `npm run usuarios` | **acceso de emergencia**: `usuarios` lista, `usuarios -- agregar <correo> <rol> [closer_id] [programas...]`, `usuarios -- quitar <correo>` (desactiva, no borra). La vía normal es `/ajustes/usuarios` |
| `npm run rotar` | rota `AUTH_GOOGLE_SECRET` y `AUTH_SECRET` |
| `npm run cuenta-servicio` | carga la cuenta de servicio de Google |
| `npm run cargar-motivos` | carga las cuatro listas de motivos (ticket 104) por el molde y retira las 8 semillas de la migración 0004. **Se corre en toda base nueva después de migrar.** Idempotente; pide `SCRIPT_ACTOR_EMAIL` |
| `npm run descubrir` · `inspeccionar <sheetId> "<pestaña>"` · `comparar` | leer la estructura de las hojas |
| `npm run limpiar-respaldos` | borra respaldos locales de `.env.local` |
| `tsx scripts/cargar-enlaces-pago.ts` | carga los enlaces de pago por el molde, con `SCRIPT_ACTOR_EMAIL` |

Un script sale con `process.exit`: `postgres-js` deja el pool abierto y el proceso se queda colgado.

## 6. Despliegue

- **`main` es producción:** un `git push origin main` dispara el deploy. Antes de empujar: `npm test`,
  `npm run typecheck`, `npm run lint` y `npm run build`.
- **Cómo saber qué commit está vivo:** la CLI de Vercel de esta máquina está logueada y alcanza el
  proyecto (el conector MCP pide OAuth y no arranca en una sesión no interactiva).
  `vercel ls --yes` da el deploy de producción más reciente y `vercel inspect <url>` su fecha; se cruza
  con `git log --format='%h %ci'`.
- **`/api/health` no prueba nada de la base:** devuelve un JSON constante. Que las consultas corran solo
  lo prueba una sesión real abriendo una pantalla que consulte.
- Si una migración no es aditiva, hay una ventana en que código y esquema no se entienden: migrar y
  desplegar seguidos.

## 7. El sync de Sheets (retirado)

**Retirado el 28-sep (ticket 108).** Los leads entran solo por el webhook (corte directo, 22-sep). Se
fueron el cron, la corrida manual, `lib/sheets/sync.ts` y `plan-sync.ts`, sus scripts y sus tests
(`git show bfeea2a:<ruta>` los recupera). Queda en `lib/sheets/` lo que lee una hoja una sola vez, para
el traslado y la migración de la etapa 7. `sync_runs` sigue en la base como historial de solo lectura.

- 🩸 La primera corrida del cron contra Supabase (28-sep, 7:52 a.m.) metió **5.343 leads sin envíos** en
  producción por la puerta descartada, y se borraron con el ok de Mani. **Lección:** cambiar el
  `DATABASE_URL` de producción también redirige a los crons; revisar `vercel.json` cuando se cambia la
  base.
- Ya no queda ningún route handler que mute con sesión: el único, `POST /api/sync/[programa]`, se fue
  con su chequeo de origen (`exigirMismoOrigen`). El webhook muta, pero se autentica por firma HMAC y no
  por cookie.

## 8. Secretos y accesos

- **Nada de la app es público** salvo `/api/health`. `proxy.ts` exige sesión en todo lo demás; un
  webhook nuevo tiene que ir en su lista pública o cada envío recibe un redirect a `/login` y falla sin
  que nadie lo vea.
- **Quitar a alguien lo saca ya:** el rol se revalida contra `users` en cada emisión del token, y la
  sesión dura 8 horas (ADR 0002).
- Secretos solo en `.env.local` y en Vercel. Un `.env.local` nunca se abre en un editor ni se pega en un
  chat.

**Pendientes de seguridad** (de sesiones anteriores, sin resolver):

- 🔴 Rotar la contraseña de PayPal de Retia: está en texto plano en el grupo de WhatsApp de ventas de
  Tactical desde el 18-ago (decisión de Mani).
- 🔴 Rotar la llave personal de HubSpot de 30X que se usó el 22-sep para leer el portal: quedó en el log
  de esa sesión.
- 🔴 Borrar el cliente OAuth web viejo del proyecto `google-workspace-mcp`.
- 🔴 Probar el login con una cuenta real de closer, local y en producción.

## 9. Incidentes que enseñaron algo

| Fecha | Qué pasó | Lo que queda |
|---|---|---|
| 16-sep | `.env.local` apuntaba a producción mientras todos creían que era `dev`; cuatro migraciones se aplicaron directo a producción | antes de escribir, se mira el ref de la base, no el nombre de la variable |
| 18-sep | cinco enlaces de pago entraron a producción con un script que insertaba en crudo: cero filas de rastro | una fila de catálogo se crea por el molde, también desde un script (ADR 0029) |
| 18-sep | `seed:datos` corrido sobre producción insertó 3 productos duplicados | no se siembra una base viva |
| 18-sep | el menú de usuario tiraba la página entera al abrirse (un componente de Base UI fuera de su contenedor), con 543 tests en verde | una pantalla se prueba haciendo clic en todo lo que se abre, y un permiso forjando la petición |
| 20-sep | dos bugs con 669 tests en verde: un botón muerto y una función de `lib/` que nadie llamaba | antes de dar por probada una función, mirar quién la llama |
| 22-sep | al cambiar de driver se cayó el build: un componente de cliente importaba un módulo que arrastra la base | un componente `"use client"` no importa nada de `lib/db` |
| 23-sep | `next dev` murió con "Jest worker encountered 2 child process exceptions" tras levantar un segundo servidor sobre la misma `.next` | antes de arrancar un servidor, mirar si ya hay uno en el 3000 |
| 27-sep | agregar un cálculo en los Typeform activó `score` e insertó la columna "Score" en la O de las dos hojas; los Apps Script leen por posición y dejaron de clasificar leads nuevos, sin error, durante ~40 min (1 lead real afectado, rescatado) | un cambio en Typeform se verifica mirando la fila 1 de la hoja después del primer envío; nunca reconectar la integración con Sheets. Detalle en `work/retia/apps-script-sheets/README.md` |
| 27-sep | `npm ci` falla porque el lock no está sincronizado (faltan `@emnapi/runtime` y `@emnapi/core`); un `node_modules` viejo tira 46 tests por falta del driver `postgres` | reparar el lock con `npm install` y un commit; mientras tanto, `npm install --no-package-lock` |

## 10. Deuda que queda

- **Escalabilidad** (medida el 19-sep en la base de Neon): 15 MB en total; `people.raw` pesaba 551 bytes
  por persona. El almacenamiento no es el problema (un millón de leads son ~550 MB). Los techos reales:
  `change_log` crece con cada cambio y nadie lo poda; el traslado lee la hoja completa en memoria; y los
  comprobantes en foto (1 a 5 MB cada uno) van a Storage, no a la base. Mani lo quiere en sesión propia.
- **Extraer los componentes grandes** (`mi-dia-registro`, dashboard y administradores) solo cuando haya
  una frontera de dominio estable (ADR 0033). Buena parte se reescribe igual en la etapa de UI.
- **Código muerto:** `lib/abonos/plataforma.ts` no lo importa nadie (verificado el 27-sep). Se señala,
  no se borra de paso.
- **Columnas sin uso tras retirar T2 (28-sep):** `sources.calificacion`, `submissions.calificacion` y
  `submissions.puntaje` siguen en el esquema, y `scripts/seed-datos.ts` todavía siembra
  `sources.calificacion`. Quitarlas es una migración; nadie la ha pedido.
- **Hashes de migraciones en la base:** las filas de `drizzle.__drizzle_migrations` de 0000 a 0020 no
  casan con los archivos porque se aplicaron desde un checkout de Windows (CRLF). Verificado el 28-sep:
  con CRLF casan todas, el contenido es idéntico y no hay que tocar nada. drizzle solo mira la última.
  Desde el 28-sep `.gitattributes` fuerza LF en `drizzle/*.sql` para que no vuelva a pasar.
- **Detectar que un lead desapareció de la fuente:** nunca se borra un lead (Mani, 19-sep); con el
  webhook deja de aplicar, salvo para el traslado.

## 11. Datos de validación

Cifras que salieron de las hojas reales. Sirven para verificar cualquier motor de métricas: **no se
escriben en la app**, la app las recalcula. Si el código da otra cosa con los mismos insumos, el bug es
del código.

**Cohortes C1 (cerradas; no cambian más):**

| ComunicArte C1 | Tactical Investor C1 |
|---|---|
| Leads 1.100 → descartados 561 (51,0%) | Filas 2.932 → personas 1.825 (37,8% duplicados) |
| Con Calendly 152 (13,8%) → llamadas 135 | Descartados 741 (40,6%) · cola de setteo 883 (48,4%) |
| Shows 51 (37,8%) → cierres 29 (56,9% sobre show) | Agendaron 200 (11,0%) → llamadas 140 → shows 72 (51,4%) → cierres 17 |
| **Lead a venta 2,64% · invitado a venta 21,5%** | **Lead a venta 0,93% · invitado a venta 8,5%** (bajo el umbral de 15%) |
| Pauta COP 10.119.796 · CPL COP 9.200 | ROAS motor de llamadas 1,97 · ROAS lanzamiento 9,04 (motores distintos, no se mezclan) |
| Ritmo sostenido: 73 leads por día hábil | Matriculados 31, pero solo 17 pasaron por el registro de llamadas |

**Cohortes C2 al 14-sep** (consolidados de Michael; la regla que usaron: si el reporte del equipo y la
hoja no coinciden, manda el reporte):

| | ComunicArte C2 | Tactical Investor C2 |
|---|---|---|
| Cupos vendidos / meta | 22 / 50 (50% de la meta lineal) | 21 / 50 (55% de la meta lineal) |
| Días hábiles corridos | 22 de 27 | 19 de 30 |
| Leads del corte (Bogotá) | 775 | 746 |
| Lead a venta | 2,84% | 2,82% |
| Agendaron (12-ago al 14-sep) | 125 (14,9%) | 105 (11,9%) |
| Caja en la hoja de estudiantes | USD 11.154 | USD 19.120 |
| Pago total / parcial | 12 / 7 (1 sin dato) | 10 / 9 |

Los reportes diarios del equipo contaban los leads por fecha UTC; los consolidados, por fecha de
Bogotá. Por eso las dos cuentas no coinciden día a día.
