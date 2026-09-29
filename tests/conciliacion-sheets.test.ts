import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { programs, sources, submissions } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { conciliarProgramaConHoja } from "@/lib/queries/conciliacion-sheets";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * La conciliacion junta TODAS las hojas del programa (ticket 110, 28-sep). ComunicArte
 * tiene dos (`New form` y `Forms viejo`); con `.limit(1)` sin orden la pantalla leia solo
 * la vieja y decia que ningun envio del webhook estaba en la hoja.
 */

const hojas: Record<string, string[]> = {};
vi.mock("@/lib/sheets/tokens-hoja", () => ({
  tokensDeHoja: async (_sheetId: string, tab: string) => new Set(hojas[tab] ?? []),
}));

let db: Db;
let cerrar: () => Promise<void>;
let programId: string;

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  const [p] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "comunicarte", nombre: "Comunicarte", ticketUsd: "797" }).returning();
  programId = p.id;
});

afterEach(async () => {
  await cerrar();
});

describe("conciliarProgramaConHoja", () => {
  it("junta los tokens de todas las hojas del programa, no de una cualquiera", async () => {
    await db.insert(sources).values([
      { programId, nombre: "Formulario anterior", tipo: "google_sheet", sheetId: "hoja", tab: "Forms viejo", activo: false },
      { programId, nombre: "Formulario actual", tipo: "google_sheet", sheetId: "hoja", tab: "New form", activo: false },
    ]);
    const [webhook] = await db
      .insert(sources)
      .values({ programId, nombre: "Typeform", tipo: "webhook", proveedor: "typeform" })
      .returning();
    await db.insert(submissions).values({ sourceId: webhook.id, token: "por-webhook", esParcial: false });
    hojas["Forms viejo"] = ["viejo-1"];
    hojas["New form"] = ["por-webhook", "nuevo-1"];

    const r = await conciliarProgramaConHoja(programId, db);

    expect(r.estado).toBe("ok");
    if (r.estado !== "ok") return;
    expect(r.conciliacion.totalHoja).toBe(3);
    expect(r.conciliacion.enCrmNoEnHoja).toEqual([]);
    expect(r.conciliacion.enHojaNoEnCrm).toEqual(["nuevo-1", "viejo-1"]);
  });
});
