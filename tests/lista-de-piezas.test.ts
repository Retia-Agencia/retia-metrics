import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { creadores, piezas, programs, tiposPieza } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ESTADOS_DE_PIEZA, estadoDePieza } from "@/lib/media/estado-de-pieza";
import { filtroDePiezasDesdeUrl, hayFiltroActivo, piezasDeMedia, PIEZAS_POR_PAGINA } from "@/lib/media/lista-de-piezas";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * Ticket 321: la lista de piezas filtra, ordena y pagina en SQL. Lo que un bug aqui hace no es
 * fallar: es mostrar una pieza de otro programa o contar mal. El estado se decide en dos
 * lugares (la insignia y el filtro) y los dos tienen que dar lo mismo.
 */
let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let creadorA: string;
let creadorB: string;
let ajeno: string;
let tipoReel: string;
let tipoHistoria: string;
const HOY = "2026-10-29";

beforeAll(async () => {
  ({ db, cerrar, vaciar } = await crearBaseReutilizable());
});
afterAll(async () => {
  await cerrar();
});

let n = 0;
async function pieza(o: Partial<typeof piezas.$inferInsert> & { creadorId: string }) {
  n += 1;
  const [p] = await db
    .insert(piezas)
    .values({ nombre: `Pieza ${n}`, tipoId: tipoReel, red: "instagram", codigo: `cod${String(n).padStart(5, "0")}`, fechaPublicacion: "2026-11-05", ...o })
    .returning();
  return p;
}

beforeEach(async () => {
  await vaciar();
  const [pa] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "a", nombre: "A", ticketUsd: "797" }).returning();
  const [pb] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "b", nombre: "B", ticketUsd: "1500" }).returning();
  const [r, h] = await db.insert(tiposPieza).values([{ nombre: "Reel" }, { nombre: "Historia" }]).returning();
  tipoReel = r.id;
  tipoHistoria = h.id;
  const [a, b, x] = await db
    .insert(creadores)
    .values([
      { nombre: "Ana", slug: "ana", programId: pa.id },
      { nombre: "Beto", slug: "beto", programId: pa.id },
      { nombre: "Ajeno", slug: "ajeno", programId: pb.id },
    ])
    .returning();
  creadorA = a.id;
  creadorB = b.id;
  ajeno = x.id;
}, 60_000);

describe("filtro desde la URL", () => {
  it("valida contra listas blancas: un valor raro vuelve al default", () => {
    const f = filtroDePiezasDesdeUrl({ estado: "inventado", creador: "no-es-uuid", red: "myspace", orden: "drop table", q: "  hola  " });
    expect(f).toMatchObject({ estado: null, creadorId: null, tipoId: null, red: null, q: "hola", orden: "creada:desc" });
    expect(hayFiltroActivo(f)).toBe(true);
    expect(hayFiltroActivo(filtroDePiezasDesdeUrl({}))).toBe(false);
  });
});

