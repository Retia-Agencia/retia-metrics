import { abonoDePrueba } from "./helpers/catalogo-de-prueba";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Session } from "next-auth";
import { calls, cohorts, dealEtapaHistorial, deals, leads, miembrosPrograma, programs, sources, submissions, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import { hoyEnBogota } from "@/lib/format";
import { consultarHechosMcp } from "@/lib/mcp/herramientas/hechos";
import { consultarMetricaMcp, periodoAnteriorDe, resumenDelHubMcp } from "@/lib/mcp/herramientas/metricas";
import type { ContextoMcp } from "@/lib/mcp/herramientas";
import { METRICAS_DE_LISTA } from "@/lib/queries/filtros-de-lista";
import { vistaDeLista } from "@/lib/queries/vista-metrica";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

// 407 fase 2: la cifra de cada metrica registrada es la misma por las tres puertas (la lista del Hub, consultar_metrica y
// consultar_hechos / resumen_del_hub). Este archivo ata esa igualdad: si una definicion se mueve (p. ej. cuando
// `lib/queries/hechos` lea las vistas de `mcp_lectura`), ningun numero cambia sin que esto se ponga rojo.

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let gerenteId: string;
const slug = "paridad-a";
const RANGO = { desde: "2026-11-01", hasta: "2026-11-30" };
const periodo = { periodo: "custom" as const, ...RANGO };

beforeAll(async () => ({ db, cerrar, vaciar } = await crearBaseReutilizable()));
afterAll(async () => cerrar());

beforeEach(async () => {
  await vaciar();
  const [programa] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug, nombre: "Paridad A" }).returning();
  const [gerente, closer] = await db.insert(users).values([
    { email: "gerente-paridad@retia.test", nombre: "Gerente", rol: "gerente" },
    { email: "closer-paridad@retia.test", nombre: "Nicolás", rol: "closer", closerId: "Nicolás" },
  ]).returning();
  gerenteId = gerente.id;
  await db.insert(miembrosPrograma).values({ userId: closer.id, programId: programa.id });
  const [cohorte] = await db.insert(cohorts).values({ programId: programa.id, codigo: "P-1", metaCupos: 10, fechaInicioVentas: "2026-11-01", fechaCierreVentas: "2026-11-30", fechaInicioClases: "2026-12-01" }).returning();
  const [fuente] = await db.insert(sources).values({ programId: programa.id, nombre: "Formulario" }).returning();
  const [lead] = await db.insert(leads).values({ programId: programa.id, emailNormalizado: "paridad@retia.test", nombre: "Paridad", fechaPrimeraAplicacion: new Date("2026-11-01T12:00:00-05:00") }).returning();
  const [envio] = await db.insert(submissions).values({ leadId: lead.id, sourceId: fuente.id, token: "paridad", fechaEnvio: new Date("2026-11-05T10:00:00-05:00"), utmSource: "instagram", utmMedium: "paid_social" }).returning();
  const [deal] = await db.insert(deals).values({ programId: programa.id, leadId: lead.id, submissionOrigenId: envio.id, cohortId: cohorte.id, ownerUserId: closer.id, etapa: "ganado_parcial", valorVendidoUsd: "797" }).returning();
  await db.insert(dealEtapaHistorial).values({ dealId: deal.id, de: "agendado", a: "ganado_parcial", userId: closer.id, fecha: new Date("2026-11-06T12:00:00-05:00") });
  await db.insert(calls).values({ programId: programa.id, dealId: deal.id, closerUserId: closer.id, resultado: "show", fechaAgenda: new Date("2026-11-06T09:00:00-05:00"), fechaLlamada: new Date("2026-11-06T09:00:00-05:00"), origen: "app" });
  await abonoDePrueba(db, [
    { programId: programa.id, dealId: deal.id, fecha: "2026-11-07", monto: "100", moneda: "USD", registradoPorUserId: closer.id },
    { programId: programa.id, dealId: deal.id, fecha: "2026-11-08", monto: "200000", moneda: "COP", registradoPorUserId: closer.id },
  ]);
}, 60_000);

function contexto(): ContextoMcp {
  const session = { user: { id: gerenteId, email: "gerente@retia.test", name: "gerente", rol: "gerente", operaComoCloser: false, closerId: null, alcanceLimitado: false } } as Session;
  return { db, session, rol: "gerente", tokenId: crypto.randomUUID(), escritura: false };
}

async function programaId(): Promise<string> {
  const [fila] = await db.select({ id: programs.id }).from(programs);
  return fila.id;
}

