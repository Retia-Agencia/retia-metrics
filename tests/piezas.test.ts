import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { changeLog, creadores as tablaCreadores, leads, piezas, programs, sources, submissions, tiposPieza, usuariosProgramasAlcance, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { creadores, tiposDePieza } from "@/lib/catalogo/creadores";
import { crearCreador, crearTipoDePieza, editarCreador, MOTIVO_CAMBIO_DE_PROGRAMA } from "@/lib/media/creadores";
import { origenDelPrograma } from "@/lib/queries/origen";
import { listaDeMetrica } from "@/lib/queries/metricas-con-filas";
import {
  crearPieza,
  crearLinkFijoDeCreador,
  descartarPieza,
  editarPieza,
  generarCodigoDePieza,
  linkDeLaPieza,
  marcarPublicada,
  piezasDelCreador,
  type ActorDeMedia,
} from "@/lib/media/piezas";
import { campanaDePieza, linkDePieza, linkFijoDelCreador } from "@/lib/atribucion/link-de-pieza";
import { resolverCanal, UTM_MEDIUM_CONTENIDO, UTM_SOURCE_CREADOR } from "@/lib/atribucion/canal";
import { emparejar, ARBOL_VACIO, type PiezasDelPrograma } from "@/lib/atribucion/emparejar";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * Tickets 316 a 318 (ADR 0107, 0108, 0110): el creador, la pieza minima, su link y el
 * emparejamiento. Lo que un bug aqui hace no es fallar: es atribuir un lead a la pieza
 * equivocada (o perder la que si lo trajo) sin ningun error.
 */

let db: Db;
// Los modulos de lib/media usan la base de la app por defecto: aqui es la de PGlite.
vi.mock("@/lib/db", () => ({
  get db() {
    return db;
  },
}));
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let programA: string;
let programB: string;
let media: ActorDeMedia;
let mediaAcotado: ActorDeMedia;
let closer: ActorDeMedia;
let tipoId: string;
let creadorConPrograma: string;
let creadorSinPrograma: string;

beforeAll(async () => {
  ({ db, cerrar, vaciar } = await crearBaseReutilizable());
});
afterAll(async () => {
  await cerrar();
});

beforeEach(async () => {
  await vaciar();
  const [a] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "a", nombre: "A", ticketUsd: "797" }).returning();
  const [b] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "b", nombre: "B", ticketUsd: "1500" }).returning();
  programA = a.id;
  programB = b.id;
  await db.insert(sources).values([
    { programId: programA, nombre: "TF A", tipo: "webhook", proveedor: "typeform", activo: true, principal: true, urlPublica: "https://form.typeform.com/to/aaa?utm_source=viejo" },
    { programId: programB, nombre: "TF B", tipo: "webhook", proveedor: "typeform", activo: true, principal: true, urlPublica: "https://form.typeform.com/to/bbb" },
  ]);
  const [m, ma, c] = await db
    .insert(users)
    .values([
      { email: "media@retia.co", rol: "media", nombre: "Media" },
      { email: "media-b@retia.co", rol: "media", nombre: "Media B" },
      { email: "closer@retia.co", rol: "closer", nombre: "Closer" },
    ])
    .returning();
  media = { id: m.id, rol: "media" };
  mediaAcotado = { id: ma.id, rol: "media" };
  closer = { id: c.id, rol: "closer" };
  await db.insert(usuariosProgramasAlcance).values({ userId: ma.id, programId: programB });

  const tipo = await tiposDePieza(db).crear(m.id, { nombre: "Reel" });
  tipoId = tipo.id as string;
  const conPrograma = await creadores(db).crear(m.id, { nombre: "Ana", slug: "ana", programId: programA });
  creadorConPrograma = conPrograma.id as string;
  const sinPrograma = await creadores(db).crear(m.id, { nombre: "Cliente Sin Programa", slug: "sinprog" });
  creadorSinPrograma = sinPrograma.id as string;
}, 60_000);

const entrada = (o: Partial<Parameters<typeof crearPieza>[1]> = {}) => ({
  nombre: "Reel de prueba",
  creadorId: creadorConPrograma,
  tipoId,
  red: "instagram" as const,
  fechaPublicacion: "2026-10-30",
  ...o,
});

