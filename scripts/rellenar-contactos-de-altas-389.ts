import "./load-env";
import { and, eq, notExists } from "drizzle-orm";
import { db } from "../lib/db";
import { leadContactos, leads } from "../lib/db/schema";
import { insertarContactosDeAlta } from "../lib/ingesta/contactos-de-alta";
import { normalizarTelefono } from "../lib/ingesta/envio";
import { LOCAL_DB_URL, validarUrlLocal } from "./db-local-url";

/**
 * Relleno UNICO de los contactos (correo y telefono) de las altas manuales que nacieron antes
 * del 389 (`entrada = crm`, sin ninguna fila en `lead_contactos`). Usa el mismo escritor que el
 * alta nueva (`insertarContactosDeAlta`), asi que no hay una segunda regla.
 *
 *   npx tsx scripts/rellenar-contactos-de-altas-389.ts [--aplicar] [--local]
 *
 * ENSAYO por defecto: cuenta y no escribe. `--aplicar` escribe (pide el ok de Mani; mirar el ref).
 * Solo imprime conteos, nunca datos personales. Idempotente: solo toca leads sin contactos, y un
 * telefono de otro lead del programa se salta por el indice unico (onConflictDoNothing).
 * `lead_contactos` no tiene rastro propio en `change_log`: las filas quedan con
 * `submission_id` nulo y `es_principal`, que es como se reconocen.
 */
async function main() {
  const aplicar = process.argv.includes("--aplicar");
  if (process.argv.includes("--local")) {
    validarUrlLocal(LOCAL_DB_URL);
    process.env.DATABASE_URL = LOCAL_DB_URL;
    process.env.DATABASE_URL_DIRECTA = LOCAL_DB_URL;
  }
  const ref = process.env.DATABASE_URL?.match(/postgres\.([a-z0-9]+)[:@]/)?.[1] ?? "local o sin ref";
  console.log(`Base: ${ref} · ${aplicar ? "APLICANDO" : "ensayo (no escribe)"}`);

  const sinContactos = await db
    .select({ id: leads.id, programId: leads.programId, correo: leads.emailNormalizado, telefono: leads.telefono })
    .from(leads)
    .where(
      and(
        eq(leads.entrada, "crm"),
        notExists(db.select({ x: leadContactos.id }).from(leadContactos).where(eq(leadContactos.leadId, leads.id))),
      ),
    );

  const conTelefonoValido = sinContactos.filter((l) => normalizarTelefono(l.telefono)).length;
  console.log(`Altas manuales sin contactos: ${sinContactos.length}`);
  console.log(`  con telefono valido: ${conTelefonoValido} · sin telefono o invalido: ${sinContactos.length - conTelefonoValido}`);

  const antes = await db.$count(leadContactos);
  if (!aplicar) {
    console.log(`Contactos hoy: ${antes} · se insertarian hasta ${sinContactos.length + conTelefonoValido}`);
    return;
  }

  await db.transaction(async (tx) => {
    for (const l of sinContactos) {
      await insertarContactosDeAlta(tx as never, {
        leadId: l.id,
        programId: l.programId,
        correo: l.correo,
        telefono: l.telefono,
      });
    }
  });
  const despues = await db.$count(leadContactos);
  console.log(`Contactos antes: ${antes} · despues: ${despues} · insertados: ${despues - antes}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
