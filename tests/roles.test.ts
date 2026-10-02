import { describe, expect, it } from "vitest";
import { puedeAcceder, esRolValido, trabajaLeads } from "@/lib/auth/roles";
import { navParaRol, programaDeRuta, rutaAlCambiarDePrograma, rutaInicial } from "@/lib/nav";
import { authConfig } from "@/lib/auth/config";

describe("trabajaLeads", () => {
  // Las tres preguntas de la familia son distintas y hay que poder contestarlas
  // distinto. Si alguien "simplifica" esta a `esAdministrador`, un gerente pasaria a
  // tener closer_id y membresias, y eso contradice el ADR 0003.
  it("el closer y el developer trabajan leads; el gerente no", () => {
    expect(trabajaLeads("closer")).toBe(true);
    expect(trabajaLeads("developer")).toBe(true);
    expect(trabajaLeads("gerente")).toBe(false);
  });

  it("sin rol no trabaja leads", () => {
    expect(trabajaLeads(null)).toBe(false);
    expect(trabajaLeads(undefined)).toBe(false);
  });
});

describe("puedeAcceder", () => {
  it("deja pasar al rol permitido", () => {
    expect(puedeAcceder("gerente", ["gerente"])).toBe(true);
    expect(puedeAcceder("closer", ["closer"])).toBe(true);
  });

  it("no hay herencia: gerente NO es closer con extras", () => {
    expect(puedeAcceder("closer", ["gerente"])).toBe(false);
    expect(puedeAcceder("gerente", ["closer"])).toBe(false);
  });

  it("el developer es la unica excepcion a la disjuncion: pasa toda ruta (ADR 0025)", () => {
    // Rutas exclusivas de gerente, exclusivas de closer y compartidas: en todas pasa.
    expect(puedeAcceder("developer", ["gerente"])).toBe(true);
    expect(puedeAcceder("developer", ["closer"])).toBe(true);
    expect(puedeAcceder("developer", ["gerente", "closer"])).toBe(true);
    // Aun sin permitidos declarados, un developer entra (acceso total).
    expect(puedeAcceder("developer", [])).toBe(true);
  });

  it("sin rol no pasa nada", () => {
    expect(puedeAcceder(undefined, ["gerente", "closer"])).toBe(false);
    expect(puedeAcceder(null, ["closer"])).toBe(false);
  });

  it("valida el rol que viene del token", () => {
    expect(esRolValido("gerente")).toBe(true);
    expect(esRolValido("developer")).toBe(true);
    expect(esRolValido("admin")).toBe(false);
    expect(esRolValido(undefined)).toBe(false);
  });
});

describe("navegacion por rol", () => {
  // La nav recibe el programa ELEGIDO como dato (sale de la URL o del primero visible),
  // no los conoce de antemano: slugs inventados, nunca los reales.
  const PROGRAMA = "programa-a";
  const rutasDe = (rol: Parameters<typeof navParaRol>[0], programa: string | null = PROGRAMA) =>
    navParaRol(rol, programa).map((i) => i.href);

  it("el closer no ve las rutas de administracion exclusivas de gerente", () => {
    // `/nerd-stats` es la unica ruta exclusiva que queda en la nav (ticket 025).
    expect(rutasDe("closer")).not.toContain("/nerd-stats");
    expect(rutasDe("closer")).toContain("/mi-dia");
  });

  it("los tres roles ven /ajustes desde el 20-sep (enmienda del ticket 013)", () => {
    for (const rol of ["gerente", "closer", "developer"] as const) {
      expect(rutasDe(rol)).toContain("/ajustes");
    }
  });

  it("los tres roles ven la tab Dashboard del programa elegido (ADR 0050)", () => {
    for (const rol of ["gerente", "closer", "developer"] as const) {
      expect(rutasDe(rol)).toContain("/p/programa-a/dashboard");
    }
  });

  it("la tab Dashboard apunta al programa que se le pasa, no a uno fijo", () => {
    expect(rutasDe("gerente", "programa-b")).toContain("/p/programa-b/dashboard");
    expect(rutasDe("gerente", "programa-b")).not.toContain("/p/programa-a/dashboard");
  });

  it("los roles operativos ven la tab Calls del programa elegido (ticket 098)", () => {
    for (const rol of ["gerente", "closer", "developer"] as const) {
      expect(rutasDe(rol)).toContain("/p/programa-a/calls");
    }
  });

  it("los roles operativos ven la tab Leads del programa elegido (ticket 072)", () => {
    for (const rol of ["gerente", "closer", "developer"] as const) {
      expect(rutasDe(rol)).toContain("/p/programa-a/leads");
    }
  });

  it("los roles operativos ven la tab Students del programa elegido (ticket 099)", () => {
    for (const rol of ["gerente", "closer", "developer"] as const) {
      expect(rutasDe(rol)).toContain("/p/programa-a/students");
    }
  });

  it("sin programa visible no hay tabs de programa", () => {
    expect(rutasDe("closer", null).some((r) => r.startsWith("/p/"))).toBe(false);
    expect(rutasDe("closer", null)).toContain("/ajustes");
  });

  it("la barra ya no lleva un item por programa (ADR 0050)", () => {
    expect(rutasDe("gerente").some((r) => r.startsWith("/programas/"))).toBe(false);
  });

  it("los tres roles ven /personas, la puerta al historial (18-sep)", () => {
    // El gerente es el caso que motivo la ruta: podia abrir `/personas/[id]` y no
    // tenia como llegar, porque el unico enlace vivia en `/mi-dia`.
    for (const rol of ["gerente", "closer", "developer"] as const) {
      expect(rutasDe(rol)).toContain("/personas");
    }
  });

  it("ambos roles ven /recursos y ya no /documentos (ticket 023)", () => {
    for (const rol of ["gerente", "closer"] as const) {
      expect(rutasDe(rol)).toContain("/recursos");
      expect(rutasDe(rol)).not.toContain("/documentos");
    }
  });

  it("el gerente aterriza en el Dashboard del primer programa; el closer en el Inbox de su primer programa (ticket 071)", () => {
    expect(rutaInicial("gerente", "programa-a")).toBe("/p/programa-a/dashboard");
    expect(rutaInicial("closer", "programa-a")).toBe("/p/programa-a/inbox");
  });

  it("un gerente sin programas activos aterriza en ajustes", () => {
    expect(rutaInicial("gerente", null)).toBe("/ajustes");
  });

  it("un closer sin programas visibles cae en /mi-dia de respaldo (ticket 071)", () => {
    expect(rutaInicial("closer", null)).toBe("/mi-dia");
  });

  it("el developer ve la union de items: mi-dia, dashboard, recursos y ajustes (ADR 0025)", () => {
    const rutas = rutasDe("developer");
    expect(rutas).toContain("/mi-dia");
    expect(rutas).toContain("/p/programa-a/dashboard");
    expect(rutas).not.toContain("/productos");
    expect(rutas).toContain("/recursos");
    expect(rutas).toContain("/ajustes");
  });

  it("el gerente no ve Mi dia: no trabaja leads (ADR 0003)", () => {
    expect(rutasDe("gerente")).not.toContain("/mi-dia");
  });

  it("Nerd Stats es SOLO del developer: ni gerente ni closer lo ven (ticket 025)", () => {
    expect(rutasDe("developer")).toContain("/nerd-stats");
    expect(rutasDe("gerente")).not.toContain("/nerd-stats");
    expect(rutasDe("closer")).not.toContain("/nerd-stats");
  });

  it("el developer aterriza en el Dashboard del primer programa, como el gerente", () => {
    expect(rutaInicial("developer", "programa-a")).toBe("/p/programa-a/dashboard");
    // Sin programas activos, cae en ajustes: tiene acceso total de administracion.
    expect(rutaInicial("developer", null)).toBe("/ajustes");
  });
});

