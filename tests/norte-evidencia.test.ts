import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { cohorts, dealEtapaHistorial, deals, leads, programs } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { leerVamosALlegar } from "@/lib/queries/vamos-a-llegar";
import { listaDeMetrica } from "@/lib/queries/metricas-con-filas";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";
import { FECHA_LEAD_DE_PRUEBA } from "./helpers/crear-lead-de-prueba";
import { duenoDePrueba } from "./helpers/dueno-de-prueba";
import { lineaConCupoDePrueba } from "./helpers/catalogo-de-prueba";

vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get() { throw new Error("Este test solo admite PGlite explícito"); } }) }));

describe("419: paridad del norte con cierres del mes y de la cohorte", () => {
  let db: Db;
  let cerrar: () => Promise<void>;
  beforeAll(async () => ({ db, cerrar } = await crearBaseReutilizable()));
  afterAll(async () => cerrar());

  it("excluye anuladas, otro programa y futuras; la cohorte incluye ventas anteriores a su apertura", async () => {
    const [p, otro] = await db.insert(programs).values([
      { ...PROGRAMA_DE_PRUEBA, slug: "norte", nombre: "Norte", ticketUsd: "1000" },
      { ...PROGRAMA_DE_PRUEBA, slug: "otro-norte", nombre: "Otro", ticketUsd: "1000" },
    ]).returning();
    const [c] = await db.insert(cohorts).values({
      programId: p.id, codigo: "C1", metaCupos: 20, precioUsd: "1000", fechaInicioVentas: "2026-11-02", fechaCierreVentas: "2026-11-30", fechaInicioClases: "2026-12-01",
    }).returning();
    let n = 0;
    async function venta(programId: string, dia: string, anulada = false, valor: string | null = "900") {
      const dueno = await duenoDePrueba(db, programId);
      const [lead] = await db.insert(leads).values({ programId, emailNormalizado: `n${++n}@test.invalid`, fechaPrimeraAplicacion: FECHA_LEAD_DE_PRUEBA }).returning();
      const [deal] = await db.insert(deals).values({
        programId, leadId: lead.id, cohortId: programId === p.id ? c.id : null,
        ownerUserId: dueno, etapa: "ganado_parcial", valorVendidoUsd: valor,
        ...(anulada ? { anuladoEn: new Date("2026-11-10T15:00:00Z"), anuladoPor: dueno, motivoAnulacion: "Error de captura" } : {}),
      }).returning();
      if (valor !== null) await lineaConCupoDePrueba(db, deal.id);
      await db.insert(dealEtapaHistorial).values({ dealId: deal.id, a: "ganado_parcial", fecha: new Date(`${dia}T10:00:00-05:00`) });
    }
    await venta(p.id, "2026-10-28");
    await venta(p.id, "2026-11-03");
    await venta(p.id, "2026-11-16", false, null);
    await venta(p.id, "2026-11-04", true);
    await venta(otro.id, "2026-11-04");
    await venta(p.id, "2026-11-17");
    const hoy = "2026-11-16";
    const datos = await leerVamosALlegar(p.id, hoy, db);
    expect(datos.cohorte?.desdeLista).toBe("2026-10-28");
    for (const [desde, cohorteId, cuadrante, esperado] of [
      [`${datos.mes.clave}-01`, null, datos.mes.cuadrante, 2],
      [datos.cohorte!.desdeLista, c.id, datos.cohorte!.cuadrante, 3],
    ] as const) {
      const [lista] = await listaDeMetrica("cierres", { programId: p.id, rango: { desde, hasta: hoy }, cohorteId, hoy }, 1, db);
      expect(cuadrante.cupos.llevamos).toBe(esperado);
      expect(lista.subtotal.cantidad).toBe(cuadrante.cupos.llevamos);
      expect(lista.filas).toHaveLength(esperado);
      expect(cuadrante.ventasSinValorVendido).toBe(1);
    }
  });
});
