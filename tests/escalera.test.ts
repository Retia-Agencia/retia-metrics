import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { abonos, calls, deals, dealEtapaHistorial, leads, programs, sources, submissions, users } from "@/lib/db/schema";
import { pautaInterina } from "@/lib/queries/pauta-interina";
import type { Db } from "@/lib/db/tipos";
import {
  agruparEscalera,
  cargarEscalera,
  escaleraDeDeals,
  filtrarEscalera,
  resumirEscalera,
} from "@/lib/queries/escalera";
import { listaDeMetrica, TAMANO_PAGINA } from "@/lib/queries/metricas-con-filas";
import { vistaDeEscalera } from "@/lib/queries/vista-escalera";
import { escaleraPorPrograma } from "@/lib/queries/escalera-todos";
import { sumarConteos } from "@/lib/queries/agregado-programas";
import { codigoDeCloser, vistaDeLista } from "@/lib/queries/vista-metrica";
import { ESCALONES, ESCALONES_QUE_PAGARON } from "@/lib/queries/escalera";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * ADR 0109, ticket 319: UN escalón por deal, en una sola función. 2026-10-05 es lunes: el viernes
 * 2 y el lunes 5 son hábiles; sábado 3 y domingo 4 no cuentan.
 */

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let programId: string;
let otroPrograma: string;
let ana: string;
let beto: string;
const rango = { desde: "2026-10-01", hasta: "2026-10-31" };

beforeAll(async () => {
  ({ db, cerrar, vaciar } = await crearBaseReutilizable());
});
afterAll(async () => cerrar());

let n = 0;
interface Siembra {
  programa?: string;
  owner?: string | null;
  creado?: string;
  etapaVendida?: boolean;
  ventaEl?: string;
  abonos?: Array<{ fecha: string; anulado?: boolean; concepto?: "ticket" | "adicional" }>;
  citas?: Array<{ dia: string; resultado: "agendada" | "show" | "no_show" | "cerrada" | "perdida" | "cancelada" | "reagendada"; anulada?: boolean }>;
  cortesia?: boolean;
  anulado?: boolean;
}
async function sembrar(s: Siembra): Promise<string> {
  n += 1;
  const programa = s.programa ?? programId;
  const [lead] = await db.insert(leads).values({ programId: programa, emailNormalizado: `l${n}@x.test` }).returning();
  const [deal] = await db.insert(deals).values({
    programId: programa,
    leadId: lead.id,
    ownerUserId: s.owner === undefined ? ana : s.owner,
    etapa: s.etapaVendida ? "ganado_parcial" : "contactado",
    cortesia: s.cortesia ?? false,
    createdAt: new Date(`${s.creado ?? "2026-10-02"}T12:00:00-05:00`),
    anuladoEn: s.anulado ? new Date() : null,
    anuladoPor: s.anulado ? ana : null,
    motivoAnulacion: s.anulado ? "x" : null,
  }).returning();
  if (s.etapaVendida) {
    await db.insert(dealEtapaHistorial).values({ dealId: deal.id, a: "ganado_parcial", fecha: new Date(`${s.ventaEl ?? "2026-10-05"}T12:00:00-05:00`) });
  }
  for (const a of s.abonos ?? []) {
    await db.insert(abonos).values({
      programId: programa, dealId: deal.id, fecha: a.fecha, monto: "100", moneda: "USD", closerId: "Ana",
      concepto: a.concepto ?? "ticket",
      anuladoEn: a.anulado ? new Date() : null, anuladoPor: a.anulado ? ana : null, motivoAnulacion: a.anulado ? "x" : null,
    });
  }
  for (const c of s.citas ?? []) {
    await db.insert(calls).values({
      programId: programa, dealId: deal.id, fechaAgenda: new Date(`${c.dia}T10:00:00-05:00`), resultado: c.resultado,
      anuladoEn: c.anulada ? new Date() : null, anuladoPor: c.anulada ? ana : null, motivoAnulacion: c.anulada ? "x" : null,
    });
  }
  return deal.id;
}

