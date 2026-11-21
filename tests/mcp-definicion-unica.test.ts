import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import type { PGlite } from "@electric-sql/pglite";
import type { Db } from "@/lib/db/tipos";
import { RESULTADOS_QUE_OCURRIERON } from "@/lib/deals/resultados-de-llamada";
import { VISTAS_DE_LECTURA } from "@/lib/queries/mcp-lectura/catalogo";
import { consultarDatos } from "@/lib/queries/mcp-lectura/consultar";
import * as abonoHecho from "@/lib/queries/hechos/abono";
import * as agendaHecho from "@/lib/queries/hechos/agenda";
import * as citaHecho from "@/lib/queries/hechos/cita";
import * as envioHecho from "@/lib/queries/hechos/envio";
import * as gastoHecho from "@/lib/queries/hechos/gasto";
import * as ventaHecho from "@/lib/queries/hechos/venta";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { conexionDeLecturaPglite } from "./helpers/conexion-de-lectura-pglite";
import { sembrarLectura } from "./helpers/siembra-de-lectura";

/**
 * 407 fase 2 (migración 0160, decisión de Mani del 21-nov): UNA definición por hecho. Para cada hecho, tres lecturas de la
 * misma base dicen lo mismo:
 *   1. la definición: `crm_definicion.<hecho>`, sin alcance ni enmascarado;
 *   2. la vista del MCP: `mcp_lectura.<hecho>` con el alcance de TODOS los programas y `ve_equipo`;
 *   3. la lectura de la app: `lib/queries/hechos/<hecho>` con su filtro de programa.
 * Agendas y citas de la app LEEN la definición (comparten el SQL); envíos, ventas, abonos y gasto siguen con su TypeScript
 * (ver el PR), y este test es lo que impide que las dos definiciones diverjan.
 */

const HECHOS = ["envios", "agendas", "citas", "ventas", "abonos", "gasto", "leads", "deals"] as const;
/** Columnas de la definición que el MCP no expone (las usa la app). */
const SOLO_PARA_LA_APP: Record<string, string[]> = { agendas: ["creada_en"] };

const RANGO = { desde: "2000-01-01", hasta: "2100-01-01" };
const PAGINA = { limite: 1000, offset: 0 };
const PARSERS = { 1082: (v: string) => v, 1114: (v: string) => v, 1184: (v: string) => v, 20: (v: string) => Number(v), 1700: (v: string) => Number(v) };

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let programaA: string;
let programaB: string;
let closerId: string;

beforeAll(async () => ({ db, cerrar, vaciar } = await crearBaseReutilizable()));
afterAll(async () => cerrar());
beforeEach(async () => {
  await vaciar();
  ({ programaA, programaB, closerId } = await sembrarLectura(db));
});

type Fila = Record<string, unknown>;

/** La definición, leída como dueño (la app), con los mismos parsers que la conexión del MCP para comparar valor contra valor. */
async function definicion(hecho: string): Promise<Fila[]> {
  const cliente = (db as Db & { $client: PGlite }).$client;
  return (await cliente.query(`select * from crm_definicion.${hecho}`, [], { parsers: PARSERS })).rows as Fila[];
}

async function vistaDelMcp(hecho: string, veEquipo: boolean): Promise<Fila[]> {
  return (await consultarDatos(conexionDeLecturaPglite(db), {
    sql: `select * from mcp_lectura.${hecho}`,
    programaIds: [programaA, programaB],
    veEquipo,
    limite: 1000,
  })).filas as Fila[];
}

/** El día como `AAAA-MM-DD`, venga como texto o como Date. */
const d10 = (valor: unknown) => (valor instanceof Date ? valor.toISOString() : String(valor)).slice(0, 10);
const clave = (fila: Fila) => String(Object.values(fila)[0]);
const ordenar = (filas: Fila[]) => [...filas].sort((a, b) => clave(a).localeCompare(clave(b)));
const quitar = (fila: Fila, columnas: string[]) => Object.fromEntries(Object.entries(fila).filter(([k]) => !columnas.includes(k)));

