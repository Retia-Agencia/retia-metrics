# Estado del proyecto
Ultima fase completada: 1 — Modelo de datos, sincronizacion con Sheets y bitacora de cambios
Fecha: 2026-08-19
Produccion: sin desplegar en esta copia todavia (fork independiente, sin deployment de Vercel propio)
Repo: https://github.com/Retia-Agencia/retia-metrics (privado)

## Que existe ya

**Autenticacion y roles**
- `lib/auth/roles.ts`: logica pura de roles (`puedeAcceder`, `esRolValido`) y los errores tipados `AuthenticationError` (401) y `AuthorizationError` (403). Sin DB, sin next-auth — se testea aislada.
- `lib/auth/config.ts`: config de Auth.js apta para edge (sin DB). La usa `proxy.ts`. Incluye el callback `session` que mapea claims del token.
- `lib/auth/index.ts`: instancia completa de Auth.js (runtime Node). Callback `signIn` con allowlist estricta contra la tabla `users`; callback `jwt` que revalida rol contra la DB en **cada emision de token**, y vacia el token si el usuario fue desactivado.
- `lib/auth/guards.ts`: `requireSession`, `requireRole(...roles)`, `requireGerente` y `respuestaDeError` para route handlers. **Este es el helper que exige el plan.**
- `lib/auth/page-guards.ts`: `paginaConSesion` / `paginaConRol` para paginas — redirigen en vez de tirar 500.
- `types/next-auth.d.ts`: augmentacion de `Session` y de `JWT` (sobre `@auth/core/jwt`).

**Base de datos** — 10 tablas
- `lib/db/schema.ts`: `users`, `programs`, `cohorts`, `sources`, `people`, `calls`, `sales`, `ad_spend`, `sync_runs`, `change_log`.
- `people` tiene indice unico `(program_id, email_normalizado)`: el dedup esta garantizado por la base, no solo por el codigo.
- `calls`, `sales` y `ad_spend` tienen indice unico sobre `(program_id, huella_fila)` para que un re-sync no duplique registros.
- `scripts/seed-datos.ts` (`npm run seed:datos`): siembra los dos programas, sus cuatro cortes y las diez fuentes. Idempotente.
- `lib/db/index.ts`: cliente Drizzle sobre `@neondatabase/serverless`. Falla ruidosamente si falta `DATABASE_URL`.
- `drizzle/0000_pink_changeling.sql`: migracion inicial generada.
- `scripts/seed-users.ts`: inserta o promueve al primer gerente desde `SEED_GERENTE_EMAIL`.

**Rutas y UI**
- `proxy.ts`: protege todo salvo `/login`, `/api/auth/*` y `/api/health`. Paginas -> redirect a `/login?desde=`; APIs -> 401 JSON.
- `app/login/page.tsx`: server action con `signIn("google")`, mensajes de error legibles (incluye `AccessDenied`).
- `app/(app)/layout.tsx` + `components/app-sidebar.tsx`: shell con sidebar filtrado por rol, selector de programa, menu de usuario y toggle claro/oscuro.
- Paginas placeholder con su guarda de rol puesta: `/comunicarte`, `/tactical-investor`, `/ajustes` (gerente), `/mi-dia` (closer), `/documentos` (ambos).
- `app/api/admin/ping` (gerente), `app/api/me` (cualquiera autenticado), `app/api/health` (publico).
- `lib/nav.ts`: navegacion declarativa por rol + `rutaInicial(rol)`. `lib/format.ts`: formato numerico colombiano.

**Configuracion**
- `scripts/configurar-env.sh` (`npm run setup`): pide los valores de forma interactiva, lee los secretos sin eco (no quedan en pantalla ni en el historial del shell), valida la forma de cada uno, rechaza los de ejemplo, genera `AUTH_SECRET` solo y respalda el archivo anterior (**un solo respaldo**, con permisos 600: los anteriores se borran).
- `scripts/load-env.ts`: carga `.env.local` antes que cualquier otro modulo.

