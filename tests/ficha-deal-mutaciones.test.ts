import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import {
  calls,
  changeLog,
  cohorts,
  dealActividades,
  deals,
  leads,
  miembrosPrograma,
  motivos,
  productos,
  programs,
  users,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import type { EtapaDeal } from "@/lib/deals/etapas";
import { registrarAbono, anularAbono } from "@/lib/deals/abonos";
import { registrarActividad } from "@/lib/deals/actividades";
import { anularDeal } from "@/lib/deals/anular-deal";
import { editarDeal } from "@/lib/deals/editar-deal";
import { puedeTrabajarDeal } from "@/lib/deals/permiso";
import { ErrorDeApp } from "@/lib/errors";
import { embudoDelRango, vistaDeCohorteActiva } from "@/lib/queries/dashboard";
import { tableroKanban } from "@/lib/queries/kanban";
import { incluyendoAnulados } from "@/lib/queries/vigente";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * Ticket 074: las tres mutaciones NUEVAS de la ficha del deal (editar, anular, registrar
 * actividad) y la pregunta "¿puede este actor tocar este deal?", que ahora vive en un solo
 * modulo (`lib/deals/permiso.ts`).
 *
 * Producto de 1.000 USD. Cada mutacion: deja rastro en `change_log`, rechaza al closer ajeno,
 * deja pasar a quien administra (gerente y developer) y NO escribe nada cuando rechaza.
 */

let db: Db;
let cerrar: () => Promise<void>;
let programId: string;
let cohortId: string;
let productoId: string;
let leadN = 0;
let closer: string;
let otroCloser: string;
let gerente: string;
let developer: string;

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  const [p] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "p", nombre: "P", ticketUsd: "1000" }).returning();
  programId = p.id;
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
  const [u] = await db.insert(users).values({ email: "maru@retiagrowth.com", rol: "closer", closerId: "Maru" }).returning();
  closer = u.id;
  const [u2] = await db.insert(users).values({ email: "jero@retiagrowth.com", rol: "closer", closerId: "Jero" }).returning();
  otroCloser = u2.id;
  const [g] = await db.insert(users).values({ email: "gerente@retiagrowth.com", rol: "gerente" }).returning();
  gerente = g.id;
  const [d] = await db.insert(users).values({ email: "dev@retiagrowth.com", rol: "developer" }).returning();
  developer = d.id;
  await db.insert(miembrosPrograma).values([
    { userId: closer, programId },
    { userId: otroCloser, programId },
  ]);
}, 60_000);

afterEach(async () => {
  await cerrar();
});

const comoCloser = () => ({ userId: closer, rol: "closer" as const });
const comoOtroCloser = () => ({ userId: otroCloser, rol: "closer" as const });
const comoGerente = () => ({ userId: gerente, rol: "gerente" as const });
const comoDeveloper = () => ({ userId: developer, rol: "developer" as const });

async function nuevoDeal(etapa: EtapaDeal, extra: Partial<typeof deals.$inferInsert> = {}) {
  const [l] = await db
    .insert(leads)
    .values({ programId, emailNormalizado: `lead${++leadN}@correo.co`, nombre: `Lead ${leadN}` })
    .returning();
  const [d] = await db
    .insert(deals)
    .values({ leadId: l.id, programId, cohortId, etapa, ownerUserId: closer, productoId, ...extra })
    .returning();
  return d.id;
}

async function deal(dealId: string) {
  const [d] = await db.select().from(deals).where(and(eq(deals.id, dealId), incluyendoAnulados(deals)));
  return d;
}

async function rastro(dealId: string) {
  return db.select().from(changeLog).where(and(eq(changeLog.tabla, "deals"), eq(changeLog.registroId, dealId)));
}

async function capturar(p: Promise<unknown>): Promise<ErrorDeApp> {
  try {
    await p;
  } catch (e) {
    return e as ErrorDeApp;
  }
  throw new Error("se esperaba un error");
}

