import { describe, it, expect } from "vitest";
import { resumenDelCambio, type CambioHecho } from "@/lib/deals/resumen-del-cambio";

const base: CambioHecho = {
  etapaAntes: "agendado",
  etapaDespues: "agendado",
  pendienteAntes: null,
  pendienteDespues: null,
};

describe("resumenDelCambio", () => {
  it("una etapa nueva se dice con su nombre del negocio", () => {
    expect(
      resumenDelCambio({ ...base, etapaAntes: "agendado", etapaDespues: "atendido" }),
    ).toEqual(["El deal pasó a Atendido."]);
  });

  it("un pendiente puesto con fecha la escribe con el formato del dominio", () => {
    expect(
      resumenDelCambio({
        ...base,
        pendienteDespues: "seguimiento",
        fechaPendiente: "2026-10-12",
      }),
    ).toEqual(["Quedó en Seguimiento hasta el 12 oct 2026."]);
  });

  it("un pendiente puesto sin fecha no inventa un día", () => {
    expect(
      resumenDelCambio({ ...base, pendienteDespues: "reagenda" }),
    ).toEqual(["Quedó en Re-agenda."]);
  });

  it("un pendiente quitado sin cambio de etapa se anuncia", () => {
    expect(
      resumenDelCambio({ ...base, pendienteAntes: "seguimiento", pendienteDespues: null }),
    ).toEqual(["Ya no está en Seguimiento."]);
  });

  it("una llamada creada se dice con su fecha y hora en Bogotá", () => {
    const instante = new Date("2026-10-14T15:00:00-05:00");
    expect(
      resumenDelCambio({ ...base, llamadaCreada: { fecha: instante } }),
    ).toEqual(["Se creó la llamada del 14 oct 2026, 15:00."]);
  });

  it("un abono registrado se dice con su monto y su moneda", () => {
    expect(
      resumenDelCambio({ ...base, abonoRegistrado: { monto: 750, moneda: "USD" } }),
    ).toEqual(["Se registró un abono de USD 750,00."]);
  });

  it("etapa y pendiente juntos salen en orden: primero la etapa, luego el pendiente", () => {
    expect(
      resumenDelCambio({
        ...base,
        etapaAntes: "agendado",
        etapaDespues: "atendido",
        pendienteDespues: "seguimiento",
        fechaPendiente: "2026-10-12",
      }),
    ).toEqual([
      "El deal pasó a Atendido.",
      "Quedó en Seguimiento hasta el 12 oct 2026.",
    ]);
  });

  it("solo una nota, sin cambio visible, confirma que se guardó", () => {
    expect(resumenDelCambio(base)).toEqual(["Anotación guardada."]);
  });
});