**Sincronizacion con Google Sheets**
- `lib/sheets/auth.ts`: cliente JWT desde la llave de la cuenta de servicio en base64.
- `lib/sheets/leer.ts`: lee una pestana. El titulo va entre comillas simples porque hay emojis en los nombres.
- `lib/sheets/mapeo.ts`: resuelve columnas **por texto del encabezado, no por posicion**, ignorando acentos y mayusculas. `MAPEO_FORMULARIO` sirve para los tres formularios pese a que la redaccion de las preguntas cambia entre programas. Si falta un campo obligatorio lanza `MapeoInvalidoError` con lo que busco y los encabezados reales. Incluye `parsearFecha`, que lee el formato colombiano d/m/yyyy — `new Date()` lo interpreta como m/d y produce fechas equivocadas en silencio.
- `lib/sheets/dedup.ts`: dedup puro por correo, sin base de datos. Conserva la fecha de primera aplicacion mas antigua, no deja que una aplicacion posterior con campos vacios borre lo que ya se sabia, y cuenta `numAplicaciones`.
- `lib/sheets/sync.ts`: el motor. Lee, deduplica, **inserta por lotes y actualiza fila por fila** (no es un upsert: eso es F-03/F-04, pendiente) y escribe la bitacora.
- `scripts/sincronizar.ts` (`npm run sync [slug]`): corre el sync desde la terminal.
- `scripts/descubrir-hojas.ts` (`npm run descubrir`), `inspeccionar-pestana.ts` (`npm run inspeccionar`) y `comparar-pestanas.ts` (`npm run comparar`): herramientas de diagnostico. **Ninguna imprime datos personales** — solo estructura, conteos y rangos de fecha.

**Rutas y UI de la Fase 1**
- `POST /api/sync/[programa]`: dispara la sincronizacion. Solo gerente. Un error de mapeo devuelve 422 con el mensaje completo, para que se pueda arreglar sin abrir logs.
- `GET /api/cron/sync`: sincronizacion programada una vez al dia, 12:00 UTC / 7am Colombia (`vercel.json`). Se cambio de cada 15 minutos a diaria porque el plan Hobby de Vercel no permite crons mas frecuentes que uno por dia; el boton manual de sync sigue disponible para forzarla. Se autentica con `CRON_SECRET`, no con sesion. **Falla cerrado**: si la variable no esta configurada devuelve 500 y no corre.
- `/ajustes/fuentes`: tarjetas con personas, aplicaciones y tasa de duplicados por programa; lista de fuentes con su ultima sincronizacion; boton "Sincronizar ahora"; e historial de las ultimas ocho corridas.

**Tests** — 68 pasando (`npm test`)
- `tests/roles.test.ts`: sin herencia de roles, sin rol no pasa nada, el closer no ve items de gerente.
- `tests/guards.test.ts`: invoca los route handlers reales con sesion mockeada — closer en endpoint de gerente = 403, sin sesion = 401, gerente = 200.
- `tests/dedup.test.ts`: la fecha colombiana no se lee como estadounidense; el mismo mapeo resuelve los dos programas; falta de campo obligatorio lanza error en vez de adivinar; el dedup reproduce el ratio real de Tactical Investor (2.954 filas -> 1.825 personas, ~38%).
- `tests/sync-permisos.test.ts`: un closer no dispara el sync; el cron rechaza sin secreto, con secreto equivocado, con uno del mismo largo, y no corre si `CRON_SECRET` no existe; un error interno del sync no sale al cliente y el cron no filtra los encabezados de la hoja.
- `tests/errores.test.ts`: `respuestaDeError` es el unico que decide que sale al cliente; un error interno no se filtra ni aunque traiga la propiedad `status`.
- `tests/paginas.test.ts`: se invocan las paginas reales — un closer no entra a las cuatro de gerente, un gerente no entra a `/mi-dia`, y una sesion con `id` vacio va al login.
- `tests/leer.test.ts`: el apostrofo del nombre de pestana se escapa duplicandolo.

