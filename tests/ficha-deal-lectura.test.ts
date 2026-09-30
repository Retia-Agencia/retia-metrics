import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  calls,
  cohorts,
  dealActividades,
  dealEtapaHistorial,
  deals,
  leads,
  motivos,
  productos,
  programs,
  sources,
  submissions,
  users,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { anularAbono, registrarAbono } from "@/lib/deals/abonos";
import { anularDeal } from "@/lib/deals/anular-deal";
import { fichaDeDeal, opcionesDeFicha } from "@/lib/queries/ficha-deal";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * Ticket 074: `fichaDeDeal`, la lectura de la pantalla. Cubre: la cabecera con sus nombres,
 * lo anulado que SE MUESTRA marcado pero NO entra en los totales (que salen de `saldosDeDeals`),
 * el historial con "sistema" cuando nadie movio, la sugerencia de fecha limite, y la frontera:
 * un deal de otro programa o inexistente devuelve `null`.
 */

let db: Db;
let cerrar: () => Promise<void>;
let programId: string;
let otroPrograma: string;
let cohortId: string;
let productoId: string;
let closer: string;
let dealId: string;

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  const [p] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "p", nombre: "P", ticketUsd: "1000" }).returning();
  programId = p.id;
  const [q] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "q", nombre: "Q", ticketUsd: "500" }).returning();
  otroPrograma = q.id;
  const [c] = await db
    .insert(cohorts)
    .values({
      programId,
      codigo: "C1",
      metaCupos: 10,
      precioUsd: "1000",
      fechaInicioClases: "2026-10-01",
      fechaInicioVentas: "2026-09-01",
      fechaCierreVentas: "2026-09-30",
      estado: "activo",
    })
    .returning();
  cohortId = c.id;
  const [prod] = await db.insert(productos).values({ programId, nombre: "Programa", precioLista: "1000" }).returning();
  productoId = prod.id;
  const [u] = await db.insert(users).values({ email: "maru@retiagrowth.com", rol: "closer", closerId: "Maru", nombre: "Maru" }).returning();
  closer = u.id;
  const [l] = await db
    .insert(leads)
    .values({ programId, emailNormalizado: "ana@correo.co", nombre: "Ana", telefono: "300" })
    .returning();
  const [fuente] = await db.insert(sources).values({ programId, nombre: "Typeform" }).returning();
  const [env] = await db
    .insert(submissions)
    .values({ leadId: l.id, sourceId: fuente.id, token: "t1", utmSource: "facebook", utmMedium: "cpc" })
    .returning();
  const [d] = await db
    .insert(deals)
    .values({ leadId: l.id, submissionOrigenId: env.id, programId, cohortId, etapa: "atendido", ownerUserId: closer, productoId, acuerdoPago: "30% en octubre" })
    .returning();
  dealId = d.id;
}, 60_000);

afterEach(async () => {
  await cerrar();
});

const comoCloser = () => ({ userId: closer, rol: "closer" as const });

