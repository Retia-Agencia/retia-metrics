import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";
import { and, eq, sql } from "drizzle-orm";
import {
  abonos,
  calls,
  changeLog,
  cohorts,
  dealActividades,
  dealEtapaHistorial,
  deals,
  leads,
  miembrosPrograma,
  productos,
  programs,
  rarezasMigracion,
  users,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { abrirDeal } from "@/lib/deals/mover-etapa";
import { reclamarDeal } from "@/lib/deals/reclamar";
import { deshacerMigracion } from "@/lib/migracion/deshacer";
import { importarGestion } from "@/lib/migracion/importar";
import { extraccionVacia, type DealTemplate, type Extraccion } from "@/lib/migracion/template";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { archivos, sinComentarios } from "./helpers/codigo-fuente";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * Ticket 127 — la reversa nivel 3 del corte (`operations.md` §12.3): deshacer la migracion de
 * UN programa por su huella. Lo que se prueba es la promesa entera: borra lo migrado y nada
 * mas (ni lo del webhook, ni el otro programa), deja rastro, y se NIEGA sin borrar nada en
 * cuanto alguien trabajo encima, porque ahi ya es historia y se anula (ADR 0038).
 */

let db: Db;
let cerrar: () => Promise<void>;
let script: string;
let maru: string;

interface Programa {
  id: string;
  slug: string;
}
let a: Programa;
let b: Programa;

async function crearPrograma(slug: string): Promise<Programa> {
  const [p] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug, nombre: slug, ticketUsd: "1500" }).returning();
  await db.insert(cohorts).values({
    programId: p.id,
    codigo: "C1",
    metaCupos: 30,
    precioUsd: "1500",
    fechaInicioVentas: "2026-07-01",
    fechaCierreVentas: "2026-08-18",
    fechaInicioClases: "2026-08-20",
    estado: "cerrado",
  });
  await db.insert(productos).values({ programId: p.id, nombre: "Programa", precioLista: "1500" });
  await db.insert(miembrosPrograma).values({ userId: maru, programId: p.id, activo: true });
  await db
    .insert(leads)
    .values(["ana@c.co", "beto@c.co", "caro@c.co"].map((e) => ({ programId: p.id, emailNormalizado: e })));
  return { id: p.id, slug };
}

function template(slug: string): Extraccion {
  const deal = (correo: string, extra: Partial<DealTemplate> = {}): DealTemplate => ({
    huella: `sheets:${slug}:setteo:${correo}`,
    correo,
    etapa: "en_contacto",
    closer: "Maru",
    fechaEtapa: "2026-08-05T05:00:00.000Z",
    cohorte: null,
    precio: null,
    acuerdoPago: null,
    mailOnboarding: false,
    notas: [{ texto: "le escribí", fecha: "2026-08-05T05:00:00.000Z" }],
    ...extra,
  });
  const t = extraccionVacia();
  t.deals.push(
    // Sin closer en la hoja: nace sin dueño y se puede reclamar.
    deal("ana@c.co", { closer: null }),
    deal("beto@c.co", { huella: `sheets:${slug}:estudiantes-julio:beto@c.co`, etapa: "completo", cohorte: "C1", precio: "1500.00", notas: [] }),
  );
  t.abonos.push({
    huella: `sheets:${slug}:estudiantes-julio:beto@c.co:abono`,
    dealHuella: `sheets:${slug}:estudiantes-julio:beto@c.co`,
    fecha: "2026-08-01",
    monto: "1500.00",
    plataforma: "mercadopago",
    closer: "Jero",
  });
  t.llamadas.push(
    { huella: `sheets:${slug}:registro:2`, correo: "beto@c.co", fecha: null, closer: "Andrea", resultado: "cerrada", categoria: null, subcategoria: null, link: null, notas: null },
    // Suelta: caro no tiene deal migrado.
    { huella: `sheets:${slug}:registro:3`, correo: "caro@c.co", fecha: null, closer: "Andrea", resultado: "no_show", categoria: null, subcategoria: null, link: null, notas: null },
  );
  t.rarezas.push({ huella: `sheets:${slug}:registro:3`, tipo: "fecha_aproximada", detalle: "sin fecha" });
  return t;
}

async function migrar(p: Programa) {
  await importarGestion(db, template(p.slug), { programId: p.id, actorId: script });
}

