import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { changeLog, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import { conectarCalendly, type FetchConCuerpo } from "@/lib/calendly/suscripcion";
import { listarProgramas } from "@/lib/catalogo/programas";
import { archivos, sinComentarios } from "./helpers/codigo-fuente";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * "Conectar Calendly" (ticket 096, A5): crea la suscripcion por la API con el token del
 * programa y guarda la clave de firma, que es un secreto (tercera excepcion nombrada). La
 * API de Calendly va simulada: ningun test la toca.
 */

let db: Db;
let cerrar: () => Promise<void>;
let programId: string;
let gerente: string;
const BASE_URL = "https://crm.retia.co";
const ORG = "https://api.calendly.com/organizations/ORG1";

interface Pedido {
  url: string;
  method: string;
  body?: Record<string, unknown>;
}

function calendlySimulado(opciones: { existentes?: { uri: string; callback_url: string }[]; alCrear?: number } = {}) {
  const pedidos: Pedido[] = [];
  const fetch: FetchConCuerpo = async (url, init) => {
    const method = init?.method ?? "GET";
    pedidos.push({ url, method, body: init?.body ? JSON.parse(init.body) : undefined });
    const ok = (json: unknown, status = 200) => ({ ok: status < 300, status, json: async () => json });
    if (url.endsWith("/users/me")) return ok({ resource: { current_organization: ORG } });
    if (method === "GET" && url.includes("/webhook_subscriptions")) {
      return ok({ collection: opciones.existentes ?? [], pagination: { next_page: null } });
    }
    if (method === "DELETE") return ok(null, 204);
    if (method === "POST") return ok({ resource: {} }, opciones.alCrear ?? 201);
    return ok({}, 404);
  };
  return { fetch, pedidos };
}

const clave = async () =>
  (await db.select({ k: programs.calendlySigningKey }).from(programs).where(eq(programs.id, programId)))[0].k;

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  const [p] = await db
    .insert(programs)
    .values({ ...PROGRAMA_DE_PRUEBA, slug: "tactical", nombre: "Tactical", ticketUsd: "1500" })
    .returning();
  programId = p.id;
  const [g] = await db.insert(users).values({ email: "gerente@retiagrowth.com", rol: "gerente" }).returning();
  gerente = g.id;
});

afterEach(async () => {
  await cerrar();
});

describe("conectarCalendly", () => {
  it("crea la suscripcion de la organizacion con los cuatro eventos y la clave que guarda", async () => {
    const { fetch, pedidos } = calendlySimulado();
    const { url } = await conectarCalendly(db, gerente, programId, { urlBase: `${BASE_URL}/`, fetch });
    expect(url).toBe(`${BASE_URL}/api/webhooks/calendly/${programId}`);

    const post = pedidos.find((p) => p.method === "POST")!;
    expect(post.body).toMatchObject({
      url,
      organization: ORG,
      scope: "organization",
      events: ["invitee.created", "invitee.canceled", "invitee_no_show.created", "invitee_no_show.deleted"],
    });
    const guardada = await clave();
    expect(guardada).toBe(post.body!.signing_key);
    expect(guardada).toMatch(/^[0-9a-f]{64}$/);
  });

  it("el rastro dice que cambio, nunca el valor; y ninguna lectura del catalogo la devuelve", async () => {
    const { fetch } = calendlySimulado();
    await conectarCalendly(db, gerente, programId, { urlBase: BASE_URL, fetch });
    const guardada = (await clave())!;
    const rastro = await db.select().from(changeLog).where(eq(changeLog.campo, "calendly_signing_key"));
    expect(rastro).toHaveLength(1);
    expect(JSON.stringify(rastro)).not.toContain(guardada);

    const [vista] = await listarProgramas(db);
    expect(vista.webhookCalendlyConectado).toBe(true);
    expect("calendlySigningKey" in vista).toBe(false);
    expect(JSON.stringify(vista)).not.toContain(guardada);
  });

  it("reconectar rehace: borra SOLO la suscripcion de esta URL y cambia la clave", async () => {
    const url = `${BASE_URL}/api/webhooks/calendly/${programId}`;
    const { fetch, pedidos } = calendlySimulado({
      existentes: [
        { uri: "https://api.calendly.com/webhook_subscriptions/MIA", callback_url: url },
        { uri: "https://api.calendly.com/webhook_subscriptions/AJENA", callback_url: "https://otra.app/hook" },
      ],
    });
    await db.update(programs).set({ calendlySigningKey: "vieja" }).where(eq(programs.id, programId));
    await conectarCalendly(db, gerente, programId, { urlBase: BASE_URL, fetch });
    expect(pedidos.filter((p) => p.method === "DELETE").map((p) => p.url)).toEqual([
      "https://api.calendly.com/webhook_subscriptions/MIA",
    ]);
    expect(await clave()).not.toBe("vieja");
  });

  it("sin https (desde local) o sin token: 422 y no se llama a Calendly", async () => {
    const { fetch, pedidos } = calendlySimulado();
    await expect(conectarCalendly(db, gerente, programId, { urlBase: "http://localhost:3000", fetch })).rejects.toMatchObject({
      status: 422,
    });
    await expect(conectarCalendly(db, gerente, programId, { urlBase: undefined, fetch })).rejects.toBeInstanceOf(ErrorDeApp);
    await db.update(programs).set({ activo: false, calendlyToken: null }).where(eq(programs.id, programId));
    await expect(conectarCalendly(db, gerente, programId, { urlBase: BASE_URL, fetch })).rejects.toMatchObject({
      status: 422,
    });
    expect(pedidos).toHaveLength(0);
  });

  it("Calendly rechaza por plan (403): error que lo dice, y la clave no se toca", async () => {
    const { fetch } = calendlySimulado({ alCrear: 403 });
    const error = await conectarCalendly(db, gerente, programId, { urlBase: BASE_URL, fetch }).catch((e) => e);
    expect(error).toBeInstanceOf(ErrorDeApp);
    expect(error.status).toBe(502);
    expect(error.message).toMatch(/Standard/);
    expect(await clave()).toBeNull();
  });
});

describe("guardian: solo `conectarCalendly` escribe la clave de firma", () => {
  const RAIZ = fileURLToPath(new URL("../", import.meta.url));
  const ESCRITOR = path.join("lib", "calendly", "suscripcion.ts");
  const escribe = (texto: string) => /calendlySigningKey\s*:/.test(sinComentarios(texto));

  it("ningun otro archivo de lib/, app/, components/ o scripts/ la asigna", () => {
    const culpables = ["lib", "app", "components", "scripts"]
      .flatMap((d) => archivos(path.join(RAIZ, d)))
      .map((f) => path.relative(RAIZ, f))
      .filter((f) => f !== ESCRITOR && f !== path.join("lib", "db", "schema.ts"))
      // Excepción nombrada (ticket 169): `simular:cita` solo corre contra la base local
      // (`validarUrlLocal`) y le pone una clave de prueba al programa local que no la tiene.
      .filter((f) => f !== path.join("scripts", "simular-cita.ts"))
      .filter((f) => escribe(fs.readFileSync(path.join(RAIZ, f), "utf8")));
    expect(culpables).toEqual([]);
  });

  it("muerde en los dos sentidos", () => {
    expect(escribe(fs.readFileSync(path.join(RAIZ, ESCRITOR), "utf8"))).toBe(true);
    expect(escribe(`db.update(programs).set({ calendlySigningKey: "x" })`)).toBe(true);
    expect(escribe(`const { calendlySigningKey, ...resto } = fila;`)).toBe(false);
  });
});