describe("paridad de cifras por las tres puertas (407 fase 2)", () => {
  it("cada metrica registrada que consultar_metrica acepta devuelve el total de la lista del Hub", async () => {
    const id = await programaId();
    const busqueda = { periodo: "custom", a_desde: RANGO.desde, a_hasta: RANGO.hasta, comparar: "no" };
    let comparadas = 0;
    for (const metrica of METRICAS_DE_LISTA) {
      let salida;
      try {
        salida = await consultarMetricaMcp.ejecutar(contexto(), consultarMetricaMcp.entrada.parse({ programa: slug, metrica, ...periodo }));
      } catch (error) {
        // Una metrica que pide un filtro obligatorio (escalon, nivel...) se rechaza igual por la pantalla.
        if (error instanceof ErrorDeApp) continue;
        throw error;
      }
      const hub = await vistaDeLista({ programId: id, metrica, busqueda, hoy: hoyEnBogota(), pagina: 1 }, db);
      expect(hub, metrica).not.toBeNull();
      const resumen = salida.estructurado.resumen as { total: number };
      expect(resumen.total, `${metrica}: consultar_metrica contra la lista del Hub`).toBe(hub!.lista.subtotal.cantidad);
      comparadas += 1;
    }
    expect(comparadas).toBeGreaterThan(10);
  });

  it("las ventas son la misma cifra en resumen_del_hub, consultar_metrica y consultar_hechos", async () => {
    const [resumen, metrica, hechos] = await Promise.all([
      resumenDelHubMcp.ejecutar(contexto(), { programa: slug, ...periodo }),
      consultarMetricaMcp.ejecutar(contexto(), consultarMetricaMcp.entrada.parse({ programa: slug, metrica: "cierres", ...periodo })),
      consultarHechosMcp.ejecutar(contexto(), consultarHechosMcp.entrada.parse({ programa: slug, hecho: "venta", ...periodo, agrupar_por: ["dia"], tamano_de_pagina: 200 })),
    ]);
    const delHub = (resumen.estructurado as { cifras: { ventas: { valor: number } } }).cifras.ventas.valor;
    const deMetrica = (metrica.estructurado.resumen as { total: number }).total;
    const deHechos = (hechos.estructurado.filas as Array<{ ventas: number }>).reduce((suma, fila) => suma + Number(fila.ventas), 0);
    expect(delHub).toBe(1);
    expect(deMetrica).toBe(delHub);
    expect(deHechos).toBe(delHub);
  });

  it("lo que entro a caja es el mismo monto por moneda en consultar_metrica y consultar_hechos", async () => {
    const [metrica, hechos] = await Promise.all([
      consultarMetricaMcp.ejecutar(contexto(), consultarMetricaMcp.entrada.parse({ programa: slug, metrica: "caja", ...periodo })),
      consultarHechosMcp.ejecutar(contexto(), consultarHechosMcp.entrada.parse({ programa: slug, hecho: "abono", ...periodo, agrupar_por: ["moneda"], tamano_de_pagina: 200 })),
    ]);
    const deMetrica = Object.fromEntries((metrica.estructurado.resumen as { entro_a_caja: Array<{ moneda: string; valor?: number; total?: number }> })
      .entro_a_caja.map((linea) => [linea.moneda.toUpperCase(), Number(linea.valor ?? linea.total)]));
    const deHechos = Object.fromEntries((hechos.estructurado.filas as Array<{ moneda: string; monto: number }>)
      .map((fila) => [fila.moneda.toUpperCase(), Number(fila.monto)]));
    expect(deHechos).toEqual({ USD: 100, COP: 200000 });
    expect(deMetrica).toEqual(deHechos);
  });

  it("agendas y citas por consultar_hechos suman lo mismo que su lista paginada", async () => {
    for (const [hecho, medida] of [["agenda", "agendas"], ["cita", "citas"]] as const) {
      const [lista, grupos] = await Promise.all([
        consultarHechosMcp.ejecutar(contexto(), consultarHechosMcp.entrada.parse({ programa: slug, hecho, ...periodo, tamano_de_pagina: 200 })),
        consultarHechosMcp.ejecutar(contexto(), consultarHechosMcp.entrada.parse({ programa: slug, hecho, ...periodo, agrupar_por: ["dia"], tamano_de_pagina: 200 })),
      ]);
      const suma = (grupos.estructurado.filas as Array<Record<string, number>>).reduce((total, fila) => total + Number(fila[medida]), 0);
      expect(lista.estructurado.total, hecho).toBe(suma);
      expect(suma, hecho).toBeGreaterThan(0);
    }
  });
});

describe("siguientes_pasos de consultar_metrica", () => {
  it("el periodo anterior tiene la misma duracion y termina el dia antes", () => {
    expect(periodoAnteriorDe("2026-11-01", "2026-11-30")).toEqual({ desde: "2026-10-02", hasta: "2026-10-31" });
    expect(periodoAnteriorDe("2026-11-10", "2026-11-10")).toEqual({ desde: "2026-11-09", hasta: "2026-11-09" });
  });

  it("ofrece comparar, abrir por canal y el enlace al Hub, con argumentos que la herramienta acepta", async () => {
    const salida = await consultarMetricaMcp.ejecutar(contexto(), consultarMetricaMcp.entrada.parse({ programa: slug, metrica: "cierres", ...periodo }));
    expect(consultarMetricaMcp.salida.safeParse(salida.estructurado).success).toBe(true);
    const pasos = salida.estructurado.siguientes_pasos as Array<{ clave: string; herramienta: string | null; argumentos: Record<string, unknown>; enlace: string | null }>;
    expect(pasos.map((paso) => paso.clave)).toEqual(["comparar_periodo_anterior", "desglosar_por_origen", "abrir_en_el_hub"]);
    const comparar = pasos[0];
    expect(comparar.argumentos).toMatchObject({ metrica: "cierres", desde: "2026-10-02", hasta: "2026-10-31", periodo: "custom" });
    expect(consultarMetricaMcp.entrada.safeParse(comparar.argumentos).success).toBe(true);
    const desglose = pasos[1];
    expect(consultarHechosMcp.entrada.safeParse(desglose.argumentos).success).toBe(true);
    expect(pasos[2]).toMatchObject({ herramienta: null, argumentos: {} });
    expect(pasos[2].enlace).toContain(slug);
  });

  it("ofrece la pagina siguiente solo cuando existe", async () => {
    const salida = await consultarMetricaMcp.ejecutar(contexto(), consultarMetricaMcp.entrada.parse({ programa: slug, metrica: "cierres", ...periodo }));
    const claves = (salida.estructurado.siguientes_pasos as Array<{ clave: string }>).map((paso) => paso.clave);
    expect(claves).not.toContain("ver_mas_filas");
  });
});
