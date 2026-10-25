import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { Proyeccion } from "@/components/dashboard/proyeccion";
import { calcularProyeccion, repartirFaltantePorSemana, type DatosParaProyeccion } from "@/lib/queries/proyeccion";

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
  conversionAgendaVenta: 0.25,
  origenConversion: "objetivo_cohorte",
};

describe("proyección y requeridos", () => {
  it("cuadra cada figura con un cálculo independiente", () => {
    const resultado = calcularProyeccion(cohorte);
    const diasQueQuedan = 10;
    const ritmo = 5 / 10;
    const ventasDia = (30 - 10) / diasQueQuedan;

    expect(resultado.ritmo.valor).toBe(ritmo);
    expect(resultado.proyeccion.valor).toBe(10 + ritmo * diasQueQuedan);
    expect(resultado.ventasRequeridasDia.valor).toBe(ventasDia);
    expect(resultado.agendasRequeridasDia.valor).toBe(ventasDia / 0.25);
    expect(resultado.leadsRequeridosDia.valor).toBe((ventasDia / 0.25) / (20 / 100));
  });

  it("muestra raya y la razón sin ventas y sin conversión", () => {
    const sinDatos = calcularProyeccion({
      ...cohorte,
      ventasVentana: 0,
      conversionAgendaVenta: 0,
      origenConversion: "sin_conversion",
    });
    const pantalla = renderToStaticMarkup(createElement(Proyeccion, { datos: sinDatos }));

    expect(sinDatos.ritmo.valor).toBeNull();
    expect(sinDatos.agendasRequeridasDia.valor).toBeNull();
    expect(pantalla).toContain("—");
    expect(pantalla).toContain("No hay ventas en la ventana de ritmo.");
    expect(pantalla).toContain("No hay una conversión agenda → venta mayor que cero.");
    expect(pantalla).not.toContain("Infinity");
  });

  it("reparte el faltante entre resto de semana, semanas completas y días finales", () => {
    expect(repartirFaltantePorSemana({ hoy: "2026-10-21", cierre: "2026-11-04", faltan: 20 })).toEqual([
      { tipo: "resto_semana", desde: "2026-10-22", hasta: "2026-10-23", diasHabiles: 2, ventas: 4 },
      { tipo: "semana", desde: "2026-10-26", hasta: "2026-10-30", diasHabiles: 5, ventas: 10 },
      { tipo: "final", desde: "2026-11-02", hasta: "2026-11-04", diasHabiles: 3, ventas: 6 },
    ]);
  });

  it("deja visibles la ventana y la conversión usadas, incluida la meta declarada de leads", () => {
    const pantalla = renderToStaticMarkup(createElement(Proyeccion, { datos: calcularProyeccion(cohorte) }));
    expect(pantalla).toContain("últimos 10 días hábiles");
    expect(pantalla).toContain("25,0 %");
    expect(pantalla).toContain("objetivo declarado de la cohorte");
    expect(pantalla).toContain("de 30 cupos de meta");
    expect(pantalla).toContain("Meta declarada: 35 leads/día");
  });
});
