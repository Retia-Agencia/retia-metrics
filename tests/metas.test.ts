import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cohorts, deals, dealEtapaHistorial, leads, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { armarMetasDelMes, leerMetasDelMes, moverMes, nombreDelMes, type CohorteParaMetas } from "@/lib/queries/metas";
import { listaDeMetrica } from "@/lib/queries/metricas-con-filas";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

const cohorteBase: CohorteParaMetas = {
  id: "c-1",
  codigo: "C1",
  metaCupos: 60,
  precioUsd: 2_000,
  fechaInicioVentas: "2026-08-31",
  fechaCierreVentas: "2026-10-09",
};

describe("146: cálculo puro de metas mensuales", () => {
  it.each([
    ["2026-08", 2, 4_000],
    ["2026-09", 44, 88_000],
    ["2026-10", 14, 28_000],
  ] as const)("reparte la ventana larga en %s sin redondear", (mes, cupos, usd) => {
    const resultado = armarMetasDelMes({ cohortes: [cohorteBase], ventas: [], mes, hoy: "2026-10-03" });
    expect(resultado.metaCupos).toBe(cupos);
    expect(resultado.metaUsd).toBe(usd);
  });

  it("suma dos cohortes que tocan el mismo mes", () => {
    const otra = { ...cohorteBase, id: "c-2", codigo: "C2", metaCupos: 30, precioUsd: 1_000 };
    const resultado = armarMetasDelMes({ cohortes: [cohorteBase, otra], ventas: [], mes: "2026-09", hoy: "2026-09-30" });
    expect(resultado.metaCupos).toBe(66);
    expect(resultado.metaUsd).toBe(110_000);
  });

  it("deja solo ventanas que tocan el mes o cohortes con ventas del mes", () => {
    const anterior = { ...cohorteBase, id: "anterior", codigo: "Anterior", fechaInicioVentas: "2026-07-01", fechaCierreVentas: "2026-07-31" };
    const futuraConVenta = { ...cohorteBase, id: "futura", codigo: "Futura", fechaInicioVentas: "2026-11-01", fechaCierreVentas: "2026-11-30" };
    const sinVentana = { ...cohorteBase, id: "sin-ventana", codigo: "Sin ventana", fechaInicioVentas: null };
    const resultado = armarMetasDelMes({
      cohortes: [cohorteBase, anterior, futuraConVenta, sinVentana],
      ventas: [{ dealId: "venta-1", cohortId: "futura", dia: "2026-09-10" }],
      mes: "2026-09",
      hoy: "2026-09-30",
    });

    expect(resultado.filas.map((fila) => fila.cohorteId)).toEqual(["c-1", "futura"]);
    expect(resultado.cohortesSinVentana).toEqual([{ id: "sin-ventana", codigo: "Sin ventana" }]);
  });

  it("calcula avance, cumplimiento y faltante semanal en septiembre", () => {
    const ventas = Array.from({ length: 11 }, (_, indice) => ({
      dealId: `venta-${indice}`,
      cohortId: cohorteBase.id,
      dia: indice < 3 ? "2026-09-14" : "2026-09-01",
    }));
    const resultado = armarMetasDelMes({ cohortes: [cohorteBase], ventas, mes: "2026-09", hoy: "2026-09-14" });

    expect(resultado.avancePct).toBe(11 / 44);
    expect(resultado.cumplimiento).toBe(11 / 20);
    expect(resultado.filas[0]?.cumplimiento).toBe(11 / 20);
    expect(resultado.compensacionSemanal?.faltan).toBe(7);
  });

  it("marca un mes fuera de las ventanas y separa las cohortes sin ventana", () => {
    const sinVentana = { ...cohorteBase, id: "c-2", codigo: "Histórica", fechaInicioVentas: null };
    const resultado = armarMetasDelMes({ cohortes: [cohorteBase, sinVentana], ventas: [], mes: "2027-01", hoy: "2026-10-03" });
    expect(resultado.metaCupos).toBe(0);
    expect(resultado.mesSinVentana).toBe(true);
    expect(resultado.cohortesSinVentana).toEqual([{ id: "c-2", codigo: "Histórica" }]);
  });

  it("un sábado conserva el esperado hasta el viernes y no divide por cero", () => {
    const resultado = armarMetasDelMes({ cohortes: [cohorteBase], ventas: [], mes: "2026-10", hoy: "2026-10-03" });
    expect(resultado.esperado).toBe(4);
    expect(resultado.compensacionSemanal).toMatchObject({
      diasHabilesRestantes: 0,
      meta: 10,
      porDia: 10,
    });
    expect(Number.isFinite(resultado.compensacionSemanal!.porDia)).toBe(true);
  });

  it("nombra y mueve meses sin Date ni Intl", () => {
    expect(nombreDelMes("2026-09")).toBe("septiembre 2026");
    expect(moverMes("2026-12", 1)).toBe("2027-01");
    expect(moverMes("2026-01", -1)).toBe("2025-12");
  });
});