beforeEach(async () => {
  await vaciar();
  const [p, q] = await db.insert(programs).values([
    { ...PROGRAMA_DE_PRUEBA, slug: "p", nombre: "P", ticketUsd: "100", cortePagoRapidoDias: 3 },
    { ...PROGRAMA_DE_PRUEBA, slug: "q", nombre: "Q", ticketUsd: "100" },
  ]).returning();
  programId = p.id;
  otroPrograma = q.id;
  [{ id: ana }, { id: beto }] = await db.insert(users).values([
    { email: "ana@x.test", rol: "closer", closerId: "Ana" },
    { email: "beto@x.test", rol: "closer", closerId: "Beto" },
  ]).returning();
});

async function porEscalon(corte?: number | null) {
  if (corte !== undefined) await db.update(programs).set({ cortePagoRapidoDias: corte }).where(eq(programs.id, programId));
  const cargada = await cargarEscalera(db, { programId, rango });
  return { cargada, escalon: (id: string) => cargada.deals.find((d) => d.dealId === id)?.escalon };
}

describe("cargarEscalera: los siete escalones contra la base", () => {
  it("cada deal cae en su escalón, en los dos sentidos", async () => {
    const enLlamada = await sembrar({ etapaVendida: true, abonos: [{ fecha: "2026-10-05" }], citas: [{ dia: "2026-10-05", resultado: "cerrada" }] });
    const rapido = await sembrar({ etapaVendida: true, ventaEl: "2026-10-07", abonos: [{ fecha: "2026-10-07" }], citas: [{ dia: "2026-10-05", resultado: "show" }] });
    const despues = await sembrar({ etapaVendida: true, ventaEl: "2026-10-12", abonos: [{ fecha: "2026-10-12" }], citas: [{ dia: "2026-10-05", resultado: "show" }] });
    const atendio = await sembrar({ citas: [{ dia: "2026-10-05", resultado: "perdida" }] });
    const noSePresento = await sembrar({ citas: [{ dia: "2026-10-05", resultado: "no_show" }] });
    const sinCita = await sembrar({});
    const sinLlamada = await sembrar({ etapaVendida: true, ventaEl: "2026-10-09", abonos: [{ fecha: "2026-10-09" }] });
    const { escalon } = await porEscalon();
    expect([enLlamada, rapido, despues, sinLlamada, atendio, noSePresento, sinCita].map(escalon)).toEqual([
      "pago_en_llamada", "pago_rapido", "pago_despues", "pago_sin_llamada", "atendio_no_compro", "agendo_no_se_presento", "dejo_datos",
    ]);
  });

  it("una cita pendiente no cuenta; solo una vencida sin atender es 'agendó y no se presentó' (28-oct)", async () => {
    const futura = await sembrar({ citas: [{ dia: "2099-01-05", resultado: "agendada" }] });
    const futuraYReagendada = await sembrar({ citas: [{ dia: "2099-01-05", resultado: "agendada" }, { dia: "2026-10-05", resultado: "reagendada" }] });
    const pasadaSinResultado = await sembrar({ citas: [{ dia: "2026-10-05", resultado: "agendada" }] });
    const noShowFuturo = await sembrar({ citas: [{ dia: "2099-01-05", resultado: "no_show" }] });
    const vencidaNoShow = await sembrar({ citas: [{ dia: "2026-10-05", resultado: "no_show" }] });
    const vencidaCancelada = await sembrar({ citas: [{ dia: "2026-10-05", resultado: "cancelada" }] });
    const pendienteYVencida = await sembrar({ citas: [{ dia: "2099-01-05", resultado: "agendada" }, { dia: "2026-10-05", resultado: "no_show" }] });
    const pendienteYAtendida = await sembrar({ citas: [{ dia: "2099-01-05", resultado: "agendada" }, { dia: "2026-10-05", resultado: "show" }] });
    const { escalon } = await porEscalon();
    expect([futura, futuraYReagendada, pasadaSinResultado, noShowFuturo].map(escalon)).toEqual(Array(4).fill("dejo_datos"));
    expect([vencidaNoShow, vencidaCancelada, pendienteYVencida].map(escalon)).toEqual(Array(3).fill("agendo_no_se_presento"));
    expect(escalon(pendienteYAtendida)).toBe("atendio_no_compro");
  });

  it("una cita o un abono anulados no cuentan; un abono adicional tampoco es 'el primer abono'", async () => {
    const citaAnulada = await sembrar({ citas: [{ dia: "2026-10-05", resultado: "show", anulada: true }] });
    const abonoAnulado = await sembrar({
      etapaVendida: true,
      abonos: [{ fecha: "2026-10-05", anulado: true }, { fecha: "2026-10-12" }],
      citas: [{ dia: "2026-10-05", resultado: "show" }],
    });
    const soloAdicionalAntes = await sembrar({
      etapaVendida: true,
      abonos: [{ fecha: "2026-10-05", concepto: "adicional" }, { fecha: "2026-10-12" }],
      citas: [{ dia: "2026-10-05", resultado: "show" }],
    });
    const { escalon } = await porEscalon();
    expect(escalon(citaAnulada)).toBe("dejo_datos");
    expect(escalon(abonoAnulado)).toBe("pago_despues"); // el primer abono vigente es el del 12
    expect(escalon(soloAdicionalAntes)).toBe("pago_despues");
  });

  it("un deal anulado, una cortesía o un deal de otro programa no entran", async () => {
    await sembrar({ anulado: true });
    await sembrar({ cortesia: true });
    await sembrar({ programa: otroPrograma });
    const propio = await sembrar({});
    const { cargada } = await porEscalon();
    expect(cargada.deals.map((d) => d.dealId)).toEqual([propio]);
  });

  it("el escalón cambia al leer cuando el deal paga, sin guardar nada", async () => {
    const id = await sembrar({ citas: [{ dia: "2026-10-05", resultado: "show" }] });
    expect((await porEscalon()).escalon(id)).toBe("atendio_no_compro");
    await db.update(deals).set({ etapa: "ganado_parcial" }).where(eq(deals.id, id));
    await db.insert(dealEtapaHistorial).values({ dealId: id, a: "ganado_parcial", fecha: new Date("2026-10-05T15:00:00-05:00") });
    await db.insert(abonos).values({ programId, dealId: id, fecha: "2026-10-05", monto: "100", moneda: "USD", closerId: "Ana" });
    expect((await porEscalon()).escalon(id)).toBe("pago_en_llamada");
  });

  it("corte nulo: 'pagó rápido' no existe y sus pagos están en 'pagó después'", async () => {
    const id = await sembrar({ etapaVendida: true, ventaEl: "2026-10-07", abonos: [{ fecha: "2026-10-07" }], citas: [{ dia: "2026-10-05", resultado: "show" }] });
    const { cargada, escalon } = await porEscalon(null);
    expect(escalon(id)).toBe("pago_despues");
    const resumen = resumirEscalera(cargada.deals, cargada.corteDias);
    expect(resumen.sinCorte).toBe(true);
    expect(resumen.lineas.find((l) => l.escalon === "pago_rapido")?.deals).toBe(0);
  });

  it("un deal creado en el periodo y vendido después no es 5 a 7: espera a su periodo de venta", async () => {
    const id = await sembrar({ etapaVendida: true, ventaEl: "2026-11-10", abonos: [{ fecha: "2026-11-10" }], citas: [{ dia: "2026-10-05", resultado: "show" }] });
    expect((await porEscalon()).escalon(id)).toBeUndefined();
    const nov = await cargarEscalera(db, { programId, rango: { desde: "2026-11-01", hasta: "2026-11-30" } });
    expect(nov.deals.find((d) => d.dealId === id)?.escalon).toBe("pago_despues");
  });

  it("la suma de los escalones de venta (1 a 4) es igual a los cierres del Hub en el mismo periodo", async () => {
    await sembrar({ etapaVendida: true, abonos: [{ fecha: "2026-10-05" }], citas: [{ dia: "2026-10-05", resultado: "cerrada" }] });
    await sembrar({ etapaVendida: true, ventaEl: "2026-10-08", abonos: [{ fecha: "2026-10-08" }], citas: [{ dia: "2026-10-05", resultado: "show" }] });
    await sembrar({ etapaVendida: true, ventaEl: "2026-10-20", abonos: [{ fecha: "2026-10-20" }] }); // sin cita
    await sembrar({ etapaVendida: true, ventaEl: "2026-09-20", abonos: [{ fecha: "2026-09-20" }] }); // fuera del periodo
    await sembrar({ etapaVendida: true, cortesia: true });
    await sembrar({ citas: [{ dia: "2026-10-05", resultado: "show" }] });
    const resumen = await escaleraDeDeals(db, { programId, rango });
    const pagaron = resumen.lineas.filter((l) => ESCALONES_QUE_PAGARON.includes(l.escalon)).reduce((s, l) => s + l.deals, 0);
    const [cierres] = await listaDeMetrica("cierres", { programId, rango, hoy: "2026-10-31" }, 1, db);
    expect(pagaron).toBe(3);
    expect(pagaron).toBe(cierres.subtotal.cantidad);
    expect(resumen.total).toBe(4);
    expect(resumen.lineas.find((l) => l.escalon === "pago_sin_llamada")?.deals).toBe(1);
    expect(resumen.lineas.find((l) => l.escalon === "pago_despues")?.deals).toBe(0);
  });

  it("el filtro de closer da lo mismo que el de la lista cierres, también con la clave histórica", async () => {
    await sembrar({ owner: ana, etapaVendida: true, abonos: [{ fecha: "2026-10-05" }], citas: [{ dia: "2026-10-05", resultado: "cerrada" }] });
    await sembrar({ owner: ana, etapaVendida: true, ventaEl: "2026-10-09", abonos: [{ fecha: "2026-10-09" }] });
    await sembrar({ owner: beto, etapaVendida: true, ventaEl: "2026-10-09", abonos: [{ fecha: "2026-10-09" }] });
    await sembrar({ owner: null, etapaVendida: true, ventaEl: "2026-10-09", abonos: [{ fecha: "2026-10-09" }] });
    const { cargada } = await porEscalon();
    for (const clave of [ana, beto, "historico:ana", "historico:  ANA ", "historico:beto", "historico:", "historico:nadie"]) {
      const [cierres] = await listaDeMetrica("cierres", { programId, rango, hoy: "2026-10-31", claveCloser: clave }, 1, db);
      const deEscalera = filtrarEscalera(cargada, { claveCloser: clave }).filter((d) => ESCALONES_QUE_PAGARON.includes(d.escalon));
      expect(deEscalera.length, clave).toBe(cierres.subtotal.cantidad);
    }
  });

  it("se abre por closer y por calidad sin perder deals", async () => {
    await sembrar({ owner: ana, citas: [{ dia: "2026-10-05", resultado: "show" }] });
    await sembrar({ owner: ana, etapaVendida: true, abonos: [{ fecha: "2026-10-05" }], citas: [{ dia: "2026-10-05", resultado: "show" }] });
    await sembrar({ owner: beto });
    await sembrar({ owner: null });
    const { cargada } = await porEscalon();
    const porCloser = agruparEscalera(cargada, "closer");
    expect(porCloser.reduce((s, g) => s + g.resumen.total, 0)).toBe(cargada.deals.length);
    expect(porCloser.find((g) => g.clave === ana)?.resumen.total).toBe(2);
    expect(agruparEscalera(cargada, "calidad").map((g) => g.etiqueta)).toEqual(["Sin calidad"]);
    expect(filtrarEscalera(cargada, { claveCloser: ana, escalon: "pago_en_llamada" })).toHaveLength(1);
  });
});

