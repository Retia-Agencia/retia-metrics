import { describe, expect, it } from "vitest";
import { conteo, dinero, sumarConteos, sumarDinero, tasa } from "@/lib/queries/agregado-programas";

describe("agregado entre programas", () => {
  it("suma conteos", () => {
    expect(sumarConteos([conteo(2), conteo(3)])).toEqual(conteo(5));
    expect(sumarConteos([])).toEqual(conteo(0));
  });

  it("agrupa dinero por moneda, sin convertirlo, y ordena las monedas", () => {
    expect(sumarDinero([])).toEqual([]);
    expect(sumarDinero([
      [dinero("USD", 10), dinero("COP", 2_000)],
      [dinero("USD", 7.5)],
    ])).toEqual([dinero("COP", 2_000), dinero("USD", 17.5)]);
  });

  it("no admite tasas ni arreglos mezclados en el tipo", () => {
    // @ts-expect-error ADR 0048: una tasa no se suma entre programas.
    sumarConteos([tasa(0.5), tasa(null)]);
    // @ts-expect-error ADR 0048: mezclar una tasa tampoco ensancha el contrato.
    sumarConteos([conteo(1), tasa(0.5)]);
    // @ts-expect-error ADR 0048: una tasa no es dinero.
    sumarDinero([[tasa(0.5)]]);
  });
});