describe("la definición y la vista del MCP dicen lo mismo, hecho por hecho", () => {
  it.each(HECHOS)("%s: mismas filas y mismos valores con alcance de todos los programas y ve_equipo", async (hecho) => {
    const definidas = await definicion(hecho);
    const vistas = await vistaDelMcp(hecho, true);
    expect(definidas.length).toBeGreaterThan(0);
    expect(ordenar(vistas)).toEqual(ordenar(definidas.map((f) => quitar(f, SOLO_PARA_LA_APP[hecho] ?? []))));
  });

  it.each(HECHOS)("%s: la definición trae las mismas columnas que la vista, en el mismo orden (más las de la app)", async (hecho) => {
    const cliente = (db as Db & { $client: PGlite }).$client;
    const columnas = async (esquema: string) => (await cliente.query<{ column_name: string }>(
      "select column_name from information_schema.columns where table_schema = $1 and table_name = $2 order by ordinal_position", [esquema, hecho])).rows.map((r) => r.column_name);
    const [def, vista] = await Promise.all([columnas("crm_definicion"), columnas("mcp_lectura")]);
    expect(def.filter((c) => !(SOLO_PARA_LA_APP[hecho] ?? []).includes(c))).toEqual(vista);
  });

  it("sin ve_equipo, la vista oculta dueño y registrador y NADA más difiere de la definición", async () => {
    const enmascaradas: Record<string, string[]> = {
      agendas: ["dueno", "dueno_nombre"], citas: ["dueno", "dueno_nombre"], ventas: ["dueno", "dueno_nombre"], deals: ["dueno", "dueno_nombre"],
      abonos: ["registrado_por", "registrado_por_nombre", "dueno", "dueno_nombre"], leads: ["traido_por"], envios: [], gasto: [],
    };
    for (const hecho of HECHOS) {
      const ocultas = enmascaradas[hecho];
      const completas = ordenar(await vistaDelMcp(hecho, true));
      const sinEquipo = ordenar(await vistaDelMcp(hecho, false));
      expect(sinEquipo, hecho).toEqual(completas.map((f) => ({ ...f, ...Object.fromEntries(ocultas.map((c) => [c, null])) })));
    }
    // Mordido: el enmascarado de verdad tapa algo (hay un dueño real que ocultar).
    expect((await vistaDelMcp("ventas", true)).some((f) => f.dueno === closerId)).toBe(true);
    expect((await vistaDelMcp("ventas", false)).every((f) => f.dueno === null)).toBe(true);
  });

  it("la lista de hechos de la prueba es la del catálogo del MCP", () => {
    expect([...HECHOS, "programas"].sort()).toEqual([...VISTAS_DE_LECTURA].sort());
  });
});

