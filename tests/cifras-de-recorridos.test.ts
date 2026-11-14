import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { calls, deals, dealEtapaHistorial, leads, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { cifrasDeAuditoria, cifrasDeCaminos, cifrasDeCitasPorSemana, cifrasDeEscalera, cifrasDelEmbudoComercial } from "@/lib/hub/cifras-de-recorridos";
import type { CifraDeMetrica, ExplicacionDeConcepto } from "@/lib/metricas/cifra";
import { cargarEmbudoComercial } from "@/lib/queries/embudo-comercial";
import { embudoPorEtapas } from "@/lib/queries/embudo-etapas";
import { ESCALONES, GRUPOS_DE_CIERRE } from "@/lib/queries/escalera";
import type { Metrica } from "@/lib/queries/metricas-con-filas";
import { vistaDeEscalera } from "@/lib/queries/vista-escalera";
import { claveDeAbiertos, detalleDeCifra, detallesDelEmbudo, detallesPorSemana, proximasPorSemana, vistaDeLista, type DetalleDeCifra } from "@/lib/queries/vista-metrica";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { FECHA_LEAD_DE_PRUEBA } from "./helpers/crear-lead-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

// Una llamada que olvide pasar PGlite falla antes de poder abrir una conexión real.
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get() { throw new Error("Este test solo admite PGlite explícito"); } }) }));

const contexto = { programa: "Prueba", cohorte: null, rango: { desde: "2026-10-01", hasta: "2026-10-31" }, hoy: "2026-10-20", closer: null };
const claves = [...ESCALONES, ...Object.keys(GRUPOS_DE_CIERRE), "cita_sin_resultado_de_escalera", "citas_sin_marcar", "porcentaje_de_escalera", "dias_medianos_de_escalera", "embudo_comercial_creados", "embudo_comercial_agendaron", "embudo_comercial_tuvieron_show", "embudo_comercial_compraron", "conversion_del_paso", "perdidos_del_paso", "pasaron", "siguen_en_etapa", "perdidos_en_etapa", "dias_medianos_en_etapa", "shows", "no_asistio", "citas_futuras", "deals_abiertos", "deals_sin_dueno", "deals_perdidos", "ticket_perdido", "ventas_sin_llamada"];
const explicaciones = Object.fromEntries(claves.map((k): [string, ExplicacionDeConcepto] => [k, {
  rotulo: "Cifra comercial", universo: "todas", unidad: k.includes("porcentaje") || k === "conversion_del_paso" ? "porcentaje" : k.startsWith("dias_") ? "decimal" : k === "ticket_perdido" ? "usd" : "conteo",
  que: "Lo que muestra el recorrido comercial.", formula: { forma: "conteo", terminos: ["casos"] }, variables: [],
}]));
const entrada = { contexto, explicaciones, referencia: "el periodo anterior" };
function cifrasEn(objeto: unknown): CifraDeMetrica[] {
  if (!objeto || typeof objeto !== "object") return [];
  if ("textoDelValor" in objeto) return [objeto as CifraDeMetrica];
  return Object.values(objeto).flatMap(cifrasEn);
}

let db: Db;
let cerrar: () => Promise<void>;
let programId: string;
const ahora = new Date("2026-10-20T18:00:00-05:00");
const periodo = { preset: "custom" as const, a: contexto.rango, b: null };
const instante = (dia: string) => new Date(`${dia}T10:00:00-05:00`);
let parametros: { programId: string; slug: string; hoy: string; periodo: typeof periodo; claveCloser: null; origen: string; ahora: Date };

beforeAll(async () => {
  ({ db, cerrar } = await crearBaseReutilizable());
  const [a, b] = await db.insert(programs).values([
    { ...PROGRAMA_DE_PRUEBA, slug: "rec419", nombre: "Prueba", ticketUsd: "1000" },
    { ...PROGRAMA_DE_PRUEBA, slug: "rec419-ajeno", nombre: "Ajeno", ticketUsd: "1000" },
  ]).returning();
  programId = a.id;
  const [u] = await db.insert(users).values({ email: "rec419@test.test", rol: "closer", closerId: "Prueba" }).returning();
  let n = 0;
  for (const caso of [
    { resultado: "show", etapa: "atendido" }, { resultado: "no_show", etapa: "agendado" },
    { resultado: "agendada", etapa: "agendado" }, { resultado: "cancelada", etapa: "agendado" },
    { resultado: "agendada", etapa: "agendado", futuro: true },
    { resultado: "agendada", etapa: "agendado", sinDueno: true },
    { resultado: "show", etapa: "atendido", anulado: true },
    { resultado: "show", etapa: "atendido", ajeno: true },
  ] as const) {
    const p = "ajeno" in caso ? b.id : programId;
    const anulado = "anulado" in caso;
    const [l] = await db.insert(leads).values({ fechaPrimeraAplicacion: FECHA_LEAD_DE_PRUEBA, programId: p, emailNormalizado: `r${n++}@test.test` }).returning();
    const [d] = await db.insert(deals).values({ programId: p, leadId: l.id, ownerUserId: "sinDueno" in caso ? null : u.id, etapa: caso.etapa, createdAt: instante("2026-10-01"), anuladoEn: anulado ? ahora : null, anuladoPor: anulado ? u.id : null, motivoAnulacion: anulado ? "Prueba" : null }).returning();
    await db.insert(dealEtapaHistorial).values([{ dealId: d.id, a: "agendado", fecha: instante("2026-10-01") }, ...(caso.etapa === "atendido" ? [{ dealId: d.id, de: "agendado" as const, a: "atendido" as const, fecha: instante("2026-10-05") }] : [])]);
    await db.insert(calls).values({ programId: p, dealId: d.id, closerUserId: u.id, fechaAgenda: instante("futuro" in caso ? "2026-10-26" : "2026-10-05"), resultado: caso.resultado });
  }
  parametros = { programId, slug: "rec419", hoy: contexto.hoy, periodo, claveCloser: null, origen: "/p/rec419/hub", ahora };
}, 120_000);
afterAll(async () => cerrar());

