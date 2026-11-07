import { describe, expect, it } from "vitest";
import { capacidadParaMetrica } from "@/lib/queries/metricas-con-filas";

describe("capacidad compartida de las listas de métricas", () => {
  it.each([
    ["pauta_meta", false, ["gerente", "developer", "paid_trafficker"]],
    ["registros", false, ["gerente", "developer", "paid_trafficker"]],
    ["agendas_creadas", false, ["gerente", "developer", "paid_trafficker"]],
    ["escalera", true, ["gerente", "developer", "paid_trafficker"]],
    ["no_agendaron", false, ["gerente", "closer", "developer"]],
    ["caja", false, ["gerente", "developer"]],
  ] as const)("%s usa la capacidad de la página", (metrica, tieneOrigen, permitidos) => {
    const capacidad = capacidadParaMetrica({ metrica, tieneOrigen });
    for (const rol of ["gerente", "closer", "developer", "paid_trafficker", "customer_success", "media"] as const) {
      expect(capacidad(rol)).toBe((permitidos as readonly string[]).includes(rol));
    }
  });
});
