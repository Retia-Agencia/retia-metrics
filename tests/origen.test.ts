import { eq } from "drizzle-orm";
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { calls, cuentasPublicitarias, deals, leads, pautaObjetos, programs, sources, submissions, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { origenDelPrograma } from "@/lib/queries/origen";
import { agrupar } from "@/lib/queries/hechos/envio";
import { listaDeMetrica } from "@/lib/queries/metricas-con-filas";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let programId: string;
let sourceId: string;

beforeAll(async () => ({ db, cerrar, vaciar } = await crearBaseReutilizable()));
async function prepararPrograma() {
  await vaciar();
  programId = (await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "origen", nombre: "Origen", ticketUsd: "1000" }).returning())[0].id;
  sourceId = (await db.insert(sources).values({ programId, nombre: "Formulario" }).returning())[0].id;
}
beforeEach(prepararPrograma);
afterAll(async () => cerrar());

async function crearEnvio(source: string | null, medium: string | null, fecha: string, utmId: string | null = null) {
  const lead = (await db.insert(leads).values({ programId, emailNormalizado: `${crypto.randomUUID()}@correo.co` }).returning())[0];
  return (await db.insert(submissions).values({
    leadId: lead.id, sourceId, token: crypto.randomUUID(), esParcial: false,
    fechaEnvio: new Date(`${fecha}T12:00:00-05:00`), utmSource: source, utmMedium: medium, utmId,
  }).returning())[0];
}

async function crearArbol() {
  const cuenta = (await db.insert(cuentasPublicitarias).values({
    idMeta: "cuenta", programId, nombre: "Cuenta", moneda: "COP", zonaHoraria: "America/Bogota",
  }).returning())[0];
  await db.insert(pautaObjetos).values([
    { cuentaId: cuenta.id, programId, idMeta: "camp", nivel: "campana", nombre: "Campaña", estado: "ACTIVE" },
    { cuentaId: cuenta.id, programId, idMeta: "set", nivel: "conjunto", padreIdMeta: "camp", nombre: "Conjunto", estado: "ACTIVE" },
    { cuentaId: cuenta.id, programId, idMeta: "ad", nivel: "anuncio", padreIdMeta: "set", nombre: "Anuncio", estado: "ACTIVE" },
  ]);
}

async function agendar(envio: Awaited<ReturnType<typeof crearEnvio>>, hora: string) {
  const deal = (await db.insert(deals).values({
    leadId: envio.leadId!, programId, etapa: "agendado", submissionOrigenId: envio.id,
  }).returning())[0];
  await db.insert(calls).values({ programId, dealId: deal.id, createdAt: new Date(hora) });
}

const leerVista = () => origenDelPrograma(db, {
  programId, rango: { desde: "2026-10-01", hasta: "2026-10-24" }, hoy: "2026-10-24",
});

