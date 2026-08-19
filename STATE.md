# Estado del proyecto
Ultima fase completada: 0 — Esqueleto, login y deploy
Fecha: 2026-08-18 (desplegada en produccion y verificada)
Produccion: https://retia-metrics.vercel.app
Repo: https://github.com/michaelcast533-cell/retia-metrics (privado)

## Que existe ya

**Autenticacion y roles**
- `lib/auth/roles.ts`: logica pura de roles (`puedeAcceder`, `esRolValido`) y los errores tipados `AuthenticationError` (401) y `AuthorizationError` (403). Sin DB, sin next-auth — se testea aislada.
- `lib/auth/config.ts`: config de Auth.js apta para edge (sin DB). La usa `proxy.ts`. Incluye el callback `session` que mapea claims del token.
- `lib/auth/index.ts`: instancia completa de Auth.js (runtime Node). Callback `signIn` con allowlist estricta contra la tabla `users`; callback `jwt` que revalida rol contra la DB al iniciar sesion y en `update`, y vacia el token si el usuario fue desactivado.
- `lib/auth/guards.ts`: `requireSession`, `requireRole(...roles)`, `requireGerente` y `respuestaDeError` para route handlers. **Este es el helper que exige el plan.**
- `lib/auth/page-guards.ts`: `paginaConSesion` / `paginaConRol` para paginas — redirigen en vez de tirar 500.
- `types/next-auth.d.ts`: augmentacion de `Session` y de `JWT` (sobre `@auth/core/jwt`).

**Base de datos**
- `lib/db/schema.ts`: enum `rol` + tabla `users` (id uuid, email unico, nombre, rol, closer_id, activo, created_at).
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
- `scripts/configurar-env.sh` (`npm run setup`): pide los valores de forma interactiva, lee los secretos sin eco (no quedan en pantalla ni en el historial del shell), valida la forma de cada uno, rechaza los de ejemplo, genera `AUTH_SECRET` solo y respalda el archivo anterior.
- `scripts/load-env.ts`: carga `.env.local` antes que cualquier otro modulo.

**Tests** — 11 pasando (`npm test`)
- `tests/roles.test.ts`: sin herencia de roles, sin rol no pasa nada, el closer no ve items de gerente.
- `tests/guards.test.ts`: invoca los route handlers reales con sesion mockeada — closer en endpoint de gerente = 403, sin sesion = 401, gerente = 200.

## Decisiones tomadas que no estan en PROJECT.md

- **npm en vez de pnpm.** No se pudo instalar pnpm global (npm prefix `/usr/local`, requiere sudo). Los scripts son los mismos.
- **`.env.local` se carga a mano en las herramientas de linea de comandos.** Next.js lo hace solo; `drizzle-kit` y `tsx` no. La carga vive en `scripts/load-env.ts` y va como PRIMER import de todo script, porque los imports se evaluan en orden y `lib/db` lee `DATABASE_URL` en cuanto se importa.
- **El proyecto de Google Cloud vive dentro de la organizacion `retiagrowth.com`.** La cuenta no puede crear proyectos fuera de ella. Ventaja: la cuenta de servicio de la Fase 1 sera interna al dominio, asi que compartirle las hojas no choca con restricciones de compartir fuera del dominio.
- **Pantalla de consentimiento OAuth: External, publicada** (estado "En produccion"). Permite que un closer entre con Gmail personal si hiciera falta. Quien controla quien entra es la tabla `users`, no Google.
- **Next 16.3.1 en vez de 15.** `create-next-app@latest` ya entrega 16. Se acepto y se documento.
- **`proxy.ts` en vez de `middleware.ts`.** Next 16 deprecó el nombre viejo; el build avisa y sugiere el codemod.
- **Sesiones JWT, sin adapter de base de datos.** El allowlist lo controlamos nosotros contra `users`; no hacen falta tablas de sesiones/cuentas. El rol se revalida contra la DB en cada emision de token.
- **Sin herencia de roles.** `gerente` no es "closer con extras": son conjuntos disjuntos. Un endpoint marcado `requireRole("gerente")` rechaza al closer y viceversa. Esta decision esta testeada.
- **`/api/health` es publico** para que Vercel pueda sondear el despliegue. No expone ningun dato del negocio.
- **Manejo de credenciales: nunca se abre `.env.local` en un editor.** El 18 de agosto una captura de pantalla del archivo abierto en TextEdit expuso la contrasena de Neon, el secreto de OAuth y el `AUTH_SECRET`. Las tres se rotaron el mismo dia. Desde entonces la configuracion se hace con `npm run setup` y `npm run rotar`, que leen los secretos sin eco, y en Vercel con `Import .env` desde el selector de archivos — en ningun paso el valor aparece en pantalla.
- **`AUTH_SECRET` es distinto entre local y produccion**, para que filtrar uno no permita falsificar sesiones en el otro.

