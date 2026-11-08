import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { deals, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { crearLeadDePrueba } from "./helpers/crear-lead-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/** CHECK `deals_venta_con_dueno` (ADR 0122, ticket 391): una venta vigente tiene dueno. */
let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let programId: string;
let closerId: string;
let gerenteId: string;

beforeAll(async () => ({ db, cerrar, vaciar } = await crearBaseReutilizable()));
afterAll(async () => cerrar());
beforeEach(async () => {
  await vaciar();
  const [p] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "check-dueno", nombre: "Check dueno", ticketUsd: "1000" }).returning();
  programId = p.id;
  const [c] = await db.insert(users).values({ email: "closer-dueno@retiagrowth.com", rol: "closer" }).returning();
  const [g] = await db.insert(users).values({ email: "gerente-dueno@retiagrowth.com", rol: "gerente" }).returning();
  closerId = c.id;
  gerenteId = g.id;
});

async function insertarDeal(extra: Partial<typeof deals.$inferInsert>) {
  const lead = await crearLeadDePrueba(db, { programId });
  return db.insert(deals).values({ programId, leadId: lead.id, ...extra });
}

describe("una venta vigente tiene dueno", () => {
  it("rechaza una venta (Abonado o Completo) vigente sin dueno", async () => {
    await expect(insertarDeal({ etapa: "ganado_parcial", ownerUserId: null })).rejects.toThrow();
    await expect(insertarDeal({ etapa: "ganado_completo", ownerUserId: null })).rejects.toThrow();
  });

  it("acepta una venta con dueno", async () => {
    await expect(insertarDeal({ etapa: "ganado_completo", ownerUserId: closerId })).resolves.toBeDefined();
  });

  it("acepta una venta ANULADA sin dueno (ADR 0038: el registro no existio)", async () => {
    await expect(
      insertarDeal({
        etapa: "ganado_completo",
        ownerUserId: null,
        anuladoEn: new Date("2026-10-23T09:00:00-05:00"),
        anuladoPor: gerenteId,
        motivoAnulacion: "Correccion",
      }),
    ).resolves.toBeDefined();
  });

  it("acepta una venta HISTORICA migrada de la hoja (huella) sin dueno, y solo esa (ADR 0122)", async () => {
    await expect(
      insertarDeal({ etapa: "ganado_completo", ownerUserId: null, huellaMigracion: "hoja:historico-1" }),
    ).resolves.toBeDefined();
  });

  it("no exige dueno fuera de las etapas de venta (Unclaimed sigue siendo un estado valido)", async () => {
    await expect(insertarDeal({ etapa: "registrado", ownerUserId: null })).resolves.toBeDefined();
    await expect(insertarDeal({ etapa: "cierre_perdido", ownerUserId: null })).resolves.toBeDefined();
  });
});
