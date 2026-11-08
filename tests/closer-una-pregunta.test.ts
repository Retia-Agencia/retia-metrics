import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { abonos, calls, dealEtapaHistorial, deals, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { REGISTRO } from "@/lib/metricas/registro";
import { embudoDelRango, embudoPorCloser } from "@/lib/queries/dashboard";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { crearLeadDePrueba } from "./helpers/crear-lead-de-prueba";
import { duenoDePrueba } from "./helpers/dueno-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;

beforeAll(async () => {
  ({ db, cerrar, vaciar } = await crearBaseReutilizable());
}, 60_000);

beforeEach(async () => {
  await vaciar();
}, 60_000);

afterAll(async () => {
  await cerrar();
});

describe("closer: una pregunta y una definicion", () => {
  it("el desglose de llamadas conserva los conteos del total", async () => {
    const [programa] = await db.insert(programs).values({
      ...PROGRAMA_DE_PRUEBA,
      slug: "closer-una-pregunta",
      nombre: "Closer una pregunta",
      ticketUsd: "1000",
    }).returning();
    const closerA = await duenoDePrueba(db, programa.id);
    const [closerB] = await db.insert(users).values({
      email: "closer-b@prueba.test",
      nombre: "Closer B",
      rol: "closer",
      closerId: "Closer B",
    }).returning();
    const fecha = new Date("2026-11-05T15:00:00-05:00");

    const sembrarVenta = async (ownerUserId: string) => {
      const lead = await crearLeadDePrueba(db, { programId: programa.id });
      const [deal] = await db.insert(deals).values({
        leadId: lead.id,
        programId: programa.id,
        ownerUserId,
        etapa: "ganado_parcial",
        valorVendidoUsd: "1000",
        comisionPorcentaje: "10",
      }).returning();
      await db.insert(dealEtapaHistorial).values({
        dealId: deal.id,
        de: "compromiso_verbal",
        a: "ganado_parcial",
        fecha,
        userId: ownerUserId,
      });
      await db.insert(abonos).values({
        dealId: deal.id,
        programId: programa.id,
        registradoPorUserId: ownerUserId,
        fecha: "2026-11-05",
        monto: "100",
        moneda: "USD",
      });
      return deal.id;
    };

    const dealA = await sembrarVenta(closerA);
    const dealB = await sembrarVenta(closerB.id);
    await db.insert(calls).values([
      { programId: programa.id, dealId: dealA, closerUserId: closerA, fechaAgenda: fecha, resultado: "show" },
      { programId: programa.id, dealId: dealA, closerUserId: closerA, fechaAgenda: fecha, resultado: "cancelada" },
      { programId: programa.id, dealId: dealB, closerUserId: closerB.id, fechaAgenda: fecha, resultado: "reagendada" },
      { programId: programa.id, dealId: dealB, closerUserId: closerB.id, fechaAgenda: fecha, resultado: "agendada" },
      { programId: programa.id, fechaAgenda: fecha, resultado: "show", origen: "sheets" },
    ]);

    const rango = { desde: "2026-11-05", hasta: "2026-11-05" };
    const ahora = new Date("2026-11-06T12:00:00-05:00");
    const total = await embudoDelRango({ programId: programa.id, rango }, db, ahora);
    const filas = await embudoPorCloser({ programId: programa.id, rango }, db, ahora);
    const suma = (campo: "agendas" | "canceladas" | "reagendadas" | "llamadasConShow") =>
      filas.reduce((acumulado, fila) => acumulado + fila[campo], 0);

    expect(suma("agendas")).toBe(total.agendas);
    expect(suma("canceladas")).toBe(total.canceladas);
    expect(suma("reagendadas")).toBe(total.reagendadas);
    expect(suma("llamadasConShow")).toBe(total.llamadasConShow);
  });

  it("cada ficha con dimension de dueno declara su criterio", () => {
    const fichasConDueno = Object.values(REGISTRO).filter((ficha) =>
      ficha.dimensiones.includes("dueno"),
    );

    expect(fichasConDueno.length).toBeGreaterThan(0);
    for (const ficha of fichasConDueno) {
      expect(ficha.criterioDeCloser).toBeDefined();
    }

    expect({
      ventas: REGISTRO.ventas.criterioDeCloser,
      cupos_vendidos: REGISTRO.cupos_vendidos.criterioDeCloser,
      llevamos: REGISTRO.llevamos.criterioDeCloser,
      vendido: REGISTRO.vendido.criterioDeCloser,
      recaudado: REGISTRO.recaudado.criterioDeCloser,
      por_cobrar: REGISTRO.por_cobrar.criterioDeCloser,
      comision: REGISTRO.comision.criterioDeCloser,
      entro_a_caja: REGISTRO.entro_a_caja.criterioDeCloser,
    }).toEqual({
      ventas: "dueno_del_deal",
      cupos_vendidos: "dueno_del_deal",
      llevamos: "dueno_del_deal",
      vendido: "dueno_del_deal",
      recaudado: "dueno_del_deal",
      por_cobrar: "dueno_del_deal",
      comision: "dueno_del_deal",
      entro_a_caja: "quien_registro_el_abono",
    });
    expect(REGISTRO.leads.criterioDeCloser).toBeUndefined();
  });
});
