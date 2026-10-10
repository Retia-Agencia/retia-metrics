import { defineConfig, devices } from "@playwright/test";

/**
 * El humo de la UI (ADR 0083, ticket 075). Corre contra `npm run dev:local`, que ya tiene que
 * estar arriba con la base local sembrada (`npm run db:local`): este archivo NO levanta el
 * servidor, porque `dev:local` es el único camino que garantiza que la app no toque producción.
 */
export default defineConfig({
  testDir: "./e2e",
  // Un solo worker: las tres sesiones comparten un `next dev` que compila cada ruta la primera vez.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  // Cada rol recorre todas sus pantallas en un solo test; la primera compilación de Next es lenta.
  timeout: 15 * 60_000,
  reporter: [["list"]],
  use: {
    baseURL: process.env.HUMO_URL ?? "http://localhost:3000",
    trace: "off",
    screenshot: "off",
  },
  projects: [
    { name: "escritorio", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "celular", use: { ...devices["Pixel 7"] } },
  ],
});
