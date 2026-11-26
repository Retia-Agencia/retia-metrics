import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Proyeccion, rangoLegible } from "@/components/dashboard/proyeccion";
import { calls, cohorts, deals, leads, programs } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import {
  MUESTRA_MINIMA_CONVERSION,
  calcularProyeccion,
  elegirConversion,
  leerProyeccion,
  metaDeLeads,
  repartirFaltantePorSemana,
  ventanaRitmoDeUrl,
  type DatosParaProyeccion,
} from "@/lib/queries/proyeccion";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";
import { duenoDePrueba } from "./helpers/dueno-de-prueba";
import { FECHA_LEAD_DE_PRUEBA } from "./helpers/crear-lead-de-prueba";

const medida = (codigo: string, deals: number, vendidos: number, shows = deals, pendientes = 0) => ({
  codigo,
  pendientes,
  tasas: {
    deals,
    conShow: shows,
    vendidos,
    razonShow: { valor: deals === 0 ? null : shows / deals, base: deals, faltan: pendientes, motivo: pendientes ? `${pendientes} citas sin resultado` : null },
    razonCierre: { valor: shows === 0 ? null : vendidos / shows, base: shows, faltan: pendientes, motivo: pendientes ? `${pendientes} citas sin resultado` : null },
  },
});

const porObjetivo = elegirConversion({ objetivo: 0.25, anterior: medida("C3", 70, 10, 32), enCurso: null });

const cohorte: DatosParaProyeccion = {
  hoy: "2026-10-21",
  cohorte: { codigo: "C4", metaCupos: 30, metaLeadsDia: 35, fechaCierreVentas: "2026-11-04" },
  vendidos: 10,
  vendidosAntesDeHoy: 10,
  ventasVentana: 5,
  agendasVentana: 20,
  registrosVentana: 100,
  diasHabilesVentana: 10,
  ventanaDiasHabiles: 10,
  ventanaDesde: "2026-10-08",
  ventanaHasta: "2026-10-21",
  conversion: porObjetivo,
};

const pintar = (datos: DatosParaProyeccion, ventanas = [] as Parameters<typeof Proyeccion>[0]["ventanas"]) =>
  renderToStaticMarkup(createElement(Proyeccion, { datos: calcularProyeccion(datos), ventanas }));

