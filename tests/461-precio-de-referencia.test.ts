import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { cohorts, dealLineas, deals, leads, programs, skus } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { precioDeReferenciaDelCiclo } from "@/lib/cohortes/precio-de-referencia";
import { armarMetasDelMes, type CohorteParaMetas } from "@/lib/queries/metas";
import { calcularEmbudoEtapas } from "@/lib/queries/embudo-etapas";
import { proyectarRoas } from "@/lib/queries/proyeccion-roas";
import { descuentosDeDeals } from "@/lib/queries/saldo";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { FECHA_LEAD_DE_PRUEBA } from "./helpers/crear-lead-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let programId: string;

beforeAll(async () => {
  ({ db, cerrar, vaciar } = await crearBaseReutilizable());
});

beforeEach(async () => {
  await vaciar();
  const [programa] = await db.insert(programs).values({
    ...PROGRAMA_DE_PRUEBA,
    slug: "precio-referencia-461",
    nombre: "Precio referencia 461",
    ticketUsd: "999",
  }).returning();
  programId = programa.id;
});

afterAll(async () => cerrar());

async function ciclo(codigo: string, precioHeredado: string) {
  const [cohorte] = await db.insert(cohorts).values({
    programId,
    codigo,
    metaCupos: 10,
    precioUsd: precioHeredado,
    fechaInicioVentas: "2026-11-01",
    fechaCierreVentas: "2026-11-30",
  }).returning();
  return cohorte;
}

function cohorteParaMetas(id: string, precioUsd: number | null): CohorteParaMetas {
  return {
    id,
    codigo: "C1",
    metaCupos: 10,
    precioUsd,
    fechaInicioVentas: "2026-11-01",
    fechaCierreVentas: "2026-11-30",
  };
}

function proyeccion(ticketUsd: number | null) {
  return proyectarRoas({
    vendidoUsd: 100,
    gastoUsd: 50,
    roasAHoy: { valor: 2, base: 1, faltan: 0, motivo: null },
    pendientes: [{ callId: "cita", claveCloser: "closer", closer: "Closer", fecha: new Date("2026-11-20T15:00:00Z"), ticketUsd }],
    porCloser: new Map(),
    programa: { deals: 10, conShow: 8, vendidos: 4 },
    muestraMinima: 10,
  });
}

function perdida(precioUsd: number | null) {
  return calcularEmbudoEtapas({
    deals: [{
      id: "perdido",
      etapa: "cierre_perdido",
      ownerUserId: null,
      ownerNombre: null,
      createdAt: new Date("2026-11-10T15:00:00Z"),
      precioUsd,
      motivoNombre: "Precio",
      cortesia: false,
    }],
    historial: [],
    idsCerrados: ["perdido"],
    rango: { desde: "2026-11-01", hasta: "2026-11-30" },
    ahora: new Date("2026-11-20T15:00:00Z"),
  }).motivosDePerdida[0]!;
}

describe("ticket 461 — precio de referencia y descuento por línea", () => {
  it("con un SKU de cupo conserva meta USD, ticket perdido y proyección ROAS", async () => {
    const cohorte = await ciclo("C1", "797");
    await db.insert(skus).values({
      programId,
      cohortId: cohorte.id,
      nombre: "Programa",
      slug: "programa",
      codigo: "precio_referencia_programa_c1",
      precioListaUsd: "797",
      cuentaComoCupo: true,
      comisionPorcentaje: "10",
    });

    const precio = await precioDeReferenciaDelCiclo(db, cohorte.id);
    expect(precio).toBe(797);
    expect(armarMetasDelMes({ cohortes: [cohorteParaMetas(cohorte.id, precio)], ventas: [], mes: "2026-11", hoy: "2026-11-30" }).metaUsd).toBe(7_970);
    expect(perdida(precio)).toMatchObject({ ticketPerdidoUsd: 797, dealsSinTicket: 0 });
    expect(proyeccion(precio)).toMatchObject({ valor: 8.376, esperadoUsd: 318.8, motivo: null });
  });

  it("sin SKU activo de cupo conserva sin precio como null, nunca como cero", async () => {
    const cohorte = await ciclo("C2", "999");
    await db.insert(skus).values({
      programId,
      cohortId: cohorte.id,
      nombre: "Adicional",
      slug: "adicional",
      codigo: "precio_referencia_adicional_c2",
      precioListaUsd: "200",
      cuentaComoCupo: false,
      comisionPorcentaje: "0",
    });

    const precio = await precioDeReferenciaDelCiclo(db, cohorte.id);
    expect(precio).toBeNull();
    expect(armarMetasDelMes({ cohortes: [cohorteParaMetas(cohorte.id, precio)], ventas: [], mes: "2026-11", hoy: "2026-11-30" }).metaUsd).toBeNull();
    expect(perdida(precio)).toMatchObject({ dealsSinTicket: 1 });
    expect(proyeccion(precio).valor).toBeNull();
  });

  it("calcula el descuento con los precios congelados de cada línea", async () => {
    const cohorte = await ciclo("C3", "999");
    const [sku] = await db.insert(skus).values({
      programId,
      cohortId: cohorte.id,
      nombre: "Programa",
      slug: "programa",
      codigo: "precio_referencia_programa_c3",
      precioListaUsd: "797",
      cuentaComoCupo: true,
      comisionPorcentaje: "10",
    }).returning();
    const [lead] = await db.insert(leads).values({
      programId,
      emailNormalizado: "descuento-461@retia.co",
      fechaPrimeraAplicacion: FECHA_LEAD_DE_PRUEBA,
    }).returning();
    const [deal] = await db.insert(deals).values({
      programId,
      leadId: lead.id,
      cohortId: cohorte.id,
      etapa: "atendido",
      valorVendidoUsd: "847",
    }).returning();
    await db.insert(dealLineas).values([
      { programId, dealId: deal.id, skuId: sku.id, precioListaUsd: "797", valorVendidoUsd: "697" },
      { programId, dealId: deal.id, skuId: sku.id, precioListaUsd: "200", valorVendidoUsd: "150" },
    ]);

    expect((await descuentosDeDeals(db, [deal.id])).get(deal.id)).toEqual({
      usd: 150,
      porcentaje: 150 / 997,
    });
  });
});
