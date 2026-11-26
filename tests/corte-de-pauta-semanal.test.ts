import { eq } from "drizzle-orm";
import type { PGlite } from "@electric-sql/pglite";
import { GET } from "@/app/(app)/p/[programa]/hub/pauta-semanal.csv/route";
import { listaDeMetrica } from "@/lib/queries/metricas-con-filas";
import type { CortePauta } from "@/lib/queries/atribucion-de-pauta";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  calls, cuentasPublicitarias, deals, dealEtapaHistorial, gastoPauta, leads, pautaObjetos, programs, sources,
  submissions, tasasCambio,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { csvDePautaSemanal } from "@/lib/pauta/csv-tabla-semanal";
import { cargarPautaSemanal, type ClavePautaSemanal, type VistaPautaSemanal } from "@/lib/queries/hechos/pauta-semanal";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { duenoDePrueba } from "./helpers/dueno-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";
import { lineaConCupoDePrueba } from "./helpers/catalogo-de-prueba";

const base = vi.hoisted(() => ({ db: null as Db | null, programId: "" }));
vi.mock("@/lib/db", () => ({ get db() { return base.db; } }));
vi.mock("@/lib/auth/guards", () => ({
  requireSession: async () => ({ user: { id: "sesion" } }),
  respuestaDeError: (error: unknown) => { throw error; },
}));
vi.mock("@/lib/format", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/format")>(),
  hoyEnBogota: () => "2026-10-18",
}));
vi.mock("@/lib/auth/vista", () => ({ rolDeVista: async () => "developer" }));
vi.mock("@/lib/auth/alcance", () => ({
  programaVisiblePorSlug: async () => ({ id: base.programId, slug: "dorado-pauta" }),
}));

let db: Db;
let cuentaId: string;
let campanaUuid: string;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let programId: string;
let sourceId: string;
let anuncioId: string;
let secuencia = 0;

const SEMANA_1 = { desde: "2026-10-05", hasta: "2026-10-11" };
const HOY = "2026-10-18";

beforeAll(async () => {
  ({ db, cerrar, vaciar } = await crearBaseReutilizable());
});
afterAll(async () => cerrar());
beforeEach(async () => {
  await vaciar();
  programId = (await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "dorado-pauta", nombre: "Dorado Pauta" }).returning())[0].id;
  base.programId = programId;
  sourceId = (await db.insert(sources).values({ programId, nombre: "Formulario" }).returning())[0].id;
  const cuenta = (await db.insert(cuentasPublicitarias).values({
    programId, idMeta: "dor-cuenta", nombre: "Cuenta", moneda: "COP", zonaHoraria: "America/Bogota",
  }).returning())[0];
  cuentaId = cuenta.id;
  const objetos = await db.insert(pautaObjetos).values([
    { cuentaId: cuenta.id, programId, idMeta: "par-campana", nivel: "campana", nombre: "Campaña", estado: "ACTIVE", proposito: "agenda" },
    { cuentaId: cuenta.id, programId, idMeta: "par-conjunto", nivel: "conjunto", padreIdMeta: "par-campana", nombre: "Conjunto", estado: "ACTIVE" },
    { cuentaId: cuenta.id, programId, idMeta: "par-anuncio", nivel: "anuncio", padreIdMeta: "par-conjunto", nombre: "Anuncio", estado: "ACTIVE" },
  ]).returning();
  campanaUuid = objetos[0].id;
  anuncioId = objetos.find((o) => o.nivel === "anuncio")!.id;
  await db.insert(tasasCambio).values({ vigenteDesde: "2026-09-28", vigenteHasta: "2026-10-18", pesosPorDolar: "4000", fuente: "prueba" });

  await db.insert(gastoPauta).values([
    { programId, fecha: "2026-10-05", monto: "400000", moneda: "COP", origen: "meta_api", pautaObjetoId: anuncioId,
      agendasMeta: 2, impresiones: 20000, clicsEnlace: 400, vistasLanding: 200, alcance: 10_000 },
    ...["2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11"].map((fecha) => (
      { programId, fecha, monto: "400000", moneda: "COP", origen: "meta_api" as const, pautaObjetoId: anuncioId, agendasMeta: 2 })),
  ]);

  // 4 envíos Paid el 5-oct; el primero se vende el 8-oct por USD 1.400 y los cuatro tienen cita creada en la semana.
  const vendida = await personaDePaid("2026-10-05", { diaVenta: "2026-10-08", valor: "1400" });
  const segunda = await personaDePaid("2026-10-05");
  const tercera = await personaDePaid("2026-10-05");
  const cuarta = await personaDePaid("2026-10-05");
  await cita(cuarta.id, "2026-10-08", "show");
  await cita(vendida.id, "2026-10-06", "show");
  await cita(segunda.id, "2026-10-07", "show");
  await cita(tercera.id, "2026-10-07", "no_show");
});

