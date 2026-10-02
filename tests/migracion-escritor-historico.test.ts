import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  abonos,
  calls,
  changeLog,
  dealActividades,
  dealEtapaHistorial,
  deals,
  leads,
  miembrosPrograma,
  programs,
  sources,
  submissions,
  users,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { abrirDeal } from "@/lib/deals/mover-etapa";
import {
  abrirDealHistorico,
  abrirDealesHistoricos,
  duenoDesdeLaHoja,
  registrarAbonoHistorico,
  registrarAbonosHistoricos,
  registrarLlamadaHistorica,
  registrarLlamadasHistoricas,
} from "@/lib/deals/historico";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * ADR 0059 y ticket 078 — el escritor de lo historico.
 *
 * Lo que se prueba es lo que las mutaciones de siempre no pueden expresar: un deal que nace
 * en Completo, un abono que no mueve nada, una llamada con resultado, y que la SEGUNDA
 * corrida de la migracion no duplique nada porque la base lo rechaza.
 */

let db: Db;
let cerrar: () => Promise<void>;
let programa: string;
let otroPrograma: string;
let lead: string;
let script: string;
let maru: string;

const H = (llave: string) => `sheets:programa-a:Estudiantes:${llave}`;

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  const [p] = await db
    .insert(programs)
    .values({ ...PROGRAMA_DE_PRUEBA, slug: "programa-a", nombre: "Programa A", ticketUsd: "1000" })
    .returning();
  const [q] = await db
    .insert(programs)
    .values({ ...PROGRAMA_DE_PRUEBA, slug: "programa-b", nombre: "Programa B", ticketUsd: "1000" })
    .returning();
  programa = p.id;
  otroPrograma = q.id;
  const [l] = await db
    .insert(leads)
    .values({ programId: programa, emailNormalizado: "ana@correo.co", nombre: "Ana" })
    .returning();
  lead = l.id;
  const [s] = await db.insert(users).values({ email: "script@retiagrowth.com", rol: "developer" }).returning();
  script = s.id;
  const [m] = await db.insert(users).values({ email: "maru@retiagrowth.com", rol: "closer", closerId: "Maru" }).returning();
  maru = m.id;
  await db.insert(miembrosPrograma).values({ userId: maru, programId: programa, activo: true });
});

afterEach(async () => {
  await cerrar();
});