/** Lo que hay de un programa, contando anulados: la reversa no mira metricas, mira filas. */
async function conteos(programId: string) {
  const n = async (q: Promise<{ n: number }[]>) => (await q)[0].n;
  const c = sql<number>`count(*)::int`;
  return {
    deals: await n(db.select({ n: c }).from(deals).where(eq(deals.programId, programId))),
    abonos: await n(db.select({ n: c }).from(abonos).where(eq(abonos.programId, programId))),
    llamadas: await n(db.select({ n: c }).from(calls).where(eq(calls.programId, programId))),
    historial: await n(
      db.select({ n: c }).from(dealEtapaHistorial).innerJoin(deals, eq(deals.id, dealEtapaHistorial.dealId)).where(eq(deals.programId, programId)),
    ),
    actividades: await n(
      db.select({ n: c }).from(dealActividades).innerJoin(deals, eq(deals.id, dealActividades.dealId)).where(eq(deals.programId, programId)),
    ),
    rarezas: await n(db.select({ n: c }).from(rarezasMigracion).where(eq(rarezasMigracion.programId, programId))),
    leads: await n(db.select({ n: c }).from(leads).where(eq(leads.programId, programId))),
  };
}

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  const [s] = await db.insert(users).values({ email: "script@retiagrowth.com", rol: "developer" }).returning();
  script = s.id;
  const [m] = await db.insert(users).values({ email: "maru@retiagrowth.com", rol: "closer", closerId: "Maru" }).returning();
  maru = m.id;
  a = await crearPrograma("prog-a");
  b = await crearPrograma("prog-b");
});

afterEach(async () => {
  await cerrar();
});

describe("deshacerMigracion", () => {
  it("deja el programa como antes de migrar, con lo del webhook y el otro programa intactos", async () => {
    // Lo que entró por el webhook antes de migrar: un deal nativo y una llamada de Calendly.
    const [caro] = await db.select({ id: leads.id }).from(leads).where(and(eq(leads.programId, a.id), eq(leads.emailNormalizado, "caro@c.co")));
    await abrirDeal(db, { leadId: caro.id, programId: a.id, etapa: "pendiente_setteo", actor: { tipo: "sistema" } });
    await db.insert(calls).values({ programId: a.id, origen: "calendly", huellaFila: "calendly:uuid-1", resultado: "agendada", emailLead: "caro@c.co" });
    const antes = await conteos(a.id);

    await migrar(a);
    await migrar(b);
    const deB = await conteos(b.id);
    const migrado = await conteos(a.id);
    expect(migrado.deals).toBe(antes.deals + 2);
    expect(migrado.abonos).toBe(1);
    expect(migrado.llamadas).toBe(antes.llamadas + 2);

    const r = await deshacerMigracion(db, { programId: a.id, actorId: script });

    expect(r).toEqual({
      estado: "deshecho",
      borrado: { deals: 2, historial: 2, actividades: 1, abonos: 1, llamadas: 2, rarezas: migrado.rarezas },
    });
    expect(await conteos(a.id)).toEqual({ ...antes, rarezas: 0 });
    expect(await conteos(b.id)).toEqual(deB);
  });

  it("deja rastro de cada registro borrado, con su huella y el actor del script", async () => {
    await migrar(a);
    await deshacerMigracion(db, { programId: a.id, actorId: script });

    const rastro = await db.select().from(changeLog).where(eq(changeLog.campo, "reversa_migracion"));
    expect(rastro.map((f) => f.tabla).sort()).toEqual(["abonos", "calls", "calls", "deal_actividades", "deals", "deals"]);
    expect(rastro.every((f) => f.userId === script && f.valorAnterior?.startsWith("sheets:prog-a:"))).toBe(true);
  });

  it("despues de deshacer, la migracion se puede volver a correr limpia", async () => {
    await migrar(a);
    const migrado = await conteos(a.id);
    await deshacerMigracion(db, { programId: a.id, actorId: script });
    await migrar(a);
    expect(await conteos(a.id)).toEqual(migrado);
  });

  it("dentro de una transaccion deshecha (el ensayo) no borra nada", async () => {
    await migrar(a);
    const migrado = await conteos(a.id);
    const ENSAYO = new Error("ensayo");
    await expect(
      (db as unknown as { transaction: <T>(fn: (tx: Db) => Promise<T>) => Promise<T> }).transaction(async (tx) => {
        const r = await deshacerMigracion(tx, { programId: a.id, actorId: script });
        expect(r.estado).toBe("deshecho");
        throw ENSAYO;
      }),
    ).rejects.toBe(ENSAYO);
    expect(await conteos(a.id)).toEqual(migrado);
  });
});