describe("316: crear y editar piezas", () => {
  it("el programa sale del creador (nunca del input), el codigo del servidor, y deja rastro", async () => {
    const id = await crearPieza(media, { ...entrada(), programId: programB } as never);
    const [p] = await db.select().from(piezas).where(eq(piezas.id, id));
    expect(p.programId).toBe(programA);
    expect(p.codigo).toMatch(/^[2-9bcdfghjkmnpqrstvwxyz]{8}$/);
    expect(p.creadaPor).toBe(media.id);
    const log = await db.select().from(changeLog).where(and(eq(changeLog.tabla, "piezas"), eq(changeLog.registroId, id)));
    expect(log.map((l) => l.campo)).toEqual(expect.arrayContaining(["red", "codigo", "creadorId"]));
    expect(log.every((l) => l.userId === media.id && l.origen === "app")).toBe(true);
  });

  it("la pieza lleva el nombre que le pone media: obligatorio al crear y editable", async () => {
    await expect(crearPieza(media, entrada({ nombre: "   " }))).rejects.toMatchObject({ status: 400 });
    const id = await crearPieza(media, entrada({ nombre: "  Reel objeción del precio " }));
    const [p] = await db.select().from(piezas).where(eq(piezas.id, id));
    expect(p.nombre).toBe("Reel objeción del precio");
    expect(await editarPieza(media, id, { nombre: "Otro nombre", tipoId, red: "instagram", fechaPublicacion: "2026-10-30" })).toBe(true);
    const [q] = await db.select().from(piezas).where(eq(piezas.id, id));
    expect(q.nombre).toBe("Otro nombre");
  });

  it("una pieza normal sin fecha o con permanente=true se rechaza", async () => {
    await expect(crearPieza(media, entrada({ fechaPublicacion: undefined }))).rejects.toMatchObject({ status: 400 });
    await expect(crearPieza(media, entrada({ permanente: true }))).rejects.toMatchObject({ status: 400 });
    await expect(
      db.insert(piezas).values({ nombre: "Reel", creadorId: creadorConPrograma, tipoId, red: "instagram", codigo: "zzzzzzzz", permanente: true, fechaPublicacion: "2026-10-30" }),
    ).rejects.toThrow();
  });

  it("acepta un link fijo por red y uno sin red; la segunda de cada uno es 409", async () => {
    const conRed = { creadorId: creadorConPrograma, tipoId, red: "instagram" as const };
    const sinRed = { creadorId: creadorConPrograma, tipoId, red: null };
    const conRedId = await crearLinkFijoDeCreador(media, conRed);
    await expect(crearLinkFijoDeCreador(media, conRed)).rejects.toMatchObject({ status: 409 });
    const sinRedId = await crearLinkFijoDeCreador(media, sinRed);
    await expect(crearLinkFijoDeCreador(media, sinRed)).rejects.toMatchObject({ status: 409 });
    const fijos = await db.select().from(piezas).where(eq(piezas.creadorId, creadorConPrograma));
    expect(fijos.find((p) => p.id === conRedId)?.nombre).toBe("Link fijo de Ana · instagram");
    expect(fijos.find((p) => p.id === sinRedId)?.nombre).toBe("Link fijo de Ana · sin red");
    await expect(editarPieza(media, conRedId, entrada())).rejects.toMatchObject({ status: 422 });
  });

  it("marcar publicada es idempotente y editar no cambia creador ni programa", async () => {
    const id = await crearPieza(media, entrada());
    expect(await marcarPublicada(media, id)).toBe(true);
    expect(await marcarPublicada(media, id)).toBe(false);
    expect(await editarPieza(media, id, { nombre: "Reel de prueba", tipoId, red: "tiktok", fechaPublicacion: "2026-10-31" })).toBe(true);
    expect(await editarPieza(media, id, { nombre: "Reel de prueba", tipoId, red: "tiktok", fechaPublicacion: "2026-10-31" })).toBe(false);
    const [p] = await db.select().from(piezas).where(eq(piezas.id, id));
    expect(p.programId).toBe(programA);
    expect(p.creadorId).toBe(creadorConPrograma);
    expect(p.red).toBe("tiktok");
  });

  it("descartar anula con quien y por que, no borra, y la pieza deja de listarse y de editarse", async () => {
    const id = await crearPieza(media, entrada());
    await expect(descartarPieza(media, id, "  ")).rejects.toMatchObject({ status: 400 });
    expect(await descartarPieza(media, id, "mala toma")).toBe(true);
    expect(await descartarPieza(media, id, "mala toma")).toBe(false);
    const [p] = await db.select().from(piezas).where(eq(piezas.id, id));
    expect(p.anuladoPor).toBe(media.id);
    expect(p.motivoAnulacion).toBe("mala toma");
    expect(await piezasDelCreador(media, creadorConPrograma)).toEqual([]);
    await expect(editarPieza(media, id, { nombre: "Reel de prueba", tipoId, red: "instagram", fechaPublicacion: "2026-10-30" })).rejects.toMatchObject({ status: 422 });
  });

  it("frontera: quien no trabaja contenido, o tiene el programa fuera de alcance, recibe 403", async () => {
    await expect(crearPieza(closer, entrada())).rejects.toMatchObject({ status: 403 });
    await expect(crearPieza(mediaAcotado, entrada())).rejects.toMatchObject({ status: 403 });
    // Un creador sin programa lo ve solo quien no tiene alcance limitado.
    await expect(crearPieza(mediaAcotado, entrada({ creadorId: creadorSinPrograma }))).rejects.toMatchObject({ status: 403 });
    await expect(crearPieza(media, entrada({ creadorId: creadorSinPrograma }))).resolves.toBeTruthy();
  });

  it("un creador o tipo desactivado no recibe piezas nuevas", async () => {
    await creadores(db).desactivar(media.id, creadorConPrograma);
    await expect(crearPieza(media, entrada())).rejects.toMatchObject({ status: 422 });
  });

  it("borrarSiNoSeUso: un creador y un tipo con piezas se desactivan, no se borran", async () => {
    await crearPieza(media, entrada());
    const c = await creadores(db).borrarSiNoSeUso(media.id, creadorConPrograma);
    expect(c).toMatchObject({ borrado: false });
    const t = await tiposDePieza(db).borrarSiNoSeUso(media.id, tipoId);
    expect(t).toMatchObject({ borrado: false });
    expect(await db.select().from(tablaCreadores).where(eq(tablaCreadores.id, creadorConPrograma))).toHaveLength(1);
    expect(await db.select().from(tiposPieza).where(eq(tiposPieza.id, tipoId))).toHaveLength(1);
  });

  it("los codigos son aleatorios y distintos", () => {
    const codigos = new Set(Array.from({ length: 200 }, generarCodigoDePieza));
    expect(codigos.size).toBe(200);
  });
});

