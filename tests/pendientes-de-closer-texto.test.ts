import { describe, expect, it } from "vitest";
import { textoDePendientesDeCloser, type DealConPendientes } from "@/lib/pendientes-de-closer/texto";

function deal(n: number): DealConPendientes {
  return {
    dealId: `deal-${n}`,
    nombreLead: `Lead Completo ${n}`,
    programa: n % 2 === 0 ? "Tactical" : "Comunicarte",
    etapa: "Agendado",
    fechaUrgencia: new Date(`2026-11-${String(n + 1).padStart(2, "0")}T10:00:00-05:00`),
    pendientes: [{ tipo: "sin_resultado", fecha: new Date(`2026-11-${String(n + 1).padStart(2, "0")}T10:00:00-05:00`) }],
  };
}

describe("texto de registros pendientes", () => {
  it("agrupa por deal, limita a ocho y anuncia los restantes y el atraso", () => {
    const texto = textoDePendientesDeCloser({
      nombreCloser: "Andrea Pérez",
      ventana: "manana",
      dia: "2026-11-14",
      deals: Array.from({ length: 10 }, (_, i) => deal(i)),
      citasAntiguas: 380,
      enlace: "https://crm.retia.co/mi-espacio?tab=notificaciones&chip=sin_resultado",
    });

    expect(texto).toContain("Andrea, te faltan 10 registros en 10 deals:");
    expect(texto).toContain("1) Lead Completo 0 · Tactical · Agendado");
    expect(texto).toContain("   • Cita del");
    expect(texto).toContain("lleva 13 días");
    expect(texto).toContain("(y 2 deals más en el CRM)");
    expect(texto).toContain("Además: 380 citas de hace más de 7 días siguen sin resultado.");
    expect(texto).not.toContain("9) Lead Completo 8");
  });

  it("la tarde solo enumera las citas y llamadas recibidas", () => {
    const texto = textoDePendientesDeCloser({
      nombreCloser: "Andrea Pérez",
      ventana: "tarde",
      dia: "2026-11-14",
      deals: [{
        ...deal(0),
        pendientes: [
          { tipo: "sin_resultado", fecha: new Date("2026-11-14T10:00:00-05:00") },
          { tipo: "sin_grain", fecha: new Date("2026-11-14T11:00:00-05:00") },
        ],
      }],
      citasAntiguas: 0,
      enlace: "https://crm.retia.co/mi-espacio",
    });
    expect(texto).toContain("Andrea, hoy tuviste 1 cita que sigue sin resultado: Lead Completo 0 (10:00)");
    expect(texto).toContain("Una llamada de hoy sigue sin link de Grain: Lead Completo 0.");
  });
});

describe("vencidos en el texto", () => {
  it("concuerda el género y omite la fecha cuando no la hay", () => {
    const base = { nombreCloser: "Juan", ventana: "manana" as const, dia: "2026-11-16", citasAntiguas: 0, enlace: "https://x" };
    const t = textoDePendientesDeCloser({
      ...base,
      deals: [{ ...deal(0), pendientes: [
        { tipo: "vencidos", fecha: null, detalle: "cartera" },
        { tipo: "vencidos", fecha: "2026-11-10", detalle: "compromiso" },
      ] }],
    });
    expect(t).toContain("• Cartera vencida");
    expect(t).not.toContain("fecha pendiente");
    expect(t).not.toContain("vencido desde el fecha");
    expect(t).toContain("• Compromiso de pago vencido desde el");
  });
});