async function personaDePaid(dia: string, venta?: { diaVenta: string; valor: string }, idMeta: string | null = "par-anuncio") {
  const lead = (await db.insert(leads).values({
    programId, fechaPrimeraAplicacion: new Date(`${dia}T10:00:00-05:00`),
    emailNormalizado: `dorado-pauta-${++secuencia}@test.co`, nombre: `Lead ${secuencia}`,
  }).returning())[0];
  const envio = (await db.insert(submissions).values({
    sourceId, leadId: lead.id, token: crypto.randomUUID(), esParcial: false,
    fechaEnvio: new Date(`${dia}T10:00:00-05:00`), createdAt: new Date(`${dia}T10:00:00-05:00`),
    utmSource: "facebook", utmMedium: "cpc", utmId: idMeta,
  }).returning())[0];
  const deal = (await db.insert(deals).values({
    programId, leadId: lead.id, submissionOrigenId: envio.id,
    ownerUserId: venta ? await duenoDePrueba(db, programId) : null,
    etapa: venta ? "ganado_completo" : "agendado",
    valorVendidoUsd: venta ? venta.valor : null,
  }).returning())[0];
  if (venta) {
    await lineaConCupoDePrueba(db, deal.id);
    await db.insert(dealEtapaHistorial).values({ dealId: deal.id, a: "ganado_completo", fecha: new Date(`${venta.diaVenta}T12:00:00-05:00`) });
  }
  return deal;
}

async function cita(dealId: string, dia: string, resultado: "show" | "no_show") {
  await db.insert(calls).values({
    programId, dealId, resultado,
    fechaAgenda: new Date(`${dia}T11:00:00-05:00`), createdAt: new Date(`${dia}T09:00:00-05:00`),
  });
}

const fila = (v: VistaPautaSemanal, clave: ClavePautaSemanal) => v.filas.find((f) => f.clave === clave)!;
const total = (v: VistaPautaSemanal, clave: ClavePautaSemanal) => fila(v, clave).celdas.total;
const vista = (corte?: CortePauta | null, paso?: "dia" | "semana") =>
  cargarPautaSemanal(db, { programId, rango: SEMANA_1, hoy: HOY, cohorteId: null, corte, paso, porCuenta: true });

async function sembrarFueraDeLaCampana() {
  const [otraCuenta] = await db.insert(cuentasPublicitarias).values({
    programId, idMeta: "otra-cuenta", nombre: "Otra cuenta", moneda: "COP", zonaHoraria: "America/Bogota",
  }).returning();
  const [hermana, ajena] = await db.insert(pautaObjetos).values([
    { programId, cuentaId, idMeta: "hermana", nivel: "campana", nombre: "Hermana", estado: "ACTIVE", proposito: "agenda" },
    { programId, cuentaId: otraCuenta.id, idMeta: "ajena", nivel: "campana", nombre: "Ajena", estado: "ACTIVE", proposito: "agenda" },
  ]).returning();
  const fecha = SEMANA_1.desde;
  await db.insert(gastoPauta).values([
    { programId, fecha, monto: "400000", moneda: "COP", origen: "meta_api", pautaObjetoId: hermana.id, agendasMeta: 2,
      impresiones: 20_000, clicsEnlace: 400, vistasLanding: 200, alcance: 10_000 },
    { programId, fecha, monto: "800000", moneda: "COP", origen: "meta_api", pautaObjetoId: ajena.id, agendasMeta: 4 },
    { programId, fecha, monto: "100000", moneda: "COP", origen: "manual", area: "paid" },
  ]);
  const vendida = await personaDePaid(fecha, { diaVenta: "2026-10-08", valor: "600" }, "hermana");
  await cita(vendida.id, "2026-10-08", "show");
  for (const id of ["ajena", null]) {
    const fuera = await personaDePaid(fecha, undefined, id);
    await cita(fuera.id, "2026-10-06", "show");
  }
}