describe("proyección", () => {
  it("separa la meta de leads declarada del requerido calculado", () => {
    expect(metaDeLeads(null)).toBeNull();
    expect(metaDeLeads({ metaLeadsDia: null })).toBeNull();
    expect(metaDeLeads({ metaLeadsDia: 35 })).toBe(35);
  });
  it("cuadra cada cifra con un cálculo independiente", () => {
    const resultado = calcularProyeccion(cohorte);
    // Del 22-oct al 4-nov hay 10 días hábiles (dos semanas sin fin de semana).
    const diasQueQuedan = 10;
    const ritmo = 5 / 10;
    // La meta de hoy cuenta hoy: del 21-oct al 4-nov son 11 habiles (352).
    const ventasDia = (30 - 10) / (diasQueQuedan + 1);

    expect(resultado.diasHabilesRestantes).toBe(diasQueQuedan);
    expect(resultado.ritmo.valor).toBe(ritmo);
    expect(resultado.proyeccion.valor).toBe(10 + ritmo * diasQueQuedan);
    expect(resultado.ventasRequeridasDia.valor).toBe(ventasDia);
    expect(resultado.showsRequeridosDia.valor).toBeCloseTo((ventasDia / 0.25) * (32 / 70));
    expect(resultado.agendasRequeridasDia.valor).toBe(ventasDia / 0.25);
    expect(resultado.leadsRequeridosDia.valor).toBe((ventasDia / 0.25) / (20 / 100));
    expect(resultado.supuestos.agendasPorRegistro).toBe(0.2);
  });

  it("encadena ventas, shows y agendas con las dos tasas de un solo grupo", () => {
    const conversion = elegirConversion({ objetivo: null, anterior: medida("C3", 70, 10, 32), enCurso: null });
    const resultado = calcularProyeccion({
      ...cohorte,
      cohorte: { ...cohorte.cohorte!, fechaCierreVentas: "2026-11-02" },
      vendidos: 8,
      vendidosAntesDeHoy: 8,
      conversion,
    });
    // 22 faltan al abrir hoy entre 9 habiles (21-oct al 2-nov, contando hoy).
    expect(resultado.ventasRequeridasDia.valor).toBeCloseTo(22 / 9);
    expect(resultado.showsRequeridosDia.valor).toBeCloseTo((22 / 9) / (10 / 32));
    expect(resultado.agendasRequeridasDia.valor).toBeCloseTo((22 / 9) / (10 / 32) / (32 / 70));
    expect(conversion.razonShow.valor! * conversion.razonCierre.valor!).toBeCloseTo(10 / 70);
  });

  it("con la meta cumplida pide cero y no reparte nada", () => {
    const resultado = calcularProyeccion({ ...cohorte, vendidos: 30, vendidosAntesDeHoy: 30, conversion: elegirConversion({ objetivo: null, anterior: null, enCurso: null }) });
    expect(resultado.faltan).toBe(0);
    expect([resultado.ventasRequeridasDia.valor, resultado.showsRequeridosDia.valor, resultado.agendasRequeridasDia.valor, resultado.leadsRequeridosDia.valor]).toEqual([0, 0, 0, 0]);
    expect(resultado.repartoSemanal).toEqual([]);
  });

  it("reparte el faltante por semana con fechas reales y sin perder ventas", () => {
    const tramos = repartirFaltantePorSemana({ hoy: "2026-10-21", cierre: "2026-11-04", faltan: 20 });
    expect(tramos).toEqual([
      { tipo: "resto_semana", desde: "2026-10-22", hasta: "2026-10-23", diasHabiles: 2, ventas: 4 },
      { tipo: "semana", desde: "2026-10-26", hasta: "2026-10-30", diasHabiles: 5, ventas: 10 },
      { tipo: "final", desde: "2026-11-02", hasta: "2026-11-04", diasHabiles: 3, ventas: 6 },
    ]);
    expect(tramos.reduce((s, t) => s + t.ventas, 0)).toBe(20);
  });

  it("escribe un rango en fechas de calendario", () => {
    expect(rangoLegible("2026-10-27", "2026-10-31")).toBe("27 al 31 oct");
    expect(rangoLegible("2026-10-30", "2026-11-04")).toBe("30 oct al 4 nov");
    expect(rangoLegible("2026-11-04", "2026-11-04")).toBe("4 nov");
  });
});

describe("la muestra mínima es del programa (352, C-17)", () => {
  it("con una muestra mínima de 10, una medición de 12 alcanza; con la de 20 por defecto, no", () => {
    const corta = medida("C2", 12, 3);
    expect(elegirConversion({ objetivo: null, anterior: corta, enCurso: null }).origen).toBe("sin_conversion");
    const propia = elegirConversion({ objetivo: null, anterior: corta, enCurso: null, muestraMinima: 10 });
    expect(propia.origen).toBe("cohorte_anterior");
    expect(elegirConversion({ objetivo: 0.25, anterior: medida("C2", 12, 3), enCurso: null, muestraMinima: 15 }).motivoShow)
      .toContain("hacen falta 15");
  });
});

