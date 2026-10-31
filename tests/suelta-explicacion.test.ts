import { describe, expect, it } from "vitest";
import { explicarSuelta } from "@/lib/calendly/suelta";

const base = { motivo: "sin_lead" as const, correoInvitado: "ana@gmail.com", nombreInvitado: "Ana Pérez", cancelada: false, sugerencias: 0 };

describe("explicarSuelta", () => {
  it("correo distinto al del formulario con deal del mismo nombre: real y apunta a colgar", () => {
    const e = explicarSuelta({ ...base, sugerencias: 1 });
    expect(e.veredicto).toBe("real");
    expect(e.causa).toContain("distinto al del formulario");
    expect(e.queHacer).toContain("Colgar en");
  });
  it("correo o nombre de prueba: prueba", () => {
    expect(explicarSuelta({ ...base, correoInvitado: "test@example.com" }).veredicto).toBe("prueba");
    expect(explicarSuelta({ ...base, nombreInvitado: "Manuel TEST" }).veredicto).toBe("prueba");
  });
  it("cancelada manda sobre todo lo demas", () => {
    expect(explicarSuelta({ ...base, cancelada: true, correoInvitado: "test@example.com" }).veredicto).toBe("cancelada");
  });
  it("ante la duda es real, nunca prueba", () => {
    for (const motivo of ["sin_correo", "varios_leads", "sin_deal_abierto", "varios_deals_abiertos", null] as const) {
      expect(explicarSuelta({ ...base, motivo }).veredicto).toBe("real");
    }
  });
});
