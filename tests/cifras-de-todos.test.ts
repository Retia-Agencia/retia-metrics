import { describe, expect, it } from "vitest";
import { cifrasDeConteosDeTodos, cifrasDeTasasDeUnPrograma, contextoDeTodos, NOMBRE_DE_TODOS } from "@/lib/hub/cifras-de-todos";
import { explicacionesDeConteosDeTodos, explicacionesDeTasasDeTodos } from "@/lib/hub/explicaciones-de-todos";
import type { DetalleDeCifra } from "@/lib/queries/vista-metrica";
import type { FilaDePrograma, VistaDeTodos } from "@/lib/queries/vista-todos";

/** 419 E-4: `/hub` como Cifras. Los totales son sumas de conteos; las tasas van una por programa y nunca se combinan. */

const conteo = (valor: number) => ({ tipo: "conteo" as const, valor });
const totales = (n: number) => ({ leads: conteo(n), agendas: conteo(n + 1), shows: conteo(n + 2), cierres: conteo(n + 3) });
const detalle = (cantidad: number): DetalleDeCifra => ({
  resumen: { programId: "todos", disponible: true, subtotal: { cantidad, caja: [] }, grupos: [] },
  desgloses: { porCloser: [], porEtapa: [], porAntiguedad: [] }, href: "/hub/lista?metrica=x", fotoDeHoy: false,
});
const vista = {
  periodo: { a: { desde: "2026-11-01", hasta: "2026-11-10" }, b: null, preset: "custom" },
  a: totales(10), b: totales(5),
  detalles: { leads: detalle(10), agendas: detalle(11), shows: detalle(12), cierres: detalle(13) },
} as unknown as VistaDeTodos;
const contexto = contextoDeTodos(vista, "2026-11-13");
const razon = (valor: number, base: number) => ({ valor, base, faltan: 0, motivo: undefined });
const fila = (nombre: string, show: number): Pick<FilaDePrograma, "programa" | "dashboard"> => ({
  programa: { id: nombre, slug: nombre, nombre } as FilaDePrograma["programa"],
  dashboard: {
    embudo: {
      razonShow: razon(show, 10), razonCierre: razon(0.2, 5),
      grupo: { conShow: 5, deals: 10, vendidos: 1, sinMarcar: 0, parcial: false, razonAgendaAVenta: razon(0.1, 10) },
    },
    anterior: null,
  },
} as unknown as Pick<FilaDePrograma, "programa" | "dashboard">);

describe("419 E-4: /hub como Cifras", () => {
  it("los conteos son una Cifra de total por concepto, con su lista y la nota de que es una suma", () => {
    const cifras = cifrasDeConteosDeTodos({ vista, referencia: "el periodo anterior", explicaciones: explicacionesDeConteosDeTodos(), contexto });
    expect(cifras.map((c) => c.concepto)).toEqual(["leads", "citas", "shows", "ventas"]);
    expect(cifras.map((c) => c.textoDelValor)).toEqual(["10", "11", "12", "13"]);
    for (const c of cifras) {
      expect(c.explicacion.filtros).toContainEqual(["Programa", NOMBRE_DE_TODOS]);
      expect(c.explicacion.lectura.map(([nombre]) => nombre)).toContain("Suma de programas");
      expect(c.explicacion.evidencia?.href).toBe("/hub/lista?metrica=x");
      expect(c.comparacion?.texto).toBe("el periodo anterior");
    }
  });

  it("sin periodo de comparación no hay comparación", () => {
    const sinB = { ...vista, b: null } as unknown as VistaDeTodos;
    const [leads] = cifrasDeConteosDeTodos({ vista: sinB, referencia: "el periodo anterior", explicaciones: explicacionesDeConteosDeTodos(), contexto, conceptos: ["leads"] });
    expect(leads.comparacion).toBeNull();
  });

  it("las tasas son una Cifra por programa, con el nombre del programa y sin combinar", () => {
    const explicaciones = explicacionesDeTasasDeTodos();
    const a = cifrasDeTasasDeUnPrograma({ fila: fila("ComunicArte", 0.6), explicaciones, contexto });
    const b = cifrasDeTasasDeUnPrograma({ fila: fila("Tactical Investor", 0.4), explicaciones, contexto });
    expect(a.asistencia.explicacion.filtros).toContainEqual(["Programa", "ComunicArte"]);
    expect(b.asistencia.explicacion.filtros).toContainEqual(["Programa", "Tactical Investor"]);
    expect(a.asistencia.valor).toBe(0.6);
    expect(b.asistencia.valor).toBe(0.4);
    expect(b.cierreDeVentas.universo).toBe("todas");
  });
});
