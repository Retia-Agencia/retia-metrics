import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { calls, cuentasPublicitarias, deals, gastoPauta, leads, pautaObjetos, programs, sources, submissions, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { costoPorAgendaDelCrm } from "@/lib/queries/hechos/costo-agenda-crm";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { FECHA_LEAD_DE_PRUEBA } from "./helpers/crear-lead-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

describe("costoPorAgendaDelCrm", () => {
  let db: Db;
  let cerrar: () => Promise<void>;
  let vaciar: () => Promise<void>;

  beforeAll(async () => ({ db, cerrar, vaciar } = await crearBaseReutilizable()));
  beforeEach(async () => vaciar());
  afterAll(async () => cerrar());

  async function programa(slug: string) {
    const [p] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug, nombre: slug, ticketUsd: "1000" }).returning();
    const [fuente] = await db.insert(sources).values({ programId: p.id, nombre: `Fuente ${slug}` }).returning();
    const [cuenta] = await db.insert(cuentasPublicitarias).values({
      programId: p.id, idMeta: `cuenta-${slug}`, nombre: "Cuenta", moneda: "COP", zonaHoraria: "America/Bogota",
    }).returning();
    return { id: p.id, fuenteId: fuente.id, cuentaId: cuenta.id };
  }

  async function campana(p: Awaited<ReturnType<typeof programa>>, clave: string, proposito: "agenda" | "lanzamiento" | null) {
    const [c] = await db.insert(pautaObjetos).values({
      cuentaId: p.cuentaId, programId: p.id, idMeta: `camp-${clave}`, nivel: "campana",
      nombre: clave, estado: "ACTIVE", proposito,
    }).returning();
    const [conjunto] = await db.insert(pautaObjetos).values({
      cuentaId: p.cuentaId, programId: p.id, idMeta: `set-${clave}`, nivel: "conjunto",
      padreIdMeta: c.idMeta, nombre: `Set ${clave}`, estado: "ACTIVE",
    }).returning();
    return (await db.insert(pautaObjetos).values({
      cuentaId: p.cuentaId, programId: p.id, idMeta: `ad-${clave}`, nivel: "anuncio",
      padreIdMeta: conjunto.idMeta, nombre: `Ad ${clave}`, estado: "ACTIVE",
    }).returning())[0];
  }

  async function agenda(p: Awaited<ReturnType<typeof programa>>, token: string, medium: string, extra = {}) {
    const [lead] = await db.insert(leads).values({
      programId: p.id, fechaPrimeraAplicacion: FECHA_LEAD_DE_PRUEBA, emailNormalizado: `${token}@test.co`,
    }).returning();
    const [envio] = await db.insert(submissions).values({
      sourceId: p.fuenteId, leadId: lead.id, token, utmSource: "meta", utmMedium: medium,
      fechaEnvio: new Date("2026-11-05T10:00:00-05:00"),
    }).returning();
    const [deal] = await db.insert(deals).values({ programId: p.id, leadId: lead.id, submissionOrigenId: envio.id }).returning();
    await db.insert(calls).values({
      programId: p.id, dealId: deal.id, createdAt: new Date("2026-11-05T11:00:00-05:00"), ...extra,
    });
  }

  it("separa agenda, lanzamiento y otras campañas y cuenta solo agendas paid vigentes del programa", async () => {
    const p = await programa("principal");
    const otro = await programa("otro");
    const adAgenda = await campana(p, "agenda", "agenda");
    const adLanzamiento = await campana(p, "lanzamiento", "lanzamiento");
    const adOtra = await campana(p, "otra", null);
    const adAjeno = await campana(otro, "ajeno", "agenda");
    const [actor] = await db.insert(users).values({ email: "actor@test.co", rol: "developer" }).returning();
    await db.insert(gastoPauta).values([
      { programId: p.id, fecha: "2026-11-05", monto: "300000", moneda: "COP", origen: "meta_api", pautaObjetoId: adAgenda.id },
      { programId: p.id, fecha: "2026-11-05", monto: "500000", moneda: "COP", origen: "meta_api", pautaObjetoId: adLanzamiento.id },
      { programId: p.id, fecha: "2026-11-05", monto: "200000", moneda: "COP", origen: "meta_api", pautaObjetoId: adOtra.id },
      { programId: otro.id, fecha: "2026-11-05", monto: "900000", moneda: "COP", origen: "meta_api", pautaObjetoId: adAjeno.id },
    ]);
    await agenda(p, "paid", "paid_social");
    await agenda(p, "organic", "organic");
    await agenda(p, "anulada", "paid_social", {
      anuladoEn: new Date("2026-11-06T10:00:00-05:00"), anuladoPor: actor.id, motivoAnulacion: "Prueba",
    });
    await agenda(otro, "ajena", "paid_social");

    const resultado = await costoPorAgendaDelCrm(db, { programId: p.id, desde: "2026-11-05", hasta: "2026-11-05" });
    expect(resultado).toEqual({
      gasto: 500000, agendasCrm: 1, gastoTotal: 1000000, gastoOtras: 0, moneda: "COP",
      costo: { valor: 500000, base: 1, faltan: 0, motivo: null },
    });
  });
});