async function motivo(tipo: "perdida" | "reagenda", nombre: string) {
  const [m] = await db.insert(motivos).values({ nombre, tipo }).returning();
  return m.id;
}

describe("puedeTrabajarDeal: una sola respuesta", () => {
  it("el dueño y quien administra sí; otro closer y un deal sin dueño no", () => {
    expect(puedeTrabajarDeal(comoCloser(), { ownerUserId: closer })).toBe(true);
    expect(puedeTrabajarDeal(comoOtroCloser(), { ownerUserId: closer })).toBe(false);
    expect(puedeTrabajarDeal(comoCloser(), { ownerUserId: null })).toBe(false);
    expect(puedeTrabajarDeal(comoGerente(), { ownerUserId: closer })).toBe(true);
    expect(puedeTrabajarDeal(comoDeveloper(), { ownerUserId: null })).toBe(true);
  });
});

describe("editarDeal", () => {
  it("un campo tocado deja UNA fila de change_log, con el actor de la sesión", async () => {
    const dealId = await nuevoDeal("atendido");
    const [otro] = await db.insert(productos).values({ programId, nombre: "Otro", precioLista: "500" }).returning();

    const cambio = await editarDeal(db, comoCloser(), { dealId, productoId: otro.id });

    expect(cambio).toBe(true);
    expect((await deal(dealId)).productoId).toBe(otro.id);
    const filas = await rastro(dealId);
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({ campo: "productoId", valorAnterior: productoId, valorNuevo: otro.id, userId: closer });
  });

  it("varios campos: una fila por campo tocado; sin cambios no escribe ni rastro", async () => {
    const dealId = await nuevoDeal("atendido");
    await editarDeal(db, comoCloser(), { dealId, fechaSeguimiento: "2026-10-05", productoId });
    // El producto ya era ese: solo la fecha cambio.
    expect((await rastro(dealId)).map((f) => f.campo)).toEqual(["fechaSeguimiento"]);

    const otraVez = await editarDeal(db, comoCloser(), { dealId, fechaSeguimiento: "2026-10-05" });
    expect(otraVez).toBe(false);
    expect(await rastro(dealId)).toHaveLength(1);
  });

  it("la fecha de seguimiento se puede borrar con null", async () => {
    const dealId = await nuevoDeal("seguimiento", { fechaSeguimiento: "2026-10-05" });
    await editarDeal(db, comoCloser(), { dealId, fechaSeguimiento: null });
    expect((await deal(dealId)).fechaSeguimiento).toBeNull();
  });

  it("un closer ajeno es rechazado y la base no se mueve", async () => {
    const dealId = await nuevoDeal("atendido");
    const e = await capturar(editarDeal(db, comoOtroCloser(), { dealId, fechaSeguimiento: "2026-10-05" }));
    expect(e.status).toBe(403);
    expect((await deal(dealId)).fechaSeguimiento).toBeNull();
    expect(await rastro(dealId)).toHaveLength(0);
  });

  it("un deal sin dueño lo edita quien administra, no un closer", async () => {
    const dealId = await nuevoDeal("pendiente_setteo", { ownerUserId: null });
    expect((await capturar(editarDeal(db, comoCloser(), { dealId, fechaSeguimiento: "2026-10-05" }))).status).toBe(403);
    await editarDeal(db, comoGerente(), { dealId, fechaSeguimiento: "2026-10-05" });
    expect((await deal(dealId)).fechaSeguimiento).toBe("2026-10-05");
  });

  it("el gerente y el developer editan el deal de cualquiera", async () => {
    const a = await nuevoDeal("atendido");
    const b = await nuevoDeal("atendido");
    await editarDeal(db, comoGerente(), { dealId: a, fechaSeguimiento: "2026-10-06" });
    await editarDeal(db, comoDeveloper(), { dealId: b, fechaSeguimiento: "2026-10-07" });
    expect((await rastro(a))[0].userId).toBe(gerente);
    expect((await rastro(b))[0].userId).toBe(developer);
  });

  it("la etapa no se edita: un `etapa` en la entrada se ignora y no deja rastro", async () => {
    const dealId = await nuevoDeal("atendido");
    await editarDeal(db, comoCloser(), { dealId, etapa: "completo", fechaSeguimiento: "2026-10-05" } as never);
    expect((await deal(dealId)).etapa).toBe("atendido");
    expect((await rastro(dealId)).map((f) => f.campo)).toEqual(["fechaSeguimiento"]);
  });

  describe("el dueño", () => {
    it("un closer NO cambia el dueño (ni el suyo): eso es administrar", async () => {
      const dealId = await nuevoDeal("atendido");
      const e = await capturar(editarDeal(db, comoCloser(), { dealId, ownerUserId: otroCloser }));
      expect(e.status).toBe(403);
      expect((await deal(dealId)).ownerUserId).toBe(closer);
      expect(await rastro(dealId)).toHaveLength(0);
    });

    it("quien administra lo reasigna, con rastro", async () => {
      const dealId = await nuevoDeal("atendido");
      await editarDeal(db, comoGerente(), { dealId, ownerUserId: otroCloser });
      expect((await deal(dealId)).ownerUserId).toBe(otroCloser);
      const [fila] = await rastro(dealId);
      expect(fila).toMatchObject({ campo: "ownerUserId", valorAnterior: closer, valorNuevo: otroCloser, userId: gerente });
    });

    it("el dueño nuevo tiene que tener membresía ACTIVA en el programa del deal: la frontera no se cruza", async () => {
      const dealId = await nuevoDeal("agendado");
      const [ajeno] = await db.insert(users).values({ email: "otro@retiagrowth.com", rol: "closer", closerId: "Otro" }).returning();
      expect((await capturar(editarDeal(db, comoGerente(), { dealId, ownerUserId: ajeno.id }))).status).toBe(422);
      await db.update(miembrosPrograma).set({ activo: false }).where(eq(miembrosPrograma.userId, otroCloser));
      expect((await capturar(editarDeal(db, comoGerente(), { dealId, ownerUserId: otroCloser }))).status).toBe(422);
      expect((await deal(dealId)).ownerUserId).toBe(closer);
    });

    it("el dueño nuevo tiene que ser un closer activo", async () => {
      const dealId = await nuevoDeal("atendido");
      expect((await capturar(editarDeal(db, comoGerente(), { dealId, ownerUserId: gerente }))).status).toBe(422);
      await db.update(users).set({ activo: false }).where(eq(users.id, otroCloser));
      expect((await capturar(editarDeal(db, comoGerente(), { dealId, ownerUserId: otroCloser }))).status).toBe(422);
      expect((await deal(dealId)).ownerUserId).toBe(closer);
    });
  });

  describe("el motivo", () => {
    it("solo tiene sentido en Cierre Perdido", async () => {
      const m = await motivo("perdida", "Sin dinero");
      const dealId = await nuevoDeal("atendido");
      const e = await capturar(editarDeal(db, comoCloser(), { dealId, motivoId: m }));
      expect(e.status).toBe(409);
      expect((await deal(dealId)).motivoId).toBeNull();
    });

    it("en Cierre Perdido cambia el motivo, y tiene que ser de la lista de pérdida", async () => {
      const antes = await motivo("perdida", "Sin dinero");
      const despues = await motivo("perdida", "No era para él");
      const deReagenda = await motivo("reagenda", "Viaje");
      const dealId = await nuevoDeal("cierre_perdido", { motivoId: antes });

      expect((await capturar(editarDeal(db, comoCloser(), { dealId, motivoId: deReagenda }))).status).toBe(422);
      expect((await capturar(editarDeal(db, comoCloser(), { dealId, motivoId: null }))).status).toBe(422);
      await editarDeal(db, comoCloser(), { dealId, motivoId: despues });

      expect((await deal(dealId)).motivoId).toBe(despues);
      expect((await rastro(dealId)).map((f) => f.campo)).toEqual(["motivoId"]);
    });
  });

  describe("el producto", () => {
    it("uno de otro programa no existe para este deal", async () => {
      const [otroPrograma] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "q", nombre: "Q", ticketUsd: "500" }).returning();
      const [ajeno] = await db.insert(productos).values({ programId: otroPrograma.id, nombre: "Ajeno", precioLista: "500" }).returning();
      const dealId = await nuevoDeal("atendido");
      expect((await capturar(editarDeal(db, comoCloser(), { dealId, productoId: ajeno.id }))).status).toBe(422);
      expect((await deal(dealId)).productoId).toBe(productoId);
    });

    it("uno mas barato que lo ya abonado se rechaza: no se fabrica un sobrepago", async () => {
      const dealId = await nuevoDeal("atendido");
      await registrarAbono(db, comoCloser(), { dealId, fecha: "2026-09-28", monto: "600", comprobanteUrl: "https://drive.google.com/c" });
      const [barato] = await db.insert(productos).values({ programId, nombre: "Barato", precioLista: "500" }).returning();
      const e = await capturar(editarDeal(db, comoCloser(), { dealId, productoId: barato.id }));
      expect(e.status).toBe(422);
      expect((await deal(dealId)).productoId).toBe(productoId);
    });
  });

  it("un deal anulado no se edita", async () => {
    const dealId = await nuevoDeal("atendido");
    await anularDeal(db, comoCloser(), { dealId, motivo: "lo registré mal" });
    expect((await capturar(editarDeal(db, comoGerente(), { dealId, fechaSeguimiento: "2026-10-05" }))).status).toBe(409);
  });
});

