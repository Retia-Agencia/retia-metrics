import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { abonos, cohorts, deals, leads, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import type { EtapaDeal } from "@/lib/deals/etapas";
import { studentsDelPrograma } from "@/lib/queries/estudiantes";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * Ticket 099 — la tab Students: la lista por cohorte cuadra con los deals vigentes en Abonado o
 * Completo de esa cohorte, con el saldo del módulo y la cartera vencida de `carteraVencida`.
 */

let db: Db;
let cerrar: () => Promise<void>;
let programId: string;
let otroPrograma: string;
let c1: string;
let c2: string;
let closer: string;
let n = 0;

const HOY = "2026-10-20";

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  const [p, q] = await db
    .insert(programs)
    .values([
      { ...PROGRAMA_DE_PRUEBA, slug: "p", nombre: "P", ticketUsd: "1000" },
      { ...PROGRAMA_DE_PRUEBA, slug: "q", nombre: "Q", ticketUsd: "1000" },
    ])
    .returning();
  programId = p.id;
  otroPrograma = q.id;
  const cohorte = (codigo: string, estado: "activo" | "cerrado", inicio: string) => ({
    programId,
    codigo,
    metaCupos: 10,
    precioUsd: "1000",
    fechaInicioVentas: "2026-08-01",
    fechaCierreVentas: "2026-09-01",
    fechaInicioClases: inicio,
    estado,
  });
  const [a, b] = await db.insert(cohorts).values([cohorte("C1", "cerrado", "2026-09-05"), cohorte("C2", "activo", "2026-10-15")]).returning();
  c1 = a.id;
  c2 = b.id;
  const [u] = await db.insert(users).values({ email: "maru@retiagrowth.com", nombre: "Maru", rol: "closer", closerId: "Maru" }).returning();
  closer = u.id;
});

afterEach(async () => {
  await cerrar();
});

async function deal(etapa: EtapaDeal, pagado: string, extra: Partial<typeof deals.$inferInsert> = {}, programa = programId) {
  const [l] = await db.insert(leads).values({ programId: programa, emailNormalizado: `l${++n}@correo.co`, nombre: `Lead ${n}` }).returning();
  const [d] = await db
    .insert(deals)
    .values({ leadId: l.id, programId: programa, cohortId: c2, etapa, ownerUserId: closer,valorVendidoUsd: "1000.00", ...extra })
    .returning();
  if (Number(pagado) > 0) await db.insert(abonos).values({ dealId: d.id, programId: programa, fecha: "2026-10-01", monto: pagado });
  return d;
}

describe("studentsDelPrograma", () => {
  it("la lista de una cohorte son sus deals vigentes en Abonado o Completo, y nada más", async () => {
    const abonado = await deal("abonado", "400");
    const completo = await deal("completo", "1000");
    await deal("compromiso_verbal", "0");
    await deal("completo", "1000", { cohortId: c1 });
    await deal("abonado", "400", { anuladoEn: new Date(), anuladoPor: closer, motivoAnulacion: "error" });

    const filas = await studentsDelPrograma(db, programId, { cohortId: c2 }, HOY);

    expect(filas.map((f) => f.dealId).sort()).toEqual([abonado.id, completo.id].sort());
    expect((await studentsDelPrograma(db, programId, {}, HOY)).length).toBe(3);
  });

  it("trae el saldo del módulo, el dueño y la cartera vencida con su fecha y días", async () => {
    const vencido = await deal("abonado", "400", { fechaLimitePago: "2026-10-10", acuerdoPago: "el resto el 10" });
    const alDia = await deal("abonado", "400", { fechaLimitePago: "2026-10-30" });

    const filas = await studentsDelPrograma(db, programId, { cohortId: c2 }, HOY);
    const v = filas.find((f) => f.dealId === vencido.id)!;
    expect(v.saldo?.saldo).toBe(600);
    expect(v.ownerNombre).toBe("Maru");
    expect(v.acuerdoPago).toBe("el resto el 10");
    expect(v.vencido).toEqual({ fechaLimite: "2026-10-10", diasDeAtraso: 10 });
    expect(filas.find((f) => f.dealId === alDia.id)!.vencido).toBeNull();
  });

  it("filtra por onboarding", async () => {
    const hecho = await deal("completo", "1000", { onboardedAt: new Date("2026-10-02T15:00:00Z") });
    const falta = await deal("completo", "1000");

    expect((await studentsDelPrograma(db, programId, { onboarded: "si" }, HOY)).map((f) => f.dealId)).toEqual([hecho.id]);
    expect((await studentsDelPrograma(db, programId, { onboarded: "no" }, HOY)).map((f) => f.dealId)).toEqual([falta.id]);
  });

  it("el programa es frontera: los estudiantes de otro programa no aparecen", async () => {
    await deal("completo", "1000", { cohortId: null }, otroPrograma);
    expect(await studentsDelPrograma(db, programId, {}, HOY)).toEqual([]);
  });
});