describe("fichaDeDeal", () => {
  it("arma la cabecera con los nombres y la fecha limite sugerida (inicio de clases)", async () => {
    const f = await fichaDeDeal(db, programId, dealId);

    expect(f).not.toBeNull();
    expect(f).toMatchObject({
      dealId,
      etapa: "atendido",
      lead: { email: "ana@correo.co", nombre: "Ana" },
      origen: { utmSource: "facebook", utmMedium: "cpc", utmCampaign: null },
      owner: { id: closer, nombre: "Maru" },
      producto: { nombre: "Programa", moneda: "USD" },
      cohorte: { codigo: "C1", inicioClases: "2026-10-01" },
      acuerdoPago: "30% en octubre",
      fechaLimiteSugerida: "2026-10-01",
      anulado: null,
    });
  });

  it("de otro programa o inexistente devuelve null: la frontera no se cruza", async () => {
    expect(await fichaDeDeal(db, otroPrograma, dealId)).toBeNull();
    expect(await fichaDeDeal(db, programId, crypto.randomUUID())).toBeNull();
  });

  it("los abonos anulados se muestran marcados pero NO entran en abonado ni saldo", async () => {
    const a1 = await registrarAbono(db, comoCloser(), { dealId, fecha: "2026-09-20", monto: "300", comprobanteUrl: "https://drive.google.com/c" });
    await registrarAbono(db, comoCloser(), { dealId, fecha: "2026-09-21", monto: "200" });
    await anularAbono(db, comoCloser(), { abonoId: a1.abonoId, motivo: "pago mal tecleado" });

    const f = (await fichaDeDeal(db, programId, dealId))!;

    expect(f.abonos).toHaveLength(2);
    const anulado = f.abonos.find((a) => a.id === a1.abonoId)!;
    expect(anulado.anuladoEn).toBeInstanceOf(Date);
    expect(anulado.motivoAnulacion).toBe("pago mal tecleado");
    expect(anulado.anuladoPorNombre).toBe("Maru");
    // La cifra sale del modulo de saldo: solo lo vigente (200 de 1.000).
    expect(f.saldo).toMatchObject({ abonado: 200, saldo: 800, abonosVigentes: 1 });
    // Y el saldo de la ficha es exactamente el del modulo.
    const { saldosDeDeals } = await import("@/lib/queries/saldo");
    expect((await saldosDeDeals(db, [dealId])).get(dealId)).toEqual(f.saldo);
  });

  it("las llamadas anuladas tambien se ven marcadas", async () => {
    await db.insert(calls).values({ dealId, programId, resultado: "show", fechaAgenda: new Date("2026-09-20T15:00:00Z"), closerUserId: closer, origen: "crm" });
    await db.insert(calls).values({
      dealId,
      programId,
      resultado: "agendada",
      fechaAgenda: new Date("2026-09-25T15:00:00Z"),
      origen: "crm",
      anuladoEn: new Date(),
      anuladoPor: closer,
      motivoAnulacion: "duplicada",
    });

    const f = (await fichaDeDeal(db, programId, dealId))!;

    expect(f.llamadas).toHaveLength(2);
    // La mas reciente primero.
    expect(f.llamadas[0].resultado).toBe("agendada");
    expect(f.llamadas[0]).toMatchObject({ motivoAnulacion: "duplicada", anuladoPorNombre: "Maru" });
    expect(f.llamadas[1]).toMatchObject({ resultado: "show", closerNombre: "Maru", anuladoEn: null });
  });

  it("el historial dice quien movio (null = sistema) y el motivo; las actividades, su autor", async () => {
    const [m] = await db.insert(motivos).values({ nombre: "Sin dinero", tipo: "perdida" }).returning();
    await db.insert(dealEtapaHistorial).values([
      { dealId, de: null, a: "pendiente_setteo", userId: null, fecha: new Date("2026-09-01T10:00:00Z") },
      { dealId, de: "pendiente_setteo", a: "atendido", userId: closer, motivoId: m.id, fecha: new Date("2026-09-02T10:00:00Z") },
    ]);
    await db.insert(dealActividades).values([
      { dealId, tipo: "contacto", canal: "WhatsApp", userId: closer, nota: "Le escribí", fecha: new Date("2026-09-03T10:00:00Z") },
      { dealId, tipo: "nota", userId: null, nota: "Nota del sistema", fecha: new Date("2026-09-04T10:00:00Z") },
    ]);

    const f = (await fichaDeDeal(db, programId, dealId))!;

    expect(f.historial.map((h) => [h.de, h.a, h.porNombre, h.motivoNombre])).toEqual([
      [null, "pendiente_setteo", null, null],
      ["pendiente_setteo", "atendido", "Maru", "Sin dinero"],
    ]);
    // Las actividades, de la mas nueva a la mas vieja.
    expect(f.actividades.map((a) => [a.tipo, a.autorNombre])).toEqual([
      ["nota", null],
      ["contacto", "Maru"],
    ]);
  });

  it("un deal anulado SE ABRE, marcado con quien y por que", async () => {
    await anularDeal(db, comoCloser(), { dealId, motivo: "lo registré mal" });
    const f = (await fichaDeDeal(db, programId, dealId))!;
    expect(f.anulado).toMatchObject({ porNombre: "Maru", motivo: "lo registré mal" });
    expect(f.etapa).toBe("atendido");
  });

  it("sin cohorte propia, la sugerencia es el inicio de clases de la activa; sin ninguna, null", async () => {
    await db.update(deals).set({ cohortId: null });
    expect((await fichaDeDeal(db, programId, dealId))!.fechaLimiteSugerida).toBe("2026-10-01");
    await db.update(cohorts).set({ estado: "cerrado" });
    expect((await fichaDeDeal(db, programId, dealId))!.fechaLimiteSugerida).toBeNull();
  });
});

describe("opcionesDeFicha", () => {
  it("ofrece solo lo del programa: productos activos, cohortes no cerradas y los closers con membresia", async () => {
    await db.insert(productos).values({ programId: otroPrograma, nombre: "Ajeno", precioLista: "10" });
    await db.insert(productos).values({ programId, nombre: "Viejo", precioLista: "10", activo: false });

    const o = await opcionesDeFicha(db, programId, closer);

    expect(o.productos.map((p) => p.nombre)).toEqual(["Programa"]);
    expect(o.cohortes.map((c) => c.nombre)).toEqual(["C1"]);
    // El dueño actual aparece aunque no tenga membresia (para no dejar el selector sin su valor).
    expect(o.owners.map((x) => x.id)).toEqual([closer]);
  });
});