describe("la app lee la misma definición", () => {
  const lib = { rango: RANGO, pagina: PAGINA };
  const idsDe = (filas: Fila[], columna: string, programa: string) => new Set(filas.filter((f) => f.programa_id === programa).map((f) => f[columna]));

  it("citas: la lista, las citas y los shows por día salen de crm_definicion.citas", async () => {
    const definidas = await definicion("citas");
    const lista = await citaHecho.listar(db, { programId: programaA, ...lib });
    expect(new Set(lista.filas.map((f) => f.callId))).toEqual(idsDe(definidas, "id_de_la_llamada", programaA));
    for (const fila of lista.filas) {
      const d = definidas.find((x) => x.id_de_la_llamada === fila.callId)!;
      expect({ dia: d10(fila.dia), area: fila.area, canal: fila.canal, cuenta: fila.cuenta, dueno: fila.dueno, cohorte: fila.cohorte, etapa: fila.etapa, ocurrio: fila.ocurrio })
        .toEqual({ dia: d10(d.dia), area: d.area, canal: d.canal, cuenta: d.cuenta, dueno: d.dueno, cohorte: d.cohorte_id, etapa: d.etapa, ocurrio: d.ocurrio });
    }
    const porDia = await citaHecho.agrupar(db, { programId: programaA, agruparPor: ["dia"], ...lib });
    const esperado = new Map<string, { citas: number; shows: number }>();
    for (const d of definidas.filter((x) => x.programa_id === programaA)) {
      const acumulado = esperado.get(d10(d.dia)) ?? { citas: 0, shows: 0 };
      esperado.set(d10(d.dia), { citas: acumulado.citas + 1, shows: acumulado.shows + (d.ocurrio === "si" ? 1 : 0) });
    }
    expect(new Map(porDia.map((f) => [d10(f.dia), { citas: f.citas, shows: f.shows }]))).toEqual(esperado);
  });

  it("citas: `ocurrio` de la definición usa los mismos resultados que el TypeScript del embudo", async () => {
    const [{ definicion: texto }] = (await db.execute(sql`select pg_get_viewdef('crm_definicion.citas'::regclass) as definicion`)).rows as Array<{ definicion: string }>;
    const literales = [...texto.matchAll(/'(show|compromiso_pago|cerrada|perdida|no_show|agendada|cancelada)'::text/g)].map((m) => m[1]);
    expect([...new Set(literales)].sort()).toEqual([...RESULTADOS_QUE_OCURRIERON].sort());
  });

  it("agendas: la lista, el corte `creadaHasta` y el conteo por día salen de crm_definicion.agendas", async () => {
    const definidas = await definicion("agendas");
    const lista = await agendaHecho.listar(db, { programId: programaA, ...lib });
    expect(new Set(lista.filas.map((f) => f.callId))).toEqual(idsDe(definidas, "id_de_la_llamada", programaA));
    for (const fila of lista.filas) {
      const d = definidas.find((x) => x.id_de_la_llamada === fila.callId)!;
      expect({ dia: d10(fila.dia), hm: fila.horaMinuto, area: fila.area, canal: fila.canal, cuenta: fila.cuenta, dueno: fila.dueno, cohorte: fila.cohorte, etapa: fila.etapa })
        .toEqual({ dia: d10(d.dia), hm: d.hora_minuto, area: d.area, canal: d.canal, cuenta: d.cuenta, dueno: d.dueno, cohorte: d.cohorte_id, etapa: d.etapa });
    }
    const corte = new Date("2026-11-09T23:59:59-05:00");
    const hasta = await agendaHecho.agrupar(db, { programId: programaA, agruparPor: [], creadaHasta: corte, ...lib });
    const creadas = definidas.filter((d) => d.programa_id === programaA && new Date(String(d.creada_en)).getTime() <= corte.getTime());
    expect(hasta.reduce((n, f) => n + f.agendas, 0)).toBe(creadas.length);
    // Mordido: el corte excluye algo (una agenda creada el 10 de noviembre).
    expect(creadas.length).toBeLessThan(definidas.filter((d) => d.programa_id === programaA).length);
    // El universo de Paid de la definición es el filtro de área de la app.
    const paid = await agendaHecho.agendasDePauta(db, { programId: programaA, rango: RANGO, agruparPor: [] });
    expect(paid.reduce((n, f) => n + f.agendas, 0)).toBe(definidas.filter((d) => d.programa_id === programaA && d.universo_paid === "si").length);
  });

  it("envios, ventas, abonos y gasto: el TypeScript de la app y la definición listan las mismas filas y los mismos valores", async () => {
    const envios = await definicion("envios");
    const deEnvios = await envioHecho.listar(db, { programId: programaA, universo: "completos_y_parciales", ...lib });
    expect(new Set(deEnvios.filas.map((f) => f.envioId))).toEqual(idsDe(envios, "id_del_envio", programaA));
    for (const fila of deEnvios.filas) {
      const d = envios.find((x) => x.id_del_envio === fila.envioId)!;
      expect({ tipo: fila.tipo, dia: d10(fila.dia), area: fila.area, canal: fila.canal, cuenta: fila.cuenta, categoria: fila.categoria })
        .toEqual({ tipo: d.tipo, dia: d10(d.dia), area: d.area, canal: d.canal, cuenta: d.cuenta, categoria: d.categoria });
    }
    const ventas = await definicion("ventas");
    const deVentas = await ventaHecho.listar(db, { programId: programaA, ...lib });
    expect(new Set(deVentas.filas.map((f) => f.dealId))).toEqual(idsDe(ventas, "id_del_deal", programaA));
    for (const fila of deVentas.filas) {
      const d = ventas.find((x) => x.id_del_deal === fila.dealId)!;
      expect({ dia: d10(fila.dia), area: fila.area, canal: fila.canal, dueno: fila.dueno }).toEqual({ dia: d10(d.dia), area: d.area, canal: d.canal, dueno: d.dueno });
    }
    const abonos = await definicion("abonos");
    const deAbonos = await abonoHecho.listar(db, { programId: programaA, ...lib });
    expect(new Set(deAbonos.filas.map((f) => f.abonoId))).toEqual(idsDe(abonos, "id_del_abono", programaA));
    for (const fila of deAbonos.filas) {
      const d = abonos.find((x) => x.id_del_abono === fila.abonoId)!;
      expect({ dia: d10(fila.dia), moneda: fila.moneda, monto: Number(fila.monto), dueno: fila.dueno }).toEqual({ dia: d10(d.dia), moneda: d.moneda, monto: Number(d.monto), dueno: d.dueno });
    }
    const gasto = await definicion("gasto");
    const deGasto = await gastoHecho.listar(db, { programId: programaA, ...lib });
    expect(new Set(deGasto.filas.map((f) => f.gastoId))).toEqual(idsDe(gasto, "id_del_gasto", programaA));
    for (const fila of deGasto.filas) {
      const d = gasto.find((x) => x.id_del_gasto === fila.gastoId)!;
      expect({ dia: d10(fila.dia), moneda: fila.moneda, monto: Number(fila.monto), objeto: fila.objeto_de_pauta, cuenta: fila.cuenta_meta })
        .toEqual({ dia: d10(d.dia), moneda: d.moneda, monto: Number(d.monto), objeto: d.objeto_de_pauta, cuenta: d.cuenta_meta });
    }
  });
});

describe("el rol del MCP no llega a las definiciones", () => {
  it("ni por SELECT, ni por el esquema, ni por sus funciones", async () => {
    const cliente = (db as Db & { $client: PGlite }).$client;
    const intentar = async (consulta: string) => {
      await cliente.exec("begin; set local role mcp_lectura_login");
      try {
        await cliente.query(consulta);
        return "permitido";
      } catch (error) {
        return (error as { code?: string }).code ?? "error";
      } finally {
        await cliente.exec("rollback");
      }
    };
    for (const hecho of HECHOS) expect(await intentar(`select * from crm_definicion.${hecho} limit 1`), hecho).toBe("42501");
    expect(await intentar("select crm_definicion.utm_area('a', 'b', gen_random_uuid(), null, null)")).toBe("42501");
    // Mordido: el mismo intento por una vista del catálogo SIN alcance fijado devuelve 0 filas (la puerta sí abre), no un permiso negado.
    expect(await intentar("select * from mcp_lectura.citas")).toBe("permitido");
  });
});