describe("el programa en la URL (ticket 097)", () => {
  it("lee el programa de una ruta /p/<slug>/..., y nada de las demas", () => {
    expect(programaDeRuta("/p/programa-a/dashboard")).toBe("programa-a");
    expect(programaDeRuta("/p/programa-a")).toBe("programa-a");
    expect(programaDeRuta("/p")).toBeNull();
    expect(programaDeRuta("/ajustes/programas/programa-a")).toBeNull();
    expect(programaDeRuta("/programas/programa-a")).toBeNull();
  });

  it("cambiar de programa mantiene la tab y cambia la URL", () => {
    expect(rutaAlCambiarDePrograma("/p/programa-a/dashboard", "programa-b")).toBe(
      "/p/programa-b/dashboard",
    );
  });

  it("suelta lo que venga detras de la tab: un id es del programa anterior", () => {
    expect(rutaAlCambiarDePrograma("/p/programa-a/dashboard/algo", "programa-b")).toBe(
      "/p/programa-b/dashboard",
    );
  });

  it("desde una ruta sin programa, o una tab que no existe, entra por la tab por defecto", () => {
    expect(rutaAlCambiarDePrograma("/ajustes", "programa-b")).toBe("/p/programa-b/dashboard");
    expect(rutaAlCambiarDePrograma("/p/programa-a/inventada", "programa-b")).toBe(
      "/p/programa-b/dashboard",
    );
  });
});

/**
 * S-03: el callback `session` traducia un token vaciado a rol "closer". La app
 * quedaba segura por el `id` vacio, no por el rol, y cualquier codigo futuro que
 * decidiera sobre `rol` sin mirar antes el `id` habria tratado a un token vaciado
 * como a un closer legitimo.
 */
describe("callback session", () => {
  const sesion = () =>
    ({ user: { id: "x", rol: "closer", closerId: null }, expires: "" }) as never;

  const llamar = (token: Record<string, unknown>) =>
    // El callback es sincrono y puro; el cast evita armar el union de parametros
    // completo de Auth.js, que no aporta nada a lo que se esta probando.
    (authConfig.callbacks.session as (p: never) => { user: { id: string; rol: string | null } })(
      { session: sesion(), token } as never,
    );

  it("un token vaciado deja el rol nulo, no closer", () => {
    const s = llamar({});
    expect(s.user.rol).toBeNull();
    expect(s.user.id).toBe("");
  });

  it("un rol que no esta en el enum tampoco degrada a closer", () => {
    const s = llamar({ usuarioId: "u1", rol: "admin" });
    expect(s.user.rol).toBeNull();
  });

  it("un token valido conserva su rol", () => {
    const s = llamar({ usuarioId: "u1", rol: "gerente" });
    expect(s.user.rol).toBe("gerente");
    expect(s.user.id).toBe("u1");
  });
});

describe("fallar cerrado sin rol", () => {
  it("no se muestra ningun item de navegacion", () => {
    expect(navParaRol(null, null)).toEqual([]);
  });

  it("no hay destino dentro de la app: va al login", () => {
    expect(rutaInicial(null, null)).toBe("/login");
  });
});
