import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  abonos,
  calls,
  changeLog,
  cohorts,
  dealActividades,
  dealEtapaHistorial,
  deals,
  leads,
  motivos,
  productos,
  programs,
  users,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import type { EtapaDeal } from "@/lib/deals/etapas";
import { MovimientoRechazado, abrirDeal, moverEtapa, type Actor } from "@/lib/deals/mover-etapa";
import { crearConRastro } from "@/lib/crm/rastro";
import { saldosDeDeals } from "@/lib/queries/saldo";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";

/**
 * Ticket 045 — `moverEtapa()`, el unico camino para cambiar `deals.etapa`.
 *
 * Los requisitos flecha por flecha ya estan probados en memoria (044). Aqui se
 * prueba lo que solo existe con base: que los hechos se LEEN de la base y no los da
 * quien llama, que la etapa y su historial van juntos o no van, quien puede tomar
 * cada flecha, y la vuelta de A1 que decide el historial.
 */

let db: Db;
let cerrar: () => Promise<void>;
let programId: string;
let leadId: string;
let closer: string;
let productoId: string;
let motivoActivo: string;
let motivoInactivo: string;

const sistema: Actor = { tipo: "sistema" };
const comoCloser = (): Actor => ({ tipo: "usuario", userId: closer });

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  const [p] = await db.insert(programs).values({ slug: "p", nombre: "P", ticketUsd: "1000" }).returning();
  programId = p.id;
  const [l] = await db.insert(leads).values({ programId, emailNormalizado: "ana@correo.co" }).returning();
  leadId = l.id;
  const [u] = await db.insert(users).values({ email: "maru@retiagrowth.com", rol: "closer" }).returning();
  closer = u.id;
  const [prod] = await db
    .insert(productos)
    .values({ programId, nombre: "Programa completo", precioLista: "1000" })
    .returning();
  productoId = prod.id;
  const [m1] = await db.insert(motivos).values({ nombre: "No contesta" }).returning();
  const [m2] = await db.insert(motivos).values({ nombre: "Viejo", activo: false }).returning();
  motivoActivo = m1.id;
  motivoInactivo = m2.id;
});

afterEach(async () => {
  await cerrar();
});

async function nuevoDeal(etapa: EtapaDeal, extra: Partial<typeof deals.$inferInsert> = {}) {
  const [d] = await db.insert(deals).values({ leadId, programId, etapa, ...extra }).returning();
  return d.id;
}

async function etapaDe(dealId: string) {
  const [d] = await db.select({ etapa: deals.etapa }).from(deals).where(eq(deals.id, dealId));
  return d.etapa;
}

const historial = (dealId: string) =>
  db.select().from(dealEtapaHistorial).where(eq(dealEtapaHistorial.dealId, dealId));

async function rechazo(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    return e as MovimientoRechazado;
  }
  throw new Error("se esperaba un rechazo");
}

