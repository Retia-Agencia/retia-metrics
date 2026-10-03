import { describe, expect, it } from "vitest";
import {
  esquemaProximoContacto,
  proximoContactoSugerido,
  proximoContactoVencido,
} from "@/lib/deals/proximo-contacto";
import { hoyEnBogota } from "@/lib/format";

describe("próximo contacto", () => {
  it("sugiere dos días hábiles y salta el fin de semana", () => {
    expect(proximoContactoSugerido("2026-10-02")).toBe("2026-10-06");
  });

  it("rechaza hoy y el pasado; acepta una fecha futura", () => {
    expect(esquemaProximoContacto.safeParse("2000-01-01").success).toBe(false);
    expect(esquemaProximoContacto.safeParse(hoyEnBogota()).success).toBe(false);
    expect(esquemaProximoContacto.safeParse("2999-01-01").success).toBe(true);
  });

  it("solo está vencido con pendiente de seguimiento y fecha anterior a hoy", () => {
    expect(proximoContactoVencido({ pendiente: "seguimiento", fechaSeguimiento: "2026-10-02" }, "2026-10-03")).toBe(true);
    expect(proximoContactoVencido({ pendiente: "seguimiento", fechaSeguimiento: "2026-10-03" }, "2026-10-03")).toBe(false);
    expect(proximoContactoVencido({ pendiente: "reagenda", fechaSeguimiento: "2026-10-02" }, "2026-10-03")).toBe(false);
    expect(proximoContactoVencido({ pendiente: "seguimiento", fechaSeguimiento: null }, "2026-10-03")).toBe(false);
  });
});
