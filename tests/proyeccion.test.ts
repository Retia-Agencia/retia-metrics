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
  repartirFaltantePorSemana,
  ventanaRitmoDeUrl,
  type DatosParaProyeccion,
} from "@/lib/queries/proyeccion";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

const porObjetivo = elegirConversion({ objetivo: 0.25, anterior: null, enCurso: null });

const cohorte: DatosParaProyeccion = {
  hoy: "2026-10-21",
  cohorte: { codigo: "C4", metaCupos: 30, metaLeadsDia: 35, fechaCierreVentas: "2026-11-04" },
  vendidos: 10,
  ventasVentana: 5,
  agendasVentana: 20,
  registrosVentana: 100,
  diasHabilesVentana: 10,
  ventanaDiasHabiles: 10,
  ventanaDesde: "2026-10-08",
  ventanaHasta: "2026-10-21",
  conversion: porObjetivo,
};

const medida = (codigo: string, deals: number, vendidos: number) => ({
  codigo,
  tasas: { deals, vendidos, agendaAVenta: deals === 0 ? null : vendidos / deals },
});

const pintar = (datos: DatosParaProyeccion, ventanas = [] as Parameters<typeof Proyeccion>[0]["ventanas"]) =>
  renderToStaticMarkup(createElement(Proyeccion, { datos: calcularProyeccion(datos), ventanas }));

describe("proyección", () => {
  it("cuadra cada cifra con un cálculo independiente", () => {
    const resultado = calcularProyeccion(cohorte);
    // Del 22-oct al 4-nov hay 10 días hábiles (dos semanas sin fin de semana).
    const diasQueQuedan = 10;
    const ritmo = 5 / 10;
    const ventasDia = (30 - 10) / diasQueQuedan;

    expect(resultado.diasHabilesRestantes).toBe(diasQueQuedan);
    expect(resultado.ritmo.valor).toBe(ritmo);
    expect(resultado.proyeccion.valor).toBe(10 + ritmo * diasQueQuedan);
    expect(resultado.ventasRequeridasDia.valor).toBe(ventasDia);
    expect(resultado.agendasRequeridasDia.valor).toBe(ventasDia / 0.25);
    expect(resultado.leadsRequeridosDia.valor).toBe((ventasDia / 0.25) / (20 / 100));
    expect(resultado.supuestos.agendasPorRegistro).toBe(0.2);
  });

  it("con la meta cumplida pide cero y no reparte nada", () => {
    const resultado = calcularProyeccion({ ...cohorte, vendidos: 30, conversion: elegirConversion({ objetivo: null, anterior: null, enCurso: null }) });
    expect(resultado.faltan).toBe(0);
    expect([resultado.ventasRequeridasDia.valor, resultado.agendasRequeridasDia.valor, resultado.leadsRequeridosDia.valor]).toEqual([0, 0, 0]);
    expect(resultado.repartoSemanal).toEqual([]);
    expect(pintar({ ...cohorte, vendidos: 30 })).toContain("Ya se vendieron los 30 cupos de C4.");
  });

  it("reparte el faltante por semana con fechas reales y sin perder ventas", () => {
    const tramos = repartirFaltantePorSemana({ hoy: "2026-10-21", cierre: "2026-11-04", faltan: 20 });
    expect(tramos).toEqual([
      { tipo: "resto_semana", desde: "2026-10-22", hasta: "2026-10-23", diasHabiles: 2, ventas: 4 },
      { tipo: "semana", desde: "2026-10-26", hasta: "2026-10-30", diasHabiles: 5, ventas: 10 },
      { tipo: "final", desde: "2026-11-02", hasta: "2026-11-04", diasHabiles: 3, ventas: 6 },
    ]);
    expect(tramos.reduce((s, t) => s + t.ventas, 0)).toBe(20);

    const pantalla = pintar(cohorte);
    expect(pantalla).toContain("Cómo repartir las 20 ventas que faltan");
    expect(pantalla).toContain("Lo que queda de esta semana · 22 al 23 oct");
    expect(pantalla).toContain("Semana del 26 al 30 oct");
    expect(pantalla).toContain("Última semana, hasta el cierre · 2 al 4 nov");
    expect(pantalla).not.toContain("Días sueltos");
  });

  it("escribe un rango en fechas de calendario", () => {
    expect(rangoLegible("2026-10-27", "2026-10-31")).toBe("27 al 31 oct");
    expect(rangoLegible("2026-10-30", "2026-11-04")).toBe("30 oct al 4 nov");
    expect(rangoLegible("2026-11-04", "2026-11-04")).toBe("4 nov");
  });
});