describe("317: el link de la pieza", () => {
  it("la campana es <tipo>_<creador>_<aaaammdd>, o sin fecha si es permanente", () => {
    expect(campanaDePieza({ tipo: "Reel", creadorSlug: "ana", fechaPublicacion: "2026-10-30", permanente: false })).toBe("Reel_ana_20261030");
    expect(campanaDePieza({ tipo: "Reel", creadorSlug: "ana", fechaPublicacion: null, permanente: true })).toBe("Reel_ana");
  });

  it("🩸 el link cae en Orgánico y el emparejador reconoce la pieza del link que el generador acaba de producir", async () => {
    const id = await crearPieza(media, entrada());
    const link = await linkDeLaPieza(media, id);
    const url = new URL(link);
    expect(url.origin + url.pathname).toBe("https://form.typeform.com/to/aaa");
    const q = (k: string) => url.searchParams.get(k);
    expect(q("utm_source")).toBe("instagram");
    expect(q("utm_medium")).toBe(UTM_MEDIUM_CONTENIDO);
    expect(q("utm_campaign")).toBe("reel_ana_20261030");
    const [p] = await db.select().from(piezas).where(eq(piezas.id, id));
    expect(q("utm_content")).toBe(p.codigo);
    expect(url.searchParams.getAll("utm_source")).toEqual(["instagram"]);

    const utms = {
      fbclid: null, source: q("utm_source"), medium: q("utm_medium"), campaign: q("utm_campaign"),
      content: q("utm_content"), term: q("utm_term"), id: q("utm_id"), idsMeta: { adId: null, adsetId: null, campaignId: null },
    };
    expect(resolverCanal(utms)).toMatchObject({ area: "organico", regla: "con_utm" });
    const dato: PiezasDelPrograma = {
      programId: programA,
      piezas: [{ id: p.id, codigo: p.codigo, creadorId: p.creadorId, programId: p.programId, anulada: false }],
    };
    const traza = emparejar(utms, ARBOL_VACIO, dato);
    expect(traza.pieza).toEqual({ piezaId: p.id, creadorId: p.creadorId });
    expect(traza.origen.area).toBe("organico");
    expect(traza.avisos).toEqual([]);
  });

  it("el link fijo sin red usa source=creador y su codigo resuelve a la pieza", async () => {
    await expect(linkFijoDelCreador(db, creadorConPrograma, null)).rejects.toMatchObject({ status: 404 });
    const id = await crearLinkFijoDeCreador(media, { creadorId: creadorConPrograma, tipoId, red: null });
    const link = await linkFijoDelCreador(db, creadorConPrograma, null);
    const url = new URL(link);
    expect(url.searchParams.get("utm_source")).toBe(UTM_SOURCE_CREADOR);
    expect(url.searchParams.get("utm_medium")).toBe(UTM_MEDIUM_CONTENIDO);
    expect(new URL(link).searchParams.get("utm_campaign")).toBe("reel_ana");
    const [p] = await db.select().from(piezas).where(eq(piezas.id, id));
    const q = (llave: string) => url.searchParams.get(llave);
    const utms = {
      fbclid: null, source: q("utm_source"), medium: q("utm_medium"), campaign: q("utm_campaign"),
      content: q("utm_content"), term: q("utm_term"), id: q("utm_id"), idsMeta: { adId: null, adsetId: null, campaignId: null },
    };
    const traza = emparejar(utms, ARBOL_VACIO, {
      programId: programA,
      piezas: [{ id: p.id, codigo: p.codigo, creadorId: p.creadorId, programId: p.programId, anulada: false }],
    });
    expect(traza.pieza).toEqual({ piezaId: p.id, creadorId: p.creadorId });
    expect(traza.avisos).toEqual([]);
  });

  it("pieza de un creador sin programa: sin link y con el porque (422)", async () => {
    const id = await crearPieza(media, entrada({ creadorId: creadorSinPrograma }));
    await expect(linkDeLaPieza(media, id)).rejects.toMatchObject({ status: 422, message: expect.stringContaining("no tiene programa") });
  });

  it("programa sin fuente principal y pieza descartada: 422", async () => {
    const id = await crearPieza(media, entrada());
    await db.update(sources).set({ principal: false }).where(eq(sources.programId, programA));
    await expect(linkDePieza(db, id)).rejects.toMatchObject({ status: 422 });
    await db.update(sources).set({ principal: true }).where(eq(sources.programId, programA));
    await descartarPieza(media, id, "x");
    await expect(linkDePieza(db, id)).rejects.toMatchObject({ status: 422 });
  });
});

