import "./load-env";
import { eq } from "drizzle-orm";
import { ZodError } from "zod";
import { db } from "../lib/db";
import { miembrosPrograma, users } from "../lib/db/schema";
import { parsearEntradaUsuario } from "../lib/catalogo/usuarios";
import { esAdministrador } from "../lib/auth/roles";

/**
 * Administra quien puede entrar a la app. No hay auto-registro: quien no este
 * en esta tabla con activo=true recibe "correo no autorizado" aunque su cuenta
 * de Google sea valida.
 *
 * Es el ACCESO DE EMERGENCIA (ticket 015): la via normal es `/ajustes/usuarios`.
 * Valida por el MISMO esquema zod que la pantalla (`parsearEntradaUsuario`), asi
 * que un closer necesita su closer_id y al menos un programa (uuid), igual que en
 * la app.
 *
 *   npm run usuarios                                          lista
 *   npm run usuarios -- agregar <correo> <rol> [id] [prog...] agrega o reactiva
 *   npm run usuarios -- quitar <correo>                       desactiva (no borra)
 *
 * `rol` es gerente, closer o developer (ADR 0025: el developer entra a todas las
 * rutas). `id` es el closer_id: el nombre exacto con el que la
 * persona aparece en la columna de closer de la BBDD (Juanjo, Dana, Andrea). `prog`
 * son uuids de programa (los da `npm run db:studio`): un closer necesita al menos
 * uno.
 */

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
  // Se cuentan ADMINISTRADORES, no gerentes: desde el ADR 0025 el developer tambien
  // administra, y este script existe justamente para no quedarse sin ninguno.
  const admins = filas.filter((u) => u.activo && esAdministrador(u.rol)).length;
  console.log(`\n  ${filas.filter((u) => u.activo).length} activo(s), ${admins} con rol de administracion.\n`);
}

async function agregar(email: string, rol: string, closerId?: string, ...programas: string[]) {
  // Se valida con el MISMO esquema zod que la pantalla: correo normalizado, y un
  // closer con su closer_id y al menos un programa. Cualquier fallo sale como el
  // mensaje del esquema, no como una regla duplicada aca.
  let datos;
  try {
    datos = parsearEntradaUsuario({
      email,
      rol,
      closerId: closerId ?? "",
      programas,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      console.error(`\n  ${error.issues[0]?.message ?? "Entrada invalida."}`);
      console.error(
        `  Uso: npm run usuarios -- agregar ${email} ${rol} ${
          rol === "closer" ? '"CloserId" <uuid-programa> [<uuid-programa>...]' : ""
        }\n`,
      );
      process.exit(1);
    }
    throw error;
  }

  const [existe] = await db.select().from(users).where(eq(users.email, datos.email)).limit(1);
  let userId: string;
  if (existe) {
    await db
      .update(users)
      .set({ rol: datos.rol, closerId: datos.closerId, activo: true })
      .where(eq(users.id, existe.id));
    userId = existe.id;
    console.log(`\n  Actualizado: ${datos.email} queda como ${datos.rol}, activo.`);
  } else {
    const [creado] = await db
      .insert(users)
      .values({
        email: datos.email,
        rol: datos.rol,
        closerId: datos.closerId,
        calendlyEmail: datos.calendlyEmail,
        nombre: datos.nombre,
        activo: true,
      })
      .returning();
    userId = creado.id;
    console.log(`\n  Agregado: ${datos.email} como ${datos.rol}.`);
  }

  // Sincroniza membresias: activa/inserta las elegidas (nunca borra). El CLI de
  // emergencia no desactiva membresias viejas; para eso esta la pantalla.
  for (const programId of datos.programas) {
    await db
      .insert(miembrosPrograma)
      .values({ userId, programId, activo: true })
      .onConflictDoUpdate({
        target: [miembrosPrograma.userId, miembrosPrograma.programId],
        set: { activo: true },
      });
  }
  if (datos.programas.length > 0) {
    console.log(`  ${datos.programas.length} programa(s) asignado(s).`);
  }
  console.log("");
}

async function quitar(email: string) {
  const correo = email.toLowerCase().trim();
  const [existe] = await db.select().from(users).where(eq(users.email, correo)).limit(1);
  if (!existe) {
    console.error(`\n  ${correo} no esta en la tabla.\n`);
    process.exit(1);
  }

  const activos = await db.select().from(users).where(eq(users.activo, true));
  // La salvaguarda es de ADMINISTRADORES, no de gerentes: desde el ADR 0025 el
  // developer tambien administra, asi que cuenta para no dejar la app sin nadie que
  // pueda administrarla. Antes era `u.rol === "gerente"` a mano, que ignoraba al
  // developer (ticket 032). `esAdministrador` es la unica fuente de esa pregunta.
  const administradoresActivos = activos.filter((u) => esAdministrador(u.rol));
  if (esAdministrador(existe.rol) && existe.activo && administradoresActivos.length === 1) {
    console.error(
      "\n  Es el unico administrador activo. Desactivarlo dejaria la app sin nadie que\n" +
      "  pueda administrarla ni ver los dashboards. Agrega otro administrador primero.\n",
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
  if (accion === "agregar") return agregar(resto[0], resto[1], resto[2], ...resto.slice(3));
  if (accion === "quitar") return quitar(resto[0]);
  console.error(
    "\n  Uso:\n" +
    "    npm run usuarios\n" +
    "    npm run usuarios -- agregar <correo> <gerente|closer> [closer_id] [uuid-programa...]\n" +
    "    npm run usuarios -- quitar <correo>\n",
  );
  process.exit(1);
}

main().then(() => process.exit(0)).catch((e) => { console.error("Fallo:", e); process.exit(1); });
