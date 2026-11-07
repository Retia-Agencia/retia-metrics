import { describe, expect, it } from "vitest";
import { ROLES, puedeVerFichaDeLead, puedeVerOperacion } from "@/lib/auth/roles";

describe("capacidades de operación", () => {
  it.each(ROLES)("resuelve las capacidades de %s y deja pasar siempre al developer", (rol) => {
    const operacion = rol === "gerente" || rol === "closer" || rol === "developer";
    const fichaLead = operacion || rol === "customer_success";
    expect(puedeVerOperacion(rol)).toBe(operacion);
    expect(puedeVerFichaDeLead(rol)).toBe(fichaLead);
  });
});
