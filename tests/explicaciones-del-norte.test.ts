import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { VamosALlegarProgramaVista } from "@/components/metas/vamos-a-llegar-programa";
import { CONCEPTOS_DEL_NORTE, cifrasDelNorte } from "@/lib/hub/cifras-del-norte";
import { explicacionesDelNorte } from "@/lib/hub/explicaciones-del-norte";
import { explicacionDe } from "@/lib/metricas/explicacion";
import type { CeldaDeMeta, VamosALlegar } from "@/lib/queries/vamos-a-llegar";

const explicaciones = explicacionesDelNorte();
const celda: CeldaDeMeta = { llevamos: 3, meta: 10, pct: 0.3, faltan: 7, esperado: 5, porDiaHabil: 1.25, proyeccion: null, tono: "neutro" };
const cuadrante = { cupos: celda, usd: { ...celda, llevamos: 2700, meta: 10000, faltan: 7300, esperado: 5000 }, ventasSinValorVendido: 1, diasHabilesQueQuedan: 5 };
const datos: VamosALlegar = {
  hoy: "2026-11-16",
  mes: { clave: "2026-11", nombre: "noviembre 2026", cierre: "2026-11-30", sinMeta: false, cuadrante },
  cohorte: { id: "cohorte-opaca", codigo: "C1", cierre: "2026-11-30", desdeLista: "2026-10-28", sinMeta: false, razonProyeccion: "Falta historial para proyectar", cuadrante },
};
const props = { programa: { id: "programa-opaco", slug: "prueba", nombre: "Programa" }, hoy: datos.hoy, origen: "/p/prueba/hub", conListas: true, configurar: { hrefBase: "/p/prueba", origen: "/p/prueba/hub" } };
function pintar(d = datos, conListas = true) {
  return renderToStaticMarkup(createElement(VamosALlegarProgramaVista, {
    datos: d, cifras: cifrasDelNorte({ datos: d, programa: "Programa", explicaciones }), props: { ...props, conListas },
  }));
}

describe("419 E-3: explicaciones y presentación del norte del programa", () => {
  it("resuelve las seis fichas para todas las áreas y sin jerga técnica", () => {
    expect(Object.keys(explicaciones)).toEqual([...CONCEPTOS_DEL_NORTE]);
    for (const clave of CONCEPTOS_DEL_NORTE) {
      const ficha = explicaciones[clave];
      expect(ficha).toEqual(explicacionDe(clave, { universo: "todas" }));
      expect(ficha.que.length).toBeGreaterThan(0);
      expect(ficha.formula.terminos.length).toBeGreaterThan(0);
      expect(ficha.variables.length).toBeGreaterThan(0);
      expect(JSON.stringify(ficha)).not.toMatch(/lib\/|ADR|utm_|periodo [AB]\b|\.\./);
    }
  });

  it("pinta ambos horizontes solo con Cifras y cuatro barras, sin la frase de avance", () => {
    const html = pintar();
    expect(html).toContain('data-testid="vamos-a-llegar"');
    expect(html.match(/data-abre-explicacion=""/g)).toHaveLength(18);
    expect(html.match(/role="progressbar"/g)).toHaveLength(4);
    expect(html).toContain("USD 2.700,00");
    expect(html).toContain("Falta historial para proyectar");
    // Una advertencia por horizonte, desde la propia Cifra en USD.
    expect(html.match(/1 ventas no tienen valor vendido/g)).toHaveLength(2);
    expect(html).not.toContain("metrica=cierres");
  });

  it("conserva Configurar y Sin cohorte activa; sin meta no dibuja barras", () => {
    const sinMeta = { ...celda, meta: null, faltan: null, esperado: null, porDiaHabil: null };
    const html = pintar({ ...datos, cohorte: null, mes: { ...datos.mes, sinMeta: true, cuadrante: { ...cuadrante, cupos: sinMeta, usd: sinMeta } } });
    expect(html).toContain("Sin cohorte activa");
    expect(html.match(/>Configurar</g)).toHaveLength(2);
    expect(html).not.toContain("a hoy ");
    expect(html.match(/data-abre-explicacion=""/g)).toHaveLength(8);
  });
});
