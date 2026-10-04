import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { abonos, calls, dealEtapaHistorial, deals, leads, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { armarVistaDelDashboard } from "@/lib/queries/vista-dashboard";
import { comisionesPorCloser } from "@/lib/queries/comision";
import {
  armarVistaDeMisMetricas,
  sumarCifrasDeMiEspacio,
} from "@/lib/queries/mi-espacio-metricas";
import { conteo, dinero, tasa } from "@/lib/queries/agregado-programas";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

const HOY = "2026-10-02";
let db: Db;
let cerrar: () => Promise<void>;

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
}, 60_000);

afterEach(async () => cerrar());

describe("read model de Mis métricas", () => {
  it("cuadra con el dashboard filtrado por el mismo closer, incluida comisión", async () => {
    const [programa] = await db.insert(programs).values({
      ...PROGRAMA_DE_PRUEBA,
      slug: "programa-a",
      nombre: "Programa A",
      ticketUsd: "797",
    }).returning();
    const [closer] = await db.insert(users).values({ email: "ana@retia.co", rol: "closer", closerId: "Ana" }).returning();
    const [lead] = await db.insert(leads).values({ programId: programa.id, emailNormalizado: "lead@retia.co" }).returning();
    const [deal] = await db.insert(deals).values({
      programId: programa.id,
      leadId: lead.id,
      ownerUserId: closer.id,
      etapa: "ganado_parcial",
      valorVendidoUsd: "1000",
      comisionPorcentaje: "10",
    }).returning();
    await db.insert(dealEtapaHistorial).values({
      dealId: deal.id,
      de: "atendido",
      a: "ganado_parcial",
      fecha: new Date("2026-10-02T15:00:00Z"),
    });
    await db.insert(calls).values([
      { programId: programa.id, dealId: deal.id, closerId: "Ana", fechaAgenda: new Date("2026-10-02T14:00:00Z"), resultado: "show" },
      { programId: programa.id, dealId: deal.id, closerId: "Ana", fechaAgenda: new Date("2026-10-02T16:00:00Z"), resultado: "no_show" },
      { programId: programa.id, dealId: deal.id, closerId: "Otro", fechaAgenda: new Date("2026-10-02T17:00:00Z"), resultado: "show" },
    ]);
    await db.insert(abonos).values({ dealId: deal.id, programId: programa.id, closerId: "Ana", fecha: HOY, monto: "250", moneda: "USD" });

    const entrada = { programId: programa.id, hoy: HOY, preset: "hoy", closerId: "Ana" };
    const [dashboard, miEspacio, comisiones] = await Promise.all([
      armarVistaDelDashboard(entrada, db),
      armarVistaDeMisMetricas({ programa: { id: programa.id, slug: programa.slug, nombre: programa.nombre }, closerId: "Ana", hoy: HOY, periodo: { preset: "hoy" } }, db),
      comisionesPorCloser({ programId: programa.id, rango: { desde: HOY, hasta: HOY } }, db),
    ]);

    expect(miEspacio.a).toMatchObject({
      agendas: dashboard.embudo.agendas,
      shows: dashboard.embudo.llamadasConShow,
      cierres: dashboard.embudo.cierres,
      pctCierre: dashboard.embudo.pctCierre,
      caja: dashboard.caja,
      noShows: 1,
    });
    expect(miEspacio.a.comisionUsd).toBe(comisiones.find((c) => c.closerId === "Ana")?.comisionUsd);
    for (const detalle of Object.values(miEspacio.detalles)) {
      expect(detalle.href).toContain("/p/programa-a/dashboard/lista?");
      expect(detalle.href).toMatch(/closer=[a-f0-9]{64}/);
      expect(detalle.href).not.toContain("Ana");
      expect(detalle.desgloses.porCloser).toEqual([]);
    }
  });
});

describe("Todos conserva la frontera de los tipos", () => {
  it("suma solo conteos y caja por moneda", () => {
    const total = sumarCifrasDeMiEspacio([
      { agendas: conteo(2), shows: conteo(1), noShows: conteo(1), cierres: conteo(1), caja: [dinero("USD", 100)] },
      { agendas: conteo(3), shows: conteo(2), noShows: conteo(0), cierres: conteo(1), caja: [dinero("USD", 50), dinero("COP", 20_000)] },
    ]);
    expect(total).toEqual({
      agendas: conteo(5), shows: conteo(3), noShows: conteo(1), cierres: conteo(2),
      caja: [dinero("COP", 20_000), dinero("USD", 150)],
    });
  });

  it("no compila con una tasa", () => {
    sumarCifrasDeMiEspacio([{
      // @ts-expect-error ADR 0048: una tasa no entra al agregado personal entre programas.
      agendas: tasa(0.5),
      shows: conteo(1), noShows: conteo(0), cierres: conteo(0), caja: [],
    }]);
  });
});
