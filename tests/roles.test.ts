import { describe, expect, it } from "vitest";
import { puedeAcceder, esRolValido } from "@/lib/auth/roles";
import { navParaRol, rutaInicial } from "@/lib/nav";

describe("puedeAcceder", () => {
  it("deja pasar al rol permitido", () => {
    expect(puedeAcceder("gerente", ["gerente"])).toBe(true);
    expect(puedeAcceder("closer", ["closer"])).toBe(true);
  });

  it("no hay herencia: gerente NO es closer con extras", () => {
    expect(puedeAcceder("closer", ["gerente"])).toBe(false);
    expect(puedeAcceder("gerente", ["closer"])).toBe(false);
  });

  it("sin rol no pasa nada", () => {
    expect(puedeAcceder(undefined, ["gerente", "closer"])).toBe(false);
    expect(puedeAcceder(null, ["closer"])).toBe(false);
  });

  it("valida el rol que viene del token", () => {
    expect(esRolValido("gerente")).toBe(true);
    expect(esRolValido("admin")).toBe(false);
    expect(esRolValido(undefined)).toBe(false);
  });
});

describe("navegacion por rol", () => {
  it("el closer no ve ningun item de gerente", () => {
    const rutas = navParaRol("closer").map((i) => i.href);
    expect(rutas).not.toContain("/comunicarte");
    expect(rutas).not.toContain("/tactical-investor");
    expect(rutas).not.toContain("/ajustes");
    expect(rutas).toContain("/mi-dia");
  });

  it("el gerente no aterriza en la vista del closer", () => {
    expect(rutaInicial("gerente")).toBe("/comunicarte");
    expect(rutaInicial("closer")).toBe("/mi-dia");
  });
});
