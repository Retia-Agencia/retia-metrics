import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { leadContactos, leads, programs, sources, submissions } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { entradasDesdeMatriz } from "@/lib/ingesta/adaptador-sheets";
import { ingerirEntradas } from "@/lib/ingesta/ingerir";
import {
  fuentesATrasladar,
  mapeoEnvioDesdeHoja,
  resumirEntradas,
  type FuenteDeHoja,
} from "@/lib/sheets/traslado";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * El traslado unico desde Sheets (ticket 111). Dos frentes:
 *  - la logica PURA (`fuentesATrasladar`, `resumirEntradas`), sin base;
 *  - el camino real fila-de-hoja → `entradasDesdeMatriz` → `ingerirEntradas` contra
 *    PGlite con TODAS las migraciones, para probar la idempotencia sobre los indices de
 *    verdad y la costura con el webhook.
 *
 * Lo que un bug aca hace no es fallar: es duplicar un lead que ya entro por el webhook,
 * o escribir en un ensayo que Mani cree que no toca la base.
 */

// ────────────────────────────────────────────── logica pura: eleccion de pestanas

function fuente(o: Partial<FuenteDeHoja> & { id: string; nombre: string }): FuenteDeHoja {
  return {
    tipo: "google_sheet",
    sheetId: "hoja-1",
    tab: "New form",
    rango: "A1:BZ",
    tzFechas: "UTC",
    mapeoColumnas: {},
    activo: true,
    ...o,
  };
}

describe("fuentesATrasladar", () => {
  it("incluye la fuente ACTIVA y la INACTIVA (Forms viejo entra igual, ticket 079)", () => {
    const { listas } = fuentesATrasladar([
      fuente({ id: "a", nombre: "Formulario actual", tab: "New form", activo: true }),
      fuente({ id: "b", nombre: "Formulario anterior", tab: "Forms viejo", activo: false }),
    ]);
    expect(listas.map((f) => f.tab).sort()).toEqual(["Forms viejo", "New form"]);
    // La inactiva conserva su marca: el reporte la muestra distinto, pero se lee igual.
    expect(listas.find((f) => f.tab === "Forms viejo")?.activo).toBe(false);
  });

  it("descarta una fuente que no es google_sheet (un webhook no se lee de una hoja)", () => {
    const { listas, descartadas } = fuentesATrasladar([
      fuente({ id: "a", nombre: "Formulario" }),
      fuente({ id: "w", nombre: "Typeform", tipo: "webhook", sheetId: null, tab: null }),
    ]);
    expect(listas.map((f) => f.id)).toEqual(["a"]);
    expect(descartadas).toEqual([
      { fuente: expect.objectContaining({ id: "w" }), motivo: "no_es_google_sheet" },
    ]);
  });

  it("descarta una google_sheet sin hoja o sin pestana, sin adivinar", () => {
    const { listas, descartadas } = fuentesATrasladar([
      fuente({ id: "a", nombre: "Sin hoja", sheetId: null }),
      fuente({ id: "b", nombre: "Sin pestana", tab: null }),
    ]);
    expect(listas).toEqual([]);
    expect(descartadas.map((d) => d.motivo)).toEqual(["sin_hoja", "sin_hoja"]);
  });

  it("pasa la hoja, la pestana, el rango, la zona y el mapeo traducido de la fuente", () => {
    const { listas } = fuentesATrasladar([
      fuente({
        id: "a",
        nombre: "Formulario",
        sheetId: "hoja-x",
        tab: "De Cero a Tactical Investor",
        rango: "A1:CZ",
        tzFechas: "America/Bogota",
        // vocabulario de hoja: se traduce a CampoEnvio
        mapeoColumnas: { emailNormalizado: "Correo", token: "ID" },
      }),
    ]);
    expect(listas[0]).toMatchObject({
      sheetId: "hoja-x",
      tab: "De Cero a Tactical Investor",
      rango: "A1:CZ",
      zona: "America/Bogota",
      mapeo: { correo: "Correo", token: "ID" },
    });
  });
});