describe("318: el emparejador reconoce la pieza", () => {
  const base = { fbclid: null, source: "instagram", medium: "contenido", campaign: "reel_ana", term: null, id: null, idsMeta: { adId: null, adsetId: null, campaignId: null } };
  const pieza = (o: Partial<PiezasDelPrograma["piezas"][number]> = {}) => ({ id: "p1", codigo: "abcd2345", creadorId: "c1", programId: "prog-a", anulada: false, ...o });
  const ctx = (...p: PiezasDelPrograma["piezas"][number][]): PiezasDelPrograma => ({ programId: "prog-a", piezas: p });

  it("resuelve la pieza viva del mismo programa, sin importar mayusculas ni el orden de las piezas", () => {
    const a = pieza();
    const b = pieza({ id: "p2", codigo: "zzzz2222" });
    const t1 = emparejar({ ...base, content: "ABCD2345" }, ARBOL_VACIO, ctx(a, b));
    const t2 = emparejar({ ...base, content: "ABCD2345" }, ARBOL_VACIO, ctx(b, a));
    expect(t1.pieza).toEqual({ piezaId: "p1", creadorId: "c1" });
    expect(t2).toEqual({ ...t1 });
    expect(t1.contenido).toEqual({ formato: "pieza", codigo: "ABCD2345" });
  });

  it("codigo desconocido, pieza anulada o de otro programa: aviso, nunca asignacion", () => {
    for (const [content, piezas] of [
      ["nope0000", [pieza()]],
      ["abcd2345", [pieza({ anulada: true })]],
      ["abcd2345", [pieza({ programId: "prog-b" })]],
      ["abcd2345", [pieza({ programId: null })]],
      [null, [pieza()]],
    ] as const) {
      const t = emparejar({ ...base, content }, ARBOL_VACIO, ctx(...piezas));
      expect(t.pieza).toBeNull();
      expect(t.avisos).toContain("pieza_desconocida");
    }
  });

  it("solo con utm_medium=contenido: otro medio ignora el codigo; sin piezas como dato no hay aviso", () => {
    const t = emparejar({ ...base, medium: "referido", content: "abcd2345" }, ARBOL_VACIO, ctx(pieza()));
    expect(t.pieza).toBeNull();
    expect(t.avisos).not.toContain("pieza_desconocida");
    const sin = emparejar({ ...base, content: "abcd2345" }, ARBOL_VACIO);
    expect(sin.pieza).toBeNull();
    expect(sin.avisos).toEqual([]);
  });
});

