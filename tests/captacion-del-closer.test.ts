import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import {
  areas,
  canales,
  changeLog,
  leads,
  miembrosPrograma,
  programs,
  sources,
  submissions,
  users,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import type { EntradaEnvio } from "@/lib/ingesta/envio";
import { ingerirEntradas } from "@/lib/ingesta/ingerir";
import { crearPersonaManual } from "@/lib/mutations/personas";
import { ARBOL_VACIO, emparejar } from "@/lib/atribucion/emparejar";
import type { CanalActivo } from "@/lib/atribucion/canal";
import {
  CAMPANA_DE_REFERIDOS,
  closerDelCodigo,
  codigoDeCaptacion,
  enlacesDeCaptacion,
} from "@/lib/atribucion/captacion-del-closer";
import { generarLink, sanearUtm } from "@/lib/atribucion/link-de-captacion";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * Ticket 086, ADR 0044: el enlace de captacion del closer y `leads.traido_por_user_id`.
 *
 * Lo que un bug aqui hace no es fallar: es dar el credito a quien no trajo al lead, o
 * borrar el de quien si (el primero gana), y "leads por area" miente sin un error. El
 * corazon: **el emparejador reconoce el enlace que el generador acaba de producir**, y la
 * ingesta resuelve su codigo al closer correcto.
 */

const MARU = "11111111-1111-4111-8111-111111111111";
const JERO = "22222222-2222-4222-8222-222222222222";

describe("el codigo y el enlace (puro)", () => {
  it("el codigo es estable, opaco, distinto por closer y sobrevive al saneo del generador", () => {
    const c = codigoDeCaptacion(MARU);
    expect(c).toMatch(/^[0-9a-f]{12}$/);
    expect(codigoDeCaptacion(MARU)).toBe(c);
    expect(codigoDeCaptacion(JERO)).not.toBe(c);
    expect(sanearUtm(c)).toBe(c);
  });

  it("un codigo solo es de un miembro: otro, nulo o desconocido no es de nadie", () => {
    expect(closerDelCodigo(codigoDeCaptacion(MARU), [MARU, JERO])).toBe(MARU);
    expect(closerDelCodigo(codigoDeCaptacion(MARU).toUpperCase(), [MARU])).toBe(MARU);
    expect(closerDelCodigo(codigoDeCaptacion(MARU), [JERO])).toBeNull();
    expect(closerDelCodigo(null, [MARU])).toBeNull();
    expect(closerDelCodigo("maru", [MARU])).toBeNull();
  });

  it("🩸 el emparejador reconoce el enlace que el generador produce y su codigo da el closer", () => {
    const canal: CanalActivo = {
      id: "c",
      nombre: "closer / referido",
      utmSource: "closer",
      utmMedium: "referido",
      areaId: "a",
      formato: "closer",
      activo: true,
    };
    const url = new URL(
      generarLink("https://form.typeform.com/to/x?utm_source=xxxxx&utm_id=xxxxx", {
        source: "closer",
        medium: "referido",
        campaign: CAMPANA_DE_REFERIDOS,
        content: codigoDeCaptacion(MARU),
      }),
    );
    const q = (k: string) => url.searchParams.get(k);
    const traza = emparejar(
      { source: q("utm_source"), medium: q("utm_medium"), campaign: q("utm_campaign"), content: q("utm_content"), term: q("utm_term"), id: q("utm_id") },
      [canal],
      ARBOL_VACIO,
    );
    expect(traza.origen).toEqual({ tipo: "canal", canal });
    expect(traza.contenido?.formato).toBe("closer");
    const codigo = traza.contenido?.formato === "closer" ? traza.contenido.codigoCloser : null;
    expect(closerDelCodigo(codigo, [JERO, MARU])).toBe(MARU);
    // El enlace no trae el nombre de nadie: solo el codigo.
    expect(url.toString().toLowerCase()).not.toContain("maru");
  });
});

let db: Db;
let cerrar: () => Promise<void>;
let programA: string;
let programB: string;
let fuenteA: string;
let maru: string;
let jero: string;
let ajeno: string;

const CAMPOS = {
  token: "Token",
  correo: "Correo",
  nombre: "Nombre",
  fechaEnvio: "Submitted At",
  utmSource: "utm_source",
  utmMedium: "utm_medium",
  utmCampaign: "utm_campaign",
  utmContent: "utm_content",
} as const;

/** Un envio del programa A con los UTM dados. */
function envio(o: { token: string; correo: string; fecha: string; utm?: Record<string, string> }): EntradaEnvio {
  return {
    sourceId: fuenteA,
    zona: "UTC",
    posicion: null,
    columnas: {
      Token: o.token,
      Correo: o.correo,
      Nombre: "",
      "Submitted At": o.fecha,
      utm_source: o.utm?.source ?? "",
      utm_medium: o.utm?.medium ?? "",
      utm_campaign: o.utm?.campaign ?? "",
      utm_content: o.utm?.content ?? "",
    },
    campos: { ...CAMPOS },
  };
}

const delCloser = (userId: string) => ({
  source: "closer",
  medium: "referido",
  campaign: "referidos",
  content: codigoDeCaptacion(userId),
});

async function traidoPor(correo: string, programId = programA) {
  const [l] = await db.select().from(leads).where(eq(leads.emailNormalizado, correo));
  expect(l?.programId).toBe(programId);
  return l.traidoPorUserId;
}

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  const [a] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "a", nombre: "A", ticketUsd: "797" }).returning();
  const [b] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "b", nombre: "B", ticketUsd: "1500" }).returning();
  programA = a.id;
  programB = b.id;
  const [fa] = await db
    .insert(sources)
    .values({ programId: programA, nombre: "Typeform A", tipo: "webhook", proveedor: "typeform", activo: true, principal: true, urlPublica: "https://form.typeform.com/to/aaa" })
    .returning();
  fuenteA = fa.id;
  await db
    .insert(sources)
    .values({ programId: programB, nombre: "Typeform B", tipo: "webhook", proveedor: "typeform", activo: true, principal: true, urlPublica: "https://form.typeform.com/to/bbb" });
  const nuevos = await db
    .insert(users)
    .values([
      { email: "maru@retiagrowth.com", rol: "closer", nombre: "Maru" },
      { email: "jero@retiagrowth.com", rol: "closer", nombre: "Jero" },
      { email: "ajeno@retiagrowth.com", rol: "closer", nombre: "Ajeno" },
    ])
    .returning();
  [maru, jero, ajeno] = nuevos.map((u) => u.id);
  await db.insert(miembrosPrograma).values([
    { userId: maru, programId: programA },
    { userId: maru, programId: programB },
    { userId: jero, programId: programA },
    { userId: ajeno, programId: programB },
  ]);
  const existente = await db.select().from(canales).where(eq(canales.formato, "closer"));
  if (existente.length === 0) {
    const [area] = await db.insert(areas).values({ nombre: "Referidos" }).returning();
    await db.insert(canales).values({ nombre: "closer / referido", utmSource: "closer", utmMedium: "referido", areaId: area.id, formato: "closer" });
  }
}, 60_000);

