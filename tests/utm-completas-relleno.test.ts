import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import { asc, sql } from "drizzle-orm";
import { programs, sources, submissions } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * Ticket 116 — el relleno de la migracion 0048. En `npm test` la migracion corre sobre una
 * base vacia, asi que su `UPDATE` no se ejercita: aqui se corre ese MISMO texto (leido del
 * archivo, no copiado) sobre envios sembrados como los de produccion, con `utm_content` y
 * `utm_term` dentro de `respuestas` y las columnas vacias.
 */

const MIGRACION = fileURLToPath(new URL("../drizzle/0048_utm-completas-en-el-envio.sql", import.meta.url));
const RELLENO = fs
  .readFileSync(MIGRACION, "utf8")
  .split("--> statement-breakpoint")
  .map((s) => s.trim())
  .find((s) => /UPDATE "submissions"/.test(s))!;

let db: Db;
let cerrar: () => Promise<void>;
let sourceId: string;

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  const [p] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "prog-a", nombre: "A", ticketUsd: "1500" }).returning();
  const [f] = await db.insert(sources).values({ programId: p.id, nombre: "Typeform" }).returning();
  sourceId = f.id;
});

afterEach(async () => {
  await cerrar();
});

const envio = (token: string, respuestas: Record<string, string | null>, extra: Partial<typeof submissions.$inferInsert> = {}) => ({
  sourceId,
  token,
  respuestas,
  ...extra,
});

describe("migracion 0048: relleno de utm_id, utm_content y utm_term desde respuestas", () => {
  it("copia desde la misma fila, deja NULL el vacio y el centinela, y guarda la macro tal cual", async () => {
    await db.insert(submissions).values([
      envio("t1", { utm_content: "anuncio-7", utm_term: "Instagram_Reels", utm_id: "1202" }),
      envio("t2", { utm_content: "  ", utm_term: " XXXXX " }),
      envio("t3", { utm_content: "{{ad.name}}", utm_term: null }),
      envio("t4", { "¿Cuanto ganas?": "mucho" }),
    ]);

    await db.execute(sql.raw(RELLENO));

    const filas = await db
      .select({ token: submissions.token, id: submissions.utmId, content: submissions.utmContent, term: submissions.utmTerm, respuestas: submissions.respuestas })
      .from(submissions)
      .orderBy(asc(submissions.token));
    expect(filas.map(({ token, id, content, term }) => [token, id, content, term])).toEqual([
      ["t1", "1202", "anuncio-7", "Instagram_Reels"],
      ["t2", null, null, null],
      ["t3", null, "{{ad.name}}", null],
      ["t4", null, null, null],
    ]);
    // `respuestas` no se toca.
    expect(filas[0].respuestas).toEqual({ utm_content: "anuncio-7", utm_term: "Instagram_Reels", utm_id: "1202" });
  });

  it("nunca reescribe una UTM que ya estaba en su columna", async () => {
    await db.insert(submissions).values(envio("t1", { utm_content: "de-respuestas" }, { utmContent: "ya-estaba" }));
    await db.execute(sql.raw(RELLENO));
    const [f] = await db.select({ content: submissions.utmContent }).from(submissions);
    expect(f.content).toBe("ya-estaba");
  });

  it("es idempotente: correrlo dos veces da lo mismo", async () => {
    await db.insert(submissions).values(envio("t1", { utm_content: "a", utm_term: "b" }));
    await db.execute(sql.raw(RELLENO));
    const antes = await db.select().from(submissions);
    await db.execute(sql.raw(RELLENO));
    expect(await db.select().from(submissions)).toEqual(antes);
  });
});
