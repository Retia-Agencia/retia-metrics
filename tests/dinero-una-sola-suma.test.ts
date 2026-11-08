import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { dealEtapaHistorial, deals, programs } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { dineroDeVentas } from "@/lib/queries/dinero-de-ventas";
import { armarVistaDelDashboard } from "@/lib/queries/vista-dashboard";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { crearLeadDePrueba } from "./helpers/crear-lead-de-prueba";
import { duenoDePrueba } from "./helpers/dueno-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

describe("ticket 393: una sola suma del dinero vendido", () => {
  let db: Db;
  let cerrar: () => Promise<void>;

  beforeAll(async () => {
    ({ db, cerrar } = await crearBaseDePrueba());
  });

  afterAll(async () => cerrar());

  it("el Hub toma contratado de dineroDeVentas y las ventas sembradas tienen valor", async () => {
    const [programa] = await db.insert(programs).values({
      ...PROGRAMA_DE_PRUEBA,
      slug: "dinero-393",
      nombre: "Dinero 393",
      ticketUsd: "1500",
    }).returning();
    const ownerUserId = await duenoDePrueba(db, programa.id);
    const ids: string[] = [];

    for (const [indice, valor] of ["797", "1500"].entries()) {
      const lead = await crearLeadDePrueba(db, {
        programId: programa.id,
        emailNormalizado: `dinero-393-${indice}@retia.co`,
      });
      const [deal] = await db.insert(deals).values({
        programId: programa.id,
        leadId: lead.id,
        ownerUserId,
        etapa: "ganado_parcial",
        valorVendidoUsd: valor,
      }).returning();
      await db.insert(dealEtapaHistorial).values({
        dealId: deal.id,
        a: "ganado_parcial",
        fecha: new Date("2026-11-03T10:00:00-05:00"),
      });
      ids.push(deal.id);
    }

    const dinero = await dineroDeVentas(db, ids);
    const vista = await armarVistaDelDashboard({
      programId: programa.id,
      hoy: "2026-11-08",
      preset: "custom",
      periodo: { preset: "custom", a: { desde: "2026-11-01", hasta: "2026-11-08" } },
    }, db);

    expect(vista.contratadoUsd).toBe(dinero.vendido);
    expect(vista.dinero.vendido).toBe(dinero.vendido);
    expect(dinero.sinValorVendido).toBe(0);
    expect(vista.dinero.sinValorVendido).toBe(0);
  });
});
