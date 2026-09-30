import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { changeLog, dealEtapaHistorial, deals, leads, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { editarPrograma } from "@/lib/catalogo/programas";
import { esViolacionCheck } from "@/lib/db/errores";
import { comisionUsd } from "@/lib/queries/comision";
import { armarVistaDelDashboard } from "@/lib/queries/vista-dashboard";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * Ticket 062 — la comisión se calcula, nunca se guarda. Monto FIJO por venta en USD, por
 * programa (Alejo, 29-sep). Sale de los mismos cierres que la columna del comparativo.
 */

let db: Db;
let cerrar: () => Promise<void>;
let programId: string;
let gerente: string;

const HOY = "2026-09-15";

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  const [p] = await db
    .insert(programs)
    .values({ ...PROGRAMA_DE_PRUEBA, slug: "programa-a", nombre: "Programa A", ticketUsd: "797.00" })
    .returning();
  programId = p.id;
  const [g] = await db.insert(users).values({ email: "gerente@retiagrowth.com", rol: "gerente" }).returning();
  gerente = g.id;
}, 60_000);

afterEach(async () => {
  await cerrar();
});

/** Un closer con `ventas` deals que entraron a Abonado hoy. */
async function closerConVentas(closerId: string, ventas: number) {
  const [u] = await db.insert(users).values({ email: `${closerId}@retiagrowth.com`, rol: "closer", closerId }).returning();
  for (let i = 0; i < ventas; i++) {
    const [l] = await db.insert(leads).values({ programId, emailNormalizado: `${closerId}${i}@correo.co` }).returning();
    const [d] = await db.insert(deals).values({ leadId: l.id, programId, etapa: "abonado", ownerUserId: u.id }).returning();
    await db.insert(dealEtapaHistorial).values({ dealId: d.id, de: "compromiso_verbal", a: "abonado", fecha: new Date("2026-09-15T15:00:00Z") });
  }
}

const vista = () => armarVistaDelDashboard({ programId, hoy: HOY, preset: "hoy" }, db);

describe("comisionUsd", () => {
  it("es ventas por el monto fijo, y nula sin monto: nunca un cero inventado", () => {
    expect(comisionUsd(3, "80.00")).toBe(240);
    expect(comisionUsd(0, "100")).toBe(0);
    expect(comisionUsd(3, null)).toBeNull();
  });
});

describe("la comisión en el comparativo entre closers", () => {
  it("sale de los mismos cierres de la fila, por el monto del programa", async () => {
    await db.update(programs).set({ comisionPorVentaUsd: "80.00" }).where(eq(programs.id, programId));
    await closerConVentas("Ana", 2);
    await closerConVentas("Beto", 1);

    const v = await vista();

    expect(v.comisionPorVentaUsd).toBe("80.00");
    const porCloser = Object.fromEntries(v.comparativo.map((c) => [c.closerId, [c.cierres, c.comisionUsd]]));
    expect(porCloser).toEqual({ Ana: [2, 160], Beto: [1, 80] });
  });

  it("sin monto cargado la comisión es nula, no cero", async () => {
    await closerConVentas("Ana", 2);
    const v = await vista();
    expect(v.comisionPorVentaUsd).toBeNull();
    expect(v.comparativo[0].comisionUsd).toBeNull();
  });

  it("cambiar el monto cambia la cifra sin migración (no se guarda en el deal)", async () => {
    await closerConVentas("Ana", 2);
    await db.update(programs).set({ comisionPorVentaUsd: "80" }).where(eq(programs.id, programId));
    expect((await vista()).comparativo[0].comisionUsd).toBe(160);
    await db.update(programs).set({ comisionPorVentaUsd: "100" }).where(eq(programs.id, programId));
    expect((await vista()).comparativo[0].comisionUsd).toBe(200);
  });
});

describe("cada venta cuenta en UN solo periodo (la comisión no se paga dos veces)", () => {
  it("un deal que pasa a Abonado un mes y a Completo el siguiente es venta solo en el primero", async () => {
    await db.update(programs).set({ comisionPorVentaUsd: "80" }).where(eq(programs.id, programId));
    await closerConVentas("Ana", 1); // entra a Abonado el 15-sep
    const [deal] = await db.select().from(deals);
    await db.insert(dealEtapaHistorial).values({ dealId: deal.id, de: "abonado", a: "completo", fecha: new Date("2026-10-03T15:00:00Z") });

    const septiembre = await armarVistaDelDashboard({ programId, hoy: HOY, preset: "hoy" }, db);
    const octubre = await armarVistaDelDashboard({ programId, hoy: "2026-10-03", preset: "hoy" }, db);

    expect(septiembre.embudo.cierres).toBe(1);
    expect(septiembre.comparativo.find((c) => c.closerId === "Ana")?.comisionUsd).toBe(80);
    expect(octubre.embudo.cierres).toBe(0);
    expect(octubre.comparativo.find((c) => c.closerId === "Ana")?.cierres ?? 0).toBe(0);
  });
});

describe("el monto por venta es una instancia editable con rastro (ADR 0012)", () => {
  const entrada = (comisionPorVentaUsd: string) => ({
    nombre: "Programa A",
    slug: "programa-a",
    ticketUsd: "797.00",
    formUrl: PROGRAMA_DE_PRUEBA.formUrl,
    comisionPorVentaUsd,
  });

  it("editarlo deja su fila en change_log; vacío se guarda como nulo", async () => {
    await editarPrograma(db, gerente, programId, entrada("80"));
    const rastro = await db
      .select()
      .from(changeLog)
      .where(and(eq(changeLog.registroId, programId), eq(changeLog.campo, "comisionPorVentaUsd")));
    expect(rastro).toHaveLength(1);
    expect(rastro[0].userId).toBe(gerente);

    await editarPrograma(db, gerente, programId, entrada(""));
    const [p] = await db.select().from(programs).where(eq(programs.id, programId));
    expect(p.comisionPorVentaUsd).toBeNull();
  });

  it("un monto que no es USD es 400, y la base rechaza uno negativo", async () => {
    await expect(editarPrograma(db, gerente, programId, entrada("ochenta"))).rejects.toMatchObject({ status: 400 });
    const negativo = db.update(programs).set({ comisionPorVentaUsd: "-1" }).where(eq(programs.id, programId));
    await expect(negativo).rejects.toSatisfy(esViolacionCheck);
  });
});
