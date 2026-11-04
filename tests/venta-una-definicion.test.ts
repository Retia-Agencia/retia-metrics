import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cohorts, dealEtapaHistorial, deals, leads, programs } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import type { EtapaDeal } from "@/lib/deals/etapas";
import { metaDeHoy } from "@/lib/dias-habiles";
import { vistaDeCohorteActiva } from "@/lib/queries/dashboard";
import { horizontesDeCupos } from "@/lib/queries/vista-hoy";
import { embudoPorEtapas } from "@/lib/queries/embudo-etapas";
import { ventasDelPrograma } from "@/lib/queries/escalera";
import { leerMetasDelMes } from "@/lib/queries/metas";
import { vendidosEn } from "@/lib/queries/metricas-filtros";
import { leerProyeccion } from "@/lib/queries/proyeccion";
import { ventasDeLaCohorte } from "@/lib/queries/ventas-de-la-cohorte";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * Ticket 352 (ADR 0115 N1, N2): la venta tiene UNA definicion (deal hoy en Abonado o Completo, dia de su
 * primera entrada) y la cohorte UNA cuenta (`ventasDeLaCohorte`, sin limite inferior).
 */

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let programId: string;
let cohortId: string;
let n = 0;

const SIEMPRE = { desde: "2000-01-01", hasta: "2100-12-31" };
const HOY = "2026-10-21"; // miercoles; la cohorte vende del 12-oct al 4-nov (18 habiles)

beforeAll(async () => {
  ({ db, cerrar, vaciar } = await crearBaseReutilizable());
});
afterAll(async () => {
  await cerrar();
});

beforeEach(async () => {
  await vaciar();
  const [p] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "p352", nombre: "P352", ticketUsd: "1000" }).returning();
  programId = p.id;
  const [c] = await db.insert(cohorts).values({
    programId, codigo: "C1", metaCupos: 20, precioUsd: "1000",
    fechaInicioClases: "2026-12-01", fechaInicioVentas: "2026-10-12", fechaCierreVentas: "2026-11-04", estado: "activo",
  }).returning();
  cohortId = c.id;
});

async function venta(etapa: EtapaDeal, dia: string, historialExtra: Array<{ de: EtapaDeal; a: EtapaDeal; dia: string }> = []) {
  const [lead] = await db.insert(leads).values({ programId, emailNormalizado: `l${++n}@t352.test` }).returning();
  const [deal] = await db.insert(deals).values({ programId, leadId: lead.id, cohortId, etapa }).returning();
  await db.insert(dealEtapaHistorial).values([
    { dealId: deal.id, a: "ganado_parcial" as EtapaDeal, fecha: new Date(`${dia}T11:00:00-05:00`) },
    ...historialExtra.map((h) => ({ dealId: deal.id, de: h.de, a: h.a, fecha: new Date(`${h.dia}T12:00:00-05:00`) })),
  ]);
  return deal.id;
}

describe("DA-1: Abonado que pasa a Cierre Perdido deja de ser venta en toda metrica a la vez", () => {
  it("Mes, Cohorte, Proyeccion, embudo y escalera/ROAS coinciden", async () => {
    const buena = await venta("ganado_parcial", "2026-10-14");
    const perdida = await venta("cierre_perdido", "2026-10-14", [{ de: "ganado_parcial", a: "cierre_perdido", dia: "2026-10-16" }]);

    expect((await vendidosEn(db, SIEMPRE)).map((f) => f.dealId)).toEqual([buena]);
    expect((await leerMetasDelMes(programId, "2026-10", HOY, db)).vendidos).toBe(1);
    expect((await vistaDeCohorteActiva({ programId }, HOY, db))!.vendidos).toBe(1);
    expect((await ventasDeLaCohorte(db, cohortId, HOY)).map((v) => v.dealId)).toEqual([buena]);
    expect((await leerProyeccion({ programId, hoy: HOY }, db)).vendidos).toBe(1);
    const embudo = await embudoPorEtapas(db, { programId, rango: SIEMPRE });
    expect(embudo.conversion.todas.pasos.find((p) => p.paso === "vendido")!.dealIds).toEqual([buena]);
    expect((await ventasDelPrograma(db, programId)).map((v) => v.dealId)).toEqual([buena]);
    expect(perdida).toBeTruthy();
  });
});

