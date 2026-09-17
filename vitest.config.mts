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
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
});
