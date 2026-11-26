import { describe, expect, it } from "vitest";
import {
  elegirRapidos,
  textoDePendientesDeCloser,
  type DealConPendientes,
  type PendienteDeDeal,
} from "@/lib/pendientes-de-closer/texto";

function deal(n: number, pendientes: PendienteDeDeal[] = [{ tipo: "sin_resultado", fecha: `2026-11-${String(n + 1).padStart(2, "0")}` }]): DealConPendientes {
  const tactical = n % 2 === 0;
  return {
    dealId: `deal-${n}`,
    nombreLead: `Lead Completo ${n}`,
    programa: tactical ? "Tactical" : "Comunicarte",
    programSlug: tactical ? "tactical" : "comunicarte",
    url: `https://crm.retia.co/p/${tactical ? "tactical" : "comunicarte"}/deals/deal-${n}`,
    fechaUrgencia: new Date(`2026-11-${String(n + 1).padStart(2, "0")}T10:00:00-05:00`),
    pendientes,
  };
}

const base = {
  nombreCloser: "Andrea Pérez",
  ventana: "manana" as const,
  citasAntiguas: 0,
  enlaces: [{ programa: "Tactical", url: "https://crm.retia.co/mi-espacio?programa=tactical&chip=sin_resultado" }],
};

describe("elegirRapidos", () => {
  it("toma uno por tipo en el orden acordado y el más reciente de cada tipo", () => {
    const elegidos = elegirRapidos([
      deal(0, [{ tipo: "sin_resultado", fecha: "2026-11-01" }]),
      deal(1, [{ tipo: "sin_resultado", fecha: "2026-11-12" }]),
      deal(2, [{ tipo: "sin_comprobante", fecha: "2026-11-02" }]),
      deal(3, [{ tipo: "sin_grain", fecha: "2026-11-03" }]),
      deal(4, [{ tipo: "vencidos", fecha: "2026-11-04", detalle: "seguimiento" }]),
      deal(5, [{ tipo: "reagenda", fecha: "2026-11-05" }]),
      deal(6, [{ tipo: "nuevos", fecha: "2026-11-06" }]),
    ], 6);
    expect(elegidos.map((x) => x.pendiente.tipo)).toEqual([
      "sin_resultado", "sin_comprobante", "sin_grain", "vencidos", "reagenda", "nuevos",
    ]);
    expect(elegidos[0].deal.dealId).toBe("deal-1");
  });

  it("completa cinco desde un solo tipo cuando faltan los demás", () => {
    const elegidos = elegirRapidos(Array.from({ length: 7 }, (_, i) => deal(i)));
    expect(elegidos).toHaveLength(5);
    expect(elegidos.map((x) => x.deal.dealId)).toEqual(["deal-6", "deal-5", "deal-4", "deal-3", "deal-2"]);
  });

  it("nunca repite un deal aunque tenga varios tipos", () => {
    const elegidos = elegirRapidos([
      deal(0, [{ tipo: "sin_resultado", fecha: "2026-11-10" }, { tipo: "sin_comprobante", fecha: "2026-11-11" }]),
      deal(1, [{ tipo: "sin_grain", fecha: "2026-11-10" }]),
      deal(2, [{ tipo: "vencidos", fecha: "2026-11-10", detalle: "cartera" }]),
      deal(3, [{ tipo: "reagenda", fecha: "2026-11-10" }]),
      deal(4, [{ tipo: "nuevos", fecha: "2026-11-10" }]),
    ]);
    expect(new Set(elegidos.map((x) => x.deal.dealId)).size).toBe(5);
  });

  it("devuelve menos de cinco solo cuando hay menos deals", () => {
    expect(elegirRapidos([deal(0), deal(1)])).toHaveLength(2);
  });
});

describe("texto de registros pendientes de la mañana", () => {
  it("muestra cinco acciones rápidas con enlace directo y los conteos completos", () => {
    const texto = textoDePendientesDeCloser({ ...base, deals: Array.from({ length: 7 }, (_, i) => deal(i)), citasAntiguas: 3 });
    expect(texto).toContain("Andrea, hoy 5 acciones rápidas:");
    expect(texto).toContain("1) Lead Completo 6 (Tactical): marca cómo terminó la cita del");
    expect(texto).toContain("   https://crm.retia.co/p/tactical/deals/deal-6");
    expect(texto).toContain("Todo lo que tienes pendiente:\n• 10 citas sin resultado (3 de hace más de 7 días)");
    expect(texto).toContain("Verlos todos: https://crm.retia.co/mi-espacio?programa=tactical&chip=sin_resultado");
  });

  it("cuenta pendientes por tipo, suma las citas antiguas y omite los tipos en cero", () => {
    const texto = textoDePendientesDeCloser({
      ...base,
      deals: [
        deal(0, [{ tipo: "sin_resultado", fecha: "2026-11-10" }, { tipo: "sin_comprobante", fecha: "2026-11-10" }]),
        deal(1, [{ tipo: "sin_resultado", fecha: "2026-11-11" }, { tipo: "sin_comprobante", fecha: "2026-11-11" }]),
      ],
      citasAntiguas: 3,
    });
    expect(texto).toContain("• 5 citas sin resultado (3 de hace más de 7 días)");
    expect(texto).toContain("• 2 abonos sin comprobante");
    expect(texto).not.toContain("llamadas sin Grain");
  });

  it("sin rápidos empieza en el resumen de citas antiguas", () => {
    const texto = textoDePendientesDeCloser({ ...base, deals: [], citasAntiguas: 2 });
    expect(texto.startsWith("Todo lo que tienes pendiente:\n• 2 citas sin resultado (2 de hace más de 7 días)")).toBe(true);
    expect(texto).not.toContain("rápidos");
  });

  it("distingue el enlace único de los enlaces de varios programas", () => {
    const uno = textoDePendientesDeCloser({ ...base, deals: [deal(0)] });
    expect(uno).toContain("Verlos todos: https://crm.retia.co/mi-espacio?programa=tactical&chip=sin_resultado");
    const varios = textoDePendientesDeCloser({
      ...base,
      deals: [deal(0), deal(1)],
      enlaces: [
        { programa: "Tactical", url: "https://x?programa=tactical&chip=sin_comprobante" },
        { programa: "Comunicarte", url: "https://x?programa=comunicarte&chip=vencidos" },
      ],
    });
    expect(varios).toContain("Verlos todos en Tactical: https://x?programa=tactical&chip=sin_comprobante");
    expect(varios).toContain("Verlos todos en Comunicarte: https://x?programa=comunicarte&chip=vencidos");
  });
});