describe("320: la tarjeta y su lista cuentan lo mismo", () => {
  const periodo = { preset: "custom" as const, a: rango, b: null };
  const entrada = () => ({ programId, slug: "p", hoy: "2026-10-31", periodo, claveCloser: null, origen: "/p/p/hub", conEquipo: true });

  async function sembrarVarios() {
    await sembrar({ owner: ana, etapaVendida: true, abonos: [{ fecha: "2026-10-05" }], citas: [{ dia: "2026-10-05", resultado: "cerrada" }] });
    await sembrar({ owner: ana, etapaVendida: true, ventaEl: "2026-10-08", abonos: [{ fecha: "2026-10-08" }], citas: [{ dia: "2026-10-05", resultado: "show" }] });
    await sembrar({ owner: beto, etapaVendida: true, ventaEl: "2026-10-20", abonos: [{ fecha: "2026-10-20" }], citas: [{ dia: "2026-10-05", resultado: "show" }] });
    await sembrar({ owner: beto, citas: [{ dia: "2026-10-05", resultado: "perdida" }] });
    await sembrar({ owner: null });
    for (let i = 0; i < TAMANO_PAGINA + 3; i += 1) await sembrar({ owner: ana, citas: [{ dia: "2026-10-05", resultado: "no_show" }] });
  }

  it("cada cifra de la tarjeta es el subtotal de su lista, y la lista pagina completa", async () => {
    await sembrarVarios();
    const vista = await vistaDeEscalera(entrada(), db);
    for (const escalon of ESCALONES) {
      const celda = vista.principal.celdas[escalon];
      const [lista] = await listaDeMetrica("escalera", { programId, rango, hoy: "2026-10-31", escalon }, 1, db);
      expect(lista.subtotal.cantidad).toBe(celda.deals);
      expect(celda.detalle?.resumen.subtotal.cantidad ?? 0).toBe(celda.deals);
      let vistas = 0;
      for (let pagina = 1; vistas < celda.deals; pagina += 1) {
        const [p] = await listaDeMetrica("escalera", { programId, rango, hoy: "2026-10-31", escalon }, pagina, db);
        vistas += p.filas.length;
      }
      expect(vistas).toBe(celda.deals);
    }
    expect(vista.principal.total).toBe(TAMANO_PAGINA + 3 + 5);
  });

  it("por closer: la celda abre la lista de ese closer y las filas suman el total del programa", async () => {
    await sembrarVarios();
    const vista = await vistaDeEscalera(entrada(), db);
    expect(vista.porCloser.reduce((t, f) => t + f.total, 0)).toBe(vista.principal.total);
    const deAna = vista.porCloser.find((f) => f.clave === ana)!;
    const celda = deAna.celdas.agendo_no_se_presento;
    const codigo = codigoDeCloser(ana);
    const abierta = await vistaDeLista({
      programId, metrica: "escalera", busqueda: { periodo: "custom", a_desde: rango.desde, a_hasta: rango.hasta, sin_b: "1" },
      hoy: "2026-10-31", codigoCloser: codigo, escalon: "agendo_no_se_presento", pagina: 1,
    }, db);
    expect(abierta?.lista.subtotal.cantidad).toBe(celda.deals);
    expect(new URL(celda.detalle!.href, "http://x").searchParams.get("closer")).toBe(codigo);
  });

  it("la lista decide con el mismo reloj que la cifra: ahora fijo", async () => {
    await sembrar({ citas: [{ dia: "2026-10-05", resultado: "no_show" }] });
    const antes = new Date("2026-10-01T12:00:00-05:00");
    const despues = new Date("2026-10-31T12:00:00-05:00");
    for (const [ahora, escalon] of [[antes, "dejo_datos"], [despues, "agendo_no_se_presento"]] as const) {
      const vista = await vistaDeEscalera({ ...entrada(), ahora }, db);
      const [lista] = await listaDeMetrica("escalera", { programId, rango, hoy: "2026-10-31", escalon, ahora }, 1, db);
      expect(vista.principal.celdas[escalon].deals).toBe(1);
      expect(lista.subtotal.cantidad).toBe(1);
      const [otra] = await listaDeMetrica("escalera", { programId, rango, hoy: "2026-10-31", escalon: escalon === "dejo_datos" ? "agendo_no_se_presento" : "dejo_datos", ahora }, 1, db);
      expect(otra.subtotal.cantidad).toBe(0);
    }
  });

  it("sin acceso al equipo no hay closers ni listas, pero las cifras quedan", async () => {
    await sembrarVarios();
    const vista = await vistaDeEscalera({ ...entrada(), conEquipo: false }, db);
    expect(vista.porCloser).toEqual([]);
    expect(vista.principal.celdas.pago_en_llamada.deals).toBe(1);
    expect(Object.values(vista.principal.celdas).every((c) => c.detalle === null)).toBe(true);
  });

  it("un escalón que no existe da una lista vacía, nunca la escalera entera", async () => {
    await sembrarVarios();
    const [lista] = await listaDeMetrica("escalera", { programId, rango, hoy: "2026-10-31", escalon: "inventado" }, 1, db);
    expect(lista.subtotal.cantidad).toBe(0);
  });

  it("con comparación trae el B de cada escalón", async () => {
    await sembrarVarios();
    await sembrar({ creado: "2026-09-10", citas: [{ dia: "2026-09-10", resultado: "perdida" }] });
    const vista = await vistaDeEscalera({ ...entrada(), periodo: { preset: "custom", a: rango, b: { desde: "2026-09-01", hasta: "2026-09-30" } } }, db);
    expect(vista.hayComparacion).toBe(true);
    expect(vista.principal.celdas.atendio_no_compro.anterior).toBe(1);
  });
});