describe("316: crear y editar creadores con la reja de media", () => {
  it("solo quien trabaja contenido; el programa y el alcance se verifican en el servidor", async () => {
    await expect(crearCreador(closer, { nombre: "X", slug: "x" })).rejects.toMatchObject({ status: 403 });
    await expect(crearTipoDePieza(closer, "Reel 2")).rejects.toMatchObject({ status: 403 });
    // media acotado a B: ni un creador de A ni uno sin programa.
    await expect(crearCreador(mediaAcotado, { nombre: "X", slug: "x", programId: programA })).rejects.toMatchObject({ status: 403 });
    await expect(crearCreador(mediaAcotado, { nombre: "X", slug: "x" })).rejects.toMatchObject({ status: 403 });
    await expect(crearCreador(mediaAcotado, { nombre: "Bea", slug: "bea", programId: programB })).resolves.toBeTruthy();
    await expect(crearCreador(media, { nombre: "Y", slug: "y", programId: programA })).resolves.toBeTruthy();
    // Editar: un creador de A le es ajeno al acotado a B, y no puede mudarlo a su programa.
    await expect(editarCreador(mediaAcotado, creadorConPrograma, { nombre: "Ana", slug: "ana", programId: programB })).rejects.toMatchObject({ status: 403 });
    await expect(editarCreador(closer, creadorConPrograma, { nombre: "Ana", slug: "ana", programId: programA })).rejects.toMatchObject({ status: 403 });
  });

  it("al asignarle programa a un creador sin programa, su permanente se relevo en la misma operacion y con rastro", async () => {
    const vieja = await crearLinkFijoDeCreador(media, { creadorId: creadorSinPrograma, tipoId, red: "instagram" });
    const [v0] = await db.select().from(piezas).where(eq(piezas.id, vieja));
    expect(v0.programId).toBeNull();
    await expect(linkFijoDelCreador(db, creadorSinPrograma, "instagram")).rejects.toMatchObject({ status: 422 });

    await editarCreador(media, creadorSinPrograma, { nombre: "Cliente Sin Programa", slug: "sinprog", programId: programA });

    const filas = await db.select().from(piezas).where(eq(piezas.creadorId, creadorSinPrograma));
    const descartada = filas.find((p) => p.id === vieja)!;
    const nueva = filas.find((p) => p.id !== vieja && p.permanente)!;
    expect(descartada.anuladoEn).not.toBeNull();
    expect(descartada.motivoAnulacion).toBe(MOTIVO_CAMBIO_DE_PROGRAMA);
    expect(nueva.programId).toBe(programA);
    expect(nueva.codigo).not.toBe(descartada.codigo);
    expect(nueva.anuladoEn).toBeNull();
    // El link fijo existe desde ese dia y lleva el codigo nuevo.
    const link = await linkFijoDelCreador(db, creadorSinPrograma, "instagram");
    expect(new URL(link).searchParams.get("utm_content")).toBe(nueva.codigo);
    const log = await db.select().from(changeLog).where(and(eq(changeLog.tabla, "piezas"), eq(changeLog.registroId, vieja)));
    expect(log.some((l) => l.campo === "motivoAnulacion" && l.valorNuevo === MOTIVO_CAMBIO_DE_PROGRAMA)).toBe(true);
  });

  it("al cambiar de programa la permanente se muda; al quedar sin programa se descarta y no se recrea", async () => {
    await crearLinkFijoDeCreador(media, { creadorId: creadorConPrograma, tipoId, red: "instagram" });
    await editarCreador(media, creadorConPrograma, { nombre: "Ana", slug: "ana", programId: programB });
    let vivas = (await db.select().from(piezas).where(eq(piezas.creadorId, creadorConPrograma))).filter((p) => p.permanente && !p.anuladoEn);
    expect(vivas).toHaveLength(1);
    expect(vivas[0].programId).toBe(programB);
    await editarCreador(media, creadorConPrograma, { nombre: "Ana", slug: "ana", programId: null });
    vivas = (await db.select().from(piezas).where(eq(piezas.creadorId, creadorConPrograma))).filter((p) => p.permanente && !p.anuladoEn);
    expect(vivas).toHaveLength(0);
  });

  it("editar sin cambiar de programa no toca las piezas", async () => {
    const id = await crearLinkFijoDeCreador(media, { creadorId: creadorConPrograma, tipoId, red: "instagram" });
    await editarCreador(media, creadorConPrograma, { nombre: "Ana Maria", slug: "ana", programId: programA });
    const [p] = await db.select().from(piezas).where(eq(piezas.id, id));
    expect(p.anuladoEn).toBeNull();
  });
});

