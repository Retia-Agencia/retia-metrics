import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq, inArray } from "drizzle-orm";

import { AlmacenEnMemoria } from "@/lib/archivos/memoria";
import { confirmarArchivo, pedirSubida, verificarArchivo } from "@/lib/archivos";
import { adjuntarComprobante, registrarAbono } from "@/lib/deals/abonos";
import { moverConHecho } from "@/lib/deals/mover-con-hecho";
import { dealsConAbonoSinComprobante } from "@/lib/deals/abono-sin-comprobante";
import { abonos, archivos, changeLog, cohorts, dealActividades, deals, leads, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { incluyendoAnulados, vigente } from "@/lib/queries/vigente";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let programId: string;
let otroProgramId: string;
let cohortId: string;
let closer: string;
let otroCloser: string;
let secuencia = 0;
let almacen: AlmacenEnMemoria;

beforeAll(async () => {
  ({ db, cerrar, vaciar } = await crearBaseReutilizable());
});

beforeEach(async () => {
  await vaciar();
  const programas = await db.insert(programs).values([
    { ...PROGRAMA_DE_PRUEBA, slug: "principal", nombre: "Principal", ticketUsd: "1000" },
    { ...PROGRAMA_DE_PRUEBA, slug: "otro", nombre: "Otro", ticketUsd: "1000" },
  ]).returning();
  programId = programas[0].id;
  otroProgramId = programas[1].id;
  const [cohorte] = await db.insert(cohorts).values({
    programId,
    codigo: "C1",
    metaCupos: 10,
    precioUsd: "1000",
    fechaInicioClases: "2026-11-01",
    fechaInicioVentas: "2026-10-01",
    fechaCierreVentas: "2026-10-31",
    estado: "activo",
  }).returning();
  cohortId = cohorte.id;
  const actores = await db.insert(users).values([
    { email: "dueno@retia.co", rol: "closer", closerId: "Dueño" },
    { email: "otro@retia.co", rol: "closer", closerId: "Otro" },
  ]).returning();
  closer = actores[0].id;
  otroCloser = actores[1].id;
  almacen = new AlmacenEnMemoria();
});

afterAll(async () => cerrar());

const actor = (userId = closer) => ({ userId, rol: "closer" as const, operaComoCloser: false });

async function nuevoAbono(opciones: { etapa?: "atendido" | "ganado_completo"; anulado?: boolean } = {}) {
  const [lead] = await db.insert(leads).values({
    programId,
    emailNormalizado: `archivo-${++secuencia}@retia.co`,
  }).returning();
  const [deal] = await db.insert(deals).values({
    leadId: lead.id,
    programId,
    cohortId,
    ownerUserId: closer,
    etapa: opciones.etapa ?? "atendido",
    valorVendidoUsd: "1000",
  }).returning();
  const [abono] = await db.insert(abonos).values({
    dealId: deal.id,
    programId,
    fecha: "2026-10-13",
    monto: "100",
    registradoPorUserId: closer,
    ...(opciones.anulado ? { anuladoEn: new Date(), anuladoPor: closer, motivoAnulacion: "Error" } : {}),
  }).returning();
  return { dealId: deal.id, abonoId: abono.id };
}

async function archivoListo(programa = programId, usuario = closer) {
  const subida = await pedirSubida(db, almacen, { programId: programa, tipoMime: "image/png", bytes: 8, actorId: usuario });
  await almacen.escribir((await db.select().from(archivos).where(eq(archivos.id, subida.archivoId)))[0].ruta, new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  await confirmarArchivo(db, almacen, { archivoId: subida.archivoId, actorId: usuario });
  return subida.archivoId;
}

async function archivoVerificado(programa = programId, usuario = closer) {
  const subida = await pedirSubida(db, almacen, { programId: programa, tipoMime: "image/png", bytes: 8, actorId: usuario });
  const [archivo] = await db.select().from(archivos).where(eq(archivos.id, subida.archivoId));
  await almacen.escribir(archivo.ruta, new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  return verificarArchivo(db, almacen, { archivoId: subida.archivoId, actorId: usuario });
}

async function nuevoDeal() {
  const [lead] = await db.insert(leads).values({
    programId,
    emailNormalizado: `abono-con-archivo-${++secuencia}@retia.co`,
  }).returning();
  const [deal] = await db.insert(deals).values({
    leadId: lead.id,
    programId,
    cohortId,
    ownerUserId: closer,
    etapa: "atendido",
    valorVendidoUsd: "1000",
  }).returning();
  return deal;
}

function datosDeAbono(dealId: string, monto = "100") {
  return { dealId, fecha: "2026-10-13", monto, moneda: "USD" as const };
}

async function errorDe(promesa: Promise<unknown>) {
  try {
    await promesa;
    throw new Error("Se esperaba un error.");
  } catch (error) {
    return error as { status: number };
  }
}

describe("adjuntar comprobante", () => {
  it("adjunta el archivo, deja rastro y nota si el deal ya está completo", async () => {
    const { dealId, abonoId } = await nuevoAbono({ etapa: "ganado_completo" });
    const archivoId = await archivoListo();
    await adjuntarComprobante(db, actor(), { abonoId, archivoId });

    const [abono] = await db.select().from(abonos).where(and(eq(abonos.id, abonoId), incluyendoAnulados(abonos)));
    expect(abono.comprobanteArchivoId).toBe(archivoId);
    expect(await db.select().from(changeLog).where(and(
      eq(changeLog.tabla, "abonos"),
      eq(changeLog.registroId, abonoId),
      eq(changeLog.campo, "comprobanteArchivoId"),
    ))).toHaveLength(1);
    expect(await db.select().from(dealActividades).where(eq(dealActividades.dealId, dealId))).toMatchObject([{
      tipo: "nota",
      userId: closer,
      nota: "Se adjuntó el comprobante del abono con el deal ya en Ganado completo.",
    }]);
  });

  it("rechaza al closer que no es dueño", async () => {
    const { abonoId } = await nuevoAbono();
    expect((await errorDe(adjuntarComprobante(db, actor(otroCloser), { abonoId, archivoId: await archivoListo(programId, otroCloser) }))).status).toBe(403);
  });

  it("rechaza un archivo pendiente", async () => {
    const { abonoId } = await nuevoAbono();
    const { archivoId } = await pedirSubida(db, almacen, { programId, tipoMime: "image/png", bytes: 8, actorId: closer });
    expect((await errorDe(adjuntarComprobante(db, actor(), { abonoId, archivoId }))).status).toBe(422);
  });

  it("rechaza un archivo de otro programa", async () => {
    const { abonoId } = await nuevoAbono();
    expect((await errorDe(adjuntarComprobante(db, actor(), { abonoId, archivoId: await archivoListo(otroProgramId) }))).status).toBe(422);
  });

  it("rechaza un archivo subido por otra persona", async () => {
    const { abonoId } = await nuevoAbono();
    expect((await errorDe(adjuntarComprobante(db, actor(), { abonoId, archivoId: await archivoListo(programId, otroCloser) }))).status).toBe(403);
  });

  it("trata un abono anulado como inexistente", async () => {
    const { abonoId } = await nuevoAbono({ anulado: true });
    expect((await errorDe(adjuntarComprobante(db, actor(), { abonoId, archivoId: await archivoListo() }))).status).toBe(404);
  });
});

it("una URL o un archivo bastan como comprobante y solo falta cuando ambos son nulos", async () => {
  const conUrl = await nuevoAbono();
  const conArchivo = await nuevoAbono();
  const sinComprobante = await nuevoAbono();
  await db.update(abonos).set({ comprobanteUrl: "https://drive.google.com/comprobante" }).where(eq(abonos.id, conUrl.abonoId));
  await db.update(abonos).set({ comprobanteArchivoId: await archivoListo() }).where(eq(abonos.id, conArchivo.abonoId));

  expect(await dealsConAbonoSinComprobante(db, [conUrl.dealId, conArchivo.dealId, sinComprobante.dealId]))
    .toEqual(new Set([sinComprobante.dealId]));
});

describe("registrar abono con archivo", () => {
  it("adjunta el archivo, lo marca listo, deja un rastro por campo y mueve la etapa", async () => {
    const deal = await nuevoDeal();
    const archivo = await archivoVerificado();

    const resultado = await registrarAbono(db, actor(), { ...datosDeAbono(deal.id), archivo });

    expect(resultado).toMatchObject({ etapa: "ganado_parcial", movioElDeal: true, saldo: 900 });
    const [abono] = await db.select().from(abonos).where(eq(abonos.id, resultado.abonoId));
    expect(abono.comprobanteArchivoId).toBe(archivo.archivoId);
    expect((await db.select().from(archivos).where(eq(archivos.id, archivo.archivoId)))[0].estado).toBe("listo");
    expect((await db.select().from(deals).where(and(eq(deals.id, deal.id), incluyendoAnulados(deals))))[0].etapa).toBe("ganado_parcial");

    const rastros = await db.select().from(changeLog).where(and(
      eq(changeLog.tabla, "abonos"),
      eq(changeLog.registroId, resultado.abonoId),
    ));
    expect(rastros.length).toBeGreaterThan(0);
    expect(new Set(rastros.map((r) => r.campo)).size).toBe(rastros.length);
    expect(rastros.filter((r) => r.campo === "comprobanteArchivoId")).toHaveLength(1);
  });

  it("rechaza un archivo de otro programa y lo deja pendiente", async () => {
    const deal = await nuevoDeal();
    const archivo = await archivoVerificado(otroProgramId);

    expect((await errorDe(registrarAbono(db, actor(), { ...datosDeAbono(deal.id), archivo }))).status).toBe(422);
    expect((await db.select().from(archivos).where(eq(archivos.id, archivo.archivoId)))[0].estado).toBe("pendiente");
  });

  it("rechaza un archivo subido por otra persona y lo deja pendiente", async () => {
    const deal = await nuevoDeal();
    const archivo = await archivoVerificado(programId, otroCloser);

    expect((await errorDe(registrarAbono(db, actor(), { ...datosDeAbono(deal.id), archivo }))).status).toBe(403);
    expect((await db.select().from(archivos).where(eq(archivos.id, archivo.archivoId)))[0].estado).toBe("pendiente");
  });

  it("deja el archivo pendiente cuando el abono falla por sobrepago", async () => {
    const deal = await nuevoDeal();
    const archivo = await archivoVerificado();

    expect((await errorDe(registrarAbono(db, actor(), { ...datosDeAbono(deal.id, "1001"), archivo }))).status).toBe(422);
    expect((await db.select().from(archivos).where(eq(archivos.id, archivo.archivoId)))[0].estado).toBe("pendiente");
  });

  it("adjunta el archivo en el camino Pagó ahora", async () => {
    const deal = await nuevoDeal();
    const archivo = await archivoVerificado();

    await moverConHecho(db, actor(), {
      dealId: deal.id,
      a: "ganado_parcial",
      datos: {},
      hecho: { tipo: "abono", fecha: "2026-10-13", monto: "100", moneda: "USD", archivo },
    });

    const [abono] = await db.select().from(abonos).where(eq(abonos.dealId, deal.id));
    expect(abono.comprobanteArchivoId).toBe(archivo.archivoId);
    expect((await db.select().from(archivos).where(eq(archivos.id, archivo.archivoId)))[0].estado).toBe("listo");
  });

  it("conserva el registro con solo link o sin comprobante", async () => {
    const conLink = await nuevoDeal();
    const sinComprobante = await nuevoDeal();

    const primero = await registrarAbono(db, actor(), {
      ...datosDeAbono(conLink.id),
      comprobanteUrl: "https://drive.google.com/comprobante",
    });
    const segundo = await registrarAbono(db, actor(), datosDeAbono(sinComprobante.id));

    const filas = await db.select().from(abonos).where(and(
      vigente(abonos),
      inArray(abonos.id, [primero.abonoId, segundo.abonoId]),
    ));
    expect(filas.find((a) => a.id === primero.abonoId)).toMatchObject({
      comprobanteUrl: "https://drive.google.com/comprobante",
      comprobanteArchivoId: null,
    });
    expect(filas.find((a) => a.id === segundo.abonoId)).toMatchObject({
      comprobanteUrl: null,
      comprobanteArchivoId: null,
    });
  });
});
