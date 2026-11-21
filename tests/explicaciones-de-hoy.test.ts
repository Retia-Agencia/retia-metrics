import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Cifra } from "@/components/cifra-con-lista";
import { razon, razonVacia } from "@/lib/cobertura";
import { CONCEPTOS_DE_HOY, cifrasDeHoy, type DatosDeHoy } from "@/lib/hub/cifras-de-hoy";
import { CONCEPTOS_DE_CLOSERS_DE_HOY, cifrasDeClosersDeHoy } from "@/lib/hub/cifras-de-pendientes-y-closers";
import { explicacionesDeHoy, explicacionesDeClosersDeHoy } from "@/lib/hub/explicaciones-de-hoy";
import { explicacionDe } from "@/lib/metricas/explicacion";
import type { ClaveRegistrada } from "@/lib/metricas/registro";

const x = explicacionesDeHoy();
const alias: Partial<Record<(typeof CONCEPTOS_DE_HOY)[number], ClaveRegistrada>> = {
  citas_realizadas: "shows", citas_sin_marcar: "citas_pendientes", citas_de_manana: "citas_del_dia",
};
const dinero = { ventas: 3, lineas: 4, vendido: 2391, recaudado: 0, porCobrar: 2391, sinValorVendido: 0, sinSaldoCalculable: 0, sobrepago: 0 };
function datos(resueltos = 1, faltan = 0): DatosDeHoy {
  const cobertura = { base: resueltos, faltan, motivo: faltan ? `${faltan} de ${resueltos + faltan} citas pasadas siguen sin resultado` : null, calculable: true };
  const show = resueltos ? razon(resueltos, resueltos, cobertura) : razonVacia("Sin citas en el periodo");
  const cierre = resueltos ? razon(0, resueltos, cobertura) : razonVacia("Sin shows en el periodo");
  return {
    embudo: {
      agendas: resueltos + faltan, canceladas: 0, llamadasConShow: resueltos, cierres: 3, razonShow: show, razonCierre: cierre,
      agendaAVenta: resueltos ? 0 : null, pendientesDeResultado: faltan, reagendadas: 0, madurando: false,
      estadosDeCitas: { porVenir: 0, sinResultado: faltan, show: resueltos, noShow: 0, reagendadas: 0, otro: 0 },
      grupo: { deals: resueltos, conShow: resueltos, vendidos: 0, pendientes: faltan, sinMarcar: faltan,
        cobertura: resueltos / (resueltos + faltan || 1), parcial: faltan > 0, agendaAVenta: 0,
        razonShow: show, razonCierre: cierre, razonAgendaAVenta: cierre },
    },
    sinResultado: faltan, registros: 0, leadsDelDia: null,
    dia: { real: 3, meta: 1.3 }, semana: { real: 3, meta: 2.1 }, diasDeLaSemana: { dia: 5, total: 5 },
    objetivoDeLeads: 50, leadsQueHacenFalta: { valor: null, razon: "Sin medición suficiente" },
    dinero, caja: [], leadsDeLaSemana: 0,
    showDeLaSemana: { citasQueYaDebianOcurrir: resueltos + faltan, realizadas: resueltos, sinMarcar: faltan,
      porcentaje: resueltos ? resueltos / (resueltos + faltan) : null }, citasDeManana: 0,
  };
}
const construir = (d: DatosDeHoy, dia = "2026-11-08") => cifrasDeHoy({ datos: d, explicaciones: x,
  programa: "Programa", dia, hoy: "2026-11-14", lunes: "2026-11-02" });

describe("419 E-3 Hoy, fichas reales y presentación sin base ni reloj", () => {
  it("resuelve todas las claves verificadas y reutiliza una explicación por concepto", () => {
    expect(Object.keys(x)).toEqual([...CONCEPTOS_DE_HOY]);
    for (const clave of CONCEPTOS_DE_HOY) {
      expect(x[clave]).toEqual(explicacionDe(alias[clave] ?? clave as ClaveRegistrada, {
        universo: "todas", ...(clave === "entro_a_caja" ? { moneda: "usd" as const } : {}),
      }));
    }
    const closers = explicacionesDeClosersDeHoy(x);
    expect(Object.keys(closers)).toEqual([...CONCEPTOS_DE_CLOSERS_DE_HOY]);
    expect(closers.asistencia).toBe(x.asistencia);
    // Bloqueado: la ficha habla de hoy, no puede explicar mañana sin mentir.
    expect(x.citas_de_manana.que).toContain("hoy");
  });

  it("conserva los valores de los tres días de la línea base", () => {
    const d = datos();
    const noviembre = construir(d);
    expect([noviembre.cuposVendidos.valor, noviembre.leads.valor, noviembre.asistencia.textoDelValor,
      noviembre.cierreDeVentas.textoDelValor, noviembre.vendido.valor, noviembre.recaudado.valor, noviembre.porCobrar.valor])
      .toEqual([3, 0, "100,0%", "0,0%", 2391, 0, 2391]);
    expect(noviembre.entroACaja[0].textoDelValor).toBe("USD 0,00");
    const septiembre = construir({ ...d, dia: { real: 0, meta: 0.6 }, registros: 2 }, "2026-09-30");
    expect([septiembre.embudo.envios.valor, septiembre.cuposVendidos.valor]).toEqual([2, 0]);
    const vacio = construir(datos(0), "2026-11-14");
    expect([vacio.asistencia.textoDelValor, vacio.cierreDeVentas.textoDelValor, vacio.semana.asistencia.textoDelValor]).toEqual(["—", "—", "—"]);
    expect(noviembre.embudo.envios.explicacion.evidencia).toBeNull();
  });

  it("3 de 10 resueltas: tarjetas y celdas dicen Parcial con base y siete faltantes", () => {
    const d = datos(3, 7);
    const cifras = construir(d);
    const [closer] = cifrasDeClosersDeHoy({ programa: "Programa", dia: "2026-11-08", hoy: "2026-11-14",
      explicaciones: explicacionesDeClosersDeHoy(x), filas: [{ ...d.embudo, clave: "opaca", closerId: "Ana", caja: [], comisionUsd: 0, ventasSinComision: 0 }] });
    for (const c of [cifras.asistencia, cifras.cierreDeVentas, cifras.semana.asistencia, closer.asistencia, closer.cierreDeVentas]) {
      expect(c.etiquetas).toContain("Parcial");
      for (const tamano of ["tarjeta", "celda"] as const) {
        const html = renderToStaticMarkup(createElement(Cifra, { cifra: c, tamano, mostrarCobertura: true }));
        expect(html).toContain("Parcial");
        expect(html).toContain("7 de 10");
        expect(html).toContain(c.explicacion.formula.conLosNumeros!);
      }
    }
  });
});