describe("la conversión agenda → venta", () => {
  it("prefiere el objetivo, luego la cohorte anterior y luego la cohorte en curso", () => {
    const anterior = medida("C2", 40, 10);
    const enCurso = { ...medida("C3", 30, 3), madurando: true };
    expect(elegirConversion({ objetivo: 0.3, anterior, enCurso })).toMatchObject({ objetivoAgendaAVenta: 0.3, razonShow: { valor: 1 }, origen: "objetivo_cohorte" });
    expect(elegirConversion({ objetivo: null, anterior, enCurso })).toMatchObject({ razonShow: { valor: 1 }, razonCierre: { valor: 10 / 40 }, origen: "cohorte_anterior", cohorteCodigo: "C2" });
    expect(elegirConversion({ objetivo: null, anterior: null, enCurso })).toMatchObject({
      razonShow: { valor: 1 },
      razonCierre: { valor: 3 / 30 },
      origen: "cohorte_en_curso",
      cohorteCodigo: "C3",
      muestra: { personas: 30, shows: 30, vendidos: 3, pendientes: 0 },
      madurando: true,
    });
  });

  it("no usa una medición con menos de la muestra mínima ni sin ventas", () => {
    const corta = elegirConversion({ objetivo: null, anterior: medida("C2", MUESTRA_MINIMA_CONVERSION - 1, 5), enCurso: { ...medida("C3", MUESTRA_MINIMA_CONVERSION - 1, 5), madurando: true } });
    expect(corta.razonShow.valor).toBeNull();
    expect(corta.motivoShow).toContain(`van ${MUESTRA_MINIMA_CONVERSION - 1} personas`);

    const justa = elegirConversion({ objetivo: null, anterior: null, enCurso: { ...medida("C3", MUESTRA_MINIMA_CONVERSION, 4), madurando: false } });
    expect(justa.razonCierre.valor).toBe(4 / MUESTRA_MINIMA_CONVERSION);

    const sinVentas = elegirConversion({ objetivo: null, anterior: null, enCurso: { ...medida("C3", 25, 0), madurando: false } });
    expect(sinVentas.razonCierre.valor).toBeNull();
    expect(sinVentas.motivoCierre).toContain("Ninguno de los 25 shows de C3 ha comprado todavía");
  });

  it("nombra los pendientes cuando dejan corta la muestra", () => {
    const conversion = elegirConversion({ objetivo: null, anterior: null, enCurso: { ...medida("C3", 10, 1, 5, 221), madurando: true } });
    expect(conversion.motivoShow).toContain("En C3 hay 221 citas pasadas sin resultado");
    expect(calcularProyeccion({ ...cohorte, conversion }).agendasRequeridasDia.razon).toContain("cuando se registren se puede medir");
  });

  it("con cobertura parcial proyecta con lo medido y lo dice en pantalla; nunca lo presenta como completo", () => {
    const parcial = elegirConversion({ objetivo: null, anterior: medida("C3", 3, 1, 3, 7), enCurso: null, muestraMinima: 1 });
    const proyeccion = calcularProyeccion({ ...cohorte, conversion: parcial });
    expect(proyeccion.agendasRequeridasDia.valor).not.toBeNull();
    expect(pintar({ ...cohorte, conversion: parcial })).toContain("parcial");

    const completa = elegirConversion({ objetivo: null, anterior: medida("C3", 10, 2, 5), enCurso: null, muestraMinima: 1 });
    const calculada = calcularProyeccion({ ...cohorte, conversion: completa });
    expect(calculada.agendasRequeridasDia.valor).toBeCloseTo((20 / 11) / (2 / 5) / (5 / 10));
  });
});

describe("la tarjeta se lee como una cadena", () => {
  it("cada raya trae su razón en palabras de gerencia, sin texto del sistema", () => {
    const sinConversion = elegirConversion({ objetivo: null, anterior: null, enCurso: { ...medida("C4", 3, 0), madurando: true } });
    const datos = { ...cohorte, ventasVentana: 0, conversion: sinConversion };
    const resultado = calcularProyeccion(datos);
    const pantalla = pintar(datos);

    expect(resultado.ritmo.valor).toBeNull();
    expect(resultado.showsRequeridosDia.valor).toBeNull();
    expect(resultado.agendasRequeridasDia.valor).toBeNull();
    expect(resultado.leadsRequeridosDia.valor).toBeNull();
    expect(pantalla).toContain("No hubo ventas en los últimos 10 días hábiles, así que no hay ritmo con qué proyectar. Prueba con una ventana más larga.");
    expect(pantalla).toContain("En C4 van 3 shows y hacen falta 20");
    expect(pantalla).toContain("Sale de las agendas por día, que todavía no se pueden calcular.");
    for (const jerga of ["Infinity", "NaN", "mayor que cero", "ventana de ritmo", "→ venta"]) expect(pantalla).not.toContain(jerga);
  });

  it("explica una ventana recortada y la falta de leads", () => {
    const datos = { ...cohorte, ventanaRecortada: true, registrosVentana: 0, agendasVentana: 0 };
    expect(calcularProyeccion(datos).leadsRequeridosDia.razon).toBe(
      "No entraron leads desde que empezó la venta de la cohorte, así que no sabemos cuántos hacen falta para una agenda.",
    );
    expect(pintar(datos)).toContain(", desde que empezó la venta)");
  });
});

// Antes: "sin cohorte dice dónde configurarla" (solo afirmaba el copy). Ahora se afirma el comportamiento: sin cohorte
// abierta nada se proyecta ni se reparte, y cada raya trae su razón en vez de un 0.
it("sin cohorte abierta no proyecta ni reparte, y cada raya dice por qué", () => {
  const resultado = calcularProyeccion({ ...cohorte, cohorte: null });
  expect([resultado.ritmo, resultado.proyeccion, resultado.ventasRequeridasDia, resultado.leadsRequeridosDia].map((r) => r.valor)).toEqual([null, null, null, null]);
  expect(resultado.ritmo.razon).toBeTruthy();
  expect(resultado.repartoSemanal).toEqual([]);
});

