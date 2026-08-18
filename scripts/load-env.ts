import { config } from "dotenv";

/**
 * Carga .env.local antes que cualquier otro modulo.
 * Va como PRIMER import de todo script de linea de comandos: los imports se
 * evaluan en orden, y lib/db lee DATABASE_URL en cuanto se importa.
 * Next.js hace esto solo; fuera de Next, no.
 */
config({ path: [".env.local", ".env"], quiet: true });
