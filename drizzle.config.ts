import { defineConfig } from "drizzle-kit";
// Next.js carga .env.local solo; las herramientas de linea de comandos no.
import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true });

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // Las migraciones van por la conexion DIRECTA de Supabase (puerto 5432), no por el
    // pooler de la app: el pooler en modo transaction no sostiene lo que drizzle-kit
    // necesita (sesion, prepared statements). Sin la directa, cae a DATABASE_URL.
    url: process.env.DATABASE_URL_DIRECTA ?? process.env.DATABASE_URL ?? "",
  },
  verbose: true,
  strict: true,
});