## Decisiones tomadas que no estan en PROJECT.md

- **npm en vez de pnpm.** No se pudo instalar pnpm global (npm prefix `/usr/local`, requiere sudo). Los scripts son los mismos.
- **`.env.local` se carga a mano en las herramientas de linea de comandos.** Next.js lo hace solo; `drizzle-kit` y `tsx` no. La carga vive en `scripts/load-env.ts`. **Ya no tiene que ir como primer import** (B-05, 6-sep): `lib/db` crea el cliente de forma perezosa, en el primer query y no al importarse, asi que el orden de los imports dejo de importar. Los scripts lo siguen importando primero porque no habia razon para reordenarlos, pero si alguien agrega un import mas arriba ya no se rompe nada.
- **El proyecto de Google Cloud vive dentro de la organizacion `retiagrowth.com`.** La cuenta no puede crear proyectos fuera de ella. Ventaja: la cuenta de servicio de la Fase 1 sera interna al dominio, asi que compartirle las hojas no choca con restricciones de compartir fuera del dominio.
- **Pantalla de consentimiento OAuth: External, publicada** (estado "En produccion"). Permite que un closer entre con Gmail personal si hiciera falta. Quien controla quien entra es la tabla `users`, no Google.
- **Next 16.3.1 en vez de 15.** `create-next-app@latest` ya entrega 16. Se acepto y se documento.
- **`proxy.ts` en vez de `middleware.ts`.** Next 16 deprecó el nombre viejo; el build avisa y sugiere el codemod.
- **Sesiones JWT, sin adapter de base de datos.** El allowlist lo controlamos nosotros contra `users`; no hacen falta tablas de sesiones/cuentas. El rol se revalida contra la DB en cada emision de token, y la sesion dura 8 horas (`maxAge`).
- **Sin herencia de roles.** `gerente` no es "closer con extras": son conjuntos disjuntos. Un endpoint marcado `requireRole("gerente")` rechaza al closer y viceversa. Esta decision esta testeada.
- **`/api/health` es publico** para que Vercel pueda sondear el despliegue. No expone ningun dato del negocio.
- **Manejo de credenciales: nunca se abre `.env.local` en un editor.** El 18 de agosto una captura de pantalla del archivo abierto en TextEdit expuso la contrasena de Neon, el secreto de OAuth y el `AUTH_SECRET`. Las tres se rotaron el mismo dia. Desde entonces la configuracion se hace con `npm run setup` y `npm run rotar`, que leen los secretos sin eco, y en Vercel con `Import .env` desde el selector de archivos — en ningun paso el valor aparece en pantalla.
- **`AUTH_SECRET` es distinto entre local y produccion**, para que filtrar uno no permita falsificar sesiones en el otro.

## Deuda / TODOs abiertos

- **Decidido, no pendiente:** el gerente del sistema es `administrativa@retiagrowth.com` (el perfil de Google aparece como "Alejandro Carvajal Parra"). Michael lo confirmo el 18 de agosto tras plantearsele dos veces el riesgo. Implicacion a tener presente al construir la Fase 4: los registros de llamada quedan atribuidos a ese usuario, no a una persona individual.
- **`Production` y `Preview` comparten la misma base de datos en Vercel.** Hoy da igual porque no hay ramas de preview. Antes de trabajar fases con previews, separarlas para que un experimento no escriba sobre datos reales.
- **`CRON_SECRET` falta en Vercel.** Existe en `.env.local` y el cron esta probado en local, pero en produccion no correra hasta cargarlo y redesplegar. Mientras tanto la sincronizacion solo funciona con el boton manual.
- **La pantalla de fuentes es de solo lectura.** El plan de la Fase 1 pedia poder editar el mapeo de columnas desde la UI; hoy el mapeo se cambia en `scripts/seed-datos.ts` y se vuelve a sembrar. Se dejo asi a proposito: los tres formularios comparten un unico mapeo que ya funciona, y una UI de edicion sin necesidad real habria sido trabajo muerto. **Es una desviacion declarada, no un olvido.**
- **Solo estan activas las fuentes de personas.** Las de `calls`, `sales` y `ad_spend` estan sembradas pero inactivas: sus encabezados todavia no se han inspeccionado, y el plan prohibe adivinar mapeos. Inspeccionarlas con `npm run inspeccionar <sheetId> "<pestana>"` es el primer paso de la Fase 2.
- **Todavia no hay pantalla para administrar usuarios** — se agregan con `npm run db:studio`. Llega en una fase posterior.
- `lib/metrics/` todavia no existe (Fase 2). `lib/sheets/` **si existe y tiene cinco archivos**: es el corazon de la Fase 1.
- Las paginas de programa son placeholders (Fase 2). `/mi-dia` es placeholder (Fase 4). `/documentos` es placeholder (Fase 5). `/ajustes` es placeholder (Fase 1).
- No hay pantallas de error ni estados vacios propios todavia (Fase 7).
- El test de cobertura de permisos que recorre TODOS los endpoints es de la Fase 7; hoy se cubren los dos que existen.

