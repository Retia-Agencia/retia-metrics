import { describe, expect, it } from "vitest";
import { puedeAcceder, esRolValido } from "@/lib/auth/roles";
import { navParaRol, rutaInicial } from "@/lib/nav";
import { authConfig } from "@/lib/auth/config";

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
  // Programas de prueba: slugs inventados, nunca los reales. La nav recibe los
  // programas como dato (salen de la base), no los conoce de antemano.
  const PROGRAMAS = [
    { slug: "programa-a", nombre: "Programa A" },
    { slug: "programa-b", nombre: "Programa B" },
  ] as const;

  it("el closer no ve las rutas de administracion exclusivas de gerente", () => {
    const rutas = navParaRol("closer", PROGRAMAS).map((i) => i.href);
    expect(rutas).not.toContain("/ajustes");
    expect(rutas).toContain("/mi-dia");
  });

  it("el closer si ve los dashboards de programa, desde ADR 0009", () => {
    const rutas = navParaRol("closer", PROGRAMAS).map((i) => i.href);
    expect(rutas).toContain("/programas/programa-a");
    expect(rutas).toContain("/programas/programa-b");
  });

  it("el gerente tambien ve los dashboards de programa", () => {
    const rutas = navParaRol("gerente", PROGRAMAS).map((i) => i.href);
    expect(rutas).toContain("/programas/programa-a");
    expect(rutas).toContain("/programas/programa-b");
  });

  it("ambos roles ven /productos (los closers tambien los administran, ADR 0016)", () => {
    const rutasCloser = navParaRol("closer", PROGRAMAS).map((i) => i.href);
    const rutasGerente = navParaRol("gerente", PROGRAMAS).map((i) => i.href);
    expect(rutasCloser).toContain("/productos");
    expect(rutasGerente).toContain("/productos");
  });

  it("ambos roles ven /recursos y ya no /documentos (ticket 023)", () => {
    const rutasCloser = navParaRol("closer", PROGRAMAS).map((i) => i.href);
    const rutasGerente = navParaRol("gerente", PROGRAMAS).map((i) => i.href);
    expect(rutasCloser).toContain("/recursos");
    expect(rutasGerente).toContain("/recursos");
    expect(rutasCloser).not.toContain("/documentos");
    expect(rutasGerente).not.toContain("/documentos");
  });

  it("un programa insertado en la lista aparece en la nav", () => {
    const conNuevo = [...PROGRAMAS, { slug: "programa-c", nombre: "Programa C" }];
    const rutas = navParaRol("gerente", conNuevo).map((i) => i.href);
    expect(rutas).toContain("/programas/programa-c");
  });

  it("el gerente no aterriza en la vista del closer", () => {
    expect(rutaInicial("gerente", "programa-a")).toBe("/programas/programa-a");
    expect(rutaInicial("closer", "programa-a")).toBe("/mi-dia");
  });

  it("un gerente sin programas activos aterriza en ajustes", () => {
    expect(rutaInicial("gerente", null)).toBe("/ajustes");
  });

  it("el developer ve la union de items: mi-dia, dashboards, productos, recursos y ajustes (ADR 0025)", () => {
    const rutas = navParaRol("developer", PROGRAMAS).map((i) => i.href);
    expect(rutas).toContain("/mi-dia");
    expect(rutas).toContain("/programas/programa-a");
    expect(rutas).toContain("/programas/programa-b");
    expect(rutas).toContain("/productos");
    expect(rutas).toContain("/recursos");
    expect(rutas).toContain("/ajustes");
  });

  it("Nerd Stats es SOLO del developer: ni gerente ni closer lo ven (ticket 025)", () => {
    expect(navParaRol("developer", PROGRAMAS).map((i) => i.href)).toContain("/nerd-stats");
    expect(navParaRol("gerente", PROGRAMAS).map((i) => i.href)).not.toContain("/nerd-stats");
    expect(navParaRol("closer", PROGRAMAS).map((i) => i.href)).not.toContain("/nerd-stats");
  });

  it("el developer aterriza en el primer programa, como el gerente (destino documentado)", () => {
    expect(rutaInicial("developer", "programa-a")).toBe("/programas/programa-a");
    // Sin programas activos, cae en ajustes: tiene acceso total de administracion.
    expect(rutaInicial("developer", null)).toBe("/ajustes");
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
    expect(navParaRol(null, [])).toEqual([]);
  });

  it("no hay destino dentro de la app: va al login", () => {
    expect(rutaInicial(null, null)).toBe("/login");
  });
});
