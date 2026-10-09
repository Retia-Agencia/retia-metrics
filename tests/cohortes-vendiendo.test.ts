import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { cohortesVendiendo } from "@/lib/cohortes/vendiendo";
import { cohorts, deals, leads, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { cambiarCohorte } from "@/lib/deals/estudiante";
import { ErrorDeApp } from "@/lib/errors";
import { incluyendoAnulados } from "@/lib/queries/vigente";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

let db: Db;
let cerrar: () => Promise<void>;
let programId: string;
let otroProgramId: string;

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  const [programa, otroPrograma] = await db
    .insert(programs)
    .values([
      { ...PROGRAMA_DE_PRUEBA, slug: "principal", nombre: "Principal", ticketUsd: "1000" },
      { ...PROGRAMA_DE_PRUEBA, slug: "otro", nombre: "Otro", ticketUsd: "1500" },
    ])
    .returning();
  programId = programa.id;
  otroProgramId = otroPrograma.id;
});

afterEach(async () => {
  await cerrar();
});

async function crearCohorte({
  codigo,
  inicio,
  cierre,
  estado = "futuro",
  programa = programId,
}: {
  codigo: string;
  inicio: string | null;
  cierre: string;
  estado?: "futuro" | "activo" | "cerrado";
  programa?: string;
}) {
  const [cohorte] = await db
    .insert(cohorts)
    .values({
      programId: programa,
      codigo,
      metaCupos: 20,
      precioUsd: "1000",
      fechaInicioClases: "2026-07-01",
      fechaInicioVentas: inicio,
      fechaCierreVentas: cierre,
      estado,
    })
    .returning();
  return cohorte;
}

async function capturar(promesa: Promise<unknown>): Promise<ErrorDeApp> {
  try {
    await promesa;
  } catch (error) {
    return error as ErrorDeApp;
  }
  throw new Error("se esperaba un error");
}

describe("cohortesVendiendo", () => {
  it("devuelve una normalmente y las dos durante la semana de solapamiento", async () => {
    await crearCohorte({ codigo: "C3", inicio: "2026-06-01", cierre: "2026-06-20" });
    await crearCohorte({ codigo: "C4", inicio: "2026-06-15", cierre: "2026-06-30" });

    expect((await cohortesVendiendo(db, programId, "2026-06-10")).map((c) => c.codigo)).toEqual(["C3"]);
    expect((await cohortesVendiendo(db, programId, "2026-06-15")).map((c) => c.codigo)).toEqual(["C3", "C4"]);
  });

  it("excluye cohortes cerradas y las de otro programa", async () => {
    await crearCohorte({ codigo: "C3", inicio: "2026-06-01", cierre: "2026-06-30" });
    await crearCohorte({ codigo: "Cerrada", inicio: "2026-06-01", cierre: "2026-06-30", estado: "cerrado" });
    await crearCohorte({ codigo: "Ajena", inicio: "2026-06-01", cierre: "2026-06-30", programa: otroProgramId });

    expect((await cohortesVendiendo(db, programId, "2026-06-15")).map((c) => c.codigo)).toEqual(["C3"]);
  });

  it("incluye ambos limites de la ventana de ventas", async () => {
    await crearCohorte({ codigo: "C3", inicio: "2026-06-01", cierre: "2026-06-30" });

    expect((await cohortesVendiendo(db, programId, "2026-06-01")).map((c) => c.codigo)).toEqual(["C3"]);
    expect((await cohortesVendiendo(db, programId, "2026-06-30")).map((c) => c.codigo)).toEqual(["C3"]);
  });
});

describe("cambiarCohorte segun la etapa", () => {
  it("un deal no estudiante solo cambia a una cohorte que vende hoy", async () => {
    const origen = await crearCohorte({ codigo: "Origen", inicio: "2000-01-01", cierre: "2999-12-31", estado: "activo" });
    const vendiendo = await crearCohorte({ codigo: "Vendiendo", inicio: "2000-01-01", cierre: "2999-12-31" });
    const futura = await crearCohorte({ codigo: "Futura", inicio: "2999-01-01", cierre: "2999-12-31" });
    const [dueno] = await db.insert(users).values({ email: "closer@retia.test", rol: "closer", closerId: "Closer" }).returning();
    const [leadAceptado, leadRechazado] = await db
      .insert(leads)
      .values([
        { programId, emailNormalizado: "aceptado@retia.test" },
        { programId, emailNormalizado: "rechazado@retia.test" },
      ])
      .returning();
    const [aceptado, rechazado] = await db
      .insert(deals)
      .values([
        { leadId: leadAceptado.id, programId, cohortId: origen.id, etapa: "atendido", ownerUserId: dueno.id },
        { leadId: leadRechazado.id, programId, cohortId: origen.id, etapa: "atendido", ownerUserId: dueno.id },
      ])
      .returning();
    const actor = { userId: dueno.id, rol: "closer" as const };

    await cambiarCohorte(db, actor, { dealId: aceptado.id, cohortId: vendiendo.id, motivo: "Corresponde a esta venta." });
    expect((await db.select().from(deals).where(and(eq(deals.id, aceptado.id), incluyendoAnulados(deals))))[0].cohortId).toBe(vendiendo.id);

    expect(await capturar(cambiarCohorte(db, actor, { dealId: rechazado.id, cohortId: futura.id, motivo: "Aun no vende." }))).toMatchObject({
      status: 422,
      message: "Solo se puede elegir una cohorte que esté vendiendo hoy.",
    });
  });

  it("un estudiante todavia puede cambiar a una cohorte futura", async () => {
    const origen = await crearCohorte({ codigo: "Origen", inicio: "2000-01-01", cierre: "2999-12-31", estado: "activo" });
    const futura = await crearCohorte({ codigo: "Futura", inicio: null, cierre: "2999-12-31" });
    const [dueno] = await db.insert(users).values({ email: "estudiante@retia.test", rol: "closer", closerId: "Closer" }).returning();
    const [lead] = await db.insert(leads).values({ programId, emailNormalizado: "lead@retia.test" }).returning();
    const [deal] = await db
      .insert(deals)
      .values({ leadId: lead.id, programId, cohortId: origen.id, etapa: "ganado_parcial", ownerUserId: dueno.id })
      .returning();

    await cambiarCohorte(db, { userId: dueno.id, rol: "closer" }, { dealId: deal.id, cohortId: futura.id, motivo: "Transferencia acordada." });

    expect((await db.select().from(deals).where(and(eq(deals.id, deal.id), incluyendoAnulados(deals))))[0].cohortId).toBe(futura.id);
  });
});