describe("DA-2: las ventas anteriores al inicio de ventas cuentan para la cohorte", () => {
  it("Cupos y Proyeccion dan la misma cifra", async () => {
    await venta("ganado_parcial", "2026-10-02"); // antes del 12-oct
    await venta("ganado_parcial", "2026-10-14");
    const cupos = (await vistaDeCohorteActiva({ programId }, HOY, db))!.vendidos;
    const proyeccion = (await leerProyeccion({ programId, hoy: HOY }, db)).vendidos;
    expect(cupos).toBe(2);
    expect(proyeccion).toBe(cupos);
  });
});

describe("DA-5: el cumplimiento del dia se mide contra la meta de apertura", () => {
  it("vender 4 con meta de apertura 2 da 200 %, no 333 %", async () => {
    // Meta 20, 10 vendidas antes de hoy; hoy 21-oct con 11 habiles contando hoy no da 2: se arma el caso a mano.
    // Abrimos con 20 - 18 = 2 por vender en el ultimo dia habil (4-nov): la meta de hoy es 2.
    const hoy = "2026-11-04";
    for (let i = 0; i < 18; i++) await venta("ganado_parcial", "2026-10-14");
    for (let i = 0; i < 4; i++) await venta("ganado_parcial", hoy);
    const vista = (await vistaDeCohorteActiva({ programId }, hoy, db))!;
    expect(vista.ventana!.metaDinamica).toBe(2);
    const dia = horizontesDeCupos({ cohorte: vista, metasDelMes: { compensacionSemanal: null }, embudo: { cierres: 4 } } as never)
      .find((h) => h.clave === "dia")!;
    expect(dia.cumplimiento).toBe(2);
  });
});

describe("R-09: el borde de la meta de hoy es uno", () => {
  it("el ultimo dia habil, meta de hoy y ventas requeridas por dia dan lo mismo", async () => {
    const hoy = "2026-11-04";
    for (let i = 0; i < 16; i++) await venta("ganado_parcial", "2026-10-14");
    const meta = (await vistaDeCohorteActiva({ programId }, hoy, db))!.ventana!.metaDinamica;
    const requeridas = (await leerProyeccion({ programId, hoy }, db)).ventasRequeridasDia.valor;
    expect(meta).toBe(4);
    expect(requeridas).toBe(meta);
    expect(metaDeHoy({ meta: 20, vendidosAntesDeHoy: 16, hoy, cierre: "2026-11-04" })).toBe(meta);
  });
});

describe("guardian (N1): nadie cuenta ventas con su propia lista de etapas", () => {
  const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const PATRON = /inArray\(\s*deals\.etapa,\s*(?:\[\s*\.\.\.\s*)?(?:ETAPAS_VENDIDAS|ETAPAS_DE_CIERRE|\[\s*"ganado_)/;
  // Solo el modulo de la venta.
  const PERMITIDOS = ["lib/queries/metricas-filtros.ts"];

  function archivos(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const ruta = path.join(dir, e.name);
      if (e.isDirectory()) return e.name === "node_modules" ? [] : archivos(ruta);
      return /\.(ts|tsx)$/.test(e.name) ? [ruta] : [];
    });
  }
  const fuera = (texto: string) => PATRON.test(texto);

  it("el patron muerde lo malo y no marca la solucion", () => {
    expect(fuera("db.select().from(deals).where(inArray(deals.etapa, [...ETAPAS_VENDIDAS]))")).toBe(true);
    expect(fuera('inArray(deals.etapa, ["ganado_parcial", "ganado_completo"])')).toBe(true);
    expect(fuera("db.select().from(deals).where(and(etapaVendida(), vigente(deals)))")).toBe(false);
  });

  it("fuera del modulo de la venta, ningun archivo lo escribe", () => {
    const infractores = ["lib", "app", "components", "scripts"]
      .flatMap((d) => archivos(path.join(RAIZ, d)))
      .map((f) => path.relative(RAIZ, f))
      .filter((rel) => !PERMITIDOS.includes(rel))
      .filter((rel) => fuera(fs.readFileSync(path.join(RAIZ, rel), "utf8")));
    expect(infractores).toEqual([]);
  });
});
