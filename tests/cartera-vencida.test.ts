import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { abonos, cohorts, deals, leads, productos, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import type { EtapaDeal } from "@/lib/deals/etapas";
import { carteraVencida } from "@/lib/queries/cartera";
import { fechaLimiteMaxima } from "@/lib/deals/pago";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * Ticket 061: cartera vencida = deals vigentes en Abonado con saldo > 0 y fecha límite
 * anterior a hoy. La fecha sin dueño es el inicio de clases de la cohorte. El saldo lo pone
 * `lib/queries/saldo.ts`, nunca esta consulta.
 */

let db: Db;
let cerrar: () => Promise<void>;
let programId: string;
let cohortId: string;
let productoId: string;
let closer: string;
let leadN = 0;

const HOY = "2026-10-20";

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  const [p] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "p", nombre: "P", ticketUsd: "1000" }).returning();
  programId = p.id;
  const [c] = await db
    .insert(cohorts)
    .values({ programId, codigo: "C1", metaCupos: 10, precioUsd: "1000", fechaInicioClases: "2026-10-15", fechaInicioVentas: "2026-09-01", fechaCierreVentas: "2026-10-10", estado: "activo" })
    .returning();
  cohortId = c.id;
  const [prod] = await db.insert(productos).values({ programId, nombre: "Programa", precioLista: "1000" }).returning();
  productoId = prod.id;
  const [u] = await db.insert(users).values({ email: "maru@retiagrowth.com", rol: "closer", closerId: "Maru" }).returning();
  closer = u.id;
});

afterEach(async () => {
  await cerrar();
});

/** Un deal con un abono de `pagado` USD (o ninguno si es 0). */
async function deal(etapa: EtapaDeal, pagado: string, extra: Partial<typeof deals.$inferInsert> = {}, programa = programId) {
  const [l] = await db.insert(leads).values({ programId: programa, emailNormalizado: `l${++leadN}@correo.co`, nombre: `Lead ${leadN}` }).returning();
  const [d] = await db
    .insert(deals)
    .values({ leadId: l.id, programId: programa, cohortId, etapa, ownerUserId: closer, productoId, ...extra })
    .returning();
  if (Number(pagado) > 0) await db.insert(abonos).values({ dealId: d.id, programId: programa, fecha: "2026-10-01", monto: pagado });
  return d;
}

describe("carteraVencida", () => {
  it("una cohorte ajena no presta su fecha: coincide con fechaLimiteMaxima", async () => {
    const [otro] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "q", nombre: "Q", ticketUsd: "1000" }).returning();
    const [ajena] = await db.insert(cohorts).values({
      programId: otro.id, codigo: "C1", metaCupos: 10, precioUsd: "1000",
      fechaInicioClases: "2026-12-01", fechaCierreVentas: "2026-11-25", estado: "futuro",
    }).returning();
    const d = await deal("abonado", "400", { cohortId: ajena.id });
    const maxima = await fechaLimiteMaxima(db, d);
    expect(maxima).toBe("2026-10-15");
    const r = await carteraVencida(db, programId, HOY);
    expect(r.vencidos).toHaveLength(1);
    expect(r.vencidos[0].fechaLimite).toBe(maxima);
  });

  it("un deal con saldo y fecha límite vencida sale, con su saldo y sus días de atraso", async () => {
    const d = await deal("abonado", "400", { fechaLimitePago: "2026-10-10", acuerdoPago: "el resto antes de clases" });
    const r = await carteraVencida(db, programId, HOY);
    expect(r.vencidos).toHaveLength(1);
    expect(r.vencidos[0]).toMatchObject({
      dealId: d.id,
      saldo: 600,
      moneda: "USD",
      fechaLimite: "2026-10-10",
      fechaPropia: true,
      diasDeAtraso: 10,
      acuerdoPago: "el resto antes de clases",
    });
  });

  it("con saldo en cero no sale; con la fecha de hoy o futura tampoco (el día límite aún es plazo)", async () => {
    await deal("abonado", "1000", { fechaLimitePago: "2026-10-01" });
    await deal("abonado", "400", { fechaLimitePago: HOY });
    await deal("abonado", "400", { fechaLimitePago: "2026-10-30" });
    expect((await carteraVencida(db, programId, HOY)).vencidos).toHaveLength(0);
  });

  it("un deal anulado no sale (vigente)", async () => {
    await deal("abonado", "400", { fechaLimitePago: "2026-10-01", anuladoEn: new Date(), anuladoPor: closer, motivoAnulacion: "error" });
    expect((await carteraVencida(db, programId, HOY)).vencidos).toHaveLength(0);
  });

  it("un abono anulado no cuenta: el saldo es el del módulo", async () => {
    const d = await deal("abonado", "400", { fechaLimitePago: "2026-10-01" });
    await db.insert(abonos).values({ dealId: d.id, programId, fecha: "2026-10-02", monto: "600", anuladoEn: new Date(), anuladoPor: closer, motivoAnulacion: "error" });
    const r = await carteraVencida(db, programId, HOY);
    expect(r.vencidos[0].saldo).toBe(600);
  });

  it("sin fecha propia rige el inicio de clases de su cohorte", async () => {
    await deal("abonado", "400");
    const r = await carteraVencida(db, programId, HOY);
    expect(r.vencidos[0]).toMatchObject({ fechaLimite: "2026-10-15", fechaPropia: false, diasDeAtraso: 5 });
  });

  it("sin cohorte propia rige la activa del programa; sin ninguna referencia se cuenta aparte", async () => {
    await deal("abonado", "400", { cohortId: null });
    let r = await carteraVencida(db, programId, HOY);
    expect(r.vencidos[0].fechaLimite).toBe("2026-10-15");

    await db.update(cohorts).set({ estado: "cerrado" }).where(eq(cohorts.id, cohortId));
    r = await carteraVencida(db, programId, HOY);
    expect(r).toMatchObject({ sinFechaDeReferencia: 1 });
    expect(r.vencidos).toHaveLength(0);
  });

  it("solo Abonado: un deal perdido con abonos no es cartera", async () => {
    await deal("cierre_perdido", "400", { fechaLimitePago: "2026-10-01" });
    expect((await carteraVencida(db, programId, HOY)).vencidos).toHaveLength(0);
  });

  it("el programa es frontera: la cartera de uno no incluye los deals del otro", async () => {
    const [otro] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "q", nombre: "Q", ticketUsd: "1500" }).returning();
    const [productoAjeno] = await db.insert(productos).values({ programId: otro.id, nombre: "Otro producto", precioLista: "1500" }).returning();
    await deal("abonado", "400", { fechaLimitePago: "2026-10-01", cohortId: null, productoId: productoAjeno.id }, otro.id);
    await deal("abonado", "100", { fechaLimitePago: "2026-10-01" });
    const r = await carteraVencida(db, programId, HOY);
    expect(r.vencidos).toHaveLength(1);
  });

  it("ordena por lo más atrasado primero", async () => {
    const reciente = await deal("abonado", "100", { fechaLimitePago: "2026-10-18" });
    const viejo = await deal("abonado", "100", { fechaLimitePago: "2026-09-01" });
    const r = await carteraVencida(db, programId, HOY);
    expect(r.vencidos.map((v) => v.dealId)).toEqual([viejo.id, reciente.id]);
  });
});
