import "./load-env";
import { eq } from "drizzle-orm";
import { db } from "../lib/db";
import { users } from "../lib/db/schema";

/**
 * Administra quien puede entrar a la app. No hay auto-registro: quien no este
 * en esta tabla con activo=true recibe "correo no autorizado" aunque su cuenta
 * de Google sea valida.
 *
 *   npm run usuarios                                  lista
 *   npm run usuarios -- agregar <correo> <rol> [id]   agrega o reactiva
 *   npm run usuarios -- quitar <correo>               desactiva (no borra)
 *
 * `rol` es gerente o closer. `id` es el closer_id: el nombre exacto con el que
 * la persona aparece en la columna de closer de la BBDD (Juanjo, Dana, Andrea).
 */

const ROLES = ["gerente", "closer"] as const;
type Rol = (typeof ROLES)[number];

async function listar() {
  const filas = await db.select().from(users).orderBy(users.email);
  if (filas.length === 0) {
    console.log("\n  No hay usuarios. Nadie puede entrar.\n");
    return;
  }
  console.log("\n  Quien puede entrar a la app:\n");
  for (const u of filas) {
    const estado = u.activo ? "activo  " : "INACTIVO";
    const closer = u.closerId ? `  closer_id: ${u.closerId}` : "";
    console.log(`    ${estado}  ${u.rol.padEnd(8)}  ${u.email}${closer}`);
  }
  const gerentes = filas.filter((u) => u.activo && u.rol === "gerente").length;
  console.log(`\n  ${filas.filter((u) => u.activo).length} activo(s), ${gerentes} con rol gerente.\n`);
}

async function agregar(email: string, rol: string, closerId?: string) {
  const correo = email.toLowerCase().trim();
  if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(correo)) {
    console.error(`\n  "${email}" no parece un correo.\n`);
    process.exit(1);
  }
  if (!ROLES.includes(rol as Rol)) {
    console.error(`\n  Rol invalido: "${rol}". Tiene que ser gerente o closer.\n`);
    process.exit(1);
  }
  if (rol === "closer" && !closerId) {
    console.error(
      "\n  Un closer necesita su closer_id: el nombre exacto con el que aparece\n" +
      "  en la columna de closer de la BBDD. Sin eso sus llamadas no se cruzan.\n" +
      `  Uso: npm run usuarios -- agregar ${correo} closer "Andrea"\n`,
    );
    process.exit(1);
  }

  const [existe] = await db.select().from(users).where(eq(users.email, correo)).limit(1);
  if (existe) {
    await db
      .update(users)
      .set({ rol: rol as Rol, closerId: closerId ?? existe.closerId, activo: true })
      .where(eq(users.id, existe.id));
    console.log(`\n  Actualizado: ${correo} queda como ${rol}, activo.\n`);
  } else {
    await db.insert(users).values({ email: correo, rol: rol as Rol, closerId: closerId ?? null, activo: true });
    console.log(`\n  Agregado: ${correo} como ${rol}.\n`);
  }
}

async function quitar(email: string) {
  const correo = email.toLowerCase().trim();
  const [existe] = await db.select().from(users).where(eq(users.email, correo)).limit(1);
  if (!existe) {
    console.error(`\n  ${correo} no esta en la tabla.\n`);
    process.exit(1);
  }

  const activos = await db.select().from(users).where(eq(users.activo, true));
  const gerentesActivos = activos.filter((u) => u.rol === "gerente");
  if (existe.rol === "gerente" && existe.activo && gerentesActivos.length === 1) {
    console.error(
      "\n  Es el unico gerente activo. Desactivarlo dejaria la app sin nadie que\n" +
      "  pueda administrarla ni ver los dashboards. Agrega otro gerente primero.\n",
    );
    process.exit(1);
  }

  // Se desactiva, no se borra: el historial de quien registro que se conserva.
  await db.update(users).set({ activo: false }).where(eq(users.id, existe.id));
  console.log(`\n  ${correo} queda inactivo. No podra entrar en la proxima emision de token.\n`);
}

async function main() {
  const [accion, ...resto] = process.argv.slice(2);
  if (!accion || accion === "listar") return listar();
  if (accion === "agregar") return agregar(resto[0], resto[1], resto[2]);
  if (accion === "quitar") return quitar(resto[0]);
  console.error(
    "\n  Uso:\n" +
    "    npm run usuarios\n" +
    "    npm run usuarios -- agregar <correo> <gerente|closer> [closer_id]\n" +
    "    npm run usuarios -- quitar <correo>\n",
  );
  process.exit(1);
}

main().then(() => process.exit(0)).catch((e) => { console.error("Fallo:", e); process.exit(1); });
