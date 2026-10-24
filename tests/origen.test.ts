import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { calls, cuentasPublicitarias, deals, leads, pautaObjetos, programs, sources, submissions } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { origenDelPrograma } from "@/lib/queries/origen";
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

  it("retira Canales con un redirect a Origen", async () => {
    const pagina = await readFile("app/(app)/ajustes/canales/page.tsx", "utf8");
    expect(pagina).toContain('redirect("/hub?seccion=origen")');
  });
});
