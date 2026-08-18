import "./load-env";
import { eq } from "drizzle-orm";
import { db } from "../lib/db";
import { users } from "../lib/db/schema";

/**
 * Inserta el primer gerente. Sin esto nadie puede entrar: no hay auto-registro.
 * Uso: SEED_GERENTE_EMAIL=... npm run seed:users
 */
async function main() {
  const email = process.env.SEED_GERENTE_EMAIL?.toLowerCase().trim();
  const nombre = process.env.SEED_GERENTE_NOMBRE?.trim() ?? "Gerencia Comercial";

  if (!email) {
    console.error("Falta SEED_GERENTE_EMAIL en .env.local");
    process.exit(1);
  }

  const existente = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (existente[0]) {
    await db
      .update(users)
      .set({ rol: "gerente", activo: true, nombre })
      .where(eq(users.email, email));
    console.log(`Actualizado: ${email} queda como gerente activo.`);
    return;
  }

  await db.insert(users).values({ email, nombre, rol: "gerente", activo: true });
  console.log(`Creado: ${email} como gerente.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Fallo el seed:", error);
    process.exit(1);
  });
