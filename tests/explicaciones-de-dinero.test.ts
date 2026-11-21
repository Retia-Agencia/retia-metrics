import { describe, expect, it } from "vitest";
import { explicacionesDeDinero } from "@/lib/hub/explicaciones-de-dinero";
import { CONCEPTOS_DE_DINERO, cifrasDeDinero, cifrasPorCohorte } from "@/lib/hub/cifras-de-dinero";
import { explicacionDe } from "@/lib/metricas/explicacion";

const contexto = { programa: "Programa", cohorte: null, rango: { desde: "2026-09-01", hasta: "2026-11-14" }, hoy: "2026-11-14", closer: null };
const dinero = { ventas: 3, lineas: 4, vendido: 2391, recaudado: 0, porCobrar: 2391, sobrepago: 0, sinValorVendido: 0, sinSaldoCalculable: 0 };

describe("explicaciones de Dinero", () => {
  it("toma las seis fichas con todas las áreas, sin texto paralelo", () => {
    const explicaciones = explicacionesDeDinero();
    expect(Object.keys(explicaciones)).toEqual([...CONCEPTOS_DE_DINERO]);
    for (const clave of CONCEPTOS_DE_DINERO) {
      expect(explicaciones[clave]).toEqual(explicacionDe(clave, { universo: "todas", ...(clave === "entro_a_caja" ? { moneda: "usd" as const } : {}) }));
    }
    expect(explicaciones.por_cobrar.unidadesDePartes).toEqual(["usd", "usd"]);
  });

  it("conserva la línea base y explicita el cero sin abonos", () => {
    const cifras = cifrasDeDinero({ dinero, caja: [], explicaciones: explicacionesDeDinero(), contexto });
    expect([cifras.vendido.textoDelValor, cifras.recaudado.textoDelValor, cifras.porCobrar.textoDelValor]).toEqual(["USD 2.391,00", "USD 0,00", "USD 2.391,00"]);
    expect(cifras.entroACaja[0].textoDelValor).toBe("USD 0,00");
    expect(cifras.recaudado.linea?.cifra).toBe("0,0%");
    expect(cifras.vendido.explicacion.evidencia).toBeNull();
  });

  it("mantiene las monedas separadas y muestra parcial por concepto y por cohorte", () => {
    const parcial = { ...dinero, sinSaldoCalculable: 1 };
    const explicaciones = explicacionesDeDinero();
    const cifras = cifrasDeDinero({ dinero: parcial, caja: [{ moneda: "COP", total: 100 }, { moneda: "USD", total: 5 }], explicaciones, contexto });
    expect(cifras.entroACaja.map((c) => [c.unidad, c.valor])).toEqual([["cop", 100], ["usd", 5]]);
    expect(cifras.vendido.etiquetas).not.toContain("Parcial");
    expect(cifras.recaudado.etiquetas).toContain("Parcial");
    const [cohorte] = cifrasPorCohorte({ filas: [{ cohorteId: "cohorte", codigo: "C1", ventas: 3, contratadoUsd: 2391, dinero: parcial }], explicaciones, contexto });
    expect(cohorte.porCobrar.etiquetas).toContain("Parcial");
    expect(cohorte.ventas.valor).toBe(3);
  });
});
