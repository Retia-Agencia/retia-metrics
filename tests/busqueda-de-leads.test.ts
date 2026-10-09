import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { leadContactos, leads, programs } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { leadsQueCasan } from "@/lib/queries/busqueda-de-leads";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * Ticket o8-busqueda: la búsqueda centralizada de leads (`leadsQueCasan`). Prueba que casa
 * por nombre, por correo normalizado, por un contacto correo y por los dígitos de un
 * teléfono; que un lead de OTRO programa nunca aparece (el programa es frontera, ADR 0043);
 * y que un texto más corto que el mínimo devuelve `null` (no filtra), distinto de un
 * conjunto vacío (nadie casa).
 */
describe("leadsQueCasan (búsqueda centralizada de leads)", () => {
  let db: Db;
  let cerrar: () => Promise<void>;
  let programId: string;
  let otroProgramId: string;

  beforeEach(async () => {
    ({ db, cerrar } = await crearBaseDePrueba());
    const [p] = await db
      .insert(programs)
      .values({ ...PROGRAMA_DE_PRUEBA, slug: "p", nombre: "P", ticketUsd: "1000" })
      .returning();
    programId = p.id;
    const [p2] = await db
      .insert(programs)
      .values({ ...PROGRAMA_DE_PRUEBA, slug: "p2", nombre: "P2", ticketUsd: "1000" })
      .returning();
    otroProgramId = p2.id;
  });

  afterEach(async () => {
    await cerrar();
  });

  async function crearLead(valores: {
    programa?: string;
    email: string;
    nombre?: string | null;
    telefono?: string | null;
  }): Promise<string> {
    const [l] = await db
      .insert(leads)
      .values({
        programId: valores.programa ?? programId,
        emailNormalizado: valores.email,
        nombre: valores.nombre ?? null,
        telefono: valores.telefono ?? null,
        numAplicaciones: 1,
      })
      .returning();
    return l.id;
  }

  it("casa por nombre (sin importar mayúsculas)", async () => {
    const id = await crearLead({ email: "ana@correo.co", nombre: "Ana María" });
    await crearLead({ email: "beto@correo.co", nombre: "Beto" });
    const casan = await leadsQueCasan(db, programId, "maría");
    expect(casan).toEqual(new Set([id]));
  });

  it("casa por correo normalizado", async () => {
    const id = await crearLead({ email: "carlos@empresa.com", nombre: "Carlos" });
    await crearLead({ email: "diana@otra.com", nombre: "Diana" });
    const casan = await leadsQueCasan(db, programId, "empresa.com");
    expect(casan).toEqual(new Set([id]));
  });

  it("casa por un contacto correo del lead", async () => {
    const id = await crearLead({ email: "elena@correo.co", nombre: "Elena" });
    await db.insert(leadContactos).values({
      leadId: id,
      programId,
      tipo: "correo",
      valor: "elena.trabajo@firma.io",
      confirmado: false,
    });
    const casan = await leadsQueCasan(db, programId, "firma.io");
    expect(casan).toEqual(new Set([id]));
  });

  it("casa por los dígitos del teléfono (ignora formato), con 4 o más dígitos", async () => {
    const id = await crearLead({ email: "fabio@correo.co", nombre: "Fabio", telefono: "+57 300 123 4567" });
    await crearLead({ email: "gina@correo.co", nombre: "Gina", telefono: "+57 301 000 0000" });
    const casan = await leadsQueCasan(db, programId, "300-1234");
    expect(casan).toEqual(new Set([id]));
  });

  it("casa por un contacto teléfono del lead", async () => {
    const id = await crearLead({ email: "hugo@correo.co", nombre: "Hugo" });
    await db.insert(leadContactos).values({
      leadId: id,
      programId,
      tipo: "telefono",
      valor: "(315) 987-6543",
      confirmado: false,
    });
    const casan = await leadsQueCasan(db, programId, "9876543");
    expect(casan).toEqual(new Set([id]));
  });

  it("nunca casa un lead de otro programa (el programa es frontera)", async () => {
    await crearLead({ programa: otroProgramId, email: "intruso@correo.co", nombre: "Intruso Único" });
    const casan = await leadsQueCasan(db, programId, "Intruso Único");
    expect(casan).toEqual(new Set());
  });

  it("devuelve null con texto más corto que el mínimo (no filtra)", async () => {
    await crearLead({ email: "ivan@correo.co", nombre: "Iván" });
    expect(await leadsQueCasan(db, programId, "")).toBeNull();
    expect(await leadsQueCasan(db, programId, "a")).toBeNull();
    expect(await leadsQueCasan(db, programId, "  ")).toBeNull();
  });
});
