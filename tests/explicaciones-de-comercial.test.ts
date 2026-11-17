import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Cifra } from "@/components/cifra-con-lista";
import { razon } from "@/lib/cobertura";
import { CONCEPTOS_DE_COMERCIAL, cifrasClaveDeComercial, cifrasDeCloser } from "@/lib/hub/cifras-de-comercial";
import { explicacionesDeComercial } from "@/lib/hub/explicaciones-de-comercial";
import { explicacionDe, explicacionesDeRecorridos } from "@/lib/metricas/explicacion";
import type { EmbudoDelRango } from "@/lib/queries/dashboard";

const explicaciones = explicacionesDeComercial();
const contexto = { programa: "Programa", cohorte: "C6", rango: { desde: "2026-11-01", hasta: "2026-11-16" }, hoy: "2026-11-16", closer: null };
function embudo(faltan = 0): EmbudoDelRango {
  const cobertura = { base: 10, faltan, motivo: faltan ? `${faltan} de ${10 + faltan} citas pasadas siguen sin resultado` : null, calculable: true };
  const razonShow = razon(6, 10, cobertura);
  const razonCierre = razon(3, 6, cobertura);
  const razonAgendaAVenta = razon(3, 10, cobertura);
  return {
    agendas: 12, canceladas: 0, reagendadas: 0, llamadasConShow: 6, cierres: 3,
    razonShow, razonCierre, agendaAVenta: 0.3, pendientesDeResultado: faltan, madurando: false,
    estadosDeCitas: { porVenir: 0, sinResultado: faltan, show: 6, noShow: 4, reagendadas: 0, otro: 0 },
    grupo: { deals: 10, conShow: 6, vendidos: 3, pendientes: faltan, sinMarcar: faltan,
      cobertura: 10 / (10 + faltan), parcial: faltan > 1, agendaAVenta: 0.3, razonShow, razonCierre, razonAgendaAVenta },
  };
}

describe("419 E-3 Comercial: fichas reales y cifras sin consultas", () => {
  it("resuelve las ocho claves contra que, formula y variables del registro", () => {
    expect(Object.keys(explicaciones)).toEqual([...CONCEPTOS_DE_COMERCIAL]);
    for (const clave of CONCEPTOS_DE_COMERCIAL) {
      const registrada = clave === "citas_sin_marcar" ? "citas_pendientes" : clave;
      expect(explicaciones[clave]).toEqual(explicacionDe(registrada, { universo: "todas" }));
      expect(explicaciones[clave].que.length).toBeGreaterThan(0);
      expect(explicaciones[clave].formula.terminos.length).toBeGreaterThan(0);
      expect(explicaciones[clave].variables.length).toBeGreaterThan(0);
    }
  });

  it("arma las cifras clave con sus partes, valores y cobertura parcial", () => {
    for (const faltan of [0, 7]) {
      const cifras = cifrasClaveDeComercial({ embudo: embudo(faltan), explicaciones, contexto });
      expect([cifras.citas.valor, cifras.asistencia.valor, cifras.cierreDeVentas.valor, cifras.citaAVenta.valor]).toEqual([12, 0.6, 0.5, 0.3]);
      expect([cifras.asistencia.textoDelValor, cifras.cierreDeVentas.textoDelValor, cifras.citaAVenta.textoDelValor]).toEqual(["60,0%", "50,0%", "30,0%"]);
      expect(cifras.sinMarcar?.valor ?? null).toBe(faltan || null);
      expect(cifras.asistencia.etiquetas.includes("Parcial")).toBe(faltan > 0);
      if (faltan) {
        const html = renderToStaticMarkup(createElement(Cifra, { cifra: cifras.asistencia, mostrarCobertura: true }));
        expect(html).toContain("Parcial");
        expect(html).toContain("7 de 17");
      }
      expect(cifras.citas.explicacion.evidencia).toBeNull();
    }
  });

  it("conserva el guion de las celdas heredadas sin cambiar el valor explicado", () => {
    const cifra = cifrasDeCloser({ fila: { ...embudo(), agendas: 0, clave: "id-opaco", closerId: "Closer" }, explicaciones, contexto }).citas;
    expect(cifra.valor).toBe(0);
    expect(cifra.textoDelValor).toBe("0");
    const html = renderToStaticMarkup(createElement(Cifra, { cifra, tamano: "celda" }, "—"));
    expect(html).toContain("—");
    expect(html).toContain('data-abre-explicacion=""');
  });

  it("resuelve los grupos y escalones desde sus variables aprobadas", () => {
    const x = explicacionesDeRecorridos();
    for (const clave of ["cerro_en_la_llamada", "cerro_con_seguimiento", "no_cerro", "ventas_sin_llamada"]) {
      expect(x[clave].variables.length).toBeGreaterThan(0);
      expect(x[clave].que).toBe(x[clave].variables[0].explicacion);
    }
  });
});