describe("anularDeal", () => {
  it("escribe la marca con quién, cuándo y por qué, y deja rastro de los tres campos", async () => {
    const dealId = await nuevoDeal("atendido");
    await anularDeal(db, comoCloser(), { dealId, motivo: "  Lo registré sobre el lead equivocado  " });

    const d = await deal(dealId);
    expect(d.anuladoEn).toBeInstanceOf(Date);
    expect(d.anuladoPor).toBe(closer);
    expect(d.motivoAnulacion).toBe("Lo registré sobre el lead equivocado");
    // La marca es ortogonal: la etapa en que estaba se conserva (ADR 0038).
    expect(d.etapa).toBe("atendido");
    const filas = await rastro(dealId);
    expect(filas.map((f) => f.campo).sort()).toEqual(["anuladoEn", "anuladoPor", "motivoAnulacion"]);
    expect(filas.every((f) => f.userId === closer)).toBe(true);
  });

  it("sin motivo no se anula (o con uno que no dice nada)", async () => {
    const dealId = await nuevoDeal("atendido");
    expect((await capturar(anularDeal(db, comoCloser(), { dealId, motivo: "" }))).status).toBe(400);
    expect((await capturar(anularDeal(db, comoCloser(), { dealId, motivo: "   " }))).status).toBe(400);
    expect((await capturar(anularDeal(db, comoCloser(), { dealId, motivo: "no" }))).status).toBe(400);
    expect((await deal(dealId)).anuladoEn).toBeNull();
    expect(await rastro(dealId)).toHaveLength(0);
  });

  it("un closer NO anula el deal de otro ni uno sin dueño", async () => {
    const ajeno = await nuevoDeal("atendido");
    const sinDueno = await nuevoDeal("pendiente_setteo", { ownerUserId: null });
    expect((await capturar(anularDeal(db, comoOtroCloser(), { dealId: ajeno, motivo: "quiero anularlo" }))).status).toBe(403);
    expect((await capturar(anularDeal(db, comoCloser(), { dealId: sinDueno, motivo: "quiero anularlo" }))).status).toBe(403);
    expect((await deal(ajeno)).anuladoEn).toBeNull();
    expect((await deal(sinDueno)).anuladoEn).toBeNull();
  });

  it("el gerente y el developer anulan el deal de cualquiera", async () => {
    const a = await nuevoDeal("atendido");
    const b = await nuevoDeal("atendido", { ownerUserId: null });
    await anularDeal(db, comoGerente(), { dealId: a, motivo: "duplicado con otro deal" });
    await anularDeal(db, comoDeveloper(), { dealId: b, motivo: "duplicado con otro deal" });
    expect((await deal(a)).anuladoPor).toBe(gerente);
    expect((await deal(b)).anuladoPor).toBe(developer);
  });

  it("anular dos veces es un error claro", async () => {
    const dealId = await nuevoDeal("atendido");
    await anularDeal(db, comoCloser(), { dealId, motivo: "lo registré mal" });
    const e = await capturar(anularDeal(db, comoCloser(), { dealId, motivo: "otra vez" }));
    expect(e.status).toBe(409);
    expect(e.message).toMatch(/ya está anulado/);
    expect((await deal(dealId)).motivoAnulacion).toBe("lo registré mal");
  });

  it("con abonos VIGENTES se rechaza: el dinero no desaparece en silencio; sin ellos, sí", async () => {
    const dealId = await nuevoDeal("atendido");
    const { abonoId } = await registrarAbono(db, comoCloser(), {
      dealId,
      fecha: "2026-09-28",
      monto: "300",
      comprobanteUrl: "https://drive.google.com/c",
    });

    const e = await capturar(anularDeal(db, comoCloser(), { dealId, motivo: "lo registré mal" }));
    expect(e.status).toBe(409);
    expect(e.message).toMatch(/anula primero los abonos/);
    expect((await deal(dealId)).anuladoEn).toBeNull();

    await anularAbono(db, comoCloser(), { abonoId, motivo: "pago mal tecleado" });
    await anularDeal(db, comoCloser(), { dealId, motivo: "lo registré mal" });
    expect((await deal(dealId)).anuladoEn).toBeInstanceOf(Date);
  });

  it("el deal anulado deja de contar en el dashboard y en el Kanban (la cifra, antes y después)", async () => {
    // Un deal vendido de la cohorte activa (Completo) y uno abierto.
    const vendido = await nuevoDeal("completo");
    await nuevoDeal("atendido");

    const antes = await vistaDeCohorteActiva({ programId }, "2026-09-15", db);
    const tableroAntes = await tableroKanban(db, programId, {}, "2026-09-15");
    expect(antes?.vendidos).toBe(1);
    expect(tableroAntes.total).toBe(2);

    await anularDeal(db, comoGerente(), { dealId: vendido, motivo: "lo registré sobre el lead equivocado" });

    const despues = await vistaDeCohorteActiva({ programId }, "2026-09-15", db);
    const tableroDespues = await tableroKanban(db, programId, {}, "2026-09-15");
    expect(despues?.vendidos).toBe(0);
    expect(tableroDespues.total).toBe(1);
  });

  it("sus llamadas vigentes se anulan con él, con rastro: dejan de contar en el embudo", async () => {
    const dealId = await nuevoDeal("atendido");
    await db.insert(calls).values([
      { dealId, programId, fechaAgenda: new Date("2026-09-15T15:00:00Z"), resultado: "show", origen: "crm" },
      { dealId, programId, fechaAgenda: new Date("2026-09-16T15:00:00Z"), resultado: "cerrada", origen: "crm" },
    ]);
    const rango = { desde: "2026-09-01", hasta: "2026-09-30" };
    const antes = await embudoDelRango({ programId, rango }, db);
    expect(antes.agendas).toBe(2);

    await anularDeal(db, comoCloser(), { dealId, motivo: "lo registré sobre el lead equivocado" });

    const despues = await embudoDelRango({ programId, rango }, db);
    expect(despues).toMatchObject({ agendas: 0, llamadasConShow: 0, cierres: 0 });
    const llamadas = await db.select().from(calls).where(and(eq(calls.dealId, dealId), incluyendoAnulados(calls)));
    for (const l of llamadas) {
      expect(l.anuladoPor).toBe(closer);
      expect(l.motivoAnulacion).toBe("Se anuló su deal: lo registré sobre el lead equivocado");
    }
    const rastro = await db.select().from(changeLog).where(and(eq(changeLog.tabla, "calls"), eq(changeLog.campo, "anuladoEn")));
    expect(rastro).toHaveLength(2);
  });

  it("anular NO es Cierre Perdido: un cierre perdido sigue contando en el tablero", async () => {
    const perdido = await nuevoDeal("cierre_perdido");
    const otro = await nuevoDeal("atendido");
    await anularDeal(db, comoCloser(), { dealId: otro, motivo: "lo registré mal" });
    const tablero = await tableroKanban(db, programId, {}, "2026-09-15");
    const ids = tablero.columnas.flatMap((c) => c.tarjetas.map((t) => t.dealId));
    expect(ids).toEqual([perdido]);
  });
});