afterEach(async () => {
  await cerrar();
});

describe("la ingesta escribe quien trajo al lead", () => {
  it("un lead que entra por el enlace de un closer queda con traido_por del closer", async () => {
    await ingerirEntradas(db, programA, [envio({ token: "t1", correo: "ana@x.co", fecha: "2026-10-01T15:00:00Z", utm: delCloser(maru) })]);
    expect(await traidoPor("ana@x.co")).toBe(maru);
  });

  it("🩸 el primero gana: un segundo envio por otra via (u otro closer) no lo pisa, y deja el envio guardado", async () => {
    await ingerirEntradas(db, programA, [envio({ token: "t1", correo: "ana@x.co", fecha: "2026-10-01T15:00:00Z", utm: delCloser(maru) })]);
    await ingerirEntradas(db, programA, [
      envio({ token: "t2", correo: "ana@x.co", fecha: "2026-10-02T15:00:00Z", utm: { source: "facebook", medium: "paid_social", campaign: "c" } }),
      envio({ token: "t3", correo: "ana@x.co", fecha: "2026-10-03T15:00:00Z", utm: delCloser(jero) }),
    ]);
    expect(await traidoPor("ana@x.co")).toBe(maru);
    expect(await db.select().from(submissions)).toHaveLength(3);
  });

  it("en un mismo lote gana el envio mas antiguo", async () => {
    await ingerirEntradas(db, programA, [
      envio({ token: "t2", correo: "ana@x.co", fecha: "2026-10-02T15:00:00Z", utm: delCloser(jero) }),
      envio({ token: "t1", correo: "ana@x.co", fecha: "2026-10-01T15:00:00Z", utm: delCloser(maru) }),
    ]);
    expect(await traidoPor("ana@x.co")).toBe(maru);
  });

  it("un lead que ya existia sin traido por lo recibe, con su fila en change_log", async () => {
    await ingerirEntradas(db, programA, [envio({ token: "t1", correo: "ana@x.co", fecha: "2026-10-01T15:00:00Z" })]);
    expect(await traidoPor("ana@x.co")).toBeNull();
    await ingerirEntradas(db, programA, [envio({ token: "t2", correo: "ana@x.co", fecha: "2026-10-02T15:00:00Z", utm: delCloser(jero) })]);
    expect(await traidoPor("ana@x.co")).toBe(jero);
    const log = await db.select().from(changeLog).where(eq(changeLog.campo, "traidoPorUserId"));
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ tabla: "leads", valorAnterior: null, valorNuevo: jero, origen: "sync" });
  });

  it("🩸 el programa es frontera: el codigo de alguien sin membresia en ese programa no acredita a nadie", async () => {
    await ingerirEntradas(db, programA, [envio({ token: "t1", correo: "ana@x.co", fecha: "2026-10-01T15:00:00Z", utm: delCloser(ajeno) })]);
    expect(await traidoPor("ana@x.co")).toBeNull();
  });

  it("un usuario desactivado no recibe credito aunque conserve la membresia", async () => {
    await db.update(users).set({ activo: false }).where(eq(users.id, jero));
    await ingerirEntradas(db, programA, [envio({ token: "t1", correo: "ana@x.co", fecha: "2026-10-01T15:00:00Z", utm: delCloser(jero) })]);
    expect(await traidoPor("ana@x.co")).toBeNull();
  });

  it("gana el primero que ESCRIBE: un lead de Meta sin codigo que luego aplica con el enlace queda del closer", async () => {
    await ingerirEntradas(db, programA, [
      envio({ token: "t1", correo: "ana@x.co", fecha: "2026-10-01T15:00:00Z", utm: { source: "facebook", medium: "paid_social", campaign: "c" } }),
    ]);
    expect(await traidoPor("ana@x.co")).toBeNull();
    await ingerirEntradas(db, programA, [envio({ token: "t2", correo: "ana@x.co", fecha: "2026-10-05T15:00:00Z", utm: delCloser(maru) })]);
    expect(await traidoPor("ana@x.co")).toBe(maru);
  });

  it("con la membresia inactiva el codigo ya no acredita", async () => {
    await db.update(miembrosPrograma).set({ activo: false }).where(eq(miembrosPrograma.userId, jero));
    await ingerirEntradas(db, programA, [envio({ token: "t1", correo: "ana@x.co", fecha: "2026-10-01T15:00:00Z", utm: delCloser(jero) })]);
    expect(await traidoPor("ana@x.co")).toBeNull();
  });

  it("el codigo en utm_content de OTRO canal no se lee como closer (ADR 0051)", async () => {
    await ingerirEntradas(db, programA, [
      envio({ token: "t1", correo: "ana@x.co", fecha: "2026-10-01T15:00:00Z", utm: { source: "instagram", medium: "stories", campaign: "x", content: codigoDeCaptacion(maru) } }),
    ]);
    expect(await traidoPor("ana@x.co")).toBeNull();
  });
});