describe("deshacerMigracion se niega si alguien trabajo encima", () => {
  async function dealMigrado(correo: string) {
    const [d] = await db.select().from(deals).where(and(eq(deals.programId, a.id), sql`${deals.huellaMigracion} like ${"%" + correo}`));
    return d;
  }

  async function esperarNegativa(motivo: string) {
    const antes = await conteos(a.id);
    const r = await deshacerMigracion(db, { programId: a.id, actorId: script });
    expect(r.estado).toBe("negado");
    expect(r.estado === "negado" && r.motivos).toHaveProperty(motivo);
    expect(await conteos(a.id)).toEqual(antes);
    expect(await db.select().from(changeLog).where(eq(changeLog.campo, "reversa_migracion"))).toEqual([]);
  }

  beforeEach(async () => {
    await migrar(a);
  });

  it("un closer reclamó un deal migrado", async () => {
    const d = await dealMigrado("ana@c.co");
    await reclamarDeal(db, { userId: maru, rol: "closer" }, { dealId: d.id });
    await esperarNegativa("editado_despues");
  });

  it("un abono del CRM sobre un deal migrado", async () => {
    const d = await dealMigrado("beto@c.co");
    await db.insert(abonos).values({ dealId: d.id, programId: a.id, fecha: "2026-09-01", monto: "100.00", origen: "app" });
    await esperarNegativa("abono_del_crm");
  });

  it("una llamada de Calendly colgada de un deal migrado", async () => {
    const d = await dealMigrado("ana@c.co");
    await db.insert(calls).values({ dealId: d.id, programId: a.id, origen: "calendly", huellaFila: "calendly:uuid-2", resultado: "agendada" });
    await esperarNegativa("llamada_del_crm");
  });

  it("alguien movió la etapa", async () => {
    const d = await dealMigrado("ana@c.co");
    await db.insert(dealEtapaHistorial).values({ dealId: d.id, de: "en_contacto", a: "agendado", userId: maru });
    await esperarNegativa("etapa_movida");
  });

  it("una persona registró una actividad", async () => {
    const d = await dealMigrado("ana@c.co");
    await db.insert(dealActividades).values({ dealId: d.id, tipo: "contacto", userId: maru, canal: "whatsapp" });
    await esperarNegativa("actividad_de_una_persona");
  });

  it("alguien anuló un deal migrado", async () => {
    const d = await dealMigrado("ana@c.co");
    await db.update(deals).set({ anuladoEn: new Date(), anuladoPor: maru, motivoAnulacion: "error" }).where(eq(deals.id, d.id));
    await esperarNegativa("deal_anulado");
  });
});

describe("guardian: solo la reversa borra filas operativas", () => {
  const RAIZ = fileURLToPath(new URL("../", import.meta.url));
  const AUTORIZADO = path.join("lib", "migracion", "deshacer.ts");
  const TABLAS = ["deals", "calls", "abonos", "dealActividades", "dealEtapaHistorial"];
  const patron = new RegExp(`\\.delete\\(\\s*(${TABLAS.join("|")})\\s*\\)`);
  const borra = (fuente: string) => patron.test(sinComentarios(fuente));

  it("ningun otro archivo de lib/, app/, components/ ni scripts/ borra deals, llamadas, abonos, actividades ni historial", () => {
    const culpables = ["lib", "app", "components", "scripts"]
      .flatMap((d) => archivos(path.join(RAIZ, d)))
      .map((f) => path.relative(RAIZ, f))
      .filter((f) => f !== AUTORIZADO)
      .filter((f) => borra(fs.readFileSync(path.join(RAIZ, f), "utf8")));
    expect(culpables).toEqual([]);
  });

  it("muerde: caza el borrado y no marca otras tablas", () => {
    expect(borra("await db.delete(deals).where(x)")).toBe(true);
    expect(borra("tx.delete( abonos )")).toBe(true);
    expect(borra("db.delete(entregasWebhook)")).toBe(false);
    expect(borra("// db.delete(deals)")).toBe(false);
  });
});
