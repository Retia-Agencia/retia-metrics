import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { abonos, calls, cohorts, deals, dealEtapaHistorial, leads, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { cajaRecaudada, carteraDelPrograma, embudoDelRango, leadsDelRango, sinResultadoDelRango } from "@/lib/queries/dashboard";
import { desglosesDelResumen, listaDeMetrica, resumenDeMetrica, TAMANO_PAGINA, type Metrica, type FilaDeMetrica } from "@/lib/queries/metricas-con-filas";
import { codigoDeCloser, vistaDeLista, urlDeLista } from "@/lib/queries/vista-metrica";
import { claveHistorica } from "@/lib/closers/identidad";
import { showsSinGrain } from "@/lib/queries/sin-grain";
import { contratadoDeDeals } from "@/lib/queries/saldo";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

let db: Db;
let cerrar: () => Promise<void>;
let programaA: string;
let programaB: string;
const rango = { desde: "2026-06-01", hasta: "2026-10-02" };
const hoy = "2026-10-01";
const metricas = ["caja", "agendas", "shows", "shows_sin_grain", "cierres", "leads"] as const;
type MetricaDelTablero = (typeof metricas)[number];

beforeAll(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  const programas = await db.insert(programs).values([
    { ...PROGRAMA_DE_PRUEBA, ticketUsd: "100", slug: "prueba-a", nombre: "A" },
    { ...PROGRAMA_DE_PRUEBA, ticketUsd: "100", slug: "prueba-b", nombre: "B" },
  ]).returning();
  [programaA, programaB] = programas.map((p) => p.id);
  const [owner] = await db.insert(users).values({ email: "test@example.test", rol: "closer", closerId: "Ana" }).returning();
  for (const programId of [programaA, programaB]) {
    for (let i = 0; i < 56; i += 1) {
      const anulada = i === 53;
      const fuera = i === 54;
      const manual = i === 55;
      const dia = fuera ? "2026-01-01" : ["2026-06-01", "2026-08-15", "2026-09-15", "2026-09-30", "2026-10-02"][i % 5];
      const fecha = new Date(`${dia}T23:30:00-05:00`);
      const [lead] = await db.insert(leads).values({
        programId,
        emailNormalizado: `lead-${i}@example.test`,
        entrada: manual ? "crm" : "formulario",
        fechaPrimeraAplicacion: fecha,
      }).returning();
      if (manual) continue;
      const [deal] = await db.insert(deals).values({
        programId,
        leadId: lead.id,
        ownerUserId: owner.id,
        etapa: "ganado_completo",
        anuladoEn: anulada ? fecha : null,
        anuladoPor: anulada ? owner.id : null,
        motivoAnulacion: anulada ? "Prueba de corrección" : null,
      }).returning();
      await db.insert(dealEtapaHistorial).values([
        { dealId: deal.id, a: "ganado_parcial", fecha },
        { dealId: deal.id, de: "ganado_parcial", a: "ganado_completo", fecha: new Date("2026-10-02T23:30:00-05:00") },
      ]);
      await db.insert(abonos).values({
        programId,
        dealId: deal.id,
        fecha: dia,
        monto: programId === programaA ? "10.25" : "30.50",
        moneda: i % 2 ? "USD" : "COP",
        closerId: i % 2 ? "Ana" : "  ANA  ",
        anuladoEn: anulada ? fecha : null,
        anuladoPor: anulada ? owner.id : null,
        motivoAnulacion: anulada ? "Prueba de corrección" : null,
      });
      await db.insert(calls).values({
        programId,
        dealId: i % 2 ? deal.id : null,
        fechaAgenda: i % 2 ? fecha : null,
        fechaLlamada: fecha,
        resultado: i % 3 && !anulada ? "agendada" : "show",
        closerId: i % 2 ? "Ana" : "  ANA  ",
        anuladoEn: anulada ? fecha : null,
        anuladoPor: anulada ? owner.id : null,
        motivoAnulacion: anulada ? "Prueba de corrección" : null,
      });
    }
  }
}, 60_000);

afterAll(async () => cerrar());

async function todas(metrica: Metrica, programId: string, claveCloser?: string) {
  const filas: FilaDeMetrica[] = [];
  let pagina = 1;
  let total = 0;
  do {
    const [seccion] = await listaDeMetrica(metrica, { programId, rango, hoy, claveCloser }, pagina, db);
    expect(seccion.filas.length).toBeLessThanOrEqual(TAMANO_PAGINA);
    total = seccion.subtotal.cantidad;
    filas.push(...seccion.filas);
    pagina += 1;
  } while (filas.length < total);
  expect(new Set(filas.map((f) => f.id)).size).toBe(total);
  return filas;
}