async function total(detalle: DetalleDeCifra) {
  const busqueda = Object.fromEntries(new URL(detalle.href, "https://prueba.test").searchParams);
  // El enlace lleva los filtros de la lista en su query; vistaDeLista los recibe por separado, como la página real.
  const lista = await vistaDeLista({
    programId, metrica: busqueda.metrica as Metrica, busqueda, hoy: contexto.hoy, codigoCloser: busqueda.closer, pagina: 1, ahora,
    escalon: busqueda.escalon, etapa: busqueda.etapa as never, antiguedad: busqueda.antiguedad as never,
    grupo: busqueda.grupo as never, calidad: busqueda.calidad as never, paso: busqueda.paso as never,
  }, db);
  expect(lista).not.toBeNull();
  return lista!.lista.subtotal.cantidad;
}

describe("419 E-2: los recorridos comerciales", () => {
  it("escalera: preserva cantidades, porcentajes y medianas; paridad con cada lista y sin anulados ni otro programa", async () => {
    const vista = await vistaDeEscalera({ ...parametros, conEquipo: true }, db);
    const antes = structuredClone(vista);
    const c = cifrasDeEscalera({ ...entrada, vista });
    for (const [i, fila] of [vista.principal, ...vista.porCloser, ...vista.porCalidad].entries()) {
      const salida = [c.principal, ...c.porCloser, ...c.porCalidad][i];
      for (const [k, celda] of Object.entries(fila.celdas)) {
        if (vista.sinCorte && k === "pago_rapido") continue;
        expect(salida.celdas[k].cantidad.valor).toBe(celda.deals);
        expect(salida.celdas[k].porcentaje.valor).toBe(celda.porcentaje.valor === null ? null : celda.porcentaje.valor / 100);
        expect(salida.celdas[k].diasMedianos.valor).toBe(celda.diasMedianos);
        if (celda.detalle) {
          expect(await total(celda.detalle)).toBe(salida.celdas[k].cantidad.valor);
          expect(salida.celdas[k].cantidad.explicacion.evidencia?.href).toBe(celda.detalle.href);
        }
      }
      for (const [k, celda] of Object.entries(fila.grupos)) {
        expect(salida.grupos[k].valor).toBe(celda.deals);
        if (celda.detalle) expect(await total(celda.detalle)).toBe(salida.grupos[k].valor);
      }
      if (fila.citaSinResultado.detalle) expect(await total(fila.citaSinResultado.detalle)).toBe(salida.citaSinResultado.valor);
    }
    expect(vista).toEqual(antes);
  });
  it("escalones sin casos: cero y medianas nulas con motivo; sin permiso, sin evidencia", async () => {
    const vista = await vistaDeEscalera({ ...parametros, conEquipo: false }, db);
    const c = cifrasDeEscalera({ ...entrada, vista });
    expect(cifrasEn(c).every((x) => x.explicacion.evidencia === null)).toBe(true);
    const cero = c.principal.celdas.pago_en_llamada;
    expect(cero.cantidad.textoDelValor).toBe("0");
    expect(cero.diasMedianos.textoDelValor).toBe("—");
  });
  it("la comparación solo aparece a pedido, incluso con base anterior cero", async () => {
    const vista = await vistaDeEscalera({ ...parametros, conEquipo: false }, db);
    vista.hayComparacion = true;
    vista.principal.celdas.atendio_no_compro.anterior = 0;
    const c = cifrasDeEscalera({ ...entrada, vista });
    expect(c.principal.celdas.atendio_no_compro.cantidad.comparacion).not.toBeNull();
    expect(c.principal.celdas.atendio_no_compro.cantidad.comparacion?.cambio).toContain("—");
    expect(cifrasDeEscalera({ contexto, explicaciones, vista }).principal.celdas.atendio_no_compro.cantidad.comparacion).toBeNull();
  });
  it("embudo: no deduce cantidades, pérdidas ni tasas y explica el origen elegido", async () => {
    const pasos = await cargarEmbudoComercial(db, { programId, rango: contexto.rango });
    const metricas = { creados: "embudo_comercial_creados", agendaron: "embudo_comercial_agendaron", tuvieron_show: "embudo_comercial_shows", compraron: "embudo_comercial_compraron" } as const;
    const conDetalle = await Promise.all(pasos.map(async (p) => ({ ...p, detalle: await detalleDeCifra(metricas[p.paso], parametros, db) })));
    const c = cifrasDelEmbudoComercial({ ...entrada, pasos: conDetalle, origen: "todos" });
    for (const [i, paso] of conDetalle.entries()) expect(await total(paso.detalle)).toBe(c[i].cantidad.valor);
    c.forEach((s, i) => {
      expect(s.cantidad.valor).toBe(pasos[i].cantidad);
      expect(s.porcentaje.valor).toBe(pasos[i].pctDelPaso);
      expect(s.perdidos?.valor ?? null).toBe(i === 0 ? null : pasos[i].perdidos);
      expect(s.cantidad.explicacion.filtros).toContainEqual(["Origen del deal", "Todos"]);
    });
  });
  it("caminos y auditoría preservan todos los conteos; las fotos conservan cohorte y no dicen periodo ni closer", async () => {
    const embudo = await embudoPorEtapas(db, { programId, rango: contexto.rango }, ahora);
    const caminos = cifrasDeCaminos({ ...entrada, embudo });
    caminos.forEach((c, i) => c.pasos.forEach((p, j) => {
      const original = embudo.conversion.porCamino[i].pasos[j];
      expect([p.pasaron.valor, p.siguen.valor, p.perdidos.valor]).toEqual([original.pasaron, original.siguenAqui, original.perdidosAqui]);
      expect(p.pasaron.explicacion.evidencia).toBeNull();
    }));
    const detalles = await detallesDelEmbudo(parametros, db, ahora);
    const conDetalles = { ...embudo,
      abiertos: embudo.abiertos.map((f) => ({ ...f, detalle: detalles.abiertos[claveDeAbiertos(f.etapa, f.ownerUserId)] })),
      sinDuenoPorAntiguedad: embudo.sinDuenoPorAntiguedad.map((f) => ({ ...f, detalle: detalles.sinDueno[f.bucket] })),
    };
    const a = cifrasDeAuditoria({ ...entrada, embudo: conDetalles });
    for (const [i, fila] of conDetalles.abiertos.entries()) expect(await total(fila.detalle)).toBe(a.abiertos[i].cifra.valor);
    for (const [i, fila] of conDetalles.sinDuenoPorAntiguedad.entries()) expect(await total(fila.detalle)).toBe(a.sinDueno[i].cifra.valor);
    expect(a.abiertos.map((x) => x.cifra.valor)).toEqual(embudo.abiertos.map((x) => x.deals));
    expect(a.sinDueno.map((x) => x.cifra.valor)).toEqual(embudo.sinDuenoPorAntiguedad.map((x) => x.deals));
    for (const f of [...a.abiertos, ...a.sinDueno]) expect(f.cifra.explicacion.filtros.map(([k]) => k)).not.toContain("Periodo");
  });
  it("semanas: fusiona sin perder las futuras, usa el rango de cada semana y prueba cada lista", async () => {
    const semanas = await detallesPorSemana(parametros, db);
    const proximas = await proximasPorSemana(parametros, db);
    const c = cifrasDeCitasPorSemana({ ...entrada, semanas, proximas });
    expect(c.length).toBeGreaterThan(0);
    for (const s of c) {
      const original = semanas.find((f) => f.semana.desde === s.desde);
      const futura = proximas.find((f) => f.semana.desde === s.desde);
      for (const [cifra, detalle] of [[s.realizadas, original?.shows], [s.noAsistio, original?.noShows], [s.sinMarcar, original?.pendientes], [s.futuras, futura?.futuras]] as const) {
        expect(cifra.valor).toBe(detalle?.resumen.subtotal.cantidad ?? 0);
        if (detalle) expect(await total(detalle)).toBe(cifra.valor);
      }
      expect(s.realizadas.explicacion.filtros).toContainEqual(["Periodo", s.semana]);
    }
    expect(cifrasDeCitasPorSemana({ ...entrada, semanas: [], proximas: [] })).toEqual([]);
  });
  it("ninguna explicación contiene jerga ni puntos repetidos, y no inventa estados", async () => {
    const embudo = await embudoPorEtapas(db, { programId, rango: contexto.rango }, ahora);
    const vista = await vistaDeEscalera({ ...parametros, conEquipo: true }, db);
    const todas = cifrasEn([cifrasDeCaminos({ ...entrada, embudo }), cifrasDeAuditoria({ ...entrada, embudo }), cifrasDeEscalera({ ...entrada, vista })]);
    for (const c of todas) {
      expect(JSON.stringify([c.rotulo, c.textoDelValor, c.explicacion.lectura, c.explicacion.filtros])).not.toMatch(/\.\.|utm_|ADR|periodo [AB]\b|NaN|undefined/);
      expect(c.estado).toBeNull();
      expect(c.comparacion).toBeNull();
    }
  });
});