describe("abrirDealHistorico (ADR 0059 punto 1)", () => {
  it("nace en Completo con UNA fila de historial del sistema, su huella y rastro del script", async () => {
    const fecha = new Date("2026-08-18T12:00:00-05:00");
    const r = await abrirDealHistorico(db, {
      leadId: lead,
      programId: programa,
      etapa: "ganado_completo",
      huella: H("ana"),
      actorId: script,
      fechaEtapa: fecha,
    });
    expect(r.estado).toBe("creado");
    if (r.estado !== "creado") return;

    const [deal] = await db.select().from(deals).where(eq(deals.id, r.dealId));
    expect(deal.etapa).toBe("ganado_completo");
    expect(deal.huellaMigracion).toBe(H("ana"));
    expect(deal.creadoPor).toBeNull();

    const historial = await db.select().from(dealEtapaHistorial).where(eq(dealEtapaHistorial.dealId, r.dealId));
    expect(historial).toHaveLength(1);
    expect(historial[0]).toMatchObject({ de: null, a: "ganado_completo", userId: null });
    expect(historial[0].fecha.getTime()).toBe(fecha.getTime());

    const rastro = await db.select().from(changeLog).where(eq(changeLog.registroId, r.dealId));
    expect(rastro.length).toBeGreaterThan(0);
    expect(rastro.every((f) => f.userId === script)).toBe(true);
  });

  it("los Registro de la hoja entran como NOTAS del sistema, nunca como contacto de alguien", async () => {
    const r = await abrirDealHistorico(db, {
      leadId: lead,
      programId: programa,
      etapa: "contactado",
      huella: H("ana"),
      actorId: script,
      notas: [{ texto: "Maru: le escribi por WhatsApp" }, { texto: "   " }, { texto: "No contesta" }],
    });
    if (r.estado !== "creado") throw new Error(r.estado);

    const notas = await db.select().from(dealActividades).where(eq(dealActividades.dealId, r.dealId));
    expect(notas).toHaveLength(2);
    expect(notas.every((n) => n.tipo === "nota" && n.userId === null)).toBe(true);
  });

  it("la segunda corrida devuelve el mismo deal y no escribe nada", async () => {
    const alta = { leadId: lead, programId: programa, etapa: "ganado_completo" as const, huella: H("ana"), actorId: script };
    const primera = await abrirDealHistorico(db, { ...alta, notas: [{ texto: "nota" }] });
    const bitacora = (await db.select().from(changeLog)).length;

    const segunda = await abrirDealHistorico(db, { ...alta, notas: [{ texto: "nota" }] });

    expect(primera.estado).toBe("creado");
    expect(segunda).toEqual({ estado: "ya_migrado", dealId: (primera as { dealId: string }).dealId });
    expect(await db.select().from(deals)).toHaveLength(1);
    expect(await db.select().from(dealActividades)).toHaveLength(1);
    expect(await db.select().from(dealEtapaHistorial)).toHaveLength(1);
    expect((await db.select().from(changeLog)).length).toBe(bitacora);
  });

  it("si el lead ya tiene un deal vivo, gana el vivo y no se toca nada (punto 3)", async () => {
    const vivo = await abrirDeal(db, { leadId: lead, programId: programa, etapa: "registrado", actor: { tipo: "sistema" } });

    const r = await abrirDealHistorico(db, {
      leadId: lead,
      programId: programa,
      etapa: "contactado",
      huella: H("ana"),
      actorId: script,
    });

    expect(r).toEqual({ estado: "lead_con_deal_vivo", dealVivoId: vivo });
    expect(await db.select().from(deals)).toHaveLength(1);
  });

  it("una venta en Completo SI entra aunque haya deal vivo: fue otra oportunidad, ya pagada", async () => {
    await abrirDeal(db, { leadId: lead, programId: programa, etapa: "registrado", actor: { tipo: "sistema" } });

    const r = await abrirDealHistorico(db, {
      leadId: lead,
      programId: programa,
      etapa: "ganado_completo",
      huella: H("ana"),
      actorId: script,
    });

    expect(r.estado).toBe("creado");
    expect(await db.select().from(deals)).toHaveLength(2);
  });

  it("el programa es frontera: un lead de otro programa se rechaza", async () => {
    await expect(
      abrirDealHistorico(db, { leadId: lead, programId: otroPrograma, etapa: "ganado_completo", huella: H("ana"), actorId: script }),
    ).rejects.toThrow(/otro programa/);
  });

  it("el envío de origen tiene que ser de ESTE lead (ADR 0060)", async () => {
    const [fuente] = await db.insert(sources).values({ programId: programa, nombre: "Typeform" }).returning();
    const [otro] = await db.insert(leads).values({ programId: programa, emailNormalizado: "beto@correo.co" }).returning();
    const [deAna] = await db.insert(submissions).values({ leadId: lead, sourceId: fuente.id, token: "t-ana" }).returning();
    const [deBeto] = await db.insert(submissions).values({ leadId: otro.id, sourceId: fuente.id, token: "t-beto" }).returning();
    const alta = { leadId: lead, programId: programa, etapa: "ganado_completo" as const, huella: H("ana"), actorId: script };

    await expect(abrirDealHistorico(db, { ...alta, submissionOrigenId: deBeto.id })).rejects.toThrow(/otro lead/);
    expect(await db.select().from(deals)).toHaveLength(0);

    const r = await abrirDealHistorico(db, { ...alta, submissionOrigenId: deAna.id });
    if (r.estado !== "creado") throw new Error(r.estado);
    const [deal] = await db.select().from(deals).where(eq(deals.id, r.dealId));
    expect(deal.submissionOrigenId).toBe(deAna.id);
  });

  it("dentro de una transaccion externa (el ensayo), el choque no la tumba", async () => {
    const alta = { leadId: lead, programId: programa, etapa: "ganado_completo" as const, huella: H("ana"), actorId: script };
    type ConTx = { transaction: <T>(fn: (tx: Db) => Promise<T>) => Promise<T> };
    const segunda = await (db as unknown as ConTx).transaction(async (tx) => {
      await abrirDealHistorico(tx, alta);
      const r = await abrirDealHistorico(tx, alta);
      // La transaccion sigue viva despues del choque: se puede seguir leyendo.
      expect(await tx.select().from(deals)).toHaveLength(1);
      return r;
    });
    expect(segunda.estado).toBe("ya_migrado");
  });
});