describe("el alta manual", () => {
  it("queda con entrada crm, sin envio y SIN traido por: solo la ingesta lo escribe (ADR 0044 punto 2)", async () => {
    const { persona } = await crearPersonaManual(db, { id: maru, rol: "closer", closerId: null }, { programId: programA, correo: "beto@x.co" });
    expect(persona.entrada).toBe("crm");
    expect(await traidoPor("beto@x.co")).toBeNull();
    expect(await db.select().from(submissions).where(eq(submissions.leadId, persona.id))).toHaveLength(0);
  });

  it("si despues aplica por el enlace de un closer, la ingesta lo acredita", async () => {
    await crearPersonaManual(db, { id: maru, rol: "closer", closerId: null }, { programId: programA, correo: "beto@x.co" });
    await ingerirEntradas(db, programA, [envio({ token: "t1", correo: "beto@x.co", fecha: "2026-10-01T15:00:00Z", utm: delCloser(jero) })]);
    expect(await traidoPor("beto@x.co")).toBe(jero);
  });
});

describe("los enlaces de un closer", () => {
  it("un closer en dos programas tiene dos URL distintas, cada una a su formulario, y ninguna se guarda", async () => {
    const antes = JSON.stringify(await db.select().from(leads));
    const enlaces = await enlacesDeCaptacion(db, maru);
    expect(enlaces.map((e) => e.programa)).toEqual(["A", "B"]);
    const urls = enlaces.map((e) => (e.ok ? e.url : null));
    expect(urls[0]).toContain("form.typeform.com/to/aaa");
    expect(urls[1]).toContain("form.typeform.com/to/bbb");
    expect(urls[0]).not.toBe(urls[1]);
    for (const u of urls) expect(new URL(u!).searchParams.get("utm_content")).toBe(codigoDeCaptacion(maru));
    expect(JSON.stringify(await db.select().from(leads))).toBe(antes);
  });

  it("sin fuente principal el programa dice por que, en vez de dar una URL rota", async () => {
    await db.update(sources).set({ principal: false }).where(eq(sources.programId, programB));
    const enlaces = await enlacesDeCaptacion(db, maru);
    const b = enlaces.find((e) => e.programId === programB)!;
    expect(b.ok).toBe(false);
    if (!b.ok) expect(b.error).toMatch(/formulario principal.*gerente/i);
  });

  it("solo de los programas con membresia activa", async () => {
    expect((await enlacesDeCaptacion(db, ajeno)).map((e) => e.programId)).toEqual([programB]);
  });
});

describe("guardian: nadie mas escribe traido_por_user_id", () => {
  it("solo la ingesta lo escribe (ADR 0044 punto 2)", () => {
    const permitidos = new Set(["lib/ingesta/ingerir.ts", "lib/db/schema.ts"]);
    const raiz = process.cwd();
    const archivos: string[] = [];
    const recorrer = (dir: string) => {
      for (const nombre of readdirSync(join(raiz, dir))) {
        const rel = `${dir}/${nombre}`;
        if (nombre === "node_modules" || nombre.startsWith(".")) continue;
        if (statSync(join(raiz, rel)).isDirectory()) recorrer(rel);
        else if (/\.(ts|tsx)$/.test(nombre)) archivos.push(rel);
      }
    };
    for (const d of ["lib", "app", "components", "scripts"]) recorrer(d);
    // Escribir es `traidoPorUserId:` (un values o un set); leer es `leads.traidoPorUserId`.
    const escritores = archivos.filter((f) => /(^|[^.\w])traidoPorUserId\s*:/.test(readFileSync(join(raiz, f), "utf8")));
    expect(escritores.filter((f) => !permitidos.has(f))).toEqual([]);
    expect(escritores).toContain("lib/ingesta/ingerir.ts");
  });
});