describe("Hub Origen", () => {
  it("clasifica el par, marca nuevo y conserva el total de envíos", async () => {
    const envio = await crearEnvio("instagram francisco", "storiesfijadas", "2026-10-20");
    await crearEnvio("facebook", "cpc", "2026-10-01");
    const deal = (await db.insert(deals).values({ leadId: envio.leadId!, programId, etapa: "agendado", submissionOrigenId: envio.id }).returning())[0];
    await db.insert(calls).values({ programId, dealId: deal.id, createdAt: new Date("2026-10-21T10:00:00-05:00") });

    const vista = await leerVista();
    const instagram = vista.filas.find((fila) => fila.source === "instagram francisco");
    expect(instagram).toMatchObject({ area: "organico", canal: "Instagram · Francisco", cuenta: "francisco", nuevo: true, agendas: 1 });
    expect(instagram?.regla).toContain("orgánico");
    expect(vista.filas.reduce((total, fila) => total + fila.envios, 0)).toBe(vista.totalEnvios);
    expect(vista.totalEnvios).toBe(2);
    const hechos = await agrupar(db, {
      programId, rango: { desde: "2026-10-01", hasta: "2026-10-24" }, agruparPor: ["canal"],
    });
    expect(vista.canales.reduce((total, fila) => total + fila.envios, 0))
      .toBe(hechos.reduce((total, fila) => total + fila.envios, 0));
    const canal = vista.canales.find((fila) => fila.canalClave === "instagram francisco")!;
    const filtros = {
      programId, rango: { desde: "2026-10-01", hasta: "2026-10-24" }, hoy: "2026-10-24",
      area: canal.area, canal: canal.canalClave,
    };
    const [registros] = await listaDeMetrica("registros", filtros, 1, db);
    const [agendas] = await listaDeMetrica("agendas_creadas", filtros, 1, db);
    expect(registros.subtotal.cantidad).toBe(canal.envios);
    expect(agendas.subtotal.cantidad).toBe(canal.agendas);
  });

  it("las listas de Pauta filtran por campaña y por resultado de la cita, y cuadran con sus cifras", async () => {
    const a = await crearEnvio("ig", "paid_social", "2026-10-10");
    const b = await crearEnvio("ig", "paid_social", "2026-10-11");
    await db.update(submissions).set({ utmCampaign: "c1" }).where(eq(submissions.id, a.id));
    await db.update(submissions).set({ utmCampaign: "c2" }).where(eq(submissions.id, b.id));
    await agendar(a, "2026-10-12T10:00:00-05:00");
    await agendar(b, "2026-10-12T11:00:00-05:00");
    await db.update(calls).set({ resultado: "no_show" });
    const base = { programId, rango: { desde: "2026-10-01", hasta: "2026-10-24" }, hoy: "2026-10-24" };
    const cantidad = async (metrica: "registros" | "agendas_creadas", extra: Parameters<typeof listaDeMetrica>[1] extends infer T ? Partial<T> : never) =>
      (await listaDeMetrica(metrica, { ...base, ...extra }, 1, db))[0].subtotal.cantidad;
    expect(await cantidad("registros", { campaign: "c1" })).toBe(1);
    expect(await cantidad("agendas_creadas", { campaign: "c2" })).toBe(1);
    expect(await cantidad("agendas_creadas", { resultado: "no_show" })).toBe(2);
    expect(await cantidad("agendas_creadas", { resultado: "show" })).toBe(0);
    expect(await cantidad("agendas_creadas", { campaign: "c1", resultado: "no_show" })).toBe(1);
  });

  it("una agenda sin envío de origen no cae en la lista de Sin UTM (la tabla la pone en su propia fila)", async () => {
    const sinUtm = await crearEnvio(null, null, "2026-10-10");
    await agendar(sinUtm, "2026-10-12T10:00:00-05:00");
    const lead = (await db.insert(leads).values({ programId, emailNormalizado: `${crypto.randomUUID()}@correo.co` }).returning())[0];
    const manual = (await db.insert(deals).values({ leadId: lead.id, programId, etapa: "agendado" }).returning())[0];
    await db.insert(calls).values({ programId, dealId: manual.id, createdAt: new Date("2026-10-12T11:00:00-05:00") });
    await db.insert(calls).values({ programId, createdAt: new Date("2026-10-12T12:00:00-05:00") });
    await db.update(calls).set({ resultado: "no_show" });
    const base = { programId, rango: { desde: "2026-10-01", hasta: "2026-10-24" }, hoy: "2026-10-24" };
    const [lista] = await listaDeMetrica("agendas_creadas", { ...base, categoria: "sin_utm", resultado: "no_show" }, 1, db);
    expect(lista.subtotal.cantidad).toBe(1);
    const [todas] = await listaDeMetrica("agendas_creadas", { ...base, resultado: "no_show" }, 1, db);
    expect(todas.subtotal.cantidad).toBe(3);
  });

  it("no marca nuevo un par visto antes de la ventana de siete días", async () => {
    await crearEnvio("instagram rosario", "storiesfijadas", "2026-09-01");
    await crearEnvio("instagram rosario", "storiesfijadas", "2026-10-22");
    const [fila] = (await leerVista()).filas;
    expect(fila).toMatchObject({ source: "instagram rosario", medium: "storiesfijadas", envios: 1, nuevo: false });
  });

  it("un utm_id recién visto no rejuvenece facebook / cpc", async () => {
    await crearEnvio("facebook", "cpc", "2026-09-01");
    await crearEnvio("facebook", "cpc", "2026-10-22", "ad-nuevo");
    expect((await leerVista()).filas).toHaveLength(1);
    expect((await leerVista()).filas[0]).toMatchObject({ envios: 1, nuevo: false });
  });

  it("separa el mismo par por regla sin cambiar el total de envíos", async () => {
    await crearArbol();
    const porMedio = await crearEnvio("facebook", "cpc", "2026-10-10");
    const porId = await crearEnvio("facebook", "cpc", "2026-10-11", "ad");
    await agendar(porMedio, "2026-10-12T10:00:00-05:00");
    await agendar(porId, "2026-10-13T10:00:00-05:00");
    const vista = await leerVista();
    expect(vista.filas).toHaveLength(2);
    expect(vista.filas.map((fila) => fila.regla)).toEqual([
      "id encontrado en el árbol de Meta",
      "medio pago: cpc",
    ]);
    expect(vista.filas.reduce((total, fila) => total + fila.envios, 0)).toBe(vista.totalEnvios);
    expect(vista.filas.map((fila) => fila.agendas)).toEqual([1, 1]);
    expect(vista.filas.reduce((total, fila) => total + fila.agendas, 0)).toBe(2);
    expect(vista.totalEnvios).toBe(2);
    const paid = vista.canales.find((fila) => fila.area === "paid" && fila.canalClave === "facebook");
    expect(paid).toBeDefined();
    expect(paid!.pares.reduce((total, fila) => total + fila.envios, 0)).toBe(paid!.envios);
    expect(paid!.pares.reduce((total, fila) => total + fila.agendas, 0)).toBe(paid!.agendas);
  });

  it("excluye agendas anuladas y filas de otro programa", async () => {
    const actor = (await db.insert(users).values({ email: "actor-origen@retia.test", rol: "developer" }).returning())[0];
    const envio = await crearEnvio("instagram rosario", "storiesfijadas", "2026-10-10");
    const deal = (await db.insert(deals).values({
      leadId: envio.leadId!, programId, etapa: "agendado", submissionOrigenId: envio.id,
    }).returning())[0];
    await db.insert(calls).values({
      programId, dealId: deal.id, createdAt: new Date("2026-10-11T10:00:00-05:00"),
      anuladoEn: new Date("2026-10-12T10:00:00-05:00"), anuladoPor: actor.id, motivoAnulacion: "Prueba",
    });

    const otro = (await db.insert(programs).values({
      ...PROGRAMA_DE_PRUEBA, slug: "origen-otro", nombre: "Otro", ticketUsd: "1000",
    }).returning())[0];
    const fuenteAjena = (await db.insert(sources).values({ programId: otro.id, nombre: "Formulario" }).returning())[0];
    const leadAjeno = (await db.insert(leads).values({ programId: otro.id, emailNormalizado: "ajeno@retia.test" }).returning())[0];
    const envioAjeno = (await db.insert(submissions).values({
      leadId: leadAjeno.id, sourceId: fuenteAjena.id, token: "ajeno", esParcial: false,
      fechaEnvio: new Date("2026-10-10T12:00:00-05:00"), utmSource: "facebook", utmMedium: "cpc",
    }).returning())[0];
    const dealAjeno = (await db.insert(deals).values({
      leadId: leadAjeno.id, programId: otro.id, etapa: "agendado", submissionOrigenId: envioAjeno.id,
    }).returning())[0];
    await db.insert(calls).values({ programId: otro.id, dealId: dealAjeno.id, createdAt: new Date("2026-10-11T10:00:00-05:00") });

    const vista = await leerVista();
    expect(vista.totalEnvios).toBe(1);
    expect(vista.canales.reduce((total, fila) => total + fila.agendas, 0)).toBe(0);
    expect(vista.canales.find((fila) => fila.canalClave === "facebook")).toBeUndefined();
  });

  it("conserva la agenda aunque el envío de origen sea anterior al rango", async () => {
    const envio = await crearEnvio("instagram rosario", "storiesfijadas", "2026-09-15");
    await agendar(envio, "2026-10-21T10:00:00-05:00");
    const vista = await leerVista();
    expect(vista.filas).toHaveLength(1);
    expect(vista.filas[0]).toMatchObject({
      source: "instagram rosario",
      medium: "storiesfijadas",
      envios: 0,
      agendas: 1,
      nuevo: false,
    });
    expect(vista.filas.reduce((total, fila) => total + fila.agendas, 0)).toBe(1);
    expect(vista.totalEnvios).toBe(0);
  });

  it("produce la misma salida aunque se invierta el orden de inserción", async () => {
    const escenario = async (invertido: boolean) => {
      await prepararPrograma();
      await crearArbol();
      const filas = [
        ["2026-10-10", null],
        ["2026-10-11", "ad"],
      ] as const;
      for (const [fecha, id] of invertido ? [...filas].reverse() : filas) {
        await crearEnvio("facebook", "cpc", fecha, id);
      }
      return (await leerVista()).filas;
    };
    expect(await escenario(false)).toEqual(await escenario(true));
  });

  it("un par con macros sale de su canal y cada lista cuadra con su cifra", async () => {
    await crearEnvio("facebook", "cpc", "2026-10-10");
    const conMacro = await crearEnvio("facebook", "cpc", "2026-10-11");
    await db.update(submissions).set({ utmCampaign: "{{campaign.name}}" }).where(eq(submissions.id, conMacro.id));

    const vista = await leerVista();
    const canal = vista.canales.find((fila) => fila.categoria === null && fila.canalClave === "facebook")!;
    const macro = vista.canales.find((fila) => fila.categoria === "macro")!;
    expect([canal.envios, macro.envios]).toEqual([1, 1]);
    const base = { programId, rango: { desde: "2026-10-01", hasta: "2026-10-24" }, hoy: "2026-10-24" };
    const [delCanal] = await listaDeMetrica("registros", { ...base, area: canal.area, canal: canal.canalClave, categoria: "con_utm" }, 1, db);
    const [deMacros] = await listaDeMetrica("registros", { ...base, categoria: "macro" }, 1, db);
    expect(delCanal.subtotal.cantidad).toBe(canal.envios);
    expect(deMacros.subtotal.cantidad).toBe(macro.envios);
  });

  it("retira Canales con un redirect a Origen", async () => {
    const pagina = await readFile("app/(app)/ajustes/canales/page.tsx", "utf8");
    expect(pagina).toContain('redirect("/hub?seccion=origen")');
  });
});