describe("registrarAbonoHistorico", () => {
  let deal: string;

  beforeEach(async () => {
    const r = await abrirDealHistorico(db, {
      leadId: lead,
      programId: programa,
      etapa: "compromiso_verbal",
      huella: H("ana"),
      actorId: script,
    });
    deal = (r as { dealId: string }).dealId;
  });

  const abono = { huella: H("ana:abono:1"), fecha: "2026-08-18", monto: "500", closer: "Jero" };

  it("escribe el abono con su huella, en USD, con el closer como texto, y NO mueve la etapa", async () => {
    const r = await registrarAbonoHistorico(db, { ...abono, dealId: deal, actorId: script });
    expect(r.estado).toBe("creado");

    const [fila] = await db.select().from(abonos);
    expect(fila).toMatchObject({ dealId: deal, programId: programa, moneda: "USD", closerId: "Jero", origen: "sheets" });
    const [d] = await db.select().from(deals).where(eq(deals.id, deal));
    expect(d.etapa).toBe("compromiso_verbal");
  });

  it("la segunda corrida no lo duplica", async () => {
    const primera = await registrarAbonoHistorico(db, { ...abono, dealId: deal, actorId: script });
    const segunda = await registrarAbonoHistorico(db, { ...abono, dealId: deal, actorId: script });

    expect(segunda).toEqual({ estado: "ya_migrado", id: primera.id });
    expect(await db.select().from(abonos)).toHaveLength(1);
  });

  it("al deal vivo del CRM no se le cuelga un abono historico (punto 3, revision de Codex)", async () => {
    const [otroLead] = await db
      .insert(leads)
      .values({ programId: programa, emailNormalizado: "beto@correo.co" })
      .returning();
    const vivo = await abrirDeal(db, { leadId: otroLead.id, programId: programa, etapa: "registrado", actor: { tipo: "sistema" } });

    await expect(
      registrarAbonoHistorico(db, { ...abono, dealId: vivo, actorId: script }),
    ).rejects.toThrow(/gana el vivo/);
    expect(await db.select().from(abonos)).toHaveLength(0);
  });

  it("un monto en cero se rechaza", async () => {
    await expect(
      registrarAbonoHistorico(db, { ...abono, monto: "0", dealId: deal, actorId: script }),
    ).rejects.toThrow(/mayor que cero/);
  });
});

