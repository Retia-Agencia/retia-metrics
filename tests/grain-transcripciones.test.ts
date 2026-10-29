import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { calls, programs, transcripcionesLlamada, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import {
  correrLecturasPendientes,
  leerYGuardarTranscript,
  llamadasPorLeer,
  MAX_INTENTOS_GRAIN,
  saludDeGrain,
} from "@/lib/grain/transcripciones";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";
import { paginaDeGrain } from "./helpers/pagina-de-grain";

const LINK = "https://grain.com/note/aaaa/bbbb";
const bien = () => vi.fn(async () => ({ ok: true, status: 200, text: async () => paginaDeGrain() }) as Response);
const http = (status: number) => vi.fn(async () => ({ ok: false, status, text: async () => "" }) as Response);

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let programId: string;

beforeAll(async () => {
  ({ db, cerrar, vaciar } = await crearBaseReutilizable());
});
afterAll(async () => cerrar());
beforeEach(async () => {
  await vaciar();
  const [p] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "r-328", nombre: "R 328", ticketUsd: "1000" }).returning();
  programId = p.id;
});

async function llamada(linkGrain: string | null, extra: Partial<typeof calls.$inferInsert> = {}) {
  const [c] = await db.insert(calls).values({ programId, resultado: "show", origen: "sheets", linkGrain, ...extra }).returning();
  return c.id;
}
const fila = async (callId: string) => (await db.select().from(transcripcionesLlamada).where(eq(transcripcionesLlamada.callId, callId)))[0];

describe("leerYGuardarTranscript", () => {
  it("guarda el crudo y es idempotente: la segunda vez no vuelve a Grain", async () => {
    const id = await llamada(LINK);
    const fetcher = bien();
    expect(await leerYGuardarTranscript(db, id, { fetcher })).toEqual({ estado: "leida", palabras: 6 });
    expect(JSON.parse((await fila(id)).crudo!).results).toHaveLength(6);
    expect(await leerYGuardarTranscript(db, id, { fetcher })).toEqual({ estado: "ya_leida" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("guarda el error, cuenta los intentos y una lectura buena lo apaga", async () => {
    const id = await llamada(LINK);
    expect(await leerYGuardarTranscript(db, id, { fetcher: http(503) })).toEqual({ estado: "fallida", codigo: "red", intentos: 1 });
    expect(await leerYGuardarTranscript(db, id, { fetcher: http(503) })).toMatchObject({ intentos: 2 });
    expect(await fila(id)).toMatchObject({ error: "red", crudo: null, intentos: 2 });
    await leerYGuardarTranscript(db, id, { fetcher: bien() });
    expect(await fila(id)).toMatchObject({ error: null, intentos: 0 });
  });

  it("un link nuevo reinicia los intentos y se relee", async () => {
    const id = await llamada(LINK);
    await leerYGuardarTranscript(db, id, { fetcher: http(503) });
    await db.update(calls).set({ linkGrain: "https://grain.com/note/cccc/dddd" }).where(eq(calls.id, id));
    expect(await leerYGuardarTranscript(db, id, { fetcher: http(503) })).toMatchObject({ intentos: 1 });
    expect((await fila(id)).linkLeido).toBe("https://grain.com/note/cccc/dddd");
  });

  it("sin link, con un link que no es de Grain o anulada, no lee ni escribe", async () => {
    const fetcher = bien();
    expect(await leerYGuardarTranscript(db, await llamada(null), { fetcher })).toEqual({ estado: "sin_link" });
    expect(await leerYGuardarTranscript(db, await llamada("https://fathom.video/share/x"), { fetcher })).toEqual({ estado: "no_es_grain" });
    expect(fetcher).not.toHaveBeenCalled();
    expect(await db.select().from(transcripcionesLlamada)).toHaveLength(0);
  });
});

describe("el cron", () => {
  it("toma lo que no tiene transcript o fallo reintentable, y salta lo leido, lo definitivo y lo agotado", async () => {
    const nueva = await llamada(LINK);
    const leida = await llamada(LINK + "1");
    await leerYGuardarTranscript(db, leida, { fetcher: bien() });
    const reintentable = await llamada(LINK + "2");
    await leerYGuardarTranscript(db, reintentable, { fetcher: http(503) });
    const definitiva = await llamada(LINK + "3");
    await leerYGuardarTranscript(db, definitiva, { fetcher: http(404) });
    const agotada = await llamada(LINK + "4");
    await leerYGuardarTranscript(db, agotada, { fetcher: http(503) });
    await db.update(transcripcionesLlamada).set({ intentos: MAX_INTENTOS_GRAIN }).where(eq(transcripcionesLlamada.callId, agotada));
    const [u] = await db.insert(users).values({ email: "g@retia.co", nombre: "G", rol: "gerente" }).returning();
    await llamada(LINK + "5", { anuladoEn: new Date(), anuladoPor: u.id, motivoAnulacion: "error" });

    expect((await llamadasPorLeer(db)).sort()).toEqual([nueva, reintentable].sort());
    expect(await correrLecturasPendientes(db, { fetcher: bien() })).toEqual({ candidatas: 2, leidas: 2, fallidas: 0 });
    expect(await llamadasPorLeer(db)).toEqual([]);
  });
});

describe("la alarma", () => {
  it("cuenta y lista las lecturas fallidas del programa, y se apaga sola al leer bien", async () => {
    const a = await llamada(LINK);
    const b = await llamada(LINK + "b");
    await leerYGuardarTranscript(db, a, { fetcher: http(503) });
    await leerYGuardarTranscript(db, b, { fetcher: http(404) });
    const salud = await saludDeGrain(db, programId);
    expect(salud).toMatchObject({ marcada: true, fallidas: 2, agotadas: 0 });
    expect(salud.lista.map((f) => f.codigo).sort()).toEqual(["no_encontrado", "red"]);

    await leerYGuardarTranscript(db, a, { fetcher: bien() });
    expect(await saludDeGrain(db, programId)).toMatchObject({ marcada: true, fallidas: 1 });
    await db.update(calls).set({ linkGrain: null }).where(eq(calls.id, b));
    expect(await saludDeGrain(db, programId)).toMatchObject({ marcada: false, fallidas: 0, lista: [] });
  });

  it("el programa es frontera", async () => {
    const id = await llamada(LINK);
    await leerYGuardarTranscript(db, id, { fetcher: http(503) });
    const [otro] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "r-328b", nombre: "R 328b", ticketUsd: "1000" }).returning();
    expect(await saludDeGrain(db, otro.id)).toMatchObject({ marcada: false });
  });
});
