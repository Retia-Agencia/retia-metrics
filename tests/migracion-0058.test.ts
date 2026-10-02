import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * La 0058 traduce los deals y su historial a las etapas de 30X (ticket 142). Aqui se
 * aplica sobre datos con la forma VIEJA: se migra hasta la 0057, se siembran deals como
 * los dejaba el motor anterior y se corre la 0058. Lo que se mide es que ningun deal
 * quede en una combinacion de etapa y pendiente que el motor nuevo no produce.
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
let programId: string;

beforeEach(async () => {
  db = new PGlite();
  await migrar(db, 0, 57);
  const p = await db.query<{ id: string }>(
    `insert into programs (slug, nombre, ticket_usd, activo, form_url, calendly_token)
     values ('p', 'P', 1000, true, 'https://form.typeform.com/to/x', 't') returning id`,
  );
  programId = p.rows[0].id;
}, 60_000);

afterEach(async () => {
  await db.close();
});

/** Un deal con la forma vieja y su historial, fila por fila en orden. */
async function dealViejo(correo: string, etapa: string, historial: [string | null, string][]) {
  const l = await db.query<{ id: string }>(
    `insert into leads (program_id, email_normalizado) values ($1, $2) returning id`,
    [programId, correo],
  );
  const d = await db.query<{ id: string }>(
    `insert into deals (lead_id, program_id, etapa) values ($1, $2, $3) returning id`,
    [l.rows[0].id, programId, etapa],
  );
  let minuto = 0;
  for (const [de, a] of historial) {
    await db.query(
      `insert into deal_etapa_historial (deal_id, de, a, fecha) values ($1, $2, $3, $4)`,
      [d.rows[0].id, de, a, new Date(Date.UTC(2026, 8, 1, 12, minuto++))],
    );
  }
  return d.rows[0].id;
}

async function despues(dealId: string) {
  const r = await db.query<{ etapa: string; pendiente: string | null }>(
    `select etapa::text, pendiente::text from deals where id = $1`,
    [dealId],
  );
  return r.rows[0];
}

describe("migración 0058: deals que nacieron en un pendiente", () => {
  it("nacido en Re-agenda queda en Agendado con Re-agenda, no en la puerta de entrada", async () => {
    const id = await dealViejo("a@x.co", "pendiente_reagenda", [[null, "pendiente_reagenda"]]);
    await migrar(db, 58, 58);
    expect(await despues(id)).toEqual({ etapa: "agendado", pendiente: "reagenda" });
  });

  it("nacido en Seguimiento queda en Atendido con Seguimiento", async () => {
    const id = await dealViejo("b@x.co", "seguimiento", [[null, "seguimiento"]]);
    await migrar(db, 58, 58);
    expect(await despues(id)).toEqual({ etapa: "atendido", pendiente: "seguimiento" });
  });

  it("nacido en Próxima Cohorte queda en su puerta (Registrado sin envío) con Próxima Cohorte", async () => {
    const id = await dealViejo("c@x.co", "proxima_cohorte", [[null, "proxima_cohorte"]]);
    await migrar(db, 58, 58);
    expect(await despues(id)).toEqual({ etapa: "registrado", pendiente: "proxima_cohorte" });
  });

  it("con etapa real antes, el pendiente se queda en esa etapa (el caso de producción)", async () => {
    const id = await dealViejo("d@x.co", "pendiente_reagenda", [
      [null, "pendiente_setteo"],
      ["pendiente_setteo", "agendado"],
      ["agendado", "pendiente_reagenda"],
    ]);
    await migrar(db, 58, 58);
    expect(await despues(id)).toEqual({ etapa: "agendado", pendiente: "reagenda" });
    const h = await db.query<{ de: string | null; a: string; pendiente_de: string | null; pendiente_a: string | null }>(
      `select de::text, a::text, pendiente_de::text, pendiente_a::text from deal_etapa_historial where deal_id = $1 order by fecha`,
      [id],
    );
    expect(h.rows).toEqual([
      { de: null, a: "registrado", pendiente_de: null, pendiente_a: null },
      { de: "registrado", a: "agendado", pendiente_de: null, pendiente_a: null },
      { de: "agendado", a: "agendado", pendiente_de: null, pendiente_a: "reagenda" },
    ]);
  });
});