describe("la conversión agenda → venta", () => {
  it("prefiere el objetivo, luego la cohorte anterior y luego la cohorte en curso", () => {
    const anterior = medida("C2", 40, 10);
    const enCurso = { ...medida("C3", 30, 3), madurando: true };
    expect(elegirConversion({ objetivo: 0.3, anterior, enCurso })).toMatchObject({ valor: 0.3, origen: "objetivo_cohorte" });
    expect(elegirConversion({ objetivo: null, anterior, enCurso })).toMatchObject({ valor: 10 / 40, origen: "cohorte_anterior", cohorteCodigo: "C2" });
    expect(elegirConversion({ objetivo: null, anterior: null, enCurso })).toMatchObject({
      valor: 3 / 30,
      origen: "cohorte_en_curso",
      cohorteCodigo: "C3",
      muestra: { personas: 30, vendidos: 3 },
      madurando: true,
    });
  });

  it("no usa una medición con menos de la muestra mínima ni sin ventas", () => {
    const corta = elegirConversion({ objetivo: null, anterior: medida("C2", MUESTRA_MINIMA_CONVERSION - 1, 5), enCurso: { ...medida("C3", MUESTRA_MINIMA_CONVERSION - 1, 5), madurando: true } });
    expect(corta.valor).toBeNull();
    expect(corta.razon).toBe(`Todavía no sabemos cuántas agendas terminan en venta: en C3 van ${MUESTRA_MINIMA_CONVERSION - 1} personas con cita y hacen falta ${MUESTRA_MINIMA_CONVERSION} para medirlo. Se completa solo a medida que pasen las citas.`);

    const justa = elegirConversion({ objetivo: null, anterior: null, enCurso: { ...medida("C3", MUESTRA_MINIMA_CONVERSION, 4), madurando: false } });
    expect(justa.valor).toBe(4 / MUESTRA_MINIMA_CONVERSION);

    const sinVentas = elegirConversion({ objetivo: null, anterior: null, enCurso: { ...medida("C3", 25, 0), madurando: false } });
    expect(sinVentas.valor).toBeNull();
    expect(sinVentas.razon).toContain("Ninguna de las 25 personas con cita de C3 ha comprado todavía");
  });

  it("dice en pantalla de dónde salió la conversión", () => {
    const pantalla = pintar({ ...cohorte, conversion: elegirConversion({ objetivo: null, anterior: null, enCurso: { ...medida("C4", 40, 10), madurando: true } }) });
    expect(pantalla).toContain("25,0% de las agendas termina en venta");
    expect(pantalla).toContain("medido en C4: 10 de 40 personas con cita compraron; puede subir");
    expect(pintar(cohorte)).toContain("según el objetivo de la cohorte");
  });
});

describe("la tarjeta se lee como una cadena", () => {
  it("dice ritmo, cierre y lo que hace falta con su relación", () => {
    const pantalla = pintar(cohorte, [
      { dias: 5, href: "/p/x/hub?ritmo=5" },
      { dias: 10, href: "/p/x/hub?ritmo=10" },
      { dias: 20, href: "/p/x/hub?ritmo=20" },
    ]);
    expect(pantalla).toContain(">Proyección<");
    expect(pantalla).not.toContain("requeridos");
    expect(pantalla).toContain("0,5 ventas por día");
    expect(pantalla).toMatch(/cerramos C4 en.*>15<.* de 30 cupos/);
    expect(pantalla).toContain("Ritmo: 5 ventas en 10 días hábiles (8 al 21 oct)");
    expect(pantalla).toContain("Para llegar a 30 faltan 20 ventas");
    expect(pantalla).toContain("20 ventas ÷ 10 días hábiles hasta el cierre (4 nov)");
    expect(pantalla).toContain("20,0% de los leads agenda (20 agendas de 100 leads, 8 al 21 oct)");
    expect(pantalla).toContain("meta declarada: 35 leads por día");
    expect(pantalla).toContain('href="/p/x/hub?ritmo=20"');
    expect(pantalla).toMatch(/aria-current="true"[^>]*>10</);
  });

  it("cada raya trae su razón en palabras de gerencia, sin texto del sistema", () => {
    const sinConversion = elegirConversion({ objetivo: null, anterior: null, enCurso: { ...medida("C4", 3, 0), madurando: true } });
    const datos = { ...cohorte, ventasVentana: 0, conversion: sinConversion };
    const resultado = calcularProyeccion(datos);
    const pantalla = pintar(datos);

    expect(resultado.ritmo.valor).toBeNull();
    expect(resultado.agendasRequeridasDia.valor).toBeNull();
    expect(resultado.leadsRequeridosDia.valor).toBeNull();
    expect(pantalla).toContain("No hubo ventas en los últimos 10 días hábiles, así que no hay ritmo con qué proyectar. Prueba con una ventana más larga.");
    expect(pantalla).toContain("en C4 van 3 personas con cita y hacen falta 20");
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

  it("sin cohorte dice dónde configurarla", () => {
    const pantalla = pintar({ ...cohorte, cohorte: null });
    expect(pantalla).toContain("No hay una cohorte abierta con fechas de venta. Se configura en la pestaña Programa.");
  });
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
      estado: "activo",
    });
    for (let i = 0; i < personas; i++) {
      const [lead] = await db.insert(leads).values({ programId: programa.id, emailNormalizado: `p${i}@retia.co` }).returning();
      const [deal] = await db.insert(deals).values({ programId: programa.id, leadId: lead.id, etapa: i < vendidas ? "ganado_completo" : "atendido" }).returning();
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
      valor: 5 / MUESTRA_MINIMA_CONVERSION,
      muestra: { personas: MUESTRA_MINIMA_CONVERSION, vendidos: 5 },
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
    expect(resultado.supuestos.conversion.valor).toBeNull();
    expect(resultado.agendasRequeridasDia.razon).toContain(`van ${MUESTRA_MINIMA_CONVERSION - 1} personas con cita`);
  });
});