describe("registrarLlamadaHistorica", () => {
  const llamada = {
    huella: "sheets:programa-a:Registro de llamadas:7",
    resultado: "show" as const,
    fechaLlamada: new Date("2026-08-10T15:00:00-05:00"),
    closer: "Maru",
    emailLead: "ana@correo.co",
  };

  it("sin deal entra suelta (origen sheets), con su resultado", async () => {
    const r = await registrarLlamadaHistorica(db, { ...llamada, programId: programa, actorId: script });
    expect(r.estado).toBe("creado");
    const [fila] = await db.select().from(calls);
    expect(fila).toMatchObject({ dealId: null, resultado: "show", origen: "sheets", closerId: "Maru" });
  });

  it("colgada de su deal, no mueve la etapa, y la segunda corrida no duplica", async () => {
    const r = await abrirDealHistorico(db, { leadId: lead, programId: programa, etapa: "contactado", huella: H("ana"), actorId: script });
    const dealId = (r as { dealId: string }).dealId;

    const primera = await registrarLlamadaHistorica(db, { ...llamada, dealId, programId: programa, actorId: script });
    const segunda = await registrarLlamadaHistorica(db, { ...llamada, dealId, programId: programa, actorId: script });

    expect(segunda).toEqual({ estado: "ya_migrado", id: primera.id });
    expect(await db.select().from(calls)).toHaveLength(1);
    const [d] = await db.select().from(deals).where(eq(deals.id, dealId));
    expect(d.etapa).toBe("contactado");
  });

  it("el programa es frontera: no se cuelga de un deal de otro programa", async () => {
    const r = await abrirDealHistorico(db, { leadId: lead, programId: programa, etapa: "contactado", huella: H("ana"), actorId: script });
    const dealId = (r as { dealId: string }).dealId;

    await expect(
      registrarLlamadaHistorica(db, { ...llamada, dealId, programId: otroPrograma, actorId: script }),
    ).rejects.toThrow(/otro programa/);
  });
});

describe("duenoDesdeLaHoja (ADR 0059 punto 5)", () => {
  it("el nombre de la hoja da el dueño si es una closer del programa, con la comparacion de siempre", async () => {
    expect(await duenoDesdeLaHoja(db, programa, "  maru ")).toBe(maru);
  });

  it("un nombre que no es usuario del CRM deja el deal sin dueño", async () => {
    expect(await duenoDesdeLaHoja(db, programa, "Jero")).toBeNull();
    expect(await duenoDesdeLaHoja(db, programa, "")).toBeNull();
  });

  it("una closer sin membresia en el programa no es dueña posible ahi", async () => {
    expect(await duenoDesdeLaHoja(db, otroPrograma, "Maru")).toBeNull();
  });
});

/**
 * Ticket 078, rendimiento: la migracion escribe en LOTE. Con ~90 ms por viaje a la base, fila
 * por fila la corrida de ComunicArte tardo 40 minutos con una transaccion abierta en
 * produccion. El lote tiene que decidir exactamente lo mismo que la fila suelta.
 */