describe("la ventana del ritmo en la URL", () => {
  it("acepta solo las opciones y vuelve a 10 con cualquier otra cosa", () => {
    expect(ventanaRitmoDeUrl("20")).toBe(20);
    expect(ventanaRitmoDeUrl(["5"])).toBe(5);
    for (const raro of [undefined, "", "7", "abc", "10.5", "-5"]) expect(ventanaRitmoDeUrl(raro)).toBe(10);
  });
});

describe("leerProyeccion contra la base", () => {
  let db: Db;
  let cerrar: () => Promise<void>;
  let vaciar: () => Promise<void>;
  beforeAll(async () => ({ db, cerrar, vaciar } = await crearBaseReutilizable()));
  beforeEach(async () => vaciar());
  afterAll(async () => cerrar());

  async function sembrar(personas: number, vendidas: number) {
    const [programa] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "proyeccion", nombre: "Proyección", ticketUsd: "1000" }).returning();
    await db.insert(cohorts).values({
      programId: programa.id,
      codigo: "C3",
      metaCupos: 50,
      precioUsd: "1000",
      fechaInicioClases: "2026-12-01",
      fechaInicioVentas: "2026-10-01",
      fechaCierreVentas: "2026-11-30",
    });
    for (let i = 0; i < personas; i++) {
      const [lead] = await db.insert(leads).values({ fechaPrimeraAplicacion: FECHA_LEAD_DE_PRUEBA, programId: programa.id, emailNormalizado: `p${i}@retia.co` }).returning();
      const [deal] = await db.insert(deals).values({ programId: programa.id, leadId: lead.id, ownerUserId: await duenoDePrueba(db, programa.id), etapa: i < vendidas ? "ganado_completo" : "atendido" }).returning();
      await db.insert(calls).values({ programId: programa.id, dealId: deal.id, fechaAgenda: new Date("2026-10-14T09:00:00-05:00"), resultado: "show" });
    }
    return programa.id;
  }

  it("sin objetivo ni cohorte anterior mide la conversión en la cohorte en curso", async () => {
    const programId = await sembrar(MUESTRA_MINIMA_CONVERSION, 5);
    const resultado = await leerProyeccion({ programId, hoy: "2026-10-21", ahora: new Date("2026-10-21T18:00:00-05:00"), ventanaDiasHabiles: 20 }, db);
    expect(resultado.supuestos.conversion).toMatchObject({
      origen: "cohorte_en_curso",
      cohorteCodigo: "C3",
      razonShow: { valor: 1 },
      razonCierre: { valor: 5 / MUESTRA_MINIMA_CONVERSION },
      muestra: { personas: MUESTRA_MINIMA_CONVERSION, shows: MUESTRA_MINIMA_CONVERSION, vendidos: 5, pendientes: 0 },
      madurando: true,
    });
    // La venta empezó el 1-oct: la ventana de 20 hábiles se recorta a 15 (1 al 21 oct).
    expect(resultado.supuestos).toMatchObject({ ventanaDesde: "2026-10-01", ventanaRecortada: true, diasHabilesVentana: 15 });
  });

  it("un sábado, los últimos 10 días hábiles siguen siendo 10", async () => {
    const programId = await sembrar(MUESTRA_MINIMA_CONVERSION, 5);
    const resultado = await leerProyeccion({ programId, hoy: "2026-10-24", ahora: new Date("2026-10-24T18:00:00-05:00") }, db);
    expect(resultado.supuestos).toMatchObject({ ventanaDesde: "2026-10-12", ventanaHasta: "2026-10-24", diasHabilesVentana: 10 });
  });

  it("con menos de la muestra mínima no inventa la conversión", async () => {
    const programId = await sembrar(MUESTRA_MINIMA_CONVERSION - 1, 5);
    const resultado = await leerProyeccion({ programId, hoy: "2026-10-21", ahora: new Date("2026-10-21T18:00:00-05:00") }, db);
    expect(resultado.supuestos.conversion.razonShow.valor).toBeNull();
    expect(resultado.agendasRequeridasDia.razon).toContain(`van ${MUESTRA_MINIMA_CONVERSION - 1} personas con cita`);
  });
});