describe("mover y dejar historial", () => {
  it("T1: con dueño y contacto registrado, el deal pasa a En Contacto y queda la fila de historial", async () => {
    const dealId = await nuevoDeal("pendiente_setteo", { ownerUserId: closer });
    await db.insert(dealActividades).values({ dealId, tipo: "contacto", canal: "whatsapp", userId: closer });

    const hecho = await moverEtapa(db, { dealId, a: "en_contacto", actor: comoCloser() });

    expect(hecho).toMatchObject({ de: "pendiente_setteo", a: "en_contacto", transicion: { id: "T1" } });
    expect(await etapaDe(dealId)).toBe("en_contacto");
    expect(await historial(dealId)).toMatchObject([
      { de: "pendiente_setteo", a: "en_contacto", userId: closer, motivoId: null },
    ]);
  });

  it("lo que falta se nombra, y el deal no se mueve ni deja historial", async () => {
    const dealId = await nuevoDeal("pendiente_setteo");

    const e = await rechazo(moverEtapa(db, { dealId, a: "en_contacto", actor: comoCloser() }));

    expect(e).toBeInstanceOf(MovimientoRechazado);
    expect(e.status).toBe(422);
    expect(e.faltantes.map((f) => f.codigo)).toEqual(["dueno", "contacto"]);
    expect(e.message).toContain("no tiene dueño");
    expect(await etapaDe(dealId)).toBe("pendiente_setteo");
    expect(await historial(dealId)).toEqual([]);
  });

  it("una flecha que no existe se rechaza con las etapas por su nombre", async () => {
    const dealId = await nuevoDeal("pendiente_setteo");
    const e = await rechazo(moverEtapa(db, { dealId, a: "completo", actor: sistema }));
    expect(e.faltantes.map((f) => f.codigo)).toEqual(["transicion_no_permitida"]);
    expect(e.message).toBe("Un deal no puede pasar de Pendiente Setteo a Completo.");
  });

  it("si el historial no se puede escribir, la etapa tampoco cambia", async () => {
    // Un actor que no existe hace fallar la FK del historial DESPUES del update de la
    // etapa: la transaccion tiene que deshacer las dos cosas.
    const dealId = await nuevoDeal("pendiente_setteo", { ownerUserId: closer });
    await db.insert(dealActividades).values({ dealId, tipo: "contacto", canal: "whatsapp", userId: closer });

    await expect(
      moverEtapa(db, {
        dealId,
        a: "en_contacto",
        actor: { tipo: "usuario", userId: "00000000-0000-0000-0000-000000000000" },
      }),
    ).rejects.toThrow();

    expect(await etapaDe(dealId)).toBe("pendiente_setteo");
    expect(await historial(dealId)).toEqual([]);
  });

  it("un deal anulado no se mueve", async () => {
    const dealId = await nuevoDeal("pendiente_setteo", { anuladoEn: new Date(), anuladoPor: closer, motivoAnulacion: "error" });
    const e = await rechazo(moverEtapa(db, { dealId, a: "cierre_perdido", actor: comoCloser(), motivoId: motivoActivo }));
    expect(e.status).toBe(409);
  });

  it("un deal que no existe es 404", async () => {
    const e = await rechazo(
      moverEtapa(db, { dealId: "00000000-0000-0000-0000-000000000000", a: "en_contacto", actor: sistema }),
    );
    expect(e.status).toBe(404);
  });
});

describe("quien puede tomar cada flecha", () => {
  it("una persona no mueve a Atendido: la mueve el sistema cuando la llamada ocurrio", async () => {
    const dealId = await nuevoDeal("agendado");
    await db.insert(calls).values({ dealId, programId, resultado: "show", origen: "app" });

    const e = await rechazo(moverEtapa(db, { dealId, a: "atendido", actor: comoCloser() }));
    expect(e.status).toBe(403);

    await moverEtapa(db, { dealId, a: "atendido", actor: sistema });
    expect(await etapaDe(dealId)).toBe("atendido");
    expect((await historial(dealId))[0].userId).toBeNull();
  });

  it("el sistema no decide por el closer que un lead se perdio", async () => {
    const dealId = await nuevoDeal("en_contacto");
    const e = await rechazo(moverEtapa(db, { dealId, a: "cierre_perdido", actor: sistema, motivoId: motivoActivo }));
    expect(e.status).toBe(403);
  });
});

describe("el motivo", () => {
  it("Cierre Perdido sin motivo, o con uno desactivado, se rechaza; con uno activo pasa y queda en el historial", async () => {
    const dealId = await nuevoDeal("en_contacto");

    let e = await rechazo(moverEtapa(db, { dealId, a: "cierre_perdido", actor: comoCloser() }));
    expect(e.faltantes.map((f) => f.codigo)).toEqual(["motivo"]);

    e = await rechazo(moverEtapa(db, { dealId, a: "cierre_perdido", actor: comoCloser(), motivoId: motivoInactivo }));
    expect(e.faltantes.map((f) => f.codigo)).toEqual(["motivo"]);

    await moverEtapa(db, { dealId, a: "cierre_perdido", actor: comoCloser(), motivoId: motivoActivo });
    expect(await historial(dealId)).toMatchObject([{ a: "cierre_perdido", motivoId: motivoActivo }]);
  });
});