describe("registrarActividad", () => {
  it("un contacto queda con su autor, su canal y su rastro, y NO mueve la etapa", async () => {
    const dealId = await nuevoDeal("pendiente_setteo");
    const id = await registrarActividad(db, comoCloser(), { dealId, tipo: "contacto", canal: " WhatsApp ", nota: "Le escribí, quedó de responder" });

    const [a] = await db.select().from(dealActividades).where(eq(dealActividades.id, id));
    expect(a).toMatchObject({ dealId, tipo: "contacto", canal: "WhatsApp", userId: closer, nota: "Le escribí, quedó de responder" });
    expect((await deal(dealId)).etapa).toBe("pendiente_setteo");
    const filas = await db
      .select()
      .from(changeLog)
      .where(and(eq(changeLog.tabla, "deal_actividades"), eq(changeLog.registroId, id)));
    expect(filas.length).toBeGreaterThan(0);
    expect(filas.every((f) => f.userId === closer)).toBe(true);
  });

  it("el canal es libre y vacío es null; una nota puede ir sin canal", async () => {
    const dealId = await nuevoDeal("atendido");
    const id = await registrarActividad(db, comoCloser(), { dealId, tipo: "nota", canal: "  ", nota: "Se ve interesado" });
    const [a] = await db.select().from(dealActividades).where(eq(dealActividades.id, id));
    expect(a.canal).toBeNull();
    const id2 = await registrarActividad(db, comoCloser(), { dealId, tipo: "nota", canal: "Telegram", nota: "Otro canal" });
    const [b] = await db.select().from(dealActividades).where(eq(dealActividades.id, id2));
    expect(b.canal).toBe("Telegram");
  });

  it("sin nota no se registra", async () => {
    const dealId = await nuevoDeal("atendido");
    expect((await capturar(registrarActividad(db, comoCloser(), { dealId, tipo: "nota", nota: "   " }))).status).toBe(400);
    expect(await db.select().from(dealActividades)).toHaveLength(0);
  });

  it("un closer ajeno es rechazado; quien administra puede", async () => {
    const dealId = await nuevoDeal("atendido");
    expect((await capturar(registrarActividad(db, comoOtroCloser(), { dealId, tipo: "nota", nota: "hola" }))).status).toBe(403);
    expect(await db.select().from(dealActividades)).toHaveLength(0);
    await registrarActividad(db, comoGerente(), { dealId, tipo: "nota", nota: "seguimiento del gerente" });
    await registrarActividad(db, comoDeveloper(), { dealId, tipo: "nota", nota: "seguimiento del developer" });
    expect(await db.select().from(dealActividades)).toHaveLength(2);
  });

  it("un deal cerrado admite notas (por qué se perdió se escribe DESPUÉS); uno anulado no", async () => {
    const perdido = await nuevoDeal("cierre_perdido");
    await registrarActividad(db, comoCloser(), { dealId: perdido, tipo: "nota", nota: "Dijo que no por precio" });
    const anulado = await nuevoDeal("atendido");
    await anularDeal(db, comoCloser(), { dealId: anulado, motivo: "lo registré mal" });
    expect((await capturar(registrarActividad(db, comoCloser(), { dealId: anulado, tipo: "nota", nota: "hola" }))).status).toBe(409);
  });
});
