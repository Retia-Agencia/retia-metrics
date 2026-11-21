## Feedback loops

The agent should run these to get fast signal on whether code works. Keep them current.

- **Test:** `npm test` (Vitest por `scripts/test.mjs`: una suite por máquina, sin huérfanos, límite
  de 480 s; ver Conventions). 1.810 pasando al 1-oct; entre 60 y 190 s según la máquina.
  Un programa de prueba ACTIVO se crea con `PROGRAMA_DE_PRUEBA` (`tests/helpers/programa-de-prueba.ts`):
  desde la 0031 un programa nace inactivo y la base exige el token para activarlo (`reactivarPrograma` exige además fuente principal, ADR 0068). Los tests que necesitan base usan PGlite en
  memoria con todas las migraciones aplicadas: `tests/helpers/base-de-prueba.ts` (ADR 0020). **Desde el 1-oct
  (ticket 150) la base se migra UNA vez por corrida** en el `globalSetup` (`tests/helpers/volcado-global.ts`) y
  cada archivo carga ese volcado; si no existe, migra por su cuenta como antes. Una migración con SQL roto
  revienta la corrida entera, una vez, con el error de la migración (probado en una rama desechable).
  **Desde el 14-oct, una base por ARCHIVO:** `crearBaseReutilizable()` en `beforeAll`, `await vaciar()` al
  empezar cada `beforeEach` y `cerrar` en `afterAll`. `vaciar` trunca las tablas y restaura las filas que
  siembran las migraciones (~25 ms contra ~0,6 s por test de un PGlite nuevo en el CI; la suite llegó a 462 s).
  `crearBaseDePrueba()` (base nueva) queda solo para las excepciones con razón que nombra
  `tests/base-por-archivo-guardian.test.ts`: tests que cambian el esquema o prueban migraciones.
  `npm run test:cambios` (`vitest run --changed`) existe, pero desde el 20-nov no se corre en local (ver abajo).
  El lock se resincronizó otra vez el 28-sep (`649bf2c`): la primera corrida del CI lo midió roto en
  Linux (faltaban `@emnapi/core` y `@emnapi/runtime` 1.11.3), y desde ahí `npm ci` pasa en el CI. Si te
  vuelve a fallar, `npm install --package-lock-only` y commit del lock, nunca `--no-package-lock`. Si ves 46 tests caídos por `drizzle-orm/postgres-js`,
  a tu `node_modules` le falta el driver `postgres`: es entorno, no regresión.
- 🩸 **Ningún test corre en local: todo cambio entra por PR y lo verifica el CI del PR** (Mani, 20-nov; reemplaza la
  regla del 1-oct, que permitía los archivos del cambio "si había aire"). Ni la suite, ni archivos sueltos
  (`npm test -- tests/x.test.ts`), ni `test:cambios`, ni `test:humo`, en ninguna sesión, hija o agente. Typecheck y
  lint locales son opcionales (no son tests y el CI los repite). Cada sesión escribe el código y sus tests, empuja
  su rama y **abre el PR; no mergea**. Mani no aprueba PRs: la sesión padre lee el diff contra el ticket, espera el
  CI verde del PR (con main traído si otro PR tocó sus archivos) y mergea. Origen: la suite se cortó tres veces a
  los 480 s en una Mac con 16,5 GB de swap (1-oct) y cada corrida local compite con las sesiones paralelas. La suite completa la valida el CI de cada
  PR y de cada push a `main` (no usa la máquina de nadie). `npm test` en el CI, medido con el ticket 150: **vitest 372 s → 274 s**
  (paso de 6 min 12 s a 4 min 34 s; ~8 min la corrida entera). Un archivo suelto en local no gana: ~3,7 s
  antes y ~4,2 s después, porque la migración sigue pagándose una vez. **Desde el 1-oct la valida un
  checkpoint** (`docs/plan-reparto.md` §6): dos al día, nadie empuja mientras corre, y si sale verde se marca con
  el tag `cp-AAAAMMDD-N`; si sale rojo, el culpable está entre el último tag y la punta. **Un ticket no está
  terminado hasta el checkpoint verde que lo incluye.** El CI del PR es el nivel 1 de cada sesión (typecheck,
  lint y tests, regla del 20-nov). El CI además corre lo que en local se salta: los tests
  contra Postgres real (`DATABASE_URL_PRUEBA_POSTGRES`), que el 1-oct estuvieron rojos 3 h sin que nadie mirara.
  Ojo: el CI cancela la corrida anterior al empujar otro commit (`cancel-in-progress`): entre checkpoints es
  alarma, no reja, y durante un checkpoint no se empuja. Pendiente: CI también en ramas.
- **Typecheck:** `npm run typecheck` (`tsc --noEmit`) · **Lint:** `npm run lint`
- **Humo de la UI (ADR 0083, 9-oct):** `npm run test:humo` (Playwright, `e2e/humo.spec.ts`). Con `npm run dev:local`
  ya arriba, entra con cada rol de la base local, visita cada pantalla y cada tab de programa, hace clic en todo lo
  que se abre (botones, selects, menús, plegables, y un nivel dentro de cada diálogo) y falla con cualquier error de
  consola o de página, un 5xx, una sesión perdida o un rol que la base no tiene. **Corta las escrituras en la red**
  (aborta todo lo que no sea GET); lo que una página escribe al renderizar sí ocurre, por eso solo contra `dev:local`. Escritorio y
  celular (`--project=escritorio` / `--project=celular`); unos 6 a 12 min por proyecto. Desde el 20-nov no se corre
  en local (regla de arriba) y todavía no está en el CI: hasta que entre, un cambio de pantalla se verifica abriendo
  la pantalla con `dev:local` (un recorrido, no un test; los previews de Vercel no tienen base). La primera vez: `npx playwright install chromium`.
- **Worktree restringido en Windows:** si PowerShell bloquea `npm.ps1`, usar `npm.cmd`. Si Vite no
  puede escribir en `node_modules/.vite-temp` porque las dependencias son compartidas, usar
  `npm.cmd test -- --configLoader runner tests/<archivo>.test.ts`; conserva el candado de `npm test`.
- **Run:** `npm run dev` (http://localhost:3000) — **escribe en producción**, es la unica base.
- **Base local (ticket 113):** `npm run db:local` (Docker: Postgres 17, todas las migraciones y un seed
  por `lib/`) y `npm run dev:local` (la app contra ella, sin tocar `.env.local`). Para clics de prueba en
  pantallas. Sembrar contra Postgres real ya destapo un bug que PGlite escondia. **Login local (ticket
  069):** `dev:local` habilita un proveedor de credenciales que entra con solo un correo de `users`
  (activo), SIN Google; existe unicamente con `AUTH_LOGIN_LOCAL=1` **y** una `DATABASE_URL` local
  (`lib/db/es-local.ts`, la unica respuesta a "¿es local?"), asi que en produccion no se registra y el rol
  sigue saliendo de la base por los callbacks de siempre.
- **CI:** `.github/workflows/ci.yml` corre `npm ci`, typecheck, lint, test y build en cada PR y en cada push a `main`.
  Desde el 14-oct `npm test` va en 3 shards (`--shard=i/3`, un runner cada uno) y typecheck, lint y build en
  otro job: en un solo job la suite llegó a 462 s y se cortó en los 480 s. El checkpoint es verde solo si
  los 4 jobs lo son.
  Sin proteccion de `main` (Mani, 28-sep): es alarma, no reja; si queda en rojo, se arregla primero.

`npm run build` no necesita `.env.local`: el cliente de la base se crea de forma perezosa.