function suma(filas: FilaDeMetrica[]) {
  const resultado: Record<string, number> = {};
  for (const f of filas) {
    if (f.moneda && f.monto !== null) resultado[f.moneda] = (resultado[f.moneda] ?? 0) + f.monto;
  }
  return resultado;
}

async function cifra(metrica: MetricaDelTablero, programId: string, claveCloser?: string) {
  const alcance = { programId, rango, claveCloser };
  if (metrica === "caja") return Object.fromEntries((await cajaRecaudada(alcance, db)).map((c) => [c.moneda, c.total]));
  if (metrica === "leads") return (await leadsDelRango(alcance, db)).leads;
  if (metrica === "shows_sin_grain") return (await showsSinGrain(alcance, db)).sinGrain;
  const embudo = await embudoDelRango(alcance, db);
  return metrica === "shows" ? embudo.llamadasConShow : embudo[metrica];
}

describe("137: la cifra, el resumen y todas las páginas cuentan exactamente lo mismo", () => {
  it.each(metricas)("%s conserva programa, fecha y vigencia", async (metrica) => {
    const filas = await todas(metrica, programaA);
    const [resumen] = await resumenDeMetrica(metrica, { programId: programaA, rango, hoy }, db);
    expect(metrica === "caja" ? suma(filas) : filas.length).toEqual(await cifra(metrica, programaA));
    expect(resumen.subtotal.cantidad).toBe(filas.length);
    expect(filas.length).toBe(metrica === "leads" ? 54 : metrica === "shows" || metrica === "shows_sin_grain" ? 18 : 53);
    expect(resumen.grupos.reduce((n, g) => n + g.cantidad, 0)).toBe(filas.length);
    expect(filas.map((f) => f.fecha)).toEqual(filas.map((f) => f.fecha).sort());
    if (metrica === "caja") expect(Object.fromEntries(resumen.subtotal.caja.map((c) => [c.moneda, c.total]))).toEqual(suma(filas));
    if (metrica === "leads" || metrica === "agendas") expect(filas.some((f) => f.dealId === null)).toBe(true);
  });

  it.each(metricas)("%s secciona varios programas sin mezclar filas ni subtotales", async (metrica) => {
    const secciones = await listaDeMetrica(metrica, { programId: [programaA, programaB], rango, hoy }, 1, db);
    expect(secciones.map((s) => s.programId)).toEqual([programaA, programaB]);
    for (const s of secciones) {
      expect(metrica === "caja" ? Object.fromEntries(s.subtotal.caja.map((c) => [c.moneda, c.total])) : s.subtotal.cantidad).toEqual(await cifra(metrica, s.programId));
      const individuales = await todas(metrica, s.programId);
      expect(s.filas.map((f) => f.id)).toEqual(individuales.slice(0, TAMANO_PAGINA).map((f) => f.id));
    }
    expect(secciones[0].filas.some((f) => secciones[1].filas.some((otra) => otra.id === f.id))).toBe(false);
  });

  it("limita y pagina en el servidor con un total independiente de la página", async () => {
    const filtros = { programId: programaA, rango, hoy };
    const [primera] = await listaDeMetrica("agendas", filtros, 1, db);
    const [segunda] = await listaDeMetrica("agendas", filtros, 2, db);
    expect(primera.filas).toHaveLength(50);
    expect(segunda.filas).toHaveLength(3);
    expect(primera.subtotal.cantidad).toBe(53);
    expect(segunda.subtotal).toEqual(primera.subtotal);
  });

  it.each(["caja", "agendas", "shows", "shows_sin_grain", "cierres"] as const)("%s conserva la identidad normalizada del closer", async (metrica) => {
    const filas = await todas(metrica, programaA, claveHistorica("ana"));
    expect(metrica === "caja" ? suma(filas) : filas.length).toEqual(await cifra(metrica, programaA, claveHistorica("ana")));
    expect(filas.length).toBeGreaterThan(0);
    expect(await todas(metrica, programaA, claveHistorica("Otro"))).toEqual([]);
  });

  it("leads no inventa atribución por closer; un deal anulado no elimina al lead", async () => {
    const [resumen] = await resumenDeMetrica("leads", { programId: programaA, rango, hoy, claveCloser: claveHistorica("Ana") }, db);
    expect(resumen.disponible).toBe(false);
    expect(await cifra("leads", programaA, claveHistorica("Ana"))).toBeNull();
    expect(await todas("leads", programaA, claveHistorica("Ana"))).toEqual([]);
  });

  it("los cuatro buckets usan fecha de Bogotá y las agendas futuras tienen cero días", async () => {
    const filas = await todas("agendas", programaA);
    expect(new Set(filas.map((f) => f.bucket))).toEqual(new Set(["0-7", "8-30", "31-90", ">90"]));
    expect(filas.find((f) => f.fecha === "2026-10-02")?.antiguedad).toBe(0);
    expect(filas.find((f) => f.fecha === "2026-09-30")?.antiguedad).toBe(1);
  });

  it("la URL fija A y B, lleva código opaco y lo resuelve sin ensanchar filtros", async () => {
    const periodo = { preset: "custom" as const, a: rango, b: { desde: "2026-01-01", hasta: "2026-01-02" } };
    const href = urlDeLista("prueba-a", "caja", periodo, claveHistorica("Ana"), "USD");
    expect(href).not.toContain("Ana");
    const busqueda = Object.fromEntries(new URL(href, "https://example.test").searchParams);
    // El código opaco hashea la CLAVE (ticket 167); una clave histórica normaliza el
    // texto, así que "Ana" y " ANA " dan el mismo código.
    expect(busqueda.closer).toBe(codigoDeCloser(claveHistorica(" ANA ")));
    const vista = await vistaDeLista({ programId: programaA, metrica: "caja", busqueda, hoy, codigoCloser: busqueda.closer, moneda: "USD", pagina: 1 }, db);
    expect(vista?.periodo).toMatchObject({ a: rango, b: periodo.b });
    expect(vista?.lista.filas.every((f) => f.moneda === "USD")).toBe(true);
    expect(await vistaDeLista({ programId: programaA, metrica: "caja", busqueda, hoy, codigoCloser: "a".repeat(64), pagina: 1 }, db)).toBeNull();
  });

  it.each(metricas)("%s: cada desglose del resumen (closer, etapa, antigüedad) suma el subtotal", async (metrica) => {
    const [resumen] = await resumenDeMetrica(metrica, { programId: programaA, rango, hoy }, db);
    const desgloses = desglosesDelResumen(resumen.grupos, (etapa) => etapa.toUpperCase());
    for (const lineas of [desgloses.porCloser, desgloses.porEtapa, desgloses.porAntiguedad]) {
      expect(lineas.reduce((n, l) => n + l.cantidad, 0)).toBe(resumen.subtotal.cantidad);
    }
    // "Ana" y "  ANA  " son el mismo closer (ADR 0030): una sola línea.
    expect(desgloses.porCloser.filter((l) => l.etiqueta.toLowerCase() === "ana").length).toBeLessThanOrEqual(1);
    expect(desgloses.porAntiguedad.map((l) => l.etiqueta)).toEqual(
      ["0-7", "8-30", "31-90", ">90"].filter((b) => desgloses.porAntiguedad.some((l) => l.etiqueta === b)),
    );
  });
});

