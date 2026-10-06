import { describe, expect, it } from "vitest";
import { sinListas, type DetalleDeCifra } from "@/lib/queries/vista-metrica";

/**
 * Ticket 102: el paid trafficker ve las cifras del Dashboard pero no la lista que hay detrás ni el
 * desglose por closer. `sinListas` lo proyecta en el servidor, donde sea que esté anidado el detalle.
 */

function detalle(cantidad: number): DetalleDeCifra {
  return {
    resumen: {
      programId: "p-1",
      disponible: true,
      subtotal: { cantidad, caja: [{ moneda: "USD", total: 10 }] },
      grupos: [{ closer: "Ana", claveCloser: "u-ana", etapa: "atendido", bucket: "0-7", moneda: null, monto: null, cantidad }],
    },
    desgloses: {
      porCloser: [{ etiqueta: "Ana", cantidad, caja: [] }],
      porEtapa: [{ etiqueta: "Atendido", cantidad, caja: [] }],
      porAntiguedad: [{ etiqueta: "0-7", cantidad, caja: [] }],
    },
    href: "/p/programa-a/dashboard/lista?metrica=agendas",
  };
}

describe("sinListas (ticket 102)", () => {
  it("conserva el número y quita la lista, los grupos y los desgloses", () => {
    const proyectado = sinListas(detalle(7));
    expect(proyectado.resumen.subtotal.cantidad).toBe(7);
    expect(proyectado.resumen.disponible).toBe(false);
    expect(proyectado.resumen.grupos).toEqual([]);
    expect(proyectado.desgloses).toEqual({ porCloser: [], porEtapa: [], porAntiguedad: [] });
    expect(proyectado.href).toBe("");
  });

  it("alcanza detalles anidados en registros y arreglos, y deja lo demás igual", () => {
    const entrada = {
      comparativo: { "u-ana": { agendas: detalle(3) } },
      semanas: [{ semana: { desde: "2026-09-28", hasta: "2026-10-02" }, creadas: detalle(2), pctNoShow: 0.5 }],
      disponible: true,
    };
    const salida = sinListas(entrada);
    expect(salida.comparativo["u-ana"].agendas.href).toBe("");
    expect(salida.semanas[0].creadas.resumen.grupos).toEqual([]);
    expect(salida.semanas[0].creadas.resumen.subtotal.cantidad).toBe(2);
    expect(salida.semanas[0].semana).toEqual({ desde: "2026-09-28", hasta: "2026-10-02" });
    expect(salida.semanas[0].pctNoShow).toBe(0.5);
    expect(salida.disponible).toBe(true);
    // Ningún nombre de closer sobrevive a la proyección.
    expect(JSON.stringify(salida)).not.toContain("Ana");
  });

  it("no toca la entrada", () => {
    const original = detalle(1);
    sinListas(original);
    expect(original.href).not.toBe("");
    expect(original.resumen.grupos).toHaveLength(1);
  });
});
