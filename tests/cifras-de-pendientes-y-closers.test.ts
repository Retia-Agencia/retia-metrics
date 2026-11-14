import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { abonos, calls, deals, dealEtapaHistorial, leads, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { CONCEPTOS_DE_CLOSERS_DE_HOY, CONCEPTOS_DE_PENDIENTES, cifrasDeClosersDeHoy, cifrasDePendientes, type ExplicacionesDeClosersDeHoy, type ExplicacionesDePendientes } from "@/lib/hub/cifras-de-pendientes-y-closers";
import type { ExplicacionDeConcepto } from "@/lib/metricas/cifra";
import { banderasDelPulso } from "@/lib/queries/banderas-del-pulso";
import { embudoPorCloser, sinResultadoDelRango } from "@/lib/queries/dashboard";
import type { Metrica } from "@/lib/queries/metricas-con-filas";
import { showsSinGrain } from "@/lib/queries/sin-grain";
import { detallesDelComparativo, detallesDelDashboard, sinListas, vistaDeLista, type DetalleDeCifra } from "@/lib/queries/vista-metrica";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { FECHA_LEAD_DE_PRUEBA } from "./helpers/crear-lead-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

// Una llamada que olvide pasar PGlite falla antes de poder abrir una conexión real.
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get() { throw new Error("Este test solo admite PGlite explícito"); } }) }));

const explicacion = (clave: string): ExplicacionDeConcepto => ({ rotulo: "Cifra del día", universo: "todas", unidad: clave === "entro_a_caja" ? "usd" : clave === "asistencia" || clave === "cierre_de_ventas" ? "porcentaje" : "conteo", que: "Los casos de esta cifra.", formula: { forma: "conteo", terminos: ["casos"] }, variables: [] });
const pendientes = Object.fromEntries(CONCEPTOS_DE_PENDIENTES.map((k): [string, ExplicacionDeConcepto] => [k, explicacion(k)])) as ExplicacionesDePendientes;
const closers = Object.fromEntries(CONCEPTOS_DE_CLOSERS_DE_HOY.map((k): [string, ExplicacionDeConcepto] => [k, explicacion(k)])) as ExplicacionesDeClosersDeHoy;
const comun = { programa: "Prueba", dia: "2026-10-05", hoy: "2026-10-05" };
const vacio = { sinGrain: { sinGrain: 0, shows: 0, pct: null }, sinResultado: 0, banderas: { atendidos: 0, sinValor: { cantidad: 0, pct: null }, sinGrain: { cantidad: 0, pct: null }, perdidosConPagos: { cantidad: 0 } } };

describe("419 E-2: pendientes y comparativo de Hoy, casos puros", () => {
  it("los ceros no desaparecen del resultado y no tienen estado inventado", () => {
    const c = cifrasDePendientes({ ...comun, datos: vacio, explicaciones: pendientes });
    expect(c.conCasos).toEqual([]);
    expect(c.enCero).toHaveLength(5);
    expect(c.banderas.every((x) => x.valor === 0 && x.textoDelValor === "0" && x.estado === null)).toBe(true);
    expect(cifrasDeClosersDeHoy({ ...comun, filas: [], explicaciones: closers })).toEqual([]);
  });
  it("conserva cada bandera y porcentaje sin recalcular; las del deal siempre dicen Hoy", () => {
    const datos = { sinGrain: { sinGrain: 3, shows: 4, pct: 0.75 }, sinResultado: 2, banderas: { atendidos: 8, sinValor: { cantidad: 1, pct: 0.125 }, sinGrain: { cantidad: 4, pct: 0.5 }, perdidosConPagos: { cantidad: 1 } } };
    const antes = structuredClone(datos);
    const c = cifrasDePendientes({ ...comun, dia: "2026-10-02", datos, explicaciones: pendientes });
    expect(c.banderas.map((x) => x.valor)).toEqual([3, 2, 1, 4, 1]);
    expect(c.banderas[0].linea).toEqual({ antes: "75,0% de ", cifra: "4", despues: " realizadas" });
    expect(c.banderas[0].explicacion.filtros).toContainEqual(["Día", "2-oct"]);
    expect(c.banderas[2].explicacion.filtros).toEqual([["Programa", "Prueba"], ["Día", "Hoy"]]);
    expect(datos).toEqual(antes);
    for (const cifra of c.banderas) expect(JSON.stringify(cifra)).not.toMatch(/\.\.|utm_|ADR|periodo [AB]\b|NaN|undefined/);
  });
});

