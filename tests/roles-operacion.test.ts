import { describe, expect, it } from "vitest";
import { ROLES, puedeConectarIa, puedeCrearTokenPersonal, puedeVerFichaDeLead, puedeVerOperacion } from "@/lib/auth/roles";

describe("capacidades de operación", () => {
  it.each(ROLES)("resuelve las capacidades de %s y deja pasar siempre al developer", (rol) => {
    const operacion = rol === "gerente" || rol === "closer" || rol === "developer";
    const fichaLead = operacion || rol === "customer_success";
    expect(puedeVerOperacion(rol)).toBe(operacion);
    expect(puedeVerFichaDeLead(rol)).toBe(fichaLead);
  });

  it.each(ROLES)("permite a %s gestionar sus conexiones", (rol) => {
    expect(puedeConectarIa(rol)).toBe(true);
    expect(puedeCrearTokenPersonal(rol)).toBe(rol === "developer");
  });
});
