import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { readdirSync, readFileSync } from "node:fs";

// 25-nov: ~340 s de la suite eran importar los mismos módulos (schema, drizzle, lib/) una vez por
// archivo. Con `isolate: false` un worker importa una vez y reusa el módulo en los archivos que le
// tocan. Pero sin aislar, vitest tampoco resetea los mocks ni el registro de módulos entre archivos
// (`vitest/dist/chunks/base.*.js`: `if (config.isolate) { mocker.reset(); resetModules(...) }`),
// así que un archivo que toca estado global (mock de módulo, espía, reloj falso, env) contamina al
// siguiente. Esos siguen aislados. La lista se deduce del contenido: un archivo que agregue un
// `vi.mock` pasa solo al grupo aislado.
const TOCA_ESTADO_GLOBAL =
  /vi\.(mock|doMock|spyOn|stubEnv|stubGlobal|useFakeTimers|setSystemTime|hoisted|importActual|resetModules)|process\.env\.[A-Z_]+ *=[^=]|globalThis\.[a-zA-Z_]+ *=[^=]/;
const aislados = readdirSync("tests")
  .filter((f) => f.endsWith(".test.ts") && TOCA_ESTADO_GLOBAL.test(readFileSync(`tests/${f}`, "utf8")))
  .map((f) => `tests/${f}`);

export default defineConfig({
  test: {
    environment: "node",
    // ~92 archivos pagaban cada uno PGlite (~700 ms) y migraciones (~150 ms).
    globalSetup: ["./tests/helpers/volcado-global.ts"],
    // Los tests de base levantan un PGlite en memoria y le aplican TODAS las
    // migraciones (ADR 0020). Con los archivos corriendo en paralelo eso no cabe
    // en los 5s por defecto y el fallo es del reloj, no del codigo.
    testTimeout: 20_000,
    // El `beforeEach` de `crearBaseDePrueba()` hace ese mismo trabajo, y el limite de
    // los hooks es OTRO: se quedaba en los 10s por defecto, asi que con varias
    // sesiones compitiendo por la maquina el suite se caia en cascada por el reloj
    // (9 archivos rojos que pasaban uno por uno). Va parejo con `testTimeout`.
    hookTimeout: 20_000,
    projects: [
      { extends: true, test: { name: "aislados", include: aislados, isolate: true } },
      {
        extends: true,
        test: { name: "compartidos", include: ["tests/**/*.test.ts"], exclude: aislados, isolate: false },
      },
    ],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
});