describe("mapeoEnvioDesdeHoja", () => {
  it("traduce el vocabulario de la hoja a CampoEnvio (incluye token, fecha y estado)", () => {
    expect(
      mapeoEnvioDesdeHoja({
        emailNormalizado: "Correo",
        fechaAplicacion: "Submitted At",
        estado: "Estado",
        telefono: "WhatsApp",
        agenda: "Agenda",
        ingresoDeclarado: "Ingreso",
      }),
    ).toEqual({
      correo: "Correo",
      fechaEnvio: "Submitted At",
      estadoHoja: "Estado",
      telefono: "WhatsApp",
    });
  });

  it("un mapeo nulo o mal formado devuelve {} (todo por defecto), sin reventar", () => {
    expect(mapeoEnvioDesdeHoja(null)).toEqual({});
    expect(mapeoEnvioDesdeHoja("roto")).toEqual({});
    expect(mapeoEnvioDesdeHoja(["a"])).toEqual({});
  });
});

// ────────────────────────────────────────────── logica pura: conteo del ensayo

const ENCABEZADOS = [
  "Token",
  "Correo electronico",
  "WhatsApp",
  "Nombre completo",
  "Submitted At",
  "Estado",
  "utm_source",
  "utm_medium",
  "utm_campaign",
];

/** Arma una matriz de hoja (encabezados + filas) para el adaptador de Sheets. */
function matriz(filas: (string | null)[][]): string[][] {
  return [ENCABEZADOS, ...filas.map((f) => f.map((c) => c ?? ""))];
}

/** Fila: [token, correo, whatsapp, nombre, fecha, estado, utmSource]. */
function fila(o: {
  token?: string;
  correo?: string;
  whatsapp?: string;
  nombre?: string;
  fecha?: string;
  estado?: string;
  utm?: string;
}): (string | null)[] {
  return [
    o.token ?? "",
    o.correo ?? "",
    o.whatsapp ?? "",
    o.nombre ?? "",
    o.fecha ?? "",
    o.estado ?? "",
    o.utm ?? "",
    "",
    "",
  ];
}

function entradasDe(filas: (string | null)[][], sourceId = "fuente-1", zona = "UTC") {
  return entradasDesdeMatriz(matriz(filas), { sourceId, zona });
}

describe("resumirEntradas", () => {
  it("cuenta filas, correos unicos (dedup), sin token, sin correo y centinelas", () => {
    const entradas = entradasDe([
      fila({ token: "t1", correo: "Ana@Correo.co", fecha: "2026-08-01T10:00:00Z" }),
      // mismo correo con otra grafia: un solo correo unico (dedup por correo)
      fila({ token: "t2", correo: "ana@correo.co", fecha: "2026-08-02T10:00:00Z" }),
      // sin token: no llega a ser envio
      fila({ correo: "beto@correo.co", fecha: "2026-08-03T10:00:00Z" }),
      // con token, sin correo
      fila({ token: "t3", fecha: "2026-08-04T10:00:00Z" }),
      // centinela de fecha: trae texto pero parsearFecha lo vuelve null
      fila({ token: "t4", correo: "caro@correo.co", fecha: "1/1/0001 0:00:00" }),
    ]);
    const r = resumirEntradas(entradas);
    expect(r.filas).toBe(5);
    expect(r.correosUnicos).toBe(2); // ana (deduplicada) + caro
    expect(r.sinToken).toBe(1);
    expect(r.sinCorreo).toBe(1);
    expect(r.fechasCentinela).toBe(1);
  });

  it("una fila sin celda de fecha (parcial legitimo) NO cuenta como centinela", () => {
    const entradas = entradasDe([fila({ token: "t1", correo: "ana@correo.co", fecha: "" })]);
    const r = resumirEntradas(entradas);
    expect(r.fechasCentinela).toBe(0);
  });
});

// ────────────────────────────────────────────── camino real contra PGlite

let db: Db;
let cerrar: () => Promise<void>;
let programId: string;
let sourceId: string;

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  const [p] = await db
    .insert(programs)
    .values({ ...PROGRAMA_DE_PRUEBA, slug: "comunicarte", nombre: "Comunicarte", ticketUsd: "797" })
    .returning();
  programId = p.id;
  const [f] = await db
    .insert(sources)
    .values({ programId, nombre: "Formulario", tipo: "google_sheet", sheetId: "hoja", tab: "New form" })
    .returning();
  sourceId = f.id;
});

afterEach(async () => {
  await cerrar();
});

async function contar() {
  const ls = await db.select().from(leads).where(eq(leads.programId, programId));
  const ss = await db.select().from(submissions).where(eq(submissions.sourceId, sourceId));
  const cs = await db.select().from(leadContactos).where(eq(leadContactos.programId, programId));
  return { leads: ls.length, submissions: ss.length, contactos: cs.length };
}

