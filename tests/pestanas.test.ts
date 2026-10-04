import { describe, expect, it } from "vitest";
import { pestanaActiva, urlConSeccion } from "@/components/layout/pestana-activa";

const pestanas = [
  { id: "primera", total: 0 },
  { id: "segunda", total: 2 },
  { id: "tercera", total: 1 },
] as const;

describe("pestanaActiva", () => {
  it("conserva una pestaña pedida válida", () => {
    expect(pestanaActiva("tercera", pestanas)).toBe("tercera");
  });

  it("elige la primera con total cuando la pedida no existe", () => {
    expect(pestanaActiva("otra", pestanas)).toBe("segunda");
  });

  it("prefiere un valor por defecto válido", () => {
    expect(pestanaActiva(undefined, pestanas, "tercera")).toBe("tercera");
  });

  it("elige la primera cuando todos los totales están en cero", () => {
    expect(pestanaActiva(undefined, [{ id: "a", total: 0 }, { id: "b", total: 0 }])).toBe("a");
  });

  it("elige la primera cuando no hay totales", () => {
    expect(pestanaActiva(undefined, [{ id: "a" }, { id: "b" }])).toBe("a");
  });
});

describe("urlConSeccion", () => {
  it("conserva otros parámetros y sus valores repetidos al reemplazar la sección", () => {
    expect(urlConSeccion("/inbox", { seccion: "vieja", filtro: ["a", "b"], pagina: "2" }, "nueva"))
      .toBe("/inbox?filtro=a&filtro=b&pagina=2&seccion=nueva");
  });

  it("limpia los parámetros pedidos", () => {
    expect(urlConSeccion("/inbox", { seccion: "vieja", pagina: "2", filtro: "a" }, "nueva", { limpiar: ["pagina"] }))
      .toBe("/inbox?filtro=a&seccion=nueva");
  });

  it("quita la sección cuando el valor es null", () => {
    expect(urlConSeccion("/inbox", { seccion: "vieja" }, null)).toBe("/inbox");
  });

  it("permite cambiar el nombre del parámetro", () => {
    expect(urlConSeccion("/lista", { vista: "anterior", seccion: "leads" }, "tabla", { parametro: "vista" }))
      .toBe("/lista?seccion=leads&vista=tabla");
  });
});
