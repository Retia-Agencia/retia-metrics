import { z } from "zod";

/** Valor en USD escrito por el closer. Cero significa que todavía no lo definió. */
export const esquemaValorVendidoUsd = z
  .number({ error: "El valor vendido debe ser un número." })
  .min(0, "El valor vendido no puede ser negativo.")
  .multipleOf(0.01, "El valor vendido admite máximo dos decimales.")
  .lt(100_000_000, "El valor vendido debe ser menor que USD 100.000.000,00.")
  .nullable()
  .transform((valor) => (valor === 0 ? null : valor));

export const esquemaValorVendidoUsdOpcional = esquemaValorVendidoUsd.optional();