## Como correr

```bash
npm install
npm run setup                  # configura .env.local de forma interactiva
npm run limpiar-respaldos      # borra los .env.local.bak-* que hayan quedado
npm run db:migrate             # aplica la migracion a Neon
npm run seed:users             # crea el primer gerente
npm run dev                    # http://localhost:3000

npm run typecheck
npm test
npm run build
```

## Verificado en la Fase 0

- `npm run build`, `npm run typecheck` y `npm run lint` pasan en limpio.
- 11 tests de Vitest pasando al cerrar la Fase 0, incluida la barrera de roles sobre los route handlers reales. (Hoy son 35: ver la seccion de tests de arriba.)
- Barrera de auth probada con peticiones reales: `/` redirige a `/login`, las APIs responden 401 JSON, `/api/health` responde 200, y `/login?error=AccessDenied` muestra el mensaje de correo no autorizado.
- **Login real con Google verificado end-to-end** contra Neon y el cliente OAuth de produccion.

## Desplegado

- **Historial (repo original bajo Michael):** produccion en `https://retia-metrics.vercel.app`, verificada de punta a punta el 18 de agosto. Ese deployment y ese proyecto de Vercel no pertenecen a esta copia y no se heredan.
- **Este fork (Retia-Agencia/retia-metrics):** sin deployment propio todavia. Al importar el repo a una cuenta de Vercel se crea un proyecto nuevo e independiente; hay que cargar las variables de entorno desde cero (ver `.env.example`).
- **Repo:** privado en GitHub. Los tres gates previos al push (ningun `.env` versionado, sin secretos en los archivos rastreados, `.env.example` si versionado) pasaron.
- **Credenciales rotadas el 18 de agosto (en el repo original):** contrasena de Neon, secreto de OAuth de Google y `AUTH_SECRET`. No aplican a este fork — hay que generar credenciales propias.


## Fase 1 — verificado contra datos reales

| | Filas leidas | Personas unicas | Duplicados |
|---|---|---|---|
| Comunicarte (`New form` + `Forms viejo`) | 1.320 | 1.253 | 5,1% |
| Tactical Investor | 2.965 | 1.839 | 38,0% |

`PROJECT.md` documentaba 2.932 filas -> 1.825 personas (37,8%) para Tactical Investor al
17 de agosto. Las hojas crecieron desde entonces y la tasa se mantuvo. **El motor reproduce
el ratio documentado sobre datos reales.**

Ademas:
- **Idempotencia:** la segunda corrida deja `change_log` intacto — 0 nuevas, 0 actualizadas, 0 cambios.
- **Bitacora:** alterar un campo a mano en la base y re-sincronizar produce **exactamente una** fila de bitacora, con valor anterior y nuevo.
- **Carga en frio:** 1.253 personas en 4,0 segundos. Con inserciones fila por fila tardaba 161 segundos, por encima del limite de una funcion de Vercel; se paso a lotes de 200.
- **Cron probado de punta a punta** en local: autoriza con el secreto correcto, sincroniza los dos programas y responde 401 con un secreto equivocado.


