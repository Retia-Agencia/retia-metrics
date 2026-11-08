import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { leads, programs } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { crearLeadDePrueba, FECHA_LEAD_DE_PRUEBA } from "./helpers/crear-lead-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/** CHECK `leads_formulario_con_fecha` (migracion 0119, ADR 0121). */
let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let programId: string;

beforeAll(async () => ({ db, cerrar, vaciar } = await crearBaseReutilizable()));
afterAll(async () => cerrar());
beforeEach(async () => {
  await vaciar();
  const [p] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "check-lead", nombre: "Check lead", ticketUsd: "1000" }).returning();
  programId = p.id;
});

describe("un lead de formulario nace con fecha", () => {
  it("la base rechaza un lead de formulario sin fecha_primera_aplicacion", async () => {
    await expect(
      db.insert(leads).values({ programId, emailNormalizado: "sin-fecha@correo.co", entrada: "formulario" }),
    ).rejects.toThrow();
    await expect(
      db.insert(leads).values({ programId, emailNormalizado: "sin-fecha-defecto@correo.co" }),
    ).rejects.toThrow();
  });

  it("acepta un lead de formulario con fecha y uno de crm sin fecha", async () => {
    const conFecha = await crearLeadDePrueba(db, { programId });
    expect(conFecha.fechaPrimeraAplicacion).toEqual(FECHA_LEAD_DE_PRUEBA);
    const crm = await crearLeadDePrueba(db, { programId, entrada: "crm" });
    expect(crm.entrada).toBe("crm");
    expect(crm.fechaPrimeraAplicacion).toBeNull();
  });
});