describe("320: todos los programas, lado a lado y sin mezclar (ADR 0048)", () => {
  const periodo = { preset: "custom" as const, a: rango, b: null };

  it("una distribución por programa; cada cifra contra la lista de SU programa y ningún total cruzado", async () => {
    await sembrar({ etapaVendida: true, abonos: [{ fecha: "2026-10-05" }], citas: [{ dia: "2026-10-05", resultado: "cerrada" }] });
    await sembrar({ citas: [{ dia: "2026-10-05", resultado: "no_show" }] });
    await sembrar({ programa: otroPrograma, owner: null, etapaVendida: true, ventaEl: "2026-10-09", abonos: [{ fecha: "2026-10-09" }] });
    await sembrar({ programa: otroPrograma, owner: null });
    await sembrar({ programa: otroPrograma, owner: null });
    const programas = [
      { id: programId, slug: "p", nombre: "P" },
      { id: otroPrograma, slug: "q", nombre: "Q" },
    ] as never;
    const filas = await escaleraPorPrograma({ programas, hoy: "2026-10-31", periodo, origen: "/hub", conListas: true }, db);

    expect(filas.map((f) => f.programa.id)).toEqual([programId, otroPrograma]);
    expect(filas.map((f) => f.vista.principal.total)).toEqual([2, 3]);
    for (const { programa, vista } of filas) {
      for (const escalon of ESCALONES) {
        const [lista] = await listaDeMetrica("escalera", { programId: programa.id, rango, hoy: "2026-10-31", escalon }, 1, db);
        expect(lista.subtotal.cantidad).toBe(vista.principal.celdas[escalon].deals);
        const href = vista.principal.celdas[escalon].detalle?.href;
        if (href) expect(href).toContain(`/p/${programa.slug}/hub/lista`);
      }
      // Sin desglose por closer ni calidad: la vista de todos es solo la distribución del programa.
      expect(vista.porCloser).toEqual([]);
      expect(vista.porCalidad).toEqual([]);
    }
    // No existe un total ni un porcentaje combinado: el resultado es solo la lista de filas por programa.
    expect(Array.isArray(filas)).toBe(true);
    for (const fila of filas) expect(Object.keys(fila).sort()).toEqual(["programa", "vista"]);
    // Ni se puede construir con los tipos: un porcentaje es una Tasa y las sumas no la aceptan.
    // @ts-expect-error una Tasa no es un Conteo
    sumarConteos(filas.map((f) => f.vista.principal.celdas.pago_en_llamada.porcentaje));
  });

  it("sin permiso para abrir listas las cifras salen sin enlace", async () => {
    await sembrar({ etapaVendida: true, abonos: [{ fecha: "2026-10-05" }], citas: [{ dia: "2026-10-05", resultado: "cerrada" }] });
    const [fila] = await escaleraPorPrograma({ programas: [{ id: programId, slug: "p", nombre: "P" }] as never, hoy: "2026-10-31", periodo, origen: "/hub", conListas: false }, db);
    expect(fila.vista.principal.celdas.pago_en_llamada.deals).toBe(1);
    expect(Object.values(fila.vista.principal.celdas).every((c) => c.detalle === null)).toBe(true);
  });
});

