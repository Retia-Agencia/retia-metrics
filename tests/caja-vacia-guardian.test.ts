import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Session } from "next-auth";
import { programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { cajaConMonedaDelPrograma, cajaRecaudada, MONEDA_DE_CAJA } from "@/lib/queries/dashboard";
import { resumenDelHubMcp } from "@/lib/mcp/herramientas/metricas";
import type { ContextoMcp } from "@/lib/mcp/herramientas";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * D-3 (auditoría 18-nov): «Entró a caja» sin abonos se pintaba de cuatro maneras («—», USD 0, un texto, nada). Por N5 una
 * suma sin filas es 0 en la moneda del programa, y el único sitio que lo decide es `cajaConMonedaDelPrograma`.
 */
describe("la caja vacía: un solo vacío, en la fuente", () => {
  let db: Db;
  let cerrar: () => Promise<void>;
  let vaciar: () => Promise<void>;
  let programId: string;
  let gerenteId: string;

  beforeAll(async () => ({ db, cerrar, vaciar } = await crearBaseReutilizable()));
  beforeEach(async () => {
    await vaciar();
    const [p] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "caja-vacia", nombre: "Caja vacía", ticketUsd: "1000" }).returning();
    programId = p.id;
    [{ id: gerenteId }] = await db.insert(users).values({ email: "gerente-caja@retia.test", rol: "gerente" }).returning();
  });
  afterAll(async () => cerrar());

  it("sin abonos, cajaRecaudada devuelve una fila de la moneda del programa con 0", async () => {
    const caja = await cajaRecaudada({ programId, rango: { desde: "2026-11-22", hasta: "2026-11-23" } }, db);
    expect(caja).toEqual([{ moneda: MONEDA_DE_CAJA, total: 0 }]);
  });

  it("resumen_del_hub sin abonos dice 0, no []", async () => {
    const contexto: ContextoMcp = {
      db, session: { user: { id: gerenteId, email: "g@retia.test", name: "g" } } as Session, rol: "gerente", tokenId: crypto.randomUUID(), escritura: false,
    };
    const salida = await resumenDelHubMcp.ejecutar(contexto, { programa: "caja-vacia", periodo: "custom", desde: "2026-11-02", hasta: "2026-11-03" });
    expect((salida.estructurado as { entro_a_caja: unknown }).entro_a_caja).toEqual([{ moneda: "USD", total: 0 }]);
  });

  it("con filas no inventa nada", () => {
    expect(cajaConMonedaDelPrograma([{ moneda: "USD", total: 5 }])).toEqual([{ moneda: "USD", total: 5 }]);
  });
});

describe("guardián: ninguna pantalla inventa el vacío de la caja", () => {
  const DUENO = "lib/queries/dashboard.ts";
  // Subtotales de LISTAS (la mayoría de las listas no tiene montos: ahí «sin caja» es lo normal), no «Entró a caja».
  const SUBTOTALES_DE_LISTA = ["components/cifra-con-lista.tsx"];
  const PROHIBIDOS: Array<[RegExp, string]> = [
    [/(?<![.\w])caja\.length\s*(===\s*0|>\s*0|\?)|vista\.caja\.length|reporte\.caja\.length|a\.caja\.length/, "pregunta si la caja está vacía (el vacío ya viene como 0 desde la fuente)"],
    [/moneda:\s*"USD",\s*total:\s*0/, "fabrica una caja en cero a mano (usa cajaConMonedaDelPrograma)"],
    [/ningún abono/i, "pinta un texto propio para la caja vacía"],
  ];
  function recorrer(dir: string): string[] {
    if (!existsSync(dir)) return [];
    return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? (e.name === "node_modules" || e.name === ".next" ? [] : recorrer(join(dir, e.name))) : /\.tsx?$/.test(e.name) ? [join(dir, e.name)] : []);
  }

  it("el vacío de la caja vive solo en dashboard.ts", () => {
    const hallazgos: string[] = [];
    for (const archivo of ["app", "components", "lib"].flatMap(recorrer)) {
      if (archivo === DUENO || SUBTOTALES_DE_LISTA.includes(archivo)) continue;
      const lineas = readFileSync(archivo, "utf8").split("\n");
      lineas.forEach((linea, i) => {
        for (const [patron, motivo] of PROHIBIDOS) if (patron.test(linea)) hallazgos.push(`${archivo}:${i + 1} ${motivo}`);
      });
    }
    expect(hallazgos).toEqual([]);
  });
});
