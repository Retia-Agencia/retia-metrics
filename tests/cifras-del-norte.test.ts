import { describe, expect, it } from "vitest";
import { cifrasDelNorte, CONCEPTOS_DEL_NORTE, type ExplicacionesDelNorte } from "@/lib/hub/cifras-del-norte";
import type { ExplicacionDeConcepto } from "@/lib/metricas/cifra";
import type { CeldaDeMeta, VamosALlegar } from "@/lib/queries/vamos-a-llegar";

const explicaciones = Object.fromEntries(CONCEPTOS_DEL_NORTE.map((k): [string, ExplicacionDeConcepto] => [k, {
  rotulo: "Cifra del norte", universo: "todas", unidad: "conteo", que: "El avance de ventas.",
  formula: { forma: "conteo", terminos: ["ventas"] }, variables: [],
}])) as ExplicacionesDelNorte;
const celda = (o: Partial<CeldaDeMeta> = {}): CeldaDeMeta => ({
  llevamos: 3, meta: 10, esperado: 4.5, faltan: 7, porDiaHabil: 1.25, proyeccion: 8, pct: 0.3, tono: "neutro", ...o,
});
function entrada(o: Partial<CeldaDeMeta> = {}, sinValor = 0) {
  const cuadrante = { cupos: celda(o), usd: celda({ ...o, llevamos: 3000 }), ventasSinValorVendido: sinValor, diasHabilesQueQuedan: 5 };
  const datos: VamosALlegar = {
    hoy: "2026-11-13", mes: { clave: "2026-11", nombre: "noviembre 2026", cierre: "2026-11-30", sinMeta: false, cuadrante },
    cohorte: { id: "opaca", codigo: "C6", cierre: null, desdeLista: "2026-11-01", sinMeta: false, razonProyeccion: "Falta historial", cuadrante },
  };
  return { programa: "Prueba", datos, explicaciones };
}

describe("419 E-2: el norte", () => {
  it("conserva todos los valores recibidos; solo filtra por Programa", () => {
    const c = cifrasDelNorte(entrada());
    expect(Object.values(c.mes.cupos).map((x) => x?.valor ?? null)).toEqual([3, 7, 4.5, 1.25, null]);
    expect(c.cohorte?.cupos.proyeccion?.valor).toBe(8);
    expect(c.mes.usd.llevamos.textoDelValor).toBe("USD 3.000,00");
    expect(c.mes.cupos.llevamos.explicacion.filtros).toEqual([["Programa", "Prueba"]]);
    expect(c.mes.cupos.porDiaHabil.textoDelValor).toBe("1,3");
  });
  it.each([[2, "peligro"], [3, "alerta"], [5, "exito"]])("el estado de %s sale de lo esperado, sin usar el tono viejo", (llevamos, tono) => {
    expect(cifrasDelNorte(entrada({ llevamos: llevamos as number })).mes.cupos.llevamos.estado?.tono).toBe(tono);
  });
  it("sin meta ni fechas, los valores nulos tienen motivo y no inventan barra ni estado", () => {
    const c = cifrasDelNorte(entrada({ meta: null, esperado: null, faltan: null, porDiaHabil: null, proyeccion: null }));
    expect(c.mes.cupos.llevamos.barra).toBeNull();
    expect(c.mes.cupos.llevamos.estado).toBeNull();
    expect(c.mes.cupos.faltan.textoDelValor).toBe("—");
    expect(JSON.stringify(c.cohorte?.cupos.proyeccion?.explicacion)).toContain("Falta historial");
  });
  it("cero es cero, esperado cero no colorea y sobrecumplir conserva la cifra", () => {
    const c = cifrasDelNorte(entrada({ llevamos: 0, esperado: 0, faltan: 0 }));
    expect(c.mes.cupos.llevamos.textoDelValor).toBe("0");
    expect(c.mes.cupos.llevamos.estado).toBeNull();
    expect(cifrasDelNorte(entrada({ llevamos: 12 })).mes.cupos.llevamos.valor).toBe(12);
  });
  it("solo USD es parcial cuando hay ventas sin valor; sin cohorte no inventa una", () => {
    const e = entrada({}, 1);
    const c = cifrasDelNorte(e);
    expect(c.mes.usd.llevamos.etiquetas).toContain("Parcial");
    expect(c.mes.cupos.llevamos.etiquetas).not.toContain("Parcial");
    expect(cifrasDelNorte({ ...e, datos: { ...e.datos, cohorte: null } }).cohorte).toBeNull();
  });
  it("no muta la entrada ni escribe jerga o puntos repetidos; sin lista probada no hay evidencia", () => {
    const e = entrada();
    const antes = structuredClone(e);
    const c = cifrasDelNorte(e);
    expect(e).toEqual(antes);
    for (const h of [c.mes, c.cohorte!]) for (const unidad of [h.cupos, h.usd]) for (const cifra of Object.values(unidad)) {
      if (!cifra) continue;
      expect(cifra.explicacion.evidencia).toBeNull();
      expect(JSON.stringify(cifra)).not.toMatch(/\.\.|utm_|ADR|periodo [AB]\b|NaN|undefined/);
    }
  });
});
