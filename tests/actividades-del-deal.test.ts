import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { changeLog, cohorts, dealActividades, dealEtapaHistorial, deals, leads, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { registrarActividad } from "@/lib/deals/actividades";
import { etapaDeCorreccion } from "@/lib/deals/mover-etapa";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

let db: Db;
let cerrar: () => Promise<void>;
let programId: string;
let closer: string;
let n = 0;
const actor = () => ({ userId: closer, rol: "closer" as const });
beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  programId = (await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "p", nombre: "P", ticketUsd: "1000" }).returning())[0].id;
  closer = (await db.insert(users).values({ email: "closer@retia.co", rol: "closer" }).returning())[0].id;
});
afterEach(async () => cerrar());
async function nuevo(etapa: "potencial" | "registrado" | "en_gestion" | "contactado") {
  const lead = (await db.insert(leads).values({ programId, emailNormalizado: `a${n++}@retia.co` }).returning())[0];
  return (await db.insert(deals).values({ leadId: lead.id, programId, etapa }).returning())[0];
}

async function enProximaCohorte(fechaInicioVentas: string | null) {
  const actual = (await db.insert(cohorts).values({
    programId,
    codigo: "C1",
    metaCupos: 10,
    precioUsd: "1000",
    fechaInicioClases: "2026-10-01",
    fechaInicioVentas: "2026-09-01",
    fechaCierreVentas: "2026-09-30",
    estado: "activo",
  }).returning())[0];
  const destino = (await db.insert(cohorts).values({
    programId,
    codigo: "C2",
    metaCupos: 10,
    precioUsd: "1000",
    fechaInicioClases: "2099-02-01",
    fechaInicioVentas,
    fechaCierreVentas: "2099-01-31",
    estado: "futuro",
  }).returning())[0];
  const deal = await nuevo("contactado");
  await db.update(deals).set({
    ownerUserId: closer,
    cohortId: actual.id,
    cohorteDestinoId: destino.id,
    pendiente: "proxima_cohorte",
  }).where(eq(deals.id, deal.id));
  return { deal, actual, destino };
}

describe("registrarActividad", () => {
  it("el primer contacto de un Registrado asigna dueño y escribe E1 y E2 en orden", async () => {
    const d = await nuevo("registrado");
    await registrarActividad(db, actor(), { dealId: d.id, tipo: "contacto", canal: "WhatsApp", nota: "Respondió" });
    const actual = (await db.select().from(deals).where(eq(deals.id, d.id)))[0];
    expect(actual).toMatchObject({ ownerUserId: closer, etapa: "contactado" });
    const h = await db.select().from(dealEtapaHistorial).where(eq(dealEtapaHistorial.dealId, d.id));
    expect(h.map((x) => [x.de, x.a, x.userId])).toEqual([
      ["registrado", "en_gestion", closer], ["en_gestion", "contactado", closer],
    ]);
    expect(h[1].fecha.getTime()).toBeGreaterThanOrEqual(h[0].fecha.getTime());
    expect(await db.select().from(changeLog).where(eq(changeLog.registroId, d.id))).toEqual(expect.arrayContaining([expect.objectContaining({ campo: "ownerUserId", userId: closer })]));
  });

  it("el movimiento que dispara una actividad lo firma quien la registró, y se puede corregir (ADR 0078)", async () => {
    const d = await nuevo("en_gestion");
    await registrarActividad(db, actor(), { dealId: d.id, tipo: "contacto", canal: "WhatsApp", nota: "Respondió" });
    expect(await etapaDeCorreccion(db, d.id)).toEqual({ a: "en_gestion", pendiente: null });
  });

  it("rechaza registrar una actividad intento", async () => {
    const d = await nuevo("potencial");
    await expect(registrarActividad(db, actor(), {
      dealId: d.id,
      tipo: "intento" as never,
      canal: "Llamada",
      nota: "No respondió",
    })).rejects.toThrow("El tipo tiene que ser contacto o nota.");
  });

  it("una nota asigna dueño si falta, pero no mueve etapa", async () => {
    const d = await nuevo("registrado");
    await registrarActividad(db, actor(), { dealId: d.id, tipo: "nota", nota: "Dato interno" });
    expect((await db.select().from(deals).where(eq(deals.id, d.id)))[0]).toMatchObject({ ownerUserId: closer, etapa: "registrado" });
    expect(await db.select().from(dealEtapaHistorial).where(eq(dealEtapaHistorial.dealId, d.id))).toEqual([]);
  });

  it("registra el contacto pero no retoma antes del inicio de ventas de la destino", async () => {
    const { deal, actual } = await enProximaCohorte("2099-01-01");

    await registrarActividad(db, actor(), { dealId: deal.id, tipo: "contacto", canal: "WhatsApp", nota: "Respondió" });

    expect((await db.select().from(deals).where(eq(deals.id, deal.id)))[0]).toMatchObject({
      cohortId: actual.id,
      pendiente: "proxima_cohorte",
    });
    expect(await db.select().from(dealActividades).where(eq(dealActividades.dealId, deal.id))).toHaveLength(1);
  });

  it("retoma con un contacto cuando ya inicio la venta de la destino", async () => {
    const { deal, destino } = await enProximaCohorte("2000-01-01");

    await registrarActividad(db, actor(), { dealId: deal.id, tipo: "contacto", canal: "WhatsApp", nota: "Respondió" });

    expect((await db.select().from(deals).where(eq(deals.id, deal.id)))[0]).toMatchObject({
      cohortId: destino.id,
      pendiente: null,
    });
  });

  it("registra el contacto pero no retoma si la destino no tiene inicio de ventas", async () => {
    const { deal, actual } = await enProximaCohorte(null);

    await registrarActividad(db, actor(), { dealId: deal.id, tipo: "contacto", canal: "WhatsApp", nota: "Respondió" });

    expect((await db.select().from(deals).where(eq(deals.id, deal.id)))[0]).toMatchObject({
      cohortId: actual.id,
      pendiente: "proxima_cohorte",
    });
    expect(await db.select().from(dealActividades).where(eq(dealActividades.dealId, deal.id))).toHaveLength(1);
  });
});

const escribeIntento = (codigo: string) => /\btipo\s*:\s*["']intento["']/.test(codigo);

function archivosDeCodigo(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entrada) => {
    const ruta = join(dir, entrada.name);
    if (entrada.isDirectory()) return archivosDeCodigo(ruta);
    return /\.[cm]?[jt]sx?$/.test(entrada.name) ? [ruta] : [];
  });
}

describe("guardián de actividades intento", () => {
  it("detecta una escritura y no confunde el tipo de lectura ni la etiqueta histórica", () => {
    expect(escribeIntento('insert({ tipo: "intento" })')).toBe(true);
    expect(escribeIntento('tipo: "contacto" | "intento" | "nota"')).toBe(false);
    expect(escribeIntento('intento: "Intento"')).toBe(false);
  });

  it("ningún camino de la app escribe una actividad intento", () => {
    const archivos = ["lib", "app", "components"].flatMap(archivosDeCodigo);
    const infractores = archivos.filter((archivo) => escribeIntento(readFileSync(archivo, "utf8")));
    expect(infractores).toEqual([]);
  });
});
