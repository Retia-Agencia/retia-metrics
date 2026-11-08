import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { dealActividades, deals, leads, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { tieneEvidenciaDeSetter } from "@/lib/deals/evidencia-de-setter";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";
import { FECHA_LEAD_DE_PRUEBA } from "./helpers/crear-lead-de-prueba";

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let dealId: string;
let setterId: string;
let otroId: string;
let secuencia = 0;

beforeAll(async () => {
  ({ db, cerrar, vaciar } = await crearBaseReutilizable());
});

beforeEach(async () => {
  await vaciar();
  const [programa] = await db
    .insert(programs)
    .values({
      ...PROGRAMA_DE_PRUEBA,
      slug: `evidencia-setter-${++secuencia}`,
      nombre: "Programa Evidencia Setter",
      ticketUsd: "797",
    })
    .returning();
  const [setter, otro] = await db
    .insert(users)
    .values([
      { email: `setter-${secuencia}@retia.test`, rol: "closer" },
      { email: `otro-${secuencia}@retia.test`, rol: "closer" },
    ])
    .returning();
  setterId = setter.id;
  otroId = otro.id;
  const [lead] = await db
    .insert(leads)
    .values({ fechaPrimeraAplicacion: FECHA_LEAD_DE_PRUEBA, programId: programa.id, emailNormalizado: `lead-${secuencia}@retia.test` })
    .returning();
  dealId = (await db
    .insert(deals)
    .values({ leadId: lead.id, programId: programa.id, etapa: "registrado", ownerUserId: setterId })
    .returning())[0].id;
});

afterAll(async () => cerrar());

describe("tieneEvidenciaDeSetter", () => {
  it("acepta la marca de link enviado", async () => {
    await db.update(deals).set({ handoffEn: new Date() });
    expect(await tieneEvidenciaDeSetter(db, dealId, setterId)).toBe(true);
  });

  it("acepta una actividad del usuario consultado", async () => {
    await db.insert(dealActividades).values({ dealId, tipo: "contacto", canal: "whatsapp", userId: setterId });
    expect(await tieneEvidenciaDeSetter(db, dealId, setterId)).toBe(true);
  });

  it("rechaza la actividad de otra persona", async () => {
    await db.insert(dealActividades).values({ dealId, tipo: "contacto", canal: "whatsapp", userId: otroId });
    expect(await tieneEvidenciaDeSetter(db, dealId, setterId)).toBe(false);
  });

  it("ignora un deal anulado aunque tenga actividad", async () => {
    await db.insert(dealActividades).values({ dealId, tipo: "contacto", canal: "whatsapp", userId: setterId });
    await db.update(deals).set({ anuladoEn: new Date(), anuladoPor: setterId, motivoAnulacion: "Duplicado" });
    expect(await tieneEvidenciaDeSetter(db, dealId, setterId)).toBe(false);
  });
});