describe("en lote (ticket 078)", () => {
  let beto: string;
  let caro: string;

  beforeEach(async () => {
    const otros = await db
      .insert(leads)
      .values([
        { programId: programa, emailNormalizado: "beto@correo.co", nombre: "Beto" },
        { programId: programa, emailNormalizado: "caro@correo.co", nombre: "Caro" },
      ])
      .returning();
    [beto, caro] = otros.map((l) => l.id);
  });

  it("en una sola llamada: creado, ya migrado, gana el vivo, y el orden de la respuesta es el de las altas", async () => {
    const previo = await abrirDealHistorico(db, { leadId: lead, programId: programa, etapa: "ganado_completo", huella: H("ana"), actorId: script });
    const vivo = await abrirDeal(db, { leadId: beto, programId: programa, etapa: "registrado", actor: { tipo: "sistema" } });

    const r = await abrirDealesHistoricos(db, [
      { leadId: caro, programId: programa, etapa: "contactado", huella: H("caro"), actorId: script, notas: [{ texto: "hola" }] },
      { leadId: lead, programId: programa, etapa: "ganado_completo", huella: H("ana"), actorId: script },
      { leadId: beto, programId: programa, etapa: "contactado", huella: H("beto"), actorId: script, notas: [{ texto: "no" }] },
    ]);

    expect(r[0].estado).toBe("creado");
    expect(r[1]).toEqual({ estado: "ya_migrado", dealId: (previo as { dealId: string }).dealId });
    expect(r[2]).toEqual({ estado: "lead_con_deal_vivo", dealVivoId: vivo });
    // Del que choco no queda ni historial, ni nota, ni bitacora.
    expect(await db.select().from(deals)).toHaveLength(3);
    expect(await db.select().from(dealEtapaHistorial)).toHaveLength(3);
    const notas = await db.select().from(dealActividades);
    expect(notas.map((n) => n.nota)).toEqual(["hola"]);
    const deCaro = (r[0] as { dealId: string }).dealId;
    const rastro = await db.select().from(changeLog).where(eq(changeLog.tabla, "deals"));
    const registros = new Set(rastro.map((f) => f.registroId));
    expect(registros.has(deCaro)).toBe(true);
    expect(rastro.filter((f) => f.registroId === deCaro).every((f) => f.userId === script && f.etiqueta === "Caro")).toBe(true);
  });

  it("dos altas del mismo lead en el lote: la segunda choca con la primera, como corriendo una tras otra", async () => {
    const r = await abrirDealesHistoricos(db, [
      { leadId: caro, programId: programa, etapa: "contactado", huella: H("caro:1"), actorId: script },
      { leadId: caro, programId: programa, etapa: "registrado", huella: H("caro:2"), actorId: script },
    ]);
    expect(r[0].estado).toBe("creado");
    expect(r[1]).toEqual({ estado: "lead_con_deal_vivo", dealVivoId: (r[0] as { dealId: string }).dealId });
  });

  it("una sola alta fuera de la frontera tumba el lote entero, sin escribir nada", async () => {
    const [ajeno] = await db
      .insert(leads)
      .values({ programId: otroPrograma, emailNormalizado: "zoe@correo.co" })
      .returning();
    await expect(
      abrirDealesHistoricos(db, [
        { leadId: caro, programId: programa, etapa: "contactado", huella: H("caro"), actorId: script },
        { leadId: ajeno.id, programId: programa, etapa: "contactado", huella: H("zoe"), actorId: script },
      ]),
    ).rejects.toThrow(/otro programa/);
    expect(await db.select().from(deals)).toHaveLength(0);
    expect(await db.select().from(changeLog)).toHaveLength(0);
  });

  it("abonos y llamadas: la segunda corrida del lote no duplica ni deja bitacora nueva", async () => {
    const [d] = await abrirDealesHistoricos(db, [
      { leadId: caro, programId: programa, etapa: "compromiso_verbal", huella: H("caro"), actorId: script },
    ]);
    const dealId = (d as { dealId: string }).dealId;
    const listaAbonos = [1, 2].map((n) => ({ dealId, huella: H(`caro:abono:${n}`), actorId: script, fecha: "2026-08-18", monto: "100" }));
    const listaLlamadas = [
      { programId: programa, dealId, huella: H("caro:llamada"), actorId: script, resultado: "show" as const },
      { programId: programa, huella: H("suelta"), actorId: script, resultado: "no_show" as const },
    ];

    const a1 = await registrarAbonosHistoricos(db, listaAbonos);
    const l1 = await registrarLlamadasHistoricas(db, listaLlamadas);
    const bitacora = (await db.select().from(changeLog)).length;
    const a2 = await registrarAbonosHistoricos(db, listaAbonos);
    const l2 = await registrarLlamadasHistoricas(db, listaLlamadas);

    expect(a1.map((r) => r.estado)).toEqual(["creado", "creado"]);
    expect(l1.map((r) => r.estado)).toEqual(["creado", "creado"]);
    expect(a2).toEqual(a1.map((r) => ({ estado: "ya_migrado", id: r.id })));
    expect(l2).toEqual(l1.map((r) => ({ estado: "ya_migrado", id: r.id })));
    expect(await db.select().from(abonos)).toHaveLength(2);
    expect(await db.select().from(calls)).toHaveLength(2);
    expect((await db.select().from(changeLog)).length).toBe(bitacora);
    // No mueve la etapa.
    const [deal] = await db.select().from(deals).where(eq(deals.id, dealId));
    expect(deal.etapa).toBe("compromiso_verbal");
  });
});
