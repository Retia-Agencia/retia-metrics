import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { calls, deals, dealEtapaHistorial, leads, programs, sources, submissions } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { cargarEmbudoComercial, pasosDelEmbudoComercial } from "@/lib/queries/embudo-comercial";
import { serieDealsContraAgendas } from "@/lib/queries/deals-contra-agendas";
import { listaDeMetrica, resumenDeMetrica } from "@/lib/queries/metricas-con-filas";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";
import { duenoDePrueba } from "./helpers/dueno-de-prueba";
import { FECHA_LEAD_DE_PRUEBA } from "./helpers/crear-lead-de-prueba";

const rango = { desde: "2026-10-01", hasta: "2026-10-31" };
const enBogota = (dia: string) => new Date(`${dia}T10:00:00-05:00`);

describe("381: embudo comercial", () => {
  let db: Db;
  let cerrar: () => Promise<void>;
  let vaciar: () => Promise<void>;
  let programId: string;
  let sourceId: string;

  beforeAll(async () => {
    ({ db, cerrar, vaciar } = await crearBaseReutilizable());
  });

  beforeEach(async () => {
    await vaciar();
    const [programa] = await db.insert(programs).values({
      ...PROGRAMA_DE_PRUEBA,
      slug: "embudo-comercial",
      nombre: "Embudo comercial",
    }).returning();
    programId = programa.id;
    const [fuente] = await db.insert(sources).values({ programId, nombre: "Formulario" }).returning();
    sourceId = fuente.id;
  }, 60_000);

  afterAll(async () => cerrar());

  it("calcula cada porcentaje contra el paso anterior y la perdida como diferencia", () => {
    const deals = [
      { dealId: "1", origen: "completo", area: "paid", agendo: true, tuvoShow: true, compro: true },
      { dealId: "2", origen: "completo", area: "organico", agendo: true, tuvoShow: true, compro: false },
      { dealId: "3", origen: "parcial", area: "paid", agendo: true, tuvoShow: false, compro: false },
      { dealId: "4", origen: "manual", area: "sin_envio_origen", agendo: false, tuvoShow: false, compro: false },
    ] as const;
    const pasos = pasosDelEmbudoComercial(deals);
    for (const [indice, paso] of pasos.entries()) {
      const anterior = indice === 0 ? paso.cantidad : pasos[indice - 1]!.cantidad;
      expect(paso.pctDelPaso).toBe(anterior === 0 ? null : paso.cantidad / anterior);
      expect(paso.perdidos).toBe(anterior - paso.cantidad);
    }
    expect(pasos[0]!.composicion).toEqual({ completo: 2, parcial: 1, manual: 1 });
    expect(Object.values(pasos[0]!.composicion!).reduce((suma, cantidad) => suma + cantidad, 0))
      .toBe(pasos[0]!.cantidad);
    const completos = pasosDelEmbudoComercial(deals, "completo");
    expect(completos.map((paso) => paso.cantidad)).toEqual([2, 2, 2, 1]);
    expect(completos[0]!.composicion).toEqual({ completo: 2, parcial: 0, manual: 0 });
  });

  it("combina el área con el universo anidado y conserva cantidad igual a dealIds", () => {
    const pasos = pasosDelEmbudoComercial([
      { dealId: "1", origen: "completo", area: "paid", agendo: true, tuvoShow: true, compro: true },
      { dealId: "2", origen: "parcial", area: "paid", agendo: true, tuvoShow: false, compro: false },
      { dealId: "3", origen: "completo", area: "organico", agendo: true, tuvoShow: true, compro: true },
      { dealId: "4", origen: "manual", area: "sin_envio_origen", agendo: false, tuvoShow: false, compro: false },
    ], undefined, "paid");

    for (const [indice, paso] of pasos.entries()) {
      expect(paso.cantidad).toBe(paso.dealIds.length);
      if (indice > 0) {
        const idsAnteriores = new Set(pasos[indice - 1]!.dealIds);
        expect(paso.dealIds.every((id) => idsAnteriores.has(id))).toBe(true);
      }
    }
    expect(pasos.map((paso) => paso.cantidad)).toEqual([2, 2, 1, 1]);
  });

  it("lee el área desde la derivación central existente", () => {
    const fuente = readFileSync(new URL("../lib/queries/embudo-comercial.ts", import.meta.url), "utf8");
    expect(fuente).toContain('import { dimensionesDeOrigen } from "@/lib/queries/hechos/origen"');
    expect(fuente).toContain("dimensionesDeOrigen(");
    expect(fuente).not.toMatch(/areaDelDeal\s*=\s*sql`case/);
  });

  it("reclasifica como completo al lead que primero envió parcial y luego terminó, con lista y cifra iguales", async () => {
    const [lead] = await db.insert(leads).values({ fechaPrimeraAplicacion: FECHA_LEAD_DE_PRUEBA, programId, emailNormalizado: "termino@example.test" }).returning();
    const [parcial] = await db.insert(submissions).values({
      leadId: lead.id, sourceId, token: "persona", esParcial: true, fechaEnvio: enBogota("2026-10-02"),
    }).returning();
    await db.insert(submissions).values({
      leadId: lead.id, sourceId, token: "persona", esParcial: false, fechaEnvio: enBogota("2026-10-03"),
    });
    const [deal] = await db.insert(deals).values({
      programId, leadId: lead.id, submissionOrigenId: parcial.id, ownerUserId: await duenoDePrueba(db, programId), etapa: "ganado_parcial", createdAt: enBogota("2026-10-02"),
    }).returning();
    await db.insert(calls).values({
      programId, dealId: deal.id, createdAt: enBogota("2026-10-04"), fechaAgenda: enBogota("2026-10-05"), resultado: "show",
    });
    await db.insert(dealEtapaHistorial).values({
      dealId: deal.id, de: "atendido", a: "ganado_parcial", fecha: enBogota("2026-10-05"),
    });

    const serie = await serieDealsContraAgendas(db, { programId, rango }, "completo");
    const [resumen] = await resumenDeMetrica("deals_desde_completo", { programId, rango, hoy: rango.hasta }, db);
    const [lista] = await listaDeMetrica("deals_desde_completo", { programId, rango, hoy: rango.hasta }, 1, db);
    const [parciales] = await listaDeMetrica("deals_desde_parcial", { programId, rango, hoy: rango.hasta }, 1, db);
    expect(serie.puntos.at(-1)!.deals).toBe(1);
    expect(resumen.subtotal.cantidad).toBe(serie.puntos.at(-1)!.deals);
    expect(lista.filas.map((fila) => fila.dealId)).toEqual([deal.id]);
    expect(parciales.filas).toHaveLength(0);

    const embudo = await cargarEmbudoComercial(db, { programId, rango });
    expect(embudo.map((paso) => [paso.paso, paso.cantidad])).toEqual([
      ["creados", 1], ["agendaron", 1], ["tuvieron_show", 1], ["compraron", 1],
    ]);
    const [compraron] = await listaDeMetrica("embudo_comercial_compraron", { programId, rango, hoy: rango.hasta }, 1, db);
    expect(compraron.subtotal.cantidad).toBe(embudo.at(-1)!.cantidad);
    expect(compraron.filas.map((fila) => fila.dealId)).toEqual([deal.id]);

    await db.update(submissions).set({ fechaEnvio: enBogota("2026-11-01") }).where(eq(submissions.esParcial, false));
    const hastaOctubre = await cargarEmbudoComercial(db, { programId, rango }, "parcial");
    expect(hastaOctubre[0]!.cantidad).toBe(1);
  });
});