describe("318: Hub › Origen cuenta aparte el contenido con codigo desconocido", () => {
  let fuenteA: string;

  async function envioDeContenido(content: string | null, medium = "contenido") {
    const [lead] = await db.insert(leads).values({ programId: programA, emailNormalizado: `${crypto.randomUUID()}@correo.co` }).returning();
    await db.insert(submissions).values({
      leadId: lead.id, sourceId: fuenteA, token: crypto.randomUUID(), esParcial: false,
      fechaEnvio: new Date("2026-10-20T12:00:00-05:00"), utmSource: "instagram", utmMedium: medium, utmContent: content,
    });
  }

  it("🩸 la cifra, su lista y el cargador cuadran: desconocido, descartado, de otro programa y sin codigo", async () => {
    [{ id: fuenteA }] = await db.select({ id: sources.id }).from(sources).where(eq(sources.programId, programA));
    const viva = await crearPieza(media, entrada());
    const descartada = await crearPieza(media, entrada({ fechaPublicacion: "2026-10-29" }));
    await descartarPieza(media, descartada, "mala toma");
    const deB = await crearCreadorB();
    const [pViva] = await db.select().from(piezas).where(eq(piezas.id, viva));
    const [pDescartada] = await db.select().from(piezas).where(eq(piezas.id, descartada));
    const [pDeB] = await db.select().from(piezas).where(eq(piezas.id, deB));

    await envioDeContenido(pViva.codigo.toUpperCase()); // reconocido (mayusculas no importan)
    await envioDeContenido(pDescartada.codigo); // descartada
    await envioDeContenido(pDeB.codigo); // pieza de OTRO programa
    await envioDeContenido("zzzzzzzz"); // no existe
    await envioDeContenido(null); // sin codigo
    await envioDeContenido("zzzzzzzz", "organico"); // otro medio: no cuenta

    const vista = await origenDelPrograma(db, { programId: programA, rango: { desde: "2026-10-01", hasta: "2026-10-31" }, hoy: "2026-10-31" });
    expect(vista.piezasDesconocidas.envios).toBe(4);
    expect(vista.piezasDesconocidas.lista.map((f) => f.codigo).sort()).toEqual(
      [pDescartada.codigo, pDeB.codigo, "zzzzzzzz", null].sort(),
    );
    const [lista] = await listaDeMetrica(
      "registros",
      { programId: programA, rango: { desde: "2026-10-01", hasta: "2026-10-31" }, hoy: "2026-10-31", categoria: "pieza_desconocida" },
      1,
      db,
    );
    expect(lista.subtotal.cantidad).toBe(4);
    expect(lista.filas).toHaveLength(4);
  });

  async function crearCreadorB() {
    const c = await creadores(db).crear(media.id, { nombre: "Bea", slug: "bea", programId: programB });
    return crearPieza(media, entrada({ creadorId: c.id as string }));
  }
});
