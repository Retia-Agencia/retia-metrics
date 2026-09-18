import { describe, expect, it } from "vitest";
import { proyectarRol, esVistaValida, VISTA_POR_DEFECTO } from "@/lib/auth/vista";

/**
 * `proyectarRol` es la parte PURA de `rolDeVista` (sin cookie): dado el rol real y la
 * vista, con que rol se proyecta y se guarda. La regla dura del ticket 028 es que la
 * vista solo ESTRECHA, nunca ensancha.
 */
describe("proyectarRol (ticket 028)", () => {
  it("un developer se proyecta segun la vista", () => {
    expect(proyectarRol("developer", "todo")).toBe("developer");
    expect(proyectarRol("developer", "gerente")).toBe("gerente");
    expect(proyectarRol("developer", "closer")).toBe("closer");
  });

  it("un no-developer IGNORA la vista: devuelve su rol real (no ensancha)", () => {
    // Un closer con cualquier vista sigue siendo closer: no gana acceso de gerente.
    expect(proyectarRol("closer", "gerente")).toBe("closer");
    expect(proyectarRol("closer", "todo")).toBe("closer");
    expect(proyectarRol("closer", "closer")).toBe("closer");
    // Un gerente con cualquier vista sigue siendo gerente.
    expect(proyectarRol("gerente", "closer")).toBe("gerente");
    expect(proyectarRol("gerente", "todo")).toBe("gerente");
  });

  it("sin rol no hay proyeccion", () => {
    expect(proyectarRol(null, "gerente")).toBeNull();
  });

  it("la vista por defecto es 'todo', la mas ancha", () => {
    expect(VISTA_POR_DEFECTO).toBe("todo");
    expect(proyectarRol("developer", VISTA_POR_DEFECTO)).toBe("developer");
  });

  it("solo 'todo', 'gerente' y 'closer' son vistas validas", () => {
    expect(esVistaValida("todo")).toBe(true);
    expect(esVistaValida("gerente")).toBe(true);
    expect(esVistaValida("closer")).toBe(true);
    expect(esVistaValida("developer")).toBe(false); // no es un valor de la cookie
    expect(esVistaValida("")).toBe(false);
    expect(esVistaValida(undefined)).toBe(false);
  });
});
