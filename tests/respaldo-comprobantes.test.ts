import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import { AlmacenEnMemoria } from "@/lib/archivos/memoria";
import { EspejoEnMemoria } from "@/lib/archivos/espejo-memoria";
import { respaldarComprobantes } from "@/lib/archivos/respaldo";
import { abonos, archivos, cohorts, deals, leads, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

const AHORA = new Date("2026-10-13T14:00:00Z");
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47]);

let db: Db;
let cerrar: () => Promise<void>;
let almacen: AlmacenEnMemoria;
let espejo: EspejoEnMemoria;
let programId: string;
let actorId: string;
let leadId: string;
let dealId: string;
let cohortId: string;

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  almacen = new AlmacenEnMemoria();
  espejo = new EspejoEnMemoria();
  const [programa] = await db.insert(programs).values({
    ...PROGRAMA_DE_PRUEBA,
    slug: "respaldo",
    nombre: "ComunicArte",
    ticketUsd: "1000",
  }).returning();
  programId = programa.id;
  const [actor] = await db.insert(users).values({ email: "actor@retia.co", rol: "closer" }).returning();
  actorId = actor.id;
  const [cohorte] = await db.insert(cohorts).values({
    programId,
    codigo: "C3",
    metaCupos: 10,
    precioUsd: "1000",
  }).returning();
  cohortId = cohorte.id;
  const [lead] = await db.insert(leads).values({
    programId,
    emailNormalizado: "ana@retia.co",
    nombre: "Ana Pérez",
  }).returning();
  leadId = lead.id;
  const [deal] = await db.insert(deals).values({ programId, leadId, cohortId }).returning();
  dealId = deal.id;
});

afterEach(async () => cerrar());

async function archivoListo(id: string, ruta = `${id}.png`, createdAt = AHORA) {
  await db.insert(archivos).values({
    id,
    programId,
    ruta,
    tipoMime: "image/png",
    bytes: PNG.byteLength,
    estado: "listo",
    subidoPorUserId: actorId,
    createdAt,
  });
  await almacen.escribir(ruta, PNG);
}

async function abonoPara(archivoId: string, paraDeal = dealId) {
  await db.insert(abonos).values({
    programId,
    dealId: paraDeal,
    fecha: "2026-10-13",
    monto: "300",
    moneda: "USD",
    comprobanteArchivoId: archivoId,
    registradoPorUserId: actorId,
  });
}

