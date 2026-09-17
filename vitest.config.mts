import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Los tests de base levantan un PGlite en memoria y le aplican TODAS las
    // migraciones (ADR 0020). Con los archivos corriendo en paralelo eso no cabe
    // en los 5s por defecto y el fallo es del reloj, no del codigo.
    testTimeout: 20_000,
    // El `beforeEach` de `crearBaseDePrueba()` hace ese mismo trabajo, y el limite de
    // los hooks es OTRO: se quedaba en los 10s por defecto, asi que con varias
    // sesiones compitiendo por la maquina el suite se caia en cascada por el reloj
    // (9 archivos rojos que pasaban uno por uno). Va parejo con `testTimeout`.
    hookTimeout: 20_000,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
});