describe("Plantillas por cuenta", () => {
  it("cuenta solo anuncios activos del programa y conserva sus tags y jerarquía", async () => {
    const cuenta = (await db.insert(cuentasPublicitarias).values({
      idMeta: "cuenta-plantillas", programId, nombre: "Cuenta plantillas", moneda: "COP", zonaHoraria: "America/Bogota",
    }).returning())[0];
    const vieja = "utm_source=facebook&utm_medium=cpc&ad_id={{ad.id}}";
    const pauta = "utm_medium=paid_social&utm_id={{ad.id}}";
    await db.insert(pautaObjetos).values([
      { cuentaId: cuenta.id, programId, idMeta: "camp-plantillas", nivel: "campana", nombre: "Campaña Uno", estado: "ACTIVE" },
      { cuentaId: cuenta.id, programId, idMeta: "set-plantillas", nivel: "conjunto", padreIdMeta: "camp-plantillas", nombre: "Conjunto Uno", estado: "ACTIVE" },
      { cuentaId: cuenta.id, programId, idMeta: "ad-vieja", nivel: "anuncio", padreIdMeta: "set-plantillas", nombre: "Anuncio Viejo", estado: "ACTIVE", urlTags: vieja },
      { cuentaId: cuenta.id, programId, idMeta: "ad-pauta", nivel: "anuncio", padreIdMeta: "set-plantillas", nombre: "Anuncio Pauta", estado: "active", urlTags: pauta },
      { cuentaId: cuenta.id, programId, idMeta: "ad-sin-id", nivel: "anuncio", padreIdMeta: "set-plantillas", nombre: "Anuncio Sin Id", estado: "ACTIVE", urlTags: null },
      { cuentaId: cuenta.id, programId, idMeta: "ad-pausado", nivel: "anuncio", padreIdMeta: "set-plantillas", nombre: "Anuncio Pausado", estado: "PAUSED", urlTags: vieja },
    ]);
    const otroPrograma = (await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "otro-origen", nombre: "Otro origen", ticketUsd: "1000" }).returning())[0];
    const otraCuenta = (await db.insert(cuentasPublicitarias).values({
      idMeta: "otra-cuenta", programId: otroPrograma.id, nombre: "Otra cuenta", moneda: "COP", zonaHoraria: "America/Bogota",
    }).returning())[0];
    await db.insert(pautaObjetos).values([
      { cuentaId: otraCuenta.id, programId: otroPrograma.id, idMeta: "otra-campana", nivel: "campana", nombre: "Otra campaña", estado: "ACTIVE" },
      { cuentaId: otraCuenta.id, programId: otroPrograma.id, idMeta: "otro-conjunto", nivel: "conjunto", padreIdMeta: "otra-campana", nombre: "Otro conjunto", estado: "ACTIVE" },
      { cuentaId: otraCuenta.id, programId: otroPrograma.id, idMeta: "otro-anuncio", nivel: "anuncio", padreIdMeta: "otro-conjunto", nombre: "Anuncio ajeno", estado: "ACTIVE", urlTags: pauta },
    ]);

    const vista = await leerVista();

    expect(vista.plantillas).toHaveLength(1);
    expect(vista.plantillas[0]).toMatchObject({
      cuenta: "Cuenta plantillas", vieja: 1, pauta: 1, otra: 0, sinId: 1,
      tagsPorTipo: { vieja: [vieja], pauta: [pauta], otra: [], sinId: [] },
    });
    expect(vista.plantillas[0].anuncios).toEqual([
      { idMeta: "ad-sin-id", nombre: "Anuncio Sin Id", campana: "Campaña Uno", conjunto: "Conjunto Uno", tipo: "sin_id", urlTags: null },
      { idMeta: "ad-vieja", nombre: "Anuncio Viejo", campana: "Campaña Uno", conjunto: "Conjunto Uno", tipo: "vieja", urlTags: vieja },
      { idMeta: "ad-pauta", nombre: "Anuncio Pauta", campana: "Campaña Uno", conjunto: "Conjunto Uno", tipo: "pauta", urlTags: pauta },
    ]);
  });
});
