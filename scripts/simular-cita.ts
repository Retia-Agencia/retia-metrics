import "./load-env";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../lib/db";
import { programs } from "../lib/db/schema";
import { HEADER_FIRMA_CALENDLY } from "../lib/calendly/evento-webhook";
import { LOCAL_DB_URL, validarUrlLocal } from "./db-local-url";

function argumento(nombre: string): string | null {
  const i = process.argv.indexOf(nombre);
  return i === -1 ? null : (process.argv[i + 1] ?? null);
}

function mananaALasDiez(): string {
  const hoy = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const fecha = new Date(`${hoy}T12:00:00Z`);
  fecha.setUTCDate(fecha.getUTCDate() + 1);
  return `${fecha.toISOString().slice(0, 10)}T10:00:00-05:00`;
}

async function main() {
  validarUrlLocal(LOCAL_DB_URL);
  process.env.DATABASE_URL = LOCAL_DB_URL;
  process.env.DATABASE_URL_DIRECTA = LOCAL_DB_URL;

  const slug = argumento("--programa");
  const cancelar = process.argv.includes("--cancelar");
  const host = argumento("--host");
  const lead = argumento("--lead");
  const uuid = argumento("--uuid") ?? randomUUID();
  if (!slug) throw new Error("Falta --programa <slug>.");
  if (cancelar && !argumento("--uuid")) throw new Error("Para cancelar falta --uuid <uuid del invitado>.");
  if (!cancelar && (!host || !lead)) throw new Error("Para crear faltan --host <correo> y --lead <correo>.");

  const [programa] = await db
    .select({ id: programs.id, clave: programs.calendlySigningKey })
    .from(programs)
    .where(eq(programs.slug, slug));
  if (!programa) throw new Error(`No existe el programa local "${slug}".`);

  let clave = programa.clave;
  if (!clave) {
    clave = randomBytes(32).toString("hex");
    await db.update(programs).set({ calendlySigningKey: clave }).where(eq(programs.id, programa.id));
  }

  const uri = `https://api.calendly.com/scheduled_events/SIMULADA/invitees/${uuid}`;
  const fecha = argumento("--fecha") ?? mananaALasDiez();
  if (!cancelar && Number.isNaN(new Date(fecha).getTime())) throw new Error("--fecha debe ser una fecha ISO válida.");
  const payload = cancelar
    ? { event: "invitee.canceled", payload: { uri, rescheduled: false } }
    : {
        event: "invitee.created",
        payload: {
          uri,
          email: lead,
          name: "Cita simulada",
          rescheduled: false,
          old_invitee: null,
          tracking: { utm_content: argumento("--codigo") },
          scheduled_event: {
            start_time: fecha,
            event_memberships: [{ user_email: host }],
          },
        },
      };
  const cuerpo = JSON.stringify(payload);
  const t = Math.floor(Date.now() / 1000);
  const firma = createHmac("sha256", clave).update(`${t}.${cuerpo}`, "utf8").digest("hex");
  const base = (argumento("--url") ?? "http://localhost:3000").replace(/\/+$/, "");
  const respuesta = await fetch(`${base}/api/webhooks/calendly/${programa.id}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      [HEADER_FIRMA_CALENDLY]: `t=${t},v1=${firma}`,
    },
    body: cuerpo,
  });
  console.log(`Estado: ${respuesta.status}`);
  console.log(`Cuerpo: ${await respuesta.text()}`);
  console.log(`UUID del invitado: ${uuid}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