describe("traslado contra la base", () => {
  it("las filas de una hoja se ingieren: leads, envios y contactos", async () => {
    const entradas = entradasDe([
      fila({ token: "t1", correo: "ana@correo.co", whatsapp: "300 123 4567", fecha: "2026-08-01T10:00:00Z" }),
      fila({ token: "t2", correo: "beto@correo.co", fecha: "2026-08-02T10:00:00Z" }),
    ]).map((e) => ({ ...e, sourceId }));

    await ingerirEntradas(db, programId, entradas, { aplicarReglaDeDeals: false });

    expect(await contar()).toMatchObject({ leads: 2, submissions: 2 });
  });

  it("correrlo DOS veces no duplica (idempotente sobre (fuente, token, es_parcial))", async () => {
    const entradas = entradasDe([
      fila({ token: "t1", correo: "ana@correo.co", fecha: "2026-08-01T10:00:00Z" }),
      fila({ token: "t2", correo: "beto@correo.co", fecha: "2026-08-02T10:00:00Z" }),
    ]).map((e) => ({ ...e, sourceId }));

    await ingerirEntradas(db, programId, entradas, { aplicarReglaDeDeals: false });
    const primera = await contar();
    await ingerirEntradas(db, programId, entradas, { aplicarReglaDeDeals: false });
    const segunda = await contar();

    expect(segunda).toEqual(primera);
    expect(segunda.leads).toBe(2);
    expect(segunda.submissions).toBe(2);
  });

  it("un lead trasladado que DESPUES llega por la misma puerta (webhook) no se duplica", async () => {
    // Traslado desde la hoja.
    const desdeHoja = entradasDe([
      fila({ token: "t1", correo: "ana@correo.co", fecha: "2026-08-01T10:00:00Z", estado: "🗑️ Descartado" }),
    ]).map((e) => ({ ...e, sourceId }));
    await ingerirEntradas(db, programId, desdeHoja, { aplicarReglaDeDeals: false });

    // El mismo token vuelve por la misma fuente (lo que hace el webhook de Typeform):
    // misma llave (fuente, token, es_parcial), asi que actualiza en vez de duplicar.
    const porWebhook = entradasDe([
      fila({ token: "t1", correo: "ana@correo.co", fecha: "2026-08-01T10:00:00Z", estado: "🗑️ Descartado" }),
    ]).map((e) => ({ ...e, sourceId }));
    await ingerirEntradas(db, programId, porWebhook, { aplicarReglaDeDeals: false });

    const c = await contar();
    expect(c.leads).toBe(1);
    expect(c.submissions).toBe(1);
  });

  it("el ENSAYO (transaccion revertida) no deja NADA escrito", async () => {
    const entradas = entradasDe([
      fila({ token: "t1", correo: "ana@correo.co", fecha: "2026-08-01T10:00:00Z" }),
    ]).map((e) => ({ ...e, sourceId }));

    // Reproduce lo que hace el script en ensayo: ingiere dentro de una transaccion y
    // fuerza el rollback lanzando.
    const marca = Symbol("rollback");
    await expect(
      (db as { transaction: <T>(fn: (tx: Db) => Promise<T>) => Promise<T> }).transaction(async (tx) => {
        await ingerirEntradas(tx, programId, entradas, { aplicarReglaDeDeals: false });
        throw marca;
      }),
    ).rejects.toBe(marca);

    expect(await contar()).toEqual({ leads: 0, submissions: 0, contactos: 0 });
  });

  it("un centinela 1/1/0001 no envenena la fecha del lead (entra como parcial, fecha null)", async () => {
    // La fila buena y la centinela con el MISMO correo: el dedup conserva la fecha real,
    // no el ano 1 (🩸 839 de 1.034 personas perdieron su fecha asi).
    const entradas = entradasDe([
      fila({ token: "bueno", correo: "ana@correo.co", fecha: "2026-08-01T10:00:00Z" }),
      fila({ token: "centinela", correo: "ana@correo.co", fecha: "1/1/0001 0:00:00" }),
    ]).map((e) => ({ ...e, sourceId }));

    await ingerirEntradas(db, programId, entradas, { aplicarReglaDeDeals: false });

    const [lead] = await db.select().from(leads).where(eq(leads.programId, programId));
    expect(lead.fechaPrimeraAplicacion).not.toBeNull();
    expect(lead.fechaPrimeraAplicacion!.getUTCFullYear()).toBe(2026);
  });
});