describe("146: lectura de metas con ventas reales", () => {
  let db: Db;
  let cerrar: () => Promise<void>;
  let programaA: string;
  let programaB: string;
  let cohorte1: string;
  let cohorte2: string;
  let ownerId: string;

  beforeAll(async () => {
    ({ db, cerrar } = await crearBaseDePrueba());
    const programas = await db.insert(programs).values([
      { ...PROGRAMA_DE_PRUEBA, ticketUsd: "2000", slug: "metas-a", nombre: "Metas A" },
      { ...PROGRAMA_DE_PRUEBA, ticketUsd: "2000", slug: "metas-b", nombre: "Metas B" },
    ]).returning();
    [programaA, programaB] = programas.map((programa) => programa.id);
    [ownerId] = (await db.insert(users).values({ email: "metas@example.test", rol: "closer", closerId: "Meta" }).returning()).map((usuario) => usuario.id);
    const cohortes = await db.insert(cohorts).values([
      { programId: programaA, codigo: "C1", metaCupos: 10, precioUsd: "2000", fechaInicioClases: "2026-10-01", fechaInicioVentas: "2026-09-01", fechaCierreVentas: "2026-09-30", estado: "cerrado" },
      { programId: programaA, codigo: "C2", metaCupos: 10, precioUsd: "2000", fechaInicioClases: "2026-11-01", fechaInicioVentas: "2026-10-01", fechaCierreVentas: "2026-10-31", estado: "futuro" },
    ]).returning();
    [cohorte1, cohorte2] = cohortes.map((cohorte) => cohorte.id);

    let numero = 0;
    async function venta(args: {
      programId?: string;
      cohortId?: string | null;
      dia: string;
      valor?: string | null;
      cortesia?: boolean;
      anulada?: boolean;
      completoEn?: string;
    }) {
      numero += 1;
      const programId = args.programId ?? programaA;
      const [lead] = await db.insert(leads).values({
        programId,
        emailNormalizado: `meta-${numero}@example.test`,
        entrada: "crm",
        fechaPrimeraAplicacion: new Date(`${args.dia}T10:00:00-05:00`),
      }).returning();
      const anuladaEn = args.anulada ? new Date(`${args.dia}T12:00:00-05:00`) : null;
      const [deal] = await db.insert(deals).values({
        programId,
        leadId: lead.id,
        ownerUserId: ownerId,
        cohortId: args.cohortId === undefined ? cohorte2 : args.cohortId,
        etapa: args.completoEn ? "ganado_completo" : "ganado_parcial",
        valorVendidoUsd: args.valor === undefined ? "1200" : args.valor,
        cortesia: args.cortesia ?? false,
        anuladoEn: anuladaEn,
        anuladoPor: anuladaEn ? ownerId : null,
        motivoAnulacion: anuladaEn ? "Corrección" : null,
      }).returning();
      await db.insert(dealEtapaHistorial).values({
        dealId: deal.id,
        a: "ganado_parcial",
        fecha: new Date(`${args.dia}T11:00:00-05:00`),
      });
      if (args.completoEn) {
        await db.insert(dealEtapaHistorial).values({
          dealId: deal.id,
          de: "ganado_parcial",
          a: "ganado_completo",
          fecha: new Date(`${args.completoEn}T11:00:00-05:00`),
        });
      }
    }

    await venta({ cohortId: cohorte1, dia: "2026-10-05", valor: "1200" });
    await venta({ cohortId: cohorte2, dia: "2026-10-06", valor: null });
    await venta({ cohortId: cohorte2, dia: "2026-10-07", anulada: true });
    await venta({ cohortId: cohorte2, dia: "2026-10-08", cortesia: true });
    await venta({ programId: programaB, cohortId: null, dia: "2026-10-09" });
    await venta({ cohortId: cohorte1, dia: "2026-09-29", completoEn: "2026-10-02" });
  }, 60_000);

  afterAll(async () => cerrar());

  it("agrupa por la cohorte del deal y aplica programa, vigencia, cortesía y primera venta", async () => {
    const octubre = await leerMetasDelMes(programaA, "2026-10", "2026-10-10", db);
    expect(octubre.vendidos).toBe(2);
    expect(octubre.filas.find((fila) => fila.cohorteId === cohorte1)?.vendidos).toBe(1);
    expect(octubre.filas.find((fila) => fila.cohorteId === cohorte1)?.metaCupos).toBe(0);
    expect(octubre.filas.find((fila) => fila.cohorteId === cohorte2)?.vendidos).toBe(1);
    expect(octubre.contratadoUsd).toBe(1_200);
    expect(octubre.ventasSinValorVendido).toBe(1);

    const septiembre = await leerMetasDelMes(programaA, "2026-09", "2026-10-10", db);
    expect(septiembre.vendidos).toBe(1);

    const [lista] = await listaDeMetrica(
      "cierres",
      { programId: programaA, rango: octubre.periodoMes, hoy: "2026-10-10" },
      1,
      db,
    );
    expect(lista.subtotal.cantidad).toBe(octubre.vendidos);
  });
});