describe("Ver solo en la tabla de Pauta", () => {
  it.each(["campana", "cuenta_meta"] as const)("recalcula todas las filas y series para %s", async (nivel) => {
    await sembrarFueraDeLaCampana();
    const cuenta = nivel === "cuenta_meta";
    const corte = { nivel, id: cuenta ? cuentaId : "par-campana" };
    const semanal = await vista(corte);
    const esperados: Record<ClavePautaSemanal, number | null> = {
      inversion: cuenta ? 3_200_000 : 2_800_000,
      agendas: cuenta ? 5 : 4,
      ventas: cuenta ? 2 : 1,
      facturacion: cuenta ? 2_000 : 1_400,
      cac: cuenta ? 1_600_000 : 2_800_000,
      vendido_cohorte: cuenta ? 2_000 : 1_400,
      ventas_cohorte: cuenta ? 2 : 1,
      roas: cuenta ? 2.5 : 2,
      profit: cuenta ? 1_200 : 700,
      costo_agenda_crm: cuenta ? 640_000 : 700_000,
      show: cuenta ? 0.8 : 0.75,
      cierre_ventas: cuenta ? 0.5 : 1 / 3,
      agenda_venta: cuenta ? 0.4 : 0.25,
      cpm: 20_000,
      ctr: 0.02,
      llegada_landing: 0.5,
      conversion_landing: cuenta ? 5 / 400 : 4 / 200,
      agendas_meta: cuenta ? 16 : 14,
      costo_agenda_meta: 200_000,
      frecuencia: null,
    };
    for (const [clave, esperado] of Object.entries(esperados)) {
      const f = fila(semanal, clave as ClavePautaSemanal);
      for (const celda of [f.celdas.total, ...f.celdas.porColumna]) {
        if (esperado === null) expect(celda.valor, clave).toBeNull();
        else expect(celda.valor, clave).toBeCloseTo(esperado);
      }
    }
    expect(fila(semanal, "inversion").subfilas?.map((sub) => sub.cuentaId)).toEqual([cuentaId]);

    const diaria = await vista(corte, "dia");
    expect(fila(diaria, "frecuencia").celdas.porColumna[0].valor).toBe(2);
    expect(diaria.dias[0]).toMatchObject({ inversionCop: cuenta ? 800_000 : 400_000, agendas: 0, ventas: 0 });
    expect(diaria.dias[3]).toMatchObject({ agendas: cuenta ? 2 : 1, ventas: cuenta ? 2 : 1, vendidoUsd: cuenta ? 2_000 : 1_400 });
    expect(diaria.dias).toEqual(semanal.dias);

    for (const [metrica, esperado] of [
      ["agendas_creadas", esperados.agendas], ["cierres", esperados.ventas],
      ["grupo_shows", cuenta ? 4 : 3], ["grupo_vendidos", esperados.ventas],
    ] as const) {
      const [lista] = await listaDeMetrica(metrica, { programId, rango: SEMANA_1, hoy: HOY, area: "paid", corte }, 1, db);
      expect(lista.subtotal.cantidad, metrica).toBe(esperado);
    }
  });

  it("en un conjunto excluye la atribución solo a campaña y conserva la razón de las tres celdas sin detalle", async () => {
    await sembrarFueraDeLaCampana();
    const residual = await personaDePaid(SEMANA_1.desde, undefined, "par-campana");
    await cita(residual.id, "2026-10-06", "show");
    const v = await vista({ nivel: "conjunto", id: "par-conjunto" }, "dia");
    expect(total(v, "agendas").valor).toBe(4);
    expect(total(v, "conversion_landing").partes).toEqual([4, 200]);
    expect(total(v, "inversion").valor).toBe(2_800_000);
    for (const clave of ["agendas_meta", "costo_agenda_meta", "costo_agenda_crm"] as const) {
      const f = fila(v, clave);
      for (const c of [f.celdas.total, ...f.celdas.porColumna]) {
        expect(c).toMatchObject({ valor: null, cobertura: { razon: "No disponible para este corte: el detalle se guarda por campaña" } });
      }
    }
    expect(fila(v, "costo_agenda_meta").subfilas?.[0].celdas.total.cobertura.razon).toBe(total(v, "costo_agenda_meta").cobertura.razon);
  });

  it("una cita y una venta heredan el completo aunque el origen quede fuera del rango operativo", async () => {
    const vendida = await personaDePaid("2026-10-03", { diaVenta: "2026-10-08", valor: "500" });
    const [completo] = await db.select().from(submissions).where(eq(submissions.id, vendida.submissionOrigenId!));
    const [parcial] = await db.insert(submissions).values({
      sourceId, token: completo.token, leadId: completo.leadId, esParcial: true,
      createdAt: new Date("2026-10-02T10:00:00-05:00"), utmSource: "instagram", utmMedium: "organico",
    }).returning();
    await db.update(deals).set({ submissionOrigenId: parcial.id }).where(eq(deals.id, vendida.id));
    await cita(vendida.id, "2026-10-08", "show");

    const corte = { nivel: "campana", id: "par-campana" } as const;
    const v = await vista(corte);
    expect(total(v, "agendas").valor).toBe(5);
    expect(total(v, "ventas").valor).toBe(2);
    expect(total(v, "facturacion").valor).toBe(1900);
    expect(total(v, "conversion_landing").partes).toEqual([4, 200]);
    expect(total(v, "profit").valor).toBe(700);
    expect(v.dias[3]).toMatchObject({ agendas: 2, ventas: 2, vendidoUsd: 1900 });
    for (const [metrica, cantidad] of [["agendas_creadas", 5], ["cierres", 2], ["grupo_shows", 4], ["grupo_vendidos", 2]] as const) {
      const [lista] = await listaDeMetrica(metrica, { programId, rango: SEMANA_1, hoy: HOY, area: "paid", corte }, 1, db);
      expect(lista.subtotal.cantidad, metrica).toBe(cantidad);
    }
  });

  it("sin corte conserva las cifras doradas, el orden y las consultas de un corte omitido", async () => {
    const cliente = (db as Db & { $client: PGlite }).$client;
    const consultas = vi.spyOn(cliente, "query");
    try {
      const omision = await cargarPautaSemanal(db, { programId, rango: SEMANA_1, hoy: HOY, cohorteId: null, porCuenta: true });
      // Alguna lectura existente compara con el reloj de pared: el instante cambia entre corridas, la consulta no.
      const firma = () => consultas.mock.calls
        .map(([texto, params]) => JSON.stringify([texto, params]).replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g, "<instante>"))
        .sort();
      const sql = firma();
      consultas.mockClear();
      const explicito = await vista(null);
      expect(explicito).toEqual(omision);
      expect(firma()).toEqual(sql);
      for (const [clave, valor] of [
        ["inversion", 2_800_000], ["agendas", 4], ["ventas", 1], ["facturacion", 1_400],
        ["costo_agenda_crm", 700_000], ["cac", 2_800_000], ["roas", 2], ["profit", 700], ["agendas_meta", 14],
      ] as const) expect(total(explicito, clave).valor).toBe(valor);
    } finally {
      consultas.mockRestore();
    }
  });

  it("el CSV aplica un corte válido e ignora un nivel incorrecto, un UUID ajeno y parámetros repetidos", async () => {
    await sembrarFueraDeLaCampana();
    const [otro] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "ajeno-csv", nombre: "Ajeno" }).returning();
    const [cuentaAjena] = await db.insert(cuentasPublicitarias).values({
      programId: otro.id, idMeta: "ajena-csv", nombre: "Ajena", moneda: "COP", zonaHoraria: "America/Bogota",
    }).returning();
    const obtener = async (corte: string) => {
      const url = `https://crm.test/p/dorado-pauta/hub/pauta-semanal.csv?a_desde=${SEMANA_1.desde}&a_hasta=${SEMANA_1.hasta}&por_cuenta=1${corte}`;
      const respuesta = await GET(new Request(url), { params: Promise.resolve({ programa: "dorado-pauta" }) });
      expect(respuesta.status).toBe(200);
      return respuesta.text();
    };
    base.db = db;
    try {
      const sinCorte = await obtener("");
      expect(await obtener(`&corte=conjunto&corte_id=${campanaUuid}`)).toBe(sinCorte);
      expect(await obtener(`&corte=cuenta_meta&corte_id=${cuentaAjena.id}`)).toBe(sinCorte);
      expect(await obtener(`&corte=campana&corte=campana&corte_id=${campanaUuid}`)).toBe(sinCorte);
      const cortado = await obtener(`&corte=campana&corte_id=${campanaUuid}`);
      expect(cortado).not.toBe(sinCorte);
      expect(cortado).toBe(csvDePautaSemanal(await vista({ nivel: "campana", id: "par-campana" })).replace(/^\uFEFF/, ""));
    } finally {
      base.db = null;
    }
  });
});