let db: Db;
let cerrar: () => Promise<void>;
let programId: string;
const ahora = new Date("2026-10-05T18:00:00-05:00");
const instante = new Date("2026-10-05T10:00:00-05:00");
const periodo = { preset: "custom" as const, a: { desde: comun.dia, hasta: comun.dia }, b: null };
beforeAll(async () => {
  ({ db, cerrar } = await crearBaseReutilizable());
  const [p, ajeno] = await db.insert(programs).values([
    { ...PROGRAMA_DE_PRUEBA, slug: "pend419", nombre: "Prueba", ticketUsd: "1000" },
    { ...PROGRAMA_DE_PRUEBA, slug: "pend419-ajeno", nombre: "Ajeno", ticketUsd: "1000" },
  ]).returning();
  programId = p.id;
  const [ana, beto] = await db.insert(users).values([
    { email: "p419a@test.test", rol: "closer", closerId: "Ana" },
    { email: "p419b@test.test", rol: "closer", closerId: "Beto" },
  ]).returning();
  let n = 0;
  for (const c of [
    { etapa: "ganado_parcial", resultado: "show", venta: true },
    { etapa: "atendido", resultado: "show" },
    { etapa: "agendado", resultado: "agendada" },
    { etapa: "agendado", resultado: "agendada" },
    { etapa: "agendado", resultado: "cancelada" },
    { etapa: "cierre_perdido", resultado: "no_show", pago: true },
    { etapa: "atendido", resultado: "show", anulado: true },
    { etapa: "atendido", resultado: "show", ajeno: true },
  ] as const) {
    const programa = "ajeno" in c ? ajeno.id : programId;
    const anulado = "anulado" in c;
    const [l] = await db.insert(leads).values({ fechaPrimeraAplicacion: FECHA_LEAD_DE_PRUEBA, programId: programa, emailNormalizado: `p${n++}@test.test` }).returning();
    const [d] = await db.insert(deals).values({ programId: programa, leadId: l.id, ownerUserId: ana.id, etapa: c.etapa, valorVendidoUsd: null, createdAt: instante, anuladoEn: anulado ? ahora : null, anuladoPor: anulado ? ana.id : null, motivoAnulacion: anulado ? "Prueba" : null }).returning();
    await db.insert(calls).values({ programId: programa, dealId: d.id, closerUserId: ana.id, fechaAgenda: instante, resultado: c.resultado });
    if ("venta" in c) await db.insert(dealEtapaHistorial).values({ dealId: d.id, a: "ganado_parcial", fecha: instante });
    // Beto cobra ventas de Ana: la tabla debe conservar ese reparto, incluso con COP y USD.
    if ("venta" in c || "pago" in c) await db.insert(abonos).values([
      { programId: programa, dealId: d.id, registradoPorUserId: beto.id, fecha: comun.dia, monto: "100", moneda: "USD" },
      { programId: programa, dealId: d.id, registradoPorUserId: beto.id, fecha: comun.dia, monto: "50000", moneda: "COP" },
    ]);
  }
}, 120_000);
afterAll(async () => cerrar());

async function total(detalle: DetalleDeCifra) {
  const busqueda = Object.fromEntries(new URL(detalle.href, "https://prueba.test").searchParams);
  const lista = await vistaDeLista({ programId, metrica: busqueda.metrica as Metrica, busqueda, hoy: comun.hoy, codigoCloser: busqueda.closer, pagina: 1, ahora }, db);
  expect(lista).not.toBeNull();
  return lista!.lista.subtotal.cantidad;
}

describe("419 E-2: pendientes y closers, paridad con listas reales en PGlite", () => {
  it("cada una de las cinco banderas abre la lista del mismo programa y alcance", async () => {
    const alcance = { programId, rango: periodo.a };
    const datos = { sinGrain: await showsSinGrain(alcance, db), sinResultado: await sinResultadoDelRango(alcance, ahora, db), banderas: await banderasDelPulso({ programId }, db) };
    const detalles = await detallesDelDashboard({ programId, slug: "pend419", hoy: comun.hoy, periodo, claveCloser: null, origen: "/p/pend419/hub", ahora }, db);
    const c = cifrasDePendientes({ ...comun, datos, detalles, explicaciones: pendientes });
    const claves = ["shows_sin_grain", "sin_resultado", "atendidos_sin_valor", "atendidos_sin_grain", "perdidos_con_pagos"] as const;
    for (const [i, clave] of claves.entries()) {
      expect(await total(detalles[clave]), clave).toBe(c.banderas[i].valor);
      expect(c.banderas[i].explicacion.evidencia?.href).toBe(detalles[clave].href);
    }
    expect(c.banderas.map((x) => x.valor)).toEqual([2, 2, 1, 2, 1]);
    const sin = cifrasDePendientes({ ...comun, datos, detalles: sinListas(detalles), explicaciones: pendientes });
    expect(sin.banderas.every((x) => x.explicacion.evidencia === null)).toBe(true);
  });
  it("cada closer conserva sus citas y ventas; la caja queda en quien cobró y separada por moneda", async () => {
    const filas = (await embudoPorCloser({ programId, rango: periodo.a }, db, ahora)).map((f) => ({ ...f, comisionUsd: 0, ventasSinComision: 0 }));
    const detalles = await detallesDelComparativo({ programId, slug: "pend419", hoy: comun.hoy, periodo, origen: "/p/pend419/hub", ahora }, filas.map((f) => f.clave), db, ahora);
    const c = cifrasDeClosersDeHoy({ ...comun, filas, detalles, explicaciones: closers });
    for (const [i, original] of filas.entries()) {
      expect(c[i].citas.valor).toBe(original.agendas);
      expect(c[i].ventas.valor).toBe(original.cierres);
      expect(c[i].asistencia.valor).toBe(original.razonShow.valor);
      expect(c[i].cierreDeVentas.valor).toBe(original.razonCierre.valor);
      expect(await total(detalles[original.clave].agendas)).toBe(c[i].citas.valor);
      expect(await total(detalles[original.clave].cierres)).toBe(c[i].ventas.valor);
      expect(await total(detalles[original.clave].grupo_citas)).toBe(original.grupo.deals);
      expect(await total(detalles[original.clave].grupo_shows)).toBe(original.grupo.conShow);
      for (const caja of c[i].entroACaja) {
        expect(caja.valor).toBe(original.caja.find((x) => x.moneda === (caja.unidad === "cop" ? "COP" : "USD"))?.total ?? 0);
        expect(caja.explicacion.filtros.map(([k]) => k)).toEqual(["Programa", "Día", "Closer", "Moneda"]);
      }
    }
    expect(c.find((x) => x.closer === "Beto")?.entroACaja.map((x) => x.valor)).toEqual([100000, 200]);
    expect(c.find((x) => x.closer === "Ana")?.ventas.valor).toBe(1);
    expect(c.find((x) => x.closer === "Ana")?.asistencia.etiquetas).toContain("Parcial");
  });
});