---

## Remediacion de la revision del 29 de agosto — en curso

Plan completo en [`docs/plan-remediacion-2026-09-06.md`](docs/plan-remediacion-2026-09-06.md),
que audita [`docs/revision-2026-08-29.md`](docs/revision-2026-08-29.md) contra el codigo y lo
parte en 26 tareas y cuatro tandas. Los tests pasaron de 35 a 55.

**Cerrado**

- **Tanda 0** — linea base: `npm test` (55), `npm run typecheck` y `npm run lint` en verde.
- **Tanda 1 completa** — S-02 (rol revalidado en cada emision, sesion de 8h), S-03 (token
  vaciado deja rol nulo y los cuatro consumidores fallan cerrado), S-04 + B-04 + F-10 (clase
  base `ErrorDeApp` en `lib/errors.ts`; `respuestaDeError` decide por tipo y no por forma, y es
  el unico lugar que decide que sale al cliente), S-07 (cron con `timingSafeEqual` y respuesta
  de solo conteos), S-05 (cuatro cabeceras de seguridad), S-10, S-11.
- **Tanda 2, parcial** — F-02 (una fila sin fecha solo rellena huecos), F-05 (fechas con
  `-05:00` explicito), F-09 (coincidencia exacta antes que parcial), F-08 (apostrofo escapado).
- **Tanda 3, lo que no necesita credenciales** — B-05 (cliente de base perezoso: `npm run build`
  ya no necesita `.env.local`), B-07 + B-08 + S-08 + S-09 (los cuatro de los scripts de shell,
  con `scripts/lib-env.sh` y `npm run limpiar-respaldos`), S-13 (IDs de las hojas por variable de
  entorno, y truncados tambien en `docs/estructura-bbdd.md`), B-03 (patron de zod en el borde,
  `ZodError` a 400), B-10 (tests de permisos sobre las cuatro paginas de gerente y la de closer),
  B-02 (paso de relectura obligatorio en `AGENTS.md`, y las cuatro afirmaciones falsas
  corregidas).
- **S-01 / B-09** — las 19 capturas fuera del arbol, `.gitignore` para imagenes en la raiz, y
  los seis secretos rotados el 6 de septiembre.

**Pendiente, con su bloqueo**

| Que | Bloqueado por |
|---|---|
| `AUTH_URL` en las variables de produccion (S-10) | No aplica a este fork: no hay proyecto de Vercel propio todavia |
| Migrar las fechas ya guardadas (F-05) | Decision: `compararCampos` no ve las fechas, asi que un `npm run sync` normal NO repara las filas existentes |
| B-01, F-03, F-04, F-07 (Tanda 2) | Falta `.env.local` para verificar de punta a punta con `npm run sync` |
| F-01 (Tanda 2) | Michael: valores reales de la columna `Estado` y su mapeo al enum; que hacer con `agenda` y `capacidadInvertir` |
| F-06 (Tanda 3) | Michael: si las filas se borran o se mueven de pestana |
| Tanda 3: S-06 + B-06 (retencion y PII), S-12 (Server Actions, va con la Fase 4), S-14 (rama de Neon para preview) | Decisiones de negocio y acceso a Vercel |

**Ojo al recibir un `.env.local` de antes del 6 de septiembre:** le faltan dos variables nuevas,
`SHEET_ID_COMUNICARTE` y `SHEET_ID_TACTICAL` (S-13). Sin ellas `npm run seed:datos` falla con un
mensaje que dice exactamente que hacer. Los valores estan en la URL de cada hoja, entre `/d/` y
`/edit`, y tambien en `docs/estructura-bbdd.md`.

**Prueba manual que falta hacer con credenciales:** que `npm run usuarios -- quitar <correo>`
saque a la persona en el siguiente request. Es lo que demuestra S-02, y el callback `jwt` no
es testeable sin extraerlo de la instancia de Auth.js.