describe("349: las ventas de Pauta por origen salen de la escalera y abren su lista", () => {
  async function conOrigen(dealId: string, source: string, medium: string, campaign: string) {
    const [deal] = await db.select().from(deals).where(eq(deals.id, dealId));
    const [fuente] = await db.insert(sources).values({ programId, nombre: `F${n++}` }).returning();
    const [envio] = await db.insert(submissions).values({
      leadId: deal.leadId, sourceId: fuente.id, token: `t${n}`, esParcial: false, fechaEnvio: new Date("2026-10-01T10:00:00-05:00"),
      utmSource: source, utmMedium: medium, utmCampaign: campaign,
    }).returning();
    await db.update(deals).set({ submissionOrigenId: envio.id }).where(eq(deals.id, dealId));
  }

  it("reparte ventas, cuándo pagaron y completo o parcial por origen, y cada cifra cuadra con su lista", async () => {
    const enLlamada = await sembrar({ etapaVendida: true, abonos: [{ fecha: "2026-10-05" }], citas: [{ dia: "2026-10-05", resultado: "cerrada" }] });
    const despues = await sembrar({ etapaVendida: true, ventaEl: "2026-10-12", abonos: [{ fecha: "2026-10-12" }], citas: [{ dia: "2026-10-05", resultado: "show" }] });
    const otroCanal = await sembrar({ etapaVendida: true, ventaEl: "2026-10-09", abonos: [{ fecha: "2026-10-09" }] });
    await sembrar({ etapaVendida: true, ventaEl: "2026-10-09", abonos: [{ fecha: "2026-10-09" }] });
    const cortesia = await sembrar({ etapaVendida: true, cortesia: true, abonos: [{ fecha: "2026-10-09" }] });
    await conOrigen(enLlamada, "ig", "paid_social", "c1");
    await conOrigen(despues, "ig", "paid_social", "c1");
    await conOrigen(otroCanal, "linkedin", "francisco", "c9");
    await conOrigen(cortesia, "ig", "paid_social", "c1");
    await db.update(deals).set({ etapa: "ganado_completo" }).where(eq(deals.id, enLlamada));

    const v = await pautaInterina(db, programId, rango, {}, "2026-10-31");
    const suma = (pred: (f: (typeof v.filas)[number]) => boolean, campo: "ventas" | "ventasEnLlamada" | "ventasDespues" | "ventasCompletas" | "ventasParciales") =>
      v.filas.filter(pred).reduce((total, f) => total + f[campo], 0);
    const ig = (f: (typeof v.filas)[number]) => f.source === "ig";
    expect(v.resumen.ventas).toBe(4);
    expect(suma(ig, "ventas")).toBe(2);
    expect(suma(ig, "ventasEnLlamada")).toBe(1);
    expect(suma(ig, "ventasDespues")).toBe(1);
    expect(suma(ig, "ventasCompletas")).toBe(1);
    expect(suma(ig, "ventasParciales")).toBe(1);
    expect(suma((f) => f.categoria === "sin_envio_origen", "ventas")).toBe(1);

    const base = { programId, rango, hoy: "2026-10-31" };
    const lista = async (extra: object) => (await listaDeMetrica("escalera", { ...base, ...extra }, 1, db))[0].subtotal.cantidad;
    expect(await lista({ escalon: "ventas" })).toBe(v.resumen.ventas);
    expect(await lista({ escalon: "ventas", source: "ig", medium: "paid_social", categoria: "con_utm" })).toBe(2);
    expect(await lista({ escalon: "pago_en_llamada", source: "ig", medium: "paid_social" })).toBe(1);
    expect(await lista({ escalon: "despues", source: "ig", medium: "paid_social" })).toBe(1);
    expect(await lista({ escalon: "ventas", source: "ig", pago: "completo" })).toBe(1);
    expect(await lista({ escalon: "ventas", campaign: "c1", pago: "parcial" })).toBe(1);
  });
});