describe("ticket 167: el drill-down de la lista por clave de closer", () => {
  let base: Db;
  let cerrarBase: () => Promise<void>;
  let prog: string;
  const r = { desde: "2026-10-01", hasta: "2026-10-02" };
  const h = "2026-10-02";

  beforeEach(async () => {
    ({ db: base, cerrar: cerrarBase } = await crearBaseDePrueba());
    const [p] = await base.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "drill-a", nombre: "Drill", ticketUsd: "100" }).returning();
    prog = p.id;
  }, 60_000);
  afterEach(async () => cerrarBase());

  it("(d) un closer SIN closer_id abre su lista por su users.id y el total es su cifra", async () => {
    const [closer] = await base.insert(users).values({ email: "sinid@d.co", rol: "closer", closerId: null }).returning();
    const [lead] = await base.insert(leads).values({ programId: prog, emailNormalizado: "l@d.co" }).returning();
    const [deal] = await base.insert(deals).values({ programId: prog, leadId: lead.id, ownerUserId: closer.id, etapa: "ganado_parcial" }).returning();
    await base.insert(abonos).values([
      { dealId: deal.id, programId: prog, registradoPorUserId: closer.id, fecha: h, monto: "100", moneda: "USD" },
      // Un abono de OTRO registrador para comprobar que el filtro no lo trae.
      { dealId: deal.id, programId: prog, closerId: "Otro", fecha: h, monto: "50", moneda: "USD" },
    ]);

    const cifra = await cajaRecaudada({ programId: prog, rango: r, claveCloser: closer.id }, base);
    expect(cifra).toEqual([{ moneda: "USD", total: 100 }]);

    // El href de la cifra lleva el codigo opaco de la CLAVE (su users.id).
    const codigo = codigoDeCloser(closer.id);
    const href = urlDeLista("drill-a", "caja", { preset: "custom", a: r, b: null }, closer.id);
    const busqueda = Object.fromEntries(new URL(href, "https://x.test").searchParams);
    expect(busqueda.closer).toBe(codigo);
    expect(href).not.toContain(closer.id);

    const vista = await vistaDeLista({ programId: prog, metrica: "caja", busqueda, hoy: h, codigoCloser: codigo, pagina: 1 }, base);
    expect(vista?.claveCloser).toBe(closer.id);
    expect(vista?.lista.subtotal.caja).toEqual([{ moneda: "USD", total: 100 }]);
  });

  it("(e) un closer historico (texto, sin cuenta) abre su lista desde la fila del comparativo", async () => {
    // Una llamada historica sin FK y sin usuario: solo el texto "Caro".
    await base.insert(calls).values({ programId: prog, closerId: "Caro", fechaAgenda: new Date("2026-10-02T14:00:00Z"), resultado: "show" });

    // Su clave es historica. La fila del comparativo/resumen la expone en `claveCloser`.
    const [resumen] = await resumenDeMetrica("agendas", { programId: prog, rango: r, hoy: h }, base);
    const grupo = resumen.grupos.find((g) => g.closer === "Caro");
    expect(grupo?.claveCloser).toBe(claveHistorica("Caro"));

    const codigo = codigoDeCloser(claveHistorica("Caro"));
    const vista = await vistaDeLista(
      { programId: prog, metrica: "agendas", busqueda: { periodo: "custom", a_desde: r.desde, a_hasta: r.hasta }, hoy: h, codigoCloser: codigo, pagina: 1 },
      base,
    );
    expect(vista?.claveCloser).toBe(claveHistorica("Caro"));
    expect(vista?.lista.subtotal.cantidad).toBe(1);
    expect(vista?.lista.filas.every((f) => f.closer === "Caro")).toBe(true);
  });
});