describe("los hechos salen de la base", () => {
  it("Proxima Cohorte exige que el deal quede en una cohorte futura", async () => {
    const base = { programId, metaCupos: 30, precioUsd: "1000", fechaInicioClases: "2026-11-01", fechaCierreVentas: "2026-10-25" };
    const [activa] = await db
      .insert(cohorts)
      .values({ ...base, codigo: "C3", estado: "activo", fechaInicioVentas: "2026-09-01" })
      .returning();
    const [futura] = await db.insert(cohorts).values({ ...base, codigo: "C4", estado: "futuro" }).returning();

    const dealId = await nuevoDeal("en_contacto", { cohortId: activa.id });
    const e = await rechazo(moverEtapa(db, { dealId, a: "proxima_cohorte", actor: comoCloser() }));
    expect(e.faltantes.map((f) => f.codigo)).toEqual(["cohorte_destino"]);

    await db.update(deals).set({ cohortId: futura.id }).where(eq(deals.id, dealId));
    await moverEtapa(db, { dealId, a: "proxima_cohorte", actor: comoCloser() });
    expect(await etapaDe(dealId)).toBe("proxima_cohorte");
  });

  it("T22: el contacto tiene que ser NUEVO, posterior a quedar en Proxima Cohorte", async () => {
    const dealId = await nuevoDeal("proxima_cohorte", { createdAt: new Date("2026-09-01T12:00:00-05:00") });
    await db.insert(dealActividades).values({
      dealId,
      tipo: "contacto",
      canal: "whatsapp",
      userId: closer,
      fecha: new Date("2026-09-10T12:00:00-05:00"),
    });
    await db.insert(dealEtapaHistorial).values({
      dealId,
      de: "atendido",
      a: "proxima_cohorte",
      fecha: new Date("2026-09-15T12:00:00-05:00"),
    });

    const e = await rechazo(moverEtapa(db, { dealId, a: "en_contacto", actor: comoCloser() }));
    expect(e.faltantes.map((f) => f.codigo)).toEqual(["contacto"]);

    await db.insert(dealActividades).values({ dealId, tipo: "contacto", canal: "llamada", userId: closer });
    await moverEtapa(db, { dealId, a: "en_contacto", actor: comoCloser() });
    expect(await etapaDe(dealId)).toBe("en_contacto");
  });

  it("el dinero mueve el deal: Abonado con saldo, Completo sin saldo, y A1 vuelve a la etapa de donde vino", async () => {
    const dealId = await nuevoDeal("atendido", { productoId });
    await db.insert(dealEtapaHistorial).values({ dealId, de: "agendado", a: "atendido" });
    const [primero] = await db
      .insert(abonos)
      .values({ dealId, programId, fecha: "2026-09-27", monto: "300", comprobanteUrl: "https://x/1.png" })
      .returning();

    // Con 700 de saldo no es Completo.
    let e = await rechazo(moverEtapa(db, { dealId, a: "completo", actor: sistema }));
    expect(e.faltantes.map((f) => f.codigo)).toEqual(["saldo_en_cero"]);
    await moverEtapa(db, { dealId, a: "abonado", actor: sistema });

    // Se anula el unico abono: vuelve a Atendido, que es de donde vino, y a ningun otro lado.
    await db
      .update(abonos)
      .set({ anuladoEn: new Date(), anuladoPor: closer, motivoAnulacion: "tecleo" })
      .where(eq(abonos.id, primero.id));
    e = await rechazo(moverEtapa(db, { dealId, a: "en_contacto", actor: sistema, motivoId: motivoActivo }));
    expect(e.status).toBe(409);
    expect(e.message).toContain("vuelve a Atendido");
    await moverEtapa(db, { dealId, a: "atendido", actor: sistema, motivoId: motivoActivo });
    expect(await etapaDe(dealId)).toBe("atendido");

    // Paga todo de una vez: T14 directo a Completo.
    await db
      .insert(abonos)
      .values({ dealId, programId, fecha: "2026-09-28", monto: "1000", comprobanteUrl: "https://x/2.png" });
    await moverEtapa(db, { dealId, a: "completo", actor: sistema });
    expect((await historial(dealId)).map((h) => h.a)).toEqual(["atendido", "abonado", "atendido", "completo"]);
  });
});

