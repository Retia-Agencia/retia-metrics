import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { count, eq } from "drizzle-orm";
import type { PGlite } from "@electric-sql/pglite";
import type { PgTable } from "drizzle-orm/pg-core";
import {
  calificaciones,
  candidatos,
  changeLog,
  colecciones,
  coleccionesVideos,
  creadores,
  descartes,
  guionesLimpios,
  referentes,
  referentesSugeridos,
  referentesSugeridosTematicas,
  referentesTematicas,
  tandas,
  tematicas,
  transcripciones,
  trasladoCockpit,
  users,
  videosGrabados,
  videosReferentes,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { deshacerCockpit } from "@/lib/migracion/cockpit/deshacer";
import { extraerDelCockpit } from "@/lib/migracion/cockpit/extraer";
import { importarCockpit, slugDeCreador } from "@/lib/migracion/cockpit/importar";
import type { ExtraccionCockpit } from "@/lib/migracion/cockpit/tipos";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";

/**
 * Ticket 322 (ADR 0111): el traslado unico del cockpit. Lo que un bug aqui hace no es fallar:
 * es perder o duplicar calificaciones, o colgarlas del creador equivocado, sin ningun error.
 */

const NUEVAS = [
  "calificaciones", "candidatos", "colecciones", "colecciones_videos", "descartes", "guiones_limpios",
  "referentes", "referentes_sugeridos", "referentes_sugeridos_tematicas", "referentes_tematicas", "tandas",
  "tematicas", "transcripciones", "traslado_cockpit", "videos_grabados", "videos_referentes",
];

let db: Db;
let cliente: PGlite;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let actorId: string;

beforeAll(async () => {
  ({ db, cerrar, vaciar } = await crearBaseReutilizable());
  cliente = (db as Db & { $client: PGlite }).$client;
});
afterAll(async () => {
  await cerrar();
});
beforeEach(async () => {
  await vaciar();
  await cliente.exec(`TRUNCATE ${NUEVAS.map((t) => `"${t}"`).join(", ")} CASCADE`);
  const [u] = await db.insert(users).values({ email: "dev@retia.co", rol: "developer", nombre: "Dev" }).returning();
  actorId = u.id;
});

const V1 = "11111111-1111-4111-8111-111111111111";
const V2 = "22222222-2222-4222-8222-222222222222";
const P1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const P2 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2";
const R1 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1";
const R2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2";
const S1 = "cccccccc-cccc-4ccc-8ccc-ccccccccccc1";
const T1 = "dddddddd-dddd-4ddd-8ddd-ddddddddddd1";
const C1 = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1";

function muestra(): ExtraccionCockpit {
  return {
    cliente: "x",
    extraidoEn: "2026-10-29T00:00:00Z",
    tablas: {
      voces: [
        { id: V1, nombre: "María José Sánchez", client_id: "x" },
        { id: V2, nombre: "Francisco", client_id: "x" },
      ],
      proyectos: [
        { id: P1, nombre: "Liderazgo", voz_id: V1, criterios_relevancia: "c1", criterios_aprendidos: "a1", plataformas: ["instagram", "tiktok"], n: 3, activo: true, actualizado_en: "2026-09-01T00:00:00Z" },
        { id: P2, nombre: "Liderazgo", voz_id: V2, criterios_relevancia: "c2", plataformas: ["instagram"], n: null, activo: false, actualizado_en: "2026-09-02T00:00:00Z" },
      ],
      referentes: [
        { id: R1, handle: "@uno", plataforma: "instagram", activo: true, actualizado_en: "2026-09-01T00:00:00Z" },
        { id: R2, handle: "dos", plataforma: "tiktok", activo: false, notas: "n", actualizado_en: "2026-09-01T00:00:00Z" },
      ],
      referentes_proyectos: [
        { referente_id: R1, proyecto_id: P1 },
        { referente_id: R1, proyecto_id: P2 },
        { referente_id: R2, proyecto_id: P1 },
      ],
      referentes_propuestos: [{ id: S1, handle: "nuevo", plataforma: "instagram", afinidad: 0.8, estado: "pendiente", creado_en: "2026-10-01T00:00:00Z" }],
      referentes_propuestos_proyectos: [{ propuesto_id: S1, proyecto_id: P1 }],
      candidatos: [
        { id: "f1000000-0000-4000-8000-000000000001", titulo: "c", voz_id: V1, proyecto_id: P1, external_id: "x1", estado: "nuevo", origen: "motor", run_id: "run-9", viral_por_tamano: false, creado_en: "2026-10-02T00:00:00Z" },
      ],
      calificados: [
        { id: "f2000000-0000-4000-8000-000000000001", titulo: "ok", contenido_o_link: "guion", estado: "aprobado", external_id: "recA", calificado_en: "2026-09-03T00:00:00Z", creado_en: "2026-09-02T00:00:00Z", metadata: { voz: "María José Sánchez", proyecto: "Liderazgo", views: 1000, likes: 10, viral_por_tamano: true } },
        { id: "f2000000-0000-4000-8000-000000000002", titulo: "no", contenido_o_link: "g2", estado: "descartado", creado_en: "2026-09-02T00:00:00Z", metadata: { voz: "Francisco", proyecto: "Liderazgo", notas_equipo: "flojo" } },
        { id: "f2000000-0000-4000-8000-000000000003", titulo: "huerfano", contenido_o_link: "g3", estado: "aprobado", creado_en: "2026-09-02T00:00:00Z", metadata: { voz: "Nadie", proyecto: "Inexistente" } },
      ],
      descartes: [{ id: "f3000000-0000-4000-8000-000000000001", titulo: "d", proyecto_id: P1, origen: "gate", creado_en: "2026-09-04T00:00:00Z" }],
      tandas: [{ id: T1, titulo: "lote", creado_en: "2026-09-05T00:00:00Z", creada_por: "u-del-cockpit" }],
      transcripciones: [
        { id: "f4000000-0000-4000-8000-000000000001", plataforma: "instagram", external_id: "v1", url: "https://i/v1", estado: "listo", script: "texto", origen: "manual", tanda_id: T1, creado_en: "2026-09-05T00:00:00Z" },
        { id: "f4000000-0000-4000-8000-000000000002", plataforma: "tiktok", external_id: "v2", url: "https://t/v2", estado: "sin_transcript", origen: "motor", creado_en: "2026-09-05T00:00:00Z" },
      ],
      guiones_limpios: [{ plataforma: "instagram", external_id: "v1", texto: "limpio", voz_id: V1, modelo: "m", actualizado_en: "2026-09-06T00:00:00Z" }],
      colecciones: [{ id: C1, nombre: "Top", creado_en: "2026-09-07T00:00:00Z", actualizado_en: "2026-09-07T00:00:00Z" }],
      colecciones_videos: [
        { coleccion_id: C1, plataforma: "instagram", external_id: "v1", url: "https://i/v1", agregado_en: "2026-09-07T00:00:00Z" },
        { coleccion_id: C1, plataforma: "tiktok", external_id: "v2", url: "https://t/v2", agregado_en: "2026-09-07T00:00:00Z" },
      ],
      videos_meta: [{ plataforma: "instagram", external_id: "v1", titulo: "t", views: 5, fuente: "apify", traido_en: "2026-09-07T00:00:00Z" }],
      grabados: [{ id: "f5000000-0000-4000-8000-000000000001", plataforma: "instagram", external_id: "v1", url: "https://i/v1", grabado_en: "2026-09-08T00:00:00Z" }],
    },
  };
}

async function conteos() {
  const n = async (t: PgTable): Promise<number> => {
    const [f] = (await db.select({ n: count() }).from(t)) as { n: number }[];
    return f.n;
  };
  return {
    creadores: await n(creadores),
    tematicas: await n(tematicas),
    referentes: await n(referentes),
    referentesTematicas: await n(referentesTematicas),
    sugeridos: await n(referentesSugeridos),
    sugeridosTematicas: await n(referentesSugeridosTematicas),
    candidatos: await n(candidatos),
    calificaciones: await n(calificaciones),
    descartes: await n(descartes),
    tandas: await n(tandas),
    transcripciones: await n(transcripciones),
    guiones: await n(guionesLimpios),
    colecciones: await n(colecciones),
    coleccionesVideos: await n(coleccionesVideos),
    videos: await n(videosReferentes),
    grabados: await n(videosGrabados),
  };
}

describe("traslado del cockpit (322)", () => {
  it("cuadra en conteos, tabla por tabla, y cuelga cada cosa de su creador", async () => {
    const reporte = await importarCockpit(db, muestra(), actorId);
    expect(await conteos()).toEqual({
      creadores: 2, tematicas: 2, referentes: 2, referentesTematicas: 3, sugeridos: 1, sugeridosTematicas: 1,
      candidatos: 1, calificaciones: 3, descartes: 1, tandas: 1, transcripciones: 2, guiones: 1,
      colecciones: 1, coleccionesVideos: 2, videos: 1, grabados: 1,
    });
    for (const [tabla, c] of Object.entries(reporte.tablas)) expect(c.nuevas + c.yaTrasladadas, tabla).toBe(c.origen - c.omitidas);

    // La misma tematica "Liderazgo" de dos creadores: la calificacion va a la de SU voz.
    const filas = await db
      .select({ titulo: calificaciones.titulo, creador: creadores.nombre, tematicaCreador: tematicas.creadorId, creadorId: calificaciones.creadorId })
      .from(calificaciones)
      .leftJoin(creadores, eq(creadores.id, calificaciones.creadorId))
      .leftJoin(tematicas, eq(tematicas.id, calificaciones.tematicaId));
    const ok = filas.find((f) => f.titulo === "ok")!;
    const no = filas.find((f) => f.titulo === "no")!;
    expect(ok.creador).toBe("María José Sánchez");
    expect(ok.tematicaCreador).toBe(ok.creadorId);
    expect(no.creador).toBe("Francisco");
    expect(no.tematicaCreador).toBe(no.creadorId);
    expect(filas.find((f) => f.titulo === "huerfano")!.creadorId).toBeNull();

    const [creadoMJ] = await db.select().from(creadores).where(eq(creadores.slug, "maria-jose-sanchez"));
    expect(creadoMJ.programId).toBeNull();
    // Sin programa y sin colecciones atadas: lo que el cockpit no sabia no se inventa.
    expect((await db.select().from(colecciones))[0].creadorId).toBeNull();
    // El numero de la corrida de n8n se guarda como texto; los usuarios del cockpit no pasan.
    expect((await db.select().from(candidatos))[0].corridaExterna).toBe("run-9");
  });

  it("los creadores salen del molde: dejan change_log con el actor", async () => {
    await importarCockpit(db, muestra(), actorId);
    const log = await db.select().from(changeLog).where(eq(changeLog.tabla, "creadores"));
    expect(log.length).toBeGreaterThan(0);
    expect(new Set(log.map((l) => l.userId))).toEqual(new Set([actorId]));
  });

  it("es idempotente: una segunda corrida no duplica nada", async () => {
    await importarCockpit(db, muestra(), actorId);
    const antes = await conteos();
    const [{ n: huellas }] = await db.select({ n: count() }).from(trasladoCockpit);
    const segunda = await importarCockpit(db, muestra(), actorId);
    expect(await conteos()).toEqual(antes);
    expect((await db.select({ n: count() }).from(trasladoCockpit))[0].n).toBe(huellas);
    expect(Object.values(segunda.tablas).every((c) => c.nuevas === 0)).toBe(true);
  });

  it("reutiliza un creador que ya existe con ese slug y el deshacer no lo toca", async () => {
    await db.insert(creadores).values({ nombre: "Francisco", slug: "francisco" });
    const r = await importarCockpit(db, muestra(), actorId);
    expect(r.creadoresReutilizados).toBe(1);
    expect((await conteos()).creadores).toBe(2);
    const res = await deshacerCockpit(db, actorId);
    expect(res.estado).toBe("deshecho");
    expect((await db.select().from(creadores)).map((c) => c.slug)).toEqual(["francisco"]);
  });

  it("se deshace limpio: todo vuelve a cero", async () => {
    await importarCockpit(db, muestra(), actorId);
    const res = await deshacerCockpit(db, actorId);
    expect(res.estado).toBe("deshecho");
    expect(Object.values(await conteos()).every((n) => n === 0)).toBe(true);
    expect((await db.select({ n: count() }).from(trasladoCockpit))[0].n).toBe(0);
  });

  it("se niega, sin borrar nada, si alguien ya trabajo encima", async () => {
    await importarCockpit(db, muestra(), actorId);
    const [t] = await db.select().from(tematicas).limit(1);
    // Algo creado DESPUES del traslado que cuelga de lo trasladado.
    await db.insert(candidatos).values({ titulo: "nuevo", estado: "nuevo", origen: "motor", tematicaId: t.id });
    const antes = await conteos();
    const res = await db.transaction((tx) => deshacerCockpit(tx as unknown as Db, actorId).then(async (r) => {
      if (r.estado === "negado") throw Object.assign(new Error("negado"), { r });
      return r;
    })).catch((e) => (e as { r?: unknown }).r);
    expect(res).toMatchObject({ estado: "negado" });
    expect(await conteos()).toEqual(antes);
  });

  it("una red desconocida falla ruidosamente y no escribe nada", async () => {
    const m = muestra();
    m.tablas.referentes[0].plataforma = "myspace";
    await expect(db.transaction((tx) => importarCockpit(tx as unknown as Db, m, actorId))).rejects.toThrow(/Red desconocida/);
    expect((await conteos()).referentes).toBe(0);
  });

  it("slugDeCreador: sin acentos, minusculas, guiones", () => {
    expect(slugDeCreador("María José Sánchez")).toBe("maria-jose-sanchez");
    expect(slugDeCreador("  Nicolás  Martínez ")).toBe("nicolas-martinez");
  });
});

describe("extraccion (solo lectura)", () => {
  it("solo hace GET, pagina de a 1000 y acota los puentes a sus padres", async () => {
    const metodos: string[] = [];
    const pedidas: string[] = [];
    const falso = (async (url: string, init?: RequestInit) => {
      metodos.push(init?.method ?? "GET");
      pedidas.push(url);
      const tabla = url.split("/rest/v1/")[1].split("?")[0];
      const offset = Number(/offset=(\d+)/.exec(url)![1]);
      if (tabla === "transcripciones") {
        const n = offset === 0 ? 1000 : 3;
        return new Response(JSON.stringify(Array.from({ length: n }, (_, i) => ({ id: `${offset + i}` }))), { status: 200 });
      }
      if (tabla === "proyectos") return new Response(JSON.stringify([{ id: "p1" }]), { status: 200 });
      if (tabla === "referentes") return new Response(JSON.stringify([{ id: "r1" }]), { status: 200 });
      if (tabla === "referentes_proyectos") {
        return new Response(JSON.stringify([{ referente_id: "r1", proyecto_id: "p1" }, { referente_id: "ajeno", proyecto_id: "p1" }]), { status: 200 });
      }
      return new Response("[]", { status: 200 });
    }) as unknown as typeof fetch;
    const e = await extraerDelCockpit({ url: "https://x.test", llave: "k", fetch: falso }, { cliente: "c", instanceId: "i" });
    expect(new Set(metodos)).toEqual(new Set(["GET"]));
    expect(e.tablas.transcripciones).toHaveLength(1003);
    expect(e.tablas.referentes_proyectos).toHaveLength(1);
    expect(pedidas.find((u) => u.includes("/proyectos?"))).toContain("client_id=eq.c");
    expect(pedidas.find((u) => u.includes("/candidatos?"))).toContain("instance_id=eq.i");
    expect(pedidas.find((u) => u.includes("/outputs?"))).toContain("tipo=eq.guion_reel");
  });
});

// Con la extraccion REAL (solo en la maquina de quien corrio `cockpit:extraer`; `.migracion/` no se sube).
describe.skipIf(!existsSync(".migracion/cockpit.json"))("con la extraccion real", () => {
  it("cuadra en conteos contra el cockpit, se repite sin duplicar y se deshace limpio", async () => {
    const real = JSON.parse(readFileSync(".migracion/cockpit.json", "utf8")) as ExtraccionCockpit;
    const reporte = await importarCockpit(db, real, actorId);
    const c = await conteos();
    const t = real.tablas;
    expect(c).toMatchObject({
      creadores: t.voces.length, tematicas: t.proyectos.length, referentes: t.referentes.length,
      referentesTematicas: t.referentes_proyectos.length, sugeridos: t.referentes_propuestos.length,
      sugeridosTematicas: t.referentes_propuestos_proyectos.length, candidatos: t.candidatos.length,
      calificaciones: t.calificados.length, descartes: t.descartes.length, tandas: t.tandas.length,
      transcripciones: t.transcripciones.length, guiones: t.guiones_limpios.length, colecciones: t.colecciones.length,
      coleccionesVideos: t.colecciones_videos.length, videos: t.videos_meta.length, grabados: t.grabados.length,
    });
    console.log("motivos del traslado real:", JSON.stringify(reporte.motivos));
    await importarCockpit(db, real, actorId);
    expect(await conteos()).toEqual(c);
    expect((await deshacerCockpit(db, actorId)).estado).toBe("deshecho");
    expect(Object.values(await conteos()).every((n) => n === 0)).toBe(true);
  }, 120_000);
});