describe("respaldo de comprobantes", () => {
  it("sube con nombre exacto, es idempotente y refleja cohorte, nombre y anulación", async () => {
    const archivoId = "a1b2c3d4-1111-4111-8111-111111111111";
    await archivoListo(archivoId);
    await abonoPara(archivoId);

    expect(await respaldarComprobantes(db, almacen, espejo, "raiz", AHORA)).toMatchObject({
      subidos: 1,
      movidos: 0,
      sinCambios: 0,
      errores: [],
    });
    expect(espejo.archivoDe(archivoId)).toMatchObject({
      nombre: "2026-10-13 Ana Pérez USD 300,00 (a1b2c3).png",
      ruta: ["ComunicArte", "C3"],
    });

    expect(await respaldarComprobantes(db, almacen, espejo, "raiz", AHORA)).toMatchObject({
      subidos: 0,
      movidos: 0,
      sinCambios: 1,
    });

    const [otra] = await db.insert(cohorts).values({
      programId,
      codigo: "C4",
      metaCupos: 10,
      precioUsd: "1000",
    }).returning();
    await db.update(deals).set({ cohortId: otra.id }).where(eq(deals.id, dealId));
    expect((await respaldarComprobantes(db, almacen, espejo, "raiz", AHORA)).movidos).toBe(1);
    expect(espejo.archivoDe(archivoId)?.ruta).toEqual(["ComunicArte", "C4"]);

    await db.update(leads).set({ nombre: "Ana/Pérez" }).where(eq(leads.id, leadId));
    expect((await respaldarComprobantes(db, almacen, espejo, "raiz", AHORA)).movidos).toBe(1);
    expect(espejo.archivoDe(archivoId)?.nombre).toContain("Ana-Pérez");

    await db.update(abonos).set({
      anuladoEn: AHORA,
      anuladoPor: actorId,
      motivoAnulacion: "Prueba",
    }).where(eq(abonos.comprobanteArchivoId, archivoId));
    expect((await respaldarComprobantes(db, almacen, espejo, "raiz", AHORA)).movidos).toBe(1);
    expect(espejo.archivoDe(archivoId)?.nombre).toMatch(/^ANULADO /);
  });

  it("usa Sin cohorte y Sin abono, y repone un archivo borrado del espejo", async () => {
    await db.update(deals).set({ cohortId: null }).where(eq(deals.id, dealId));
    const conAbono = "b1b2b3b4-1111-4111-8111-111111111111";
    const reemplazado = "c1c2c3c4-1111-4111-8111-111111111111";
    await archivoListo(conAbono);
    await abonoPara(conAbono);
    await archivoListo(reemplazado, `${reemplazado}.png`, new Date("2026-10-12T03:00:00Z"));

    expect((await respaldarComprobantes(db, almacen, espejo, "raiz", AHORA)).subidos).toBe(2);
    expect(espejo.archivoDe(conAbono)?.ruta).toEqual(["ComunicArte", "Sin cohorte"]);
    expect(espejo.archivoDe(reemplazado)).toMatchObject({
      nombre: "2026-10-11 (c1c2c3).png",
      ruta: ["ComunicArte", "Sin abono"],
    });

    const fila = (await db.select().from(archivos).where(eq(archivos.id, conAbono)))[0];
    espejo.borrar(fila.driveFileId!);
    expect((await respaldarComprobantes(db, almacen, espejo, "raiz", AHORA)).subidos).toBe(1);
    expect(espejo.archivoDe(conAbono)).not.toBeNull();
  });

  it("barre solo pendientes de más de 24 horas sin referencia", async () => {
    const viejo = "d1d2d3d4-1111-4111-8111-111111111111";
    const reciente = "e1e2e3e4-1111-4111-8111-111111111111";
    const referenciado = "f2f3f4f5-1111-4111-8111-111111111111";
    for (const [id, createdAt] of [
      [viejo, new Date(AHORA.getTime() - 25 * 60 * 60 * 1000)],
      [reciente, new Date(AHORA.getTime() - 2 * 60 * 60 * 1000)],
      [referenciado, new Date(AHORA.getTime() - 25 * 60 * 60 * 1000)],
    ] as const) {
      await db.insert(archivos).values({
        id,
        programId,
        ruta: `${id}.png`,
        tipoMime: "image/png",
        bytes: PNG.byteLength,
        estado: "pendiente",
        subidoPorUserId: actorId,
        createdAt,
      });
      await almacen.escribir(`${id}.png`, PNG);
    }
    await abonoPara(referenciado);

    expect((await respaldarComprobantes(db, almacen, espejo, "raiz", AHORA)).barridos).toBe(1);
    expect(await db.select().from(archivos).where(eq(archivos.id, viejo))).toHaveLength(0);
    expect(await almacen.leer(`${viejo}.png`)).toBeNull();
    expect(await db.select().from(archivos).where(eq(archivos.id, reciente))).toHaveLength(1);
    expect(await almacen.leer(`${reciente}.png`)).not.toBeNull();
    expect(await db.select().from(archivos).where(eq(archivos.id, referenciado))).toHaveLength(1);
    expect(await almacen.leer(`${referenciado}.png`)).not.toBeNull();
  });

  it("continúa cuando falla la lectura de un archivo", async () => {
    const fallido = "f1f2f3f4-1111-4111-8111-111111111111";
    const correcto = "a2a3a4a5-1111-4111-8111-111111111111";
    await archivoListo(fallido);
    await archivoListo(correcto);
    const leer = almacen.leer.bind(almacen);
    almacen.leer = async (ruta) => {
      if (ruta === `${fallido}.png`) throw new Error("secreto que no debe salir");
      return leer(ruta);
    };

    const resultado = await respaldarComprobantes(db, almacen, espejo, "raiz", AHORA);
    expect(resultado.subidos).toBe(1);
    expect(resultado.errores).toEqual([`No se pudo respaldar el archivo ${fallido}.`]);
    expect(resultado.errores.join(" ")).not.toContain("secreto");
    expect(espejo.archivoDe(correcto)).not.toBeNull();
  });

  it("sin espejo omite el respaldo pero conserva el barrido", async () => {
    const listo = "b2b3b4b5-1111-4111-8111-111111111111";
    const viejo = "c2c3c4c5-1111-4111-8111-111111111111";
    await archivoListo(listo);
    await db.insert(archivos).values({
      id: viejo,
      programId,
      ruta: `${viejo}.png`,
      tipoMime: "image/png",
      bytes: PNG.byteLength,
      estado: "pendiente",
      subidoPorUserId: actorId,
      createdAt: new Date(AHORA.getTime() - 25 * 60 * 60 * 1000),
    });
    await almacen.escribir(`${viejo}.png`, PNG);

    const resultado = await respaldarComprobantes(db, almacen, null, null, AHORA);
    expect(resultado).toMatchObject({ subidos: 0, barridos: 1 });
    expect(resultado.errores[0]).toContain("se omitió el respaldo");
    expect(await db.select().from(archivos).where(eq(archivos.id, listo))).toHaveLength(1);
  });
});
