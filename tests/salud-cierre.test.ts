import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { programs, sources, submissions } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { textoDeCierre } from "@/lib/salud/cierre";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

const AHORA = new Date("2026-11-13T10:00:00-05:00");

describe("cierre diario de salud", () => {
  let db: Db;
  let cerrar: () => Promise<void>;
  let vaciar: () => Promise<void>;
  let sourceId: string;

  beforeAll(async () => {
    ({ db, cerrar, vaciar } = await crearBaseReutilizable());
  });

  beforeEach(async () => {
    await vaciar();
    const [programa] = await db.insert(programs).values({
      ...PROGRAMA_DE_PRUEBA,
      slug: "cierre",
      nombre: "Programa Cierre",
      ticketUsd: "1000",
    }).returning();
    const [activa] = await db.insert(sources).values({
      programId: programa.id,
      nombre: "Formulario principal",
      tipo: "webhook",
      proveedor: "typeform",
      activo: true,
    }).returning();
    sourceId = activa.id;
    await db.insert(sources).values([
      {
        programId: programa.id,
        nombre: "Webhook pendiente",
        tipo: "webhook",
        proveedor: "typeform",
        activo: false,
      },
      {
        programId: programa.id,
        nombre: "Hoja antigua",
        tipo: "google_sheet",
        activo: false,
      },
    ]);
  });

  afterAll(async () => cerrar());

  it("cuenta solo los envios del dia de Bogota y lista solo webhooks sin activar", async () => {
    await db.insert(submissions).values([
      { sourceId, token: "privado@example.com", createdAt: new Date("2026-11-12T23:59:00-05:00"), leadQuality: "High" },
      { sourceId, token: "Nombre Privado", createdAt: new Date("2026-11-13T00:01:00-05:00"), leadQuality: "High" },
      { sourceId, token: "hoy-2", createdAt: new Date("2026-11-13T09:00:00-05:00"), leadQuality: "High" },
    ]);

    const texto = await textoDeCierre(db, AHORA);

    expect(texto).toContain("• Programa Cierre · Formulario principal: 2 envíos (último 09:00)");
    expect(texto).toContain("*Fuentes sin activar*\n• Programa Cierre · Webhook pendiente");
    expect(texto).not.toContain("Hoja antigua");
    expect(texto).not.toContain("privado@example.com");
    expect(texto).not.toContain("Nombre Privado");
  });
});
