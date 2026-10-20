import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * La 0094 crea `integraciones` y copia DENTRO de la base los secretos vivos (ADR 0095 punto
 * 4): Calendly de `programs`, Typeform de `sources` y Meta de `meta_conexiones`. Se migra
 * hasta la 0093, se siembra como estaba produccion el 19-oct y se corre la 0094. Lo que se
 * mide es que ningun programa pierda un secreto en el camino ni gane uno que no tenia.
 */

const DRIZZLE = path.resolve(__dirname, "../drizzle");

async function sentencias(tag: string): Promise<string[]> {
  const texto = await readFile(path.join(DRIZZLE, `${tag}.sql`), "utf8");
  return texto.split("--> statement-breakpoint").map((s) => s.trim()).filter(Boolean);
}

async function migrar(db: PGlite, desde: number, hasta: number) {
  const journal = JSON.parse(await readFile(path.join(DRIZZLE, "meta/_journal.json"), "utf8")) as {
    entries: { idx: number; tag: string }[];
  };
  for (const { idx, tag } of journal.entries) {
    if (idx < desde || idx > hasta) continue;
    for (const s of await sentencias(tag)) await db.exec(s);
  }
}

let db: PGlite;

async function programa(slug: string, calendly: { token: string; firma?: string } | null): Promise<string> {
  const r = await db.query<{ id: string }>(
    `insert into programs (slug, nombre, ticket_usd, activo, calendly_token, calendly_signing_key)
     values ($1, $1, 1000, $2, $3, $4) returning id`,
    [slug, calendly !== null, calendly?.token ?? null, calendly?.firma ?? null],
  );
  return r.rows[0].id;
}

async function fuente(programId: string, nombre: string, activo: boolean, typeformToken: string | null) {
  await db.query(
    `insert into sources (program_id, nombre, tipo, activo, proveedor, typeform_token)
     values ($1, $2, 'webhook', $3, 'typeform', $4)`,
    [programId, nombre, activo, typeformToken],
  );
}

async function integracionesDe(programId: string) {
  const r = await db.query<{ tipo: string; secretos: Record<string, string>; config: Record<string, string>; probada_en: Date | null }>(
    `select tipo::text, secretos, config, probada_en from integraciones where program_id = $1 order by tipo`,
    [programId],
  );
  return r.rows;
}

beforeEach(async () => {
  db = new PGlite();
  await migrar(db, 0, 93);
}, 60_000);

afterEach(async () => {
  await db.close();
});

describe("migración 0094: los secretos vivos pasan a integraciones", () => {
  it("copia Calendly con sus dos secretos, Typeform una vez por programa y Meta a quien tiene cuentas", async () => {
    const conTodo = await programa("con-todo", { token: "cal-1", firma: "firma-1" });
    await fuente(conTodo, "Typeform vieja", false, "tf-cuenta");
    await fuente(conTodo, "Typeform", true, "tf-cuenta");
    await db.query(`insert into meta_conexiones (nombre, token_secreto) values ('retia-insights', 'meta-1')`);
    await db.query(
      `insert into cuentas_publicitarias (id_meta, program_id, nombre, moneda, zona_horaria)
       values ('111', $1, 'Cuenta', 'COP', 'America/Bogota')`,
      [conTodo],
    );
    const sinFirma = await programa("sin-firma", { token: "cal-2" });
    const inactivo = await programa("inactivo", null);

    await migrar(db, 94, 94);

    expect(await integracionesDe(conTodo)).toEqual([
      { tipo: "calendly", secretos: { token: "cal-1", claveFirma: "firma-1" }, config: {}, probada_en: null },
      { tipo: "meta", secretos: { token: "meta-1" }, config: { nombre: "retia-insights" }, probada_en: null },
      { tipo: "typeform", secretos: { token: "tf-cuenta" }, config: {}, probada_en: null },
    ]);
    expect(await integracionesDe(sinFirma)).toEqual([
      { tipo: "calendly", secretos: { token: "cal-2" }, config: {}, probada_en: null },
    ]);
    expect(await integracionesDe(inactivo)).toEqual([]);
  });

  it("sin el CHECK viejo, un programa activo ya no exige el token en programs", async () => {
    await migrar(db, 94, 94);
    await expect(programa("activo-sin-token", null).then(async (id) => {
      await db.query(`update programs set activo = true where id = $1`, [id]);
    })).resolves.toBeUndefined();
  });
});
