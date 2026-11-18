import { describe, expect, it } from "vitest";
import { cifrasDeTotalesDePauta, FILAS_SUMABLES_DE_PAUTA, type ProgramaConPautaSemanal } from "@/lib/hub/cifras-de-pauta-de-todos";
import { CONCEPTO_DE_PAUTA_SEMANAL } from "@/lib/metricas/pendientes";
import { fichaDe } from "@/lib/metricas/registro";
import type { ClavePautaSemanal } from "@/lib/queries/hechos/pauta-semanal";

/**
 * 422: la franja de totales de la Pauta de `/hub`. Solo suma lo que el ADR 0048 deja sumar, nunca cuenta como cero a un
 * programa sin dato y nunca combina una tasa.
 */

const celda = (valor: number | null) => ({ valor, cobertura: { estado: valor === null ? "sin_dato" : "ok", razon: null } });
const programa = (nombre: string, valores: Partial<Record<ClavePautaSemanal, number | null>>): ProgramaConPautaSemanal => ({
  programa: { nombre },
  semanal: {
    filas: (Object.entries(valores) as Array<[ClavePautaSemanal, number | null]>).map(([clave, valor]) => ({
      clave, celdas: { total: celda(valor), porColumna: [] },
    })),
  },
} as unknown as ProgramaConPautaSemanal);
const rango = { desde: "2026-11-01", hasta: "2026-11-10" };

describe("422: totales de Pauta en /hub", () => {
  it("suma cada fila en su unidad entre programas", () => {
    const [inversion, agendas, ventas, vendido] = cifrasDeTotalesDePauta({
      programas: [
        programa("ComunicArte", { inversion: 1_000_000, agendas: 4, ventas: 2, facturacion: 1000 }),
        programa("Tactical", { inversion: 500_000, agendas: 6, ventas: 1, facturacion: 250.5 }),
      ],
      rango, hoy: "2026-11-13",
    });
    expect([inversion.textoDelValor, agendas.textoDelValor, ventas.textoDelValor, vendido.textoDelValor])
      .toEqual(["COP 1.500.000", "10", "3", "USD 1.250,50"]);
    expect(inversion.explicacion.filtros).toContainEqual(["Programas", "ComunicArte, Tactical"]);
    expect(inversion.explicacion.lectura.map(([nombre]) => nombre)).toContain("Suma de programas");
    expect(inversion.etiquetas).toEqual([]);
  });

  it("un programa sin gasto no aporta cero: no suma, se nombra y la cifra queda Parcial", () => {
    const [inversion] = cifrasDeTotalesDePauta({
      programas: [programa("ComunicArte", { inversion: 750_000 }), programa("Tactical", { inversion: null })],
      rango, hoy: "2026-11-13",
    });
    expect(inversion.textoDelValor).toBe("COP 750.000");
    expect(inversion.etiquetas).toContain("Parcial");
    expect(inversion.explicacion.lectura).toContainEqual(["Parcial", "Tactical no tiene dato en el periodo y no suma."]);
  });

  it("si ningún programa tiene dato la cifra es «—» y dice por qué, no cero", () => {
    const [inversion] = cifrasDeTotalesDePauta({
      programas: [programa("A", { inversion: null }), programa("B", { inversion: null })], rango, hoy: "2026-11-13",
    });
    expect(inversion.textoDelValor).toBe("—");
    expect(inversion.vacio).toBe(true);
    expect(inversion.explicacion.lectura[0][1]).toContain("Ningún programa tiene gasto cargado");
  });

  it("solo hay filas que el registro marca como sumables entre programas (ninguna tasa)", () => {
    for (const clave of FILAS_SUMABLES_DE_PAUTA) {
      expect(fichaDe(CONCEPTO_DE_PAUTA_SEMANAL[clave]).sumaEntreProgramas, clave).toBe(true);
    }
    // Mordido: las tasas y los costos están registrados como NO sumables, así que no podrían entrar a la lista.
    for (const clave of ["show", "cierre_ventas", "agenda_venta", "roas", "costo_agenda_crm"] as const) {
      expect(fichaDe(CONCEPTO_DE_PAUTA_SEMANAL[clave]).sumaEntreProgramas, clave).toBe(false);
    }
  });
});
