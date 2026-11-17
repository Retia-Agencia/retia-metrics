import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { abonos, calls, cohorts, deals, dealEtapaHistorial, leads, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { claveHistorica } from "@/lib/closers/identidad";
import { dineroDelRango, dineroPorCloserDelRango } from "@/lib/queries/dashboard";
import { CLAVE_SIN_DUENO } from "@/lib/queries/embudo-con-filas";
import { detalleDeCifra, detallesDelComparativo, CELDAS_DEL_COMPARATIVO } from "@/lib/queries/vista-metrica";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { FECHA_LEAD_DE_PRUEBA } from "./helpers/crear-lead-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let programId: string;
let cohortId: string;
let claves: string[];
let secuencia = 0;

const HOY = "2026-11-17";
const rango = { desde: "2026-11-01", hasta: HOY };
const ahora = new Date("2026-11-17T18:00:00-05:00");
const periodo = { preset: "custom" as const, a: rango, b: null };

beforeAll(async () => {
  ({ db, cerrar, vaciar } = await crearBaseReutilizable());
});

beforeEach(async () => {
  await vaciar();
  secuencia = 0;
  const [programa, ajeno] = await db.insert(programs).values([
    { ...PROGRAMA_DE_PRUEBA, slug: "conjunto", nombre: "Conjunto", ticketUsd: "1000" },
    { ...PROGRAMA_DE_PRUEBA, slug: "conjunto-ajeno", nombre: "Ajeno", ticketUsd: "1000" },
  ]).returning();
  programId = programa.id;
  const [cohorte] = await db.insert(cohorts).values({
    programId,
    codigo: "C1",
    metaCupos: 20,
    precioUsd: "1000",
    fechaInicioClases: "2026-12-01",
    fechaInicioVentas: rango.desde,
    fechaCierreVentas: "2026-11-30",
    estado: "activo",
  }).returning();
  cohortId = cohorte.id;
  const [ana, beto, cara] = await db.insert(users).values([
    { email: "ana@conjunto.test", rol: "closer", closerId: "Ana" },
    { email: "beto@conjunto.test", rol: "closer", closerId: "Beto" },
    { email: "cara@conjunto.test", rol: "closer", closerId: "Cara" },
  ]).returning();
  claves = [ana.id, beto.id, cara.id, CLAVE_SIN_DUENO];

  const nuevoDeal = async (
    programa: string,
    ownerUserId: string | null,
    etapa: "atendido" | "cierre_perdido" | "ganado_parcial" | "ganado_completo",
    opciones: { anulado?: boolean; valor?: string | null; cohorte?: string | null } = {},
  ) => {
    const [lead] = await db.insert(leads).values({
      programId: programa,
      fechaPrimeraAplicacion: FECHA_LEAD_DE_PRUEBA,
      emailNormalizado: `conjunto-${++secuencia}@test.co`,
    }).returning();
    const [deal] = await db.insert(deals).values({
      programId: programa,
      leadId: lead.id,
      ownerUserId,
      cohortId: opciones.cohorte === undefined && programa === programId ? cohortId : opciones.cohorte,
      etapa,
      valorVendidoUsd: opciones.valor === undefined ? "1000" : opciones.valor,
      ...(opciones.anulado ? {
        anuladoEn: ahora,
        anuladoPor: ana.id,
        motivoAnulacion: "Corrección de prueba",
      } : {}),
    }).returning();
    if (etapa === "ganado_parcial" || etapa === "ganado_completo") {
      await db.insert(dealEtapaHistorial).values({
        dealId: deal.id,
        a: etapa,
        fecha: new Date("2026-11-10T10:00:00-05:00"),
      });
    }
    return deal;
  };

  const anaVenta = await nuevoDeal(programId, ana.id, "ganado_parcial", { valor: "900" });
  const betoVenta = await nuevoDeal(programId, beto.id, "ganado_completo", { valor: "1000" });
  const caraVenta = await nuevoDeal(programId, cara.id, "ganado_parcial", { valor: "800" });
  const sinDueno = await nuevoDeal(programId, null, "ganado_parcial", { valor: "700" });
  const abierto = await nuevoDeal(programId, beto.id, "atendido");
  const perdido = await nuevoDeal(programId, cara.id, "cierre_perdido");
  const anulado = await nuevoDeal(programId, ana.id, "ganado_completo", { anulado: true });
  const ajenoDeal = await nuevoDeal(ajeno.id, ana.id, "ganado_completo", { cohorte: null });

  await db.insert(calls).values([
    { programId, dealId: anaVenta.id, closerUserId: ana.id, fechaAgenda: new Date("2026-11-05T10:00:00-05:00"), resultado: "show" },
    { programId, dealId: betoVenta.id, closerUserId: beto.id, fechaAgenda: new Date("2026-11-06T10:00:00-05:00"), resultado: "no_show" },
    { programId, dealId: caraVenta.id, closerUserId: cara.id, fechaAgenda: new Date("2026-11-07T10:00:00-05:00"), resultado: "show" },
    { programId, dealId: sinDueno.id, closerUserId: null, fechaAgenda: new Date("2026-11-08T10:00:00-05:00"), resultado: "show" },
    { programId, dealId: abierto.id, closerUserId: beto.id, fechaAgenda: new Date("2026-11-09T10:00:00-05:00"), resultado: "show" },
    { programId, dealId: perdido.id, closerUserId: cara.id, fechaAgenda: new Date("2026-11-10T10:00:00-05:00"), resultado: "no_show" },
    { programId, dealId: anulado.id, closerUserId: ana.id, fechaAgenda: new Date("2026-11-11T10:00:00-05:00"), resultado: "show" },
    { programId: ajeno.id, dealId: ajenoDeal.id, closerUserId: ana.id, fechaAgenda: new Date("2026-11-12T10:00:00-05:00"), resultado: "show" },
  ]);
  await db.insert(abonos).values([
    { programId, dealId: anaVenta.id, registradoPorUserId: ana.id, fecha: "2026-11-10", monto: "300", moneda: "USD" },
    { programId, dealId: betoVenta.id, registradoPorUserId: beto.id, fecha: "2026-11-10", monto: "200", moneda: "USD" },
    { programId, dealId: betoVenta.id, registradoPorUserId: beto.id, fecha: "2026-11-11", monto: "50000", moneda: "COP" },
    // Fila histórica: la identidad SQL la atribuye a la cuenta de Cara por la regla central.
    { programId, dealId: caraVenta.id, closerId: "  CARA ", fecha: "2026-11-12", monto: "100", moneda: "USD" },
    { programId, dealId: sinDueno.id, fecha: "2026-11-13", monto: "70", moneda: "USD" },
    { programId, dealId: anulado.id, registradoPorUserId: ana.id, fecha: "2026-11-14", monto: "999", moneda: "USD" },
    { programId: ajeno.id, dealId: ajenoDeal.id, registradoPorUserId: ana.id, fecha: "2026-11-15", monto: "999", moneda: "USD" },
  ]);
}, 60_000);

afterAll(async () => {
  await cerrar();
});

describe("comparativo por conjunto", () => {
  it("conserva exactamente cada celda que se obtenía consultando un closer", async () => {
    const entrada = { programId, slug: "conjunto", hoy: HOY, periodo, origen: "/p/conjunto/hub?seccion=comercial", ahora };
    const porConjunto = await detallesDelComparativo(entrada, claves, db, ahora);

    for (const clave of claves) {
      for (const metrica of CELDAS_DEL_COMPARATIVO) {
        expect(porConjunto[clave][metrica], `${clave} ${metrica}`).toEqual(
          await detalleDeCifra(metrica, { ...entrada, claveCloser: clave }, db),
        );
      }
    }
    // Ni el cierre anulado ni el del otro programa se cuelan en la fila de Ana.
    expect(porConjunto[claves[0]].cierres.resumen.subtotal.cantidad).toBe(1);
    expect(porConjunto[claves[2]].caja.resumen.subtotal.caja).toEqual([{ moneda: "USD", total: 100 }]);
    expect(porConjunto[claves[3]].caja.resumen.subtotal.caja).toEqual([{ moneda: "USD", total: 70 }]);
  });

  it("conserva exactamente el dinero de cada closer", async () => {
    const clavesDeDinero = [...claves, claveHistorica("Cara")];
    const porConjunto = await dineroPorCloserDelRango({ programId, rango, cohorteId }, clavesDeDinero, db);
    for (const clave of clavesDeDinero) {
      expect(porConjunto.get(clave), clave).toEqual(
        await dineroDelRango({ programId, rango, cohorteId, claveCloser: clave }, db),
      );
    }
    expect(porConjunto.get(claves[0])?.vendido).toBe(900);
    expect(porConjunto.get(claves[1])).toMatchObject({ vendido: 1000, recaudado: 0, sinSaldoCalculable: 1 });
  });
});