describe("el saldo (ADR 0024)", () => {
  it("precio del producto menos abonos vigentes; sin producto no hay saldo", async () => {
    const conProducto = await nuevoDeal("atendido", { productoId });
    // Otro lead: la base no deja dos deals abiertos del mismo lead y programa.
    const [otro] = await db.insert(leads).values({ programId, emailNormalizado: "beto@correo.co" }).returning();
    const [sp] = await db.insert(deals).values({ leadId: otro.id, programId, etapa: "atendido" }).returning();
    const sinProducto = sp.id;
    await db.insert(abonos).values({ dealId: conProducto, programId, fecha: "2026-09-27", monto: "250.50" });
    await db
      .insert(abonos)
      .values({
        dealId: conProducto,
        programId,
        fecha: "2026-09-27",
        monto: "100",
        anuladoEn: new Date(),
        anuladoPor: closer,
        motivoAnulacion: "tecleo",
      });

    const saldos = await saldosDeDeals(db, [conProducto, sinProducto]);
    expect(saldos.get(conProducto)).toMatchObject({ precio: 1000, abonado: 250.5, abonosVigentes: 1, saldo: 749.5 });
    expect(saldos.get(sinProducto)).toMatchObject({ precio: null, saldo: null, sinSaldoPorque: "sin_producto" });
  });

  it("nunca convierte moneda en silencio: un abono en otra moneda deja el saldo sin calcular", async () => {
    const dealId = await nuevoDeal("atendido", { productoId });
    await db.insert(abonos).values({ dealId, programId, fecha: "2026-09-27", monto: "400000", moneda: "COP" });
    expect((await saldosDeDeals(db, [dealId])).get(dealId)).toMatchObject({
      saldo: null,
      sinSaldoPorque: "moneda_distinta",
    });
  });
});

describe("saltos, retrocesos y recuperacion (ticket 047)", () => {
  it("T4: el cierre por chat salta de En Contacto a Compromiso Verbal con producto y fecha limite", async () => {
    const dealId = await nuevoDeal("en_contacto");
    const e = await rechazo(moverEtapa(db, { dealId, a: "compromiso_verbal", actor: comoCloser() }));
    expect(e.faltantes.map((f) => f.codigo)).toEqual(["producto", "fecha_limite_pago"]);

    await db.update(deals).set({ productoId, fechaLimitePago: "2026-10-30" }).where(eq(deals.id, dealId));
    await moverEtapa(db, { dealId, a: "compromiso_verbal", actor: comoCloser() });
    expect(await etapaDe(dealId)).toBe("compromiso_verbal");
  });

  it("un retroceso (T29, Atendido → Re-agenda) sin motivo se rechaza; con motivo pasa y queda en el historial", async () => {
    const dealId = await nuevoDeal("atendido");
    const e = await rechazo(moverEtapa(db, { dealId, a: "pendiente_reagenda", actor: comoCloser() }));
    expect(e.faltantes.map((f) => f.codigo)).toEqual(["motivo"]);

    await moverEtapa(db, { dealId, a: "pendiente_reagenda", actor: comoCloser(), motivoId: motivoActivo });
    expect(await historial(dealId)).toMatchObject([{ de: "atendido", a: "pendiente_reagenda", motivoId: motivoActivo }]);
  });

  it("un perdido se recupera con motivo, y solo hacia En Contacto, Agendado o Proxima Cohorte", async () => {
    const dealId = await nuevoDeal("cierre_perdido");

    let e = await rechazo(moverEtapa(db, { dealId, a: "atendido", actor: comoCloser(), motivoId: motivoActivo }));
    expect(e.faltantes.map((f) => f.codigo)).toEqual(["transicion_no_permitida"]);
    e = await rechazo(moverEtapa(db, { dealId, a: "en_contacto", actor: comoCloser() }));
    expect(e.faltantes.map((f) => f.codigo)).toEqual(["motivo"]);

    await moverEtapa(db, { dealId, a: "en_contacto", actor: comoCloser(), motivoId: motivoActivo });
    expect(await historial(dealId)).toMatchObject([{ de: "cierre_perdido", a: "en_contacto", motivoId: motivoActivo }]);
  });
});