## Deuda / TODOs abiertos

- **El unico usuario es `administrativa@retiagrowth.com`, con rol gerente — y NO es la cuenta de Michael.** Al iniciar sesion, la app muestra el perfil como "Alejandro Carvajal Parra". Consecuencias: quien tenga la clave de ese buzon entra como gerente y ve caja, CAC, ROAS y el comparativo de closers; los registros de llamada de la Fase 4 quedarian atribuidos a Alejandro; y si le quitan ese buzon a Michael, se queda sin acceso. **Pendiente: insertar el correo propio de Michael como gerente.**
- **`Production` y `Preview` comparten la misma base de datos en Vercel.** Hoy da igual porque no hay ramas de preview. Antes de trabajar fases con previews, separarlas para que un experimento no escriba sobre datos reales.
- **Falta borrar el secreto viejo de OAuth en Google Cloud.** Hay dos secretos activos en el cliente `Retia Metrics Web`; el nuevo ya esta en uso en local y produccion.
- **Todavia no hay pantalla para administrar usuarios** — se agregan con `npm run db:studio`. Llega en una fase posterior.
- `lib/sheets/` y `lib/metrics/` estan vacias (Fase 1 y Fase 2).
- Las paginas de programa son placeholders (Fase 2). `/mi-dia` es placeholder (Fase 4). `/documentos` es placeholder (Fase 5). `/ajustes` es placeholder (Fase 1).
- No hay pantallas de error ni estados vacios propios todavia (Fase 7).
- El test de cobertura de permisos que recorre TODOS los endpoints es de la Fase 7; hoy se cubren los dos que existen.

## Como correr

```bash
npm install
npm run setup                  # configura .env.local de forma interactiva
npm run db:migrate             # aplica la migracion a Neon
npm run seed:users             # crea el primer gerente
npm run dev                    # http://localhost:3000

npm run typecheck
npm test
npm run build
```

## Verificado en esta fase

- `npm run build`, `npm run typecheck` y `npm run lint` pasan en limpio.
- 11 tests de Vitest pasando, incluida la barrera de roles sobre los route handlers reales.
- Barrera de auth probada con peticiones reales: `/` redirige a `/login`, las APIs responden 401 JSON, `/api/health` responde 200, y `/login?error=AccessDenied` muestra el mensaje de correo no autorizado.
- **Login real con Google verificado end-to-end** contra Neon y el cliente OAuth de produccion.

## Desplegado

- **Produccion:** https://retia-metrics.vercel.app — verificada de punta a punta el 18 de agosto: raiz redirige a `/login`, las APIs responden 401 sin sesion, el endpoint de gerente responde 401, el callback de Google coincide con el autorizado, y el login real funciona.
- **Repo:** privado en GitHub. Los tres gates previos al push (ningun `.env` versionado, sin secretos en los archivos rastreados, `.env.example` si versionado) pasaron.
- **Credenciales rotadas el 18 de agosto:** contrasena de Neon, secreto de OAuth de Google y `AUTH_SECRET`. Los respaldos de `.env.local` que contenian las viejas fueron borrados.