describe("ticket 148: listas de contratado, sin resultado y cartera", () => {
  let base: Db;
  let cerrarBase: () => Promise<void>;
  let prog: string;
  let ajeno: string;
  let owner: typeof users.$inferSelect;
  const r = { desde: "2026-10-01", hasta: "2026-10-04" };
  const ahora = new Date("2026-10-04T12:00:00-05:00");
  let secuencia = 0;

  beforeEach(async () => {
    ({ db: base, cerrar: cerrarBase } = await crearBaseDePrueba());
    const ps = await base.insert(programs).values([
      { ...PROGRAMA_DE_PRUEBA, slug: "m148", nombre: "M148", ticketUsd: "100" },
      { ...PROGRAMA_DE_PRUEBA, slug: "m148-ajeno", nombre: "Ajeno", ticketUsd: "100" },
    ]).returning();
    [prog, ajeno] = ps.map((p) => p.id);
    [owner] = await base.insert(users).values({ email: "m148@retia.co", rol: "closer", closerId: "M148" }).returning();
  }, 60_000);
  afterEach(async () => cerrarBase());

  async function deal(programId: string, extra: Record<string, unknown> = {}) {
    secuencia += 1;
    const [lead] = await base.insert(leads).values({ programId, emailNormalizado: `m148-${secuencia}@retia.co` }).returning();
    const [fila] = await base.insert(deals).values({ programId, leadId: lead.id, ownerUserId: owner.id, ...extra } as never).returning();
    return fila;
  }

  async function vender(programId: string, extra: Record<string, unknown> = {}) {
    const fila = await deal(programId, { etapa: "ganado_parcial", valorVendidoUsd: "80", ...extra });
    await base.insert(dealEtapaHistorial).values({ dealId: fila.id, a: "ganado_parcial", fecha: new Date("2026-10-02T10:00:00-05:00") });
    return fila;
  }

  it("contratado suma el valor de sus filas y cohorte acota sin incluir cortesía, anulado ni otro programa", async () => {
    const cohortes = await base.insert(cohorts).values([
      { programId: prog, codigo: "C1", metaCupos: 10, precioUsd: "100", fechaInicioClases: "2026-11-01", fechaCierreVentas: "2026-10-31", estado: "cerrado" },
      { programId: prog, codigo: "C2", metaCupos: 10, precioUsd: "100", fechaInicioClases: "2026-12-01", fechaCierreVentas: "2026-11-30", estado: "cerrado" },
    ]).returning();
    await vender(prog, { cohortId: cohortes[0].id, valorVendidoUsd: "80" });
    await vender(prog, { cohortId: cohortes[1].id, valorVendidoUsd: "70" });
    await vender(prog, { cohortId: cohortes[0].id, valorVendidoUsd: "0", cortesia: true });
    await vender(ajeno, { valorVendidoUsd: "900" });
    await vender(prog, { valorVendidoUsd: "500", anuladoEn: ahora, anuladoPor: owner.id, motivoAnulacion: "Error de prueba" });

    const filtros = { programId: prog, rango: r, hoy: "2026-10-04", ahora };
    const [lista] = await listaDeMetrica("contratado", filtros, 1, base);
    expect(lista.filas.map((fila) => fila.monto)).toEqual([80, 70]);
    expect(lista.subtotal.caja).toEqual([{ moneda: "USD", total: 150 }]);
    const ids = lista.filas.flatMap((fila) => fila.dealId ? [fila.dealId] : []);
    expect(lista.subtotal.caja[0]?.total).toBe((await contratadoDeDeals(base, ids)).usd);
    const [porCohorte] = await listaDeMetrica("contratado", { ...filtros, cohorteId: cohortes[0].id }, 1, base);
    expect(porCohorte.filas.map((fila) => fila.monto)).toEqual([80]);
    const href = urlDeLista("m148", "contratado", { preset: "custom", a: r, b: null }, null, undefined, cohortes[0].id);
    expect(new URL(href, "https://retia.test").searchParams.get("cohorte")).toBe(cohortes[0].id);
  });

  it("sin_resultado y cartera cuentan exactamente las filas de sus listas", async () => {
    const abierto = await deal(prog);
    const cerrado = await deal(prog, { etapa: "ganado_completo" });
    const pasado = new Date("2026-10-04T10:00:00-05:00");
    const futuro = new Date("2026-10-04T14:00:00-05:00");
    await base.insert(calls).values([
      { programId: prog, dealId: abierto.id, fechaAgenda: pasado, resultado: "agendada" },
      { programId: prog, dealId: abierto.id, fechaAgenda: futuro, resultado: "agendada" },
      { programId: prog, dealId: abierto.id, fechaAgenda: pasado, resultado: "show" },
      { programId: prog, dealId: cerrado.id, fechaAgenda: pasado, resultado: "agendada" },
      { programId: prog, dealId: abierto.id, fechaAgenda: pasado, resultado: "agendada", anuladoEn: ahora, anuladoPor: owner.id, motivoAnulacion: "Error de prueba" },
    ]);
    await deal(prog, { etapa: "ganado_parcial", valorVendidoUsd: "100" });
    await deal(prog, { etapa: "ganado_parcial", valorVendidoUsd: "100" });
    await deal(prog, { etapa: "ganado_parcial", valorVendidoUsd: "0", cortesia: true });
    await deal(prog, { etapa: "ganado_parcial", valorVendidoUsd: "100", anuladoEn: ahora, anuladoPor: owner.id, motivoAnulacion: "Error de prueba" });

    const filtros = { programId: prog, rango: r, hoy: "2026-10-04", ahora };
    const [sinResultado] = await listaDeMetrica("sin_resultado", filtros, 1, base);
    expect(sinResultado.subtotal.cantidad).toBe(1);
    expect(sinResultado.filas).toHaveLength(1);
    expect(await sinResultadoDelRango({ programId: prog, rango: r }, ahora, base)).toBe(sinResultado.filas.length);
    const [cartera] = await listaDeMetrica("cartera", filtros, 1, base);
    expect(cartera.subtotal.cantidad).toBe(cartera.filas.length);
    expect(cartera.filas).toHaveLength(2);
    expect((await carteraDelPrograma(prog, "2026-10-04", base)).deals).toBe(cartera.filas.length);
  });
});