describe("abrirDeal: donde nace un deal (ticket 047)", () => {
  it("a mano nace en En Contacto con quien lo crea de dueño, con su primera fila de historial y su rastro", async () => {
    const dealId = await abrirDeal(db, { leadId, programId, etapa: "en_contacto", actor: comoCloser() });

    const [d] = await db.select().from(deals).where(eq(deals.id, dealId));
    expect(d).toMatchObject({ etapa: "en_contacto", ownerUserId: closer, creadoPor: closer });
    expect(await historial(dealId)).toMatchObject([{ de: null, a: "en_contacto", userId: closer }]);
    const log = await db.select().from(changeLog).where(eq(changeLog.registroId, dealId));
    expect(log.map((l) => l.campo)).toContain("etapa");
  });

  it("a mano no nace en Agendado ni despues de la llamada; el sistema no nace en En Contacto", async () => {
    for (const etapa of ["agendado", "atendido", "abonado", "completo"] as const) {
      const e = await rechazo(abrirDeal(db, { leadId, programId, etapa, actor: comoCloser() }));
      expect(e.status, etapa).toBe(422);
    }
    const e = await rechazo(abrirDeal(db, { leadId, programId, etapa: "en_contacto", actor: sistema }));
    expect(e.status).toBe(422);
    expect(await db.select().from(deals)).toEqual([]);
  });

  it("el sistema abre en Agendado con el dueño que le dio Calendly", async () => {
    const dealId = await abrirDeal(db, { leadId, programId, etapa: "agendado", actor: sistema, ownerUserId: closer });
    expect(await historial(dealId)).toMatchObject([{ de: null, a: "agendado", userId: null }]);
    const [d] = await db.select().from(deals).where(eq(deals.id, dealId));
    expect(d.ownerUserId).toBe(closer);
  });

  it("nacer en Compromiso Verbal exige producto y fecha limite", async () => {
    const e = await rechazo(abrirDeal(db, { leadId, programId, etapa: "compromiso_verbal", actor: comoCloser(), productoId }));
    expect(e.faltantes.map((f) => f.codigo)).toEqual(["fecha_limite_pago"]);

    await abrirDeal(db, {
      leadId,
      programId,
      etapa: "compromiso_verbal",
      actor: comoCloser(),
      productoId,
      fechaLimitePago: "2026-10-30",
    });
  });

  it("el programa es frontera: no se abre un deal sobre un lead de otro programa", async () => {
    const [otro] = await db.insert(programs).values({ slug: "q", nombre: "Q", ticketUsd: "1500" }).returning();
    const e = await rechazo(abrirDeal(db, { leadId, programId: otro.id, etapa: "pendiente_setteo", actor: sistema }));
    expect(e.status).toBe(422);
    expect(await db.select().from(deals)).toEqual([]);
  });

  it("un deal abierto por lead: el segundo es 409; reaplicar tras un Cierre Perdido abre uno NUEVO", async () => {
    const primero = await abrirDeal(db, { leadId, programId, etapa: "pendiente_setteo", actor: sistema });
    const e = await rechazo(abrirDeal(db, { leadId, programId, etapa: "pendiente_setteo", actor: sistema }));
    expect(e.status).toBe(409);
    expect(await historial(primero)).toHaveLength(1);

    await moverEtapa(db, { dealId: primero, a: "cierre_perdido", actor: comoCloser(), motivoId: motivoActivo });
    const segundo = await abrirDeal(db, { leadId, programId, etapa: "pendiente_setteo", actor: sistema });
    expect(segundo).not.toBe(primero);
    expect(await etapaDe(primero)).toBe("cierre_perdido");
  });

  it("nadie mas crea un deal diciendo su etapa: crearConRastro lo rechaza sin la llave del motor", async () => {
    await expect(
      crearConRastro(
        { db, tabla: deals, nombreTabla: "deals", actorId: closer, etiqueta: "x" },
        { leadId, programId, etapa: "abonado" },
      ),
    ).rejects.toThrow(/abrirDeal\(\)/);
    expect(await db.select().from(deals)).toEqual([]);
  });
});