describe("la lista de piezas", () => {
  it("el estado del filtro coincide con el de la insignia para cada pieza", async () => {
    await pieza({ creadorId: creadorA, nombre: "futura", fechaPublicacion: "2026-11-05" });
    await pieza({ creadorId: creadorA, nombre: "hoy", fechaPublicacion: HOY });
    await pieza({ creadorId: creadorA, nombre: "vieja", fechaPublicacion: "2026-10-01" });
    await pieza({ creadorId: creadorA, nombre: "fija", fechaPublicacion: null, permanente: true });
    await pieza({ creadorId: creadorA, nombre: "publicada", fechaPublicacion: "2026-10-01", publicadaEn: new Date() });
    await pieza({ creadorId: creadorA, nombre: "fija publicada", fechaPublicacion: null, permanente: true, publicadaEn: new Date(), red: "tiktok" });
    const todas = await piezasDeMedia(db, [creadorA], filtroDePiezasDesdeUrl({}), HOY, 1);
    expect(todas.total).toBe(6);
    let suma = 0;
    for (const estado of ESTADOS_DE_PIEZA) {
      const r = await piezasDeMedia(db, [creadorA], filtroDePiezasDesdeUrl({ estado }), HOY, 1);
      expect(r.filas.every((p) => estadoDePieza(p, HOY) === estado)).toBe(true);
      expect(r.total).toBe(todas.filas.filter((p) => estadoDePieza(p, HOY) === estado).length);
      suma += r.total;
    }
    expect(suma).toBe(6); // los cuatro estados reparten todas las piezas, sin solaparse
  });

  it("el programa es frontera: ignora piezas de creadores fuera de la lista y un creador ajeno en la URL", async () => {
    await pieza({ creadorId: creadorA });
    await pieza({ creadorId: ajeno });
    const sinFiltro = await piezasDeMedia(db, [creadorA, creadorB], filtroDePiezasDesdeUrl({}), HOY, 1);
    expect(sinFiltro.total).toBe(1);
    const forzado = await piezasDeMedia(db, [creadorA, creadorB], filtroDePiezasDesdeUrl({ creador: ajeno }), HOY, 1);
    expect(forzado.total).toBe(1);
    expect((await piezasDeMedia(db, [], filtroDePiezasDesdeUrl({}), HOY, 1)).total).toBe(0);
  });

  it("no cuenta las descartadas", async () => {
    await pieza({ creadorId: creadorA });
    await pieza({ creadorId: creadorA, anuladoEn: new Date(), motivoAnulacion: "x" });
    expect((await piezasDeMedia(db, [creadorA], filtroDePiezasDesdeUrl({}), HOY, 1)).total).toBe(1);
  });

  it("filtra por creador, tipo, red y texto (literal: % no es comodin)", async () => {
    await pieza({ creadorId: creadorA, nombre: "Objeción del precio", tipoId: tipoHistoria, red: "tiktok" });
    await pieza({ creadorId: creadorB, nombre: "100% real" });
    await pieza({ creadorId: creadorB, nombre: "Otra" });
    const cuenta = async (q: Record<string, string>) => (await piezasDeMedia(db, [creadorA, creadorB], filtroDePiezasDesdeUrl(q), HOY, 1)).total;
    expect(await cuenta({ creador: creadorB })).toBe(2);
    expect(await cuenta({ tipo: tipoHistoria })).toBe(1);
    expect(await cuenta({ red: "tiktok" })).toBe(1);
    expect(await cuenta({ q: "precio" })).toBe(1);
    expect(await cuenta({ q: "beto" })).toBe(2); // por nombre del creador
    expect(await cuenta({ q: "%" })).toBe(1); // solo "100% real"
    expect(await cuenta({ q: "_" })).toBe(0);
  });

  it("ordena por creador, nombre y fecha (las siempre visibles al final)", async () => {
    await pieza({ creadorId: creadorB, nombre: "B pieza", fechaPublicacion: "2026-11-01" });
    await pieza({ creadorId: creadorA, nombre: "Z pieza", fechaPublicacion: "2026-11-09" });
    await pieza({ creadorId: creadorA, nombre: "M pieza", fechaPublicacion: null, permanente: true });
    const nombres = async (orden: string) => (await piezasDeMedia(db, [creadorA, creadorB], filtroDePiezasDesdeUrl({ orden }), HOY, 1)).filas.map((p) => p.nombre);
    expect(await nombres("nombre:asc")).toEqual(["B pieza", "M pieza", "Z pieza"]);
    expect(await nombres("fecha:asc")).toEqual(["B pieza", "Z pieza", "M pieza"]);
    expect(await nombres("fecha:desc")).toEqual(["Z pieza", "B pieza", "M pieza"]);
    expect((await nombres("creador:desc"))[0]).toBe("B pieza");
    expect((await nombres("creador:asc"))[2]).toBe("B pieza");
  });

  it("pagina: el total no depende de la pagina y una pagina fuera de rango cae en la ultima", async () => {
    for (let i = 0; i < PIEZAS_POR_PAGINA + 3; i++) await pieza({ creadorId: creadorA });
    const f = filtroDePiezasDesdeUrl({});
    const p1 = await piezasDeMedia(db, [creadorA], f, HOY, 1);
    const p2 = await piezasDeMedia(db, [creadorA], f, HOY, 2);
    const p9 = await piezasDeMedia(db, [creadorA], f, HOY, 9);
    expect([p1.total, p2.total, p1.paginas]).toEqual([PIEZAS_POR_PAGINA + 3, PIEZAS_POR_PAGINA + 3, 2]);
    expect(p1.filas).toHaveLength(PIEZAS_POR_PAGINA);
    expect(p2.filas).toHaveLength(3);
    expect(p9.pagina).toBe(2);
    expect(new Set([...p1.filas, ...p2.filas].map((p) => p.id)).size).toBe(PIEZAS_POR_PAGINA + 3);
  });
});
