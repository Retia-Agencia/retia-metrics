import { beforeEach, describe, expect, it, vi } from "vitest";
import type { JWT } from "@auth/core/jwt";

/**
 * S-02 — quitar a alguien lo saca en el SIGUIENTE request, no cuando expire su JWT.
 *
 * Esta garantia estuvo escrita en el handoff como "no testeable sin extraerla de
 * Auth.js" desde el 6 de septiembre. Lo unico que la volvia intocable era que los
 * callbacks eran funciones anonimas dentro de `NextAuth({...})`; el ticket 015 las
 * movio a `lib/auth/revalidacion.ts` sin cambiar una sola regla, y aca se muerden.
 *
 * La mitad operativa (que `npm run usuarios -- quitar` deje la fila en activo=false
 * sin borrarla) se verifico a mano contra la rama `dev` el 20-sep.
 *
 * Lo que NO cubre este archivo, dicho de frente: que Auth.js llame al callback `jwt`
 * en cada emision. Eso es conducta de la estrategia `jwt` y solo lo comprueba un
 * recorrido real con sesion abierta.
 */

const select = vi.fn();
vi.mock("@/lib/db", () => ({ db: { select } }));

/** Deja la consulta de `buscarUsuario` devolviendo la fila que se le pase (o ninguna). */
function enLaBase(fila: Record<string, unknown> | null) {
  select.mockReturnValue({
    from: () => ({ where: () => ({ limit: async () => (fila ? [fila] : []) }) }),
  });
}

const activo = {
  id: "u-1",
  email: "andrea@retia.co",
  rol: "closer",
  closerId: "Andrea",
  activo: true,
};

beforeEach(() => {
  select.mockReset();
});

describe("revalidarToken", () => {
  it("un usuario activo queda con su id, su rol y su closerId en el token", async () => {
    enLaBase(activo);
    const { revalidarToken } = await import("@/lib/auth/revalidacion");

    const token = await revalidarToken({ email: "andrea@retia.co" } as JWT);

    expect(token.usuarioId).toBe("u-1");
    expect(token.rol).toBe("closer");
    expect(token.closerId).toBe("Andrea");
  });

  /** El corazon de S-02. */
  it("a quien quedo inactivo se le vacia el token, aunque su JWT siga vigente", async () => {
    enLaBase({ ...activo, activo: false });
    const { revalidarToken } = await import("@/lib/auth/revalidacion");

    const token = await revalidarToken({
      email: "andrea@retia.co",
      usuarioId: "u-1",
      rol: "closer",
      closerId: "Andrea",
    } as JWT);

    expect(token.usuarioId).toBeUndefined();
    expect(token.rol).toBeUndefined();
    expect(token.closerId).toBeUndefined();
  });

  it("a quien ya no esta en la tabla tambien", async () => {
    enLaBase(null);
    const { revalidarToken } = await import("@/lib/auth/revalidacion");

    const token = await revalidarToken({
      email: "borrado@retia.co",
      usuarioId: "u-9",
      rol: "gerente",
    } as JWT);

    expect(token.usuarioId).toBeUndefined();
    expect(token.rol).toBeUndefined();
  });

  /**
   * Un rol que la base no reconoce NO puede caer en un rol con mas permisos. Cae al
   * mas estrecho, que es `closer`, y no revienta.
   */
  it("un rol invalido en la base cae a closer, no a gerente ni a developer", async () => {
    enLaBase({ ...activo, rol: "superadmin" });
    const { revalidarToken } = await import("@/lib/auth/revalidacion");

    const token = await revalidarToken({ email: "andrea@retia.co" } as JWT);

    expect(token.rol).toBe("closer");
  });

  it("un token sin correo se devuelve tal cual y no consulta la base", async () => {
    const { revalidarToken } = await import("@/lib/auth/revalidacion");

    const token = await revalidarToken({} as JWT);

    expect(token).toEqual({});
    expect(select).not.toHaveBeenCalled();
  });

  /** El correo del login gana sobre el del token: es el de la emision en curso. */
  it("el correo del login manda sobre el que traiga el token", async () => {
    enLaBase(activo);
    const { revalidarToken } = await import("@/lib/auth/revalidacion");

    const token = await revalidarToken({ email: "viejo@retia.co" } as JWT, "andrea@retia.co");

    expect(token.usuarioId).toBe("u-1");
  });

  it("el correo se normaliza antes de buscar: mayusculas y espacios no crean otro usuario", async () => {
    enLaBase(activo);
    const { revalidarToken } = await import("@/lib/auth/revalidacion");

    const token = await revalidarToken({ email: "  Andrea@Retia.CO  " } as JWT);

    expect(token.usuarioId).toBe("u-1");
  });
});

describe("puedeIniciarSesion", () => {
  it("deja entrar a quien esta en la tabla y activo", async () => {
    enLaBase(activo);
    const { puedeIniciarSesion } = await import("@/lib/auth/revalidacion");
    expect(await puedeIniciarSesion("andrea@retia.co")).toBe(true);
  });

  it("no deja entrar a quien fue quitado", async () => {
    enLaBase({ ...activo, activo: false });
    const { puedeIniciarSesion } = await import("@/lib/auth/revalidacion");
    expect(await puedeIniciarSesion("andrea@retia.co")).toBe(false);
  });

  /** No hay auto-registro: una cuenta de Google valida que no este en la tabla no entra. */
  it("no deja entrar a un correo que no esta en la tabla, aunque Google lo autentique", async () => {
    enLaBase(null);
    const { puedeIniciarSesion } = await import("@/lib/auth/revalidacion");
    expect(await puedeIniciarSesion("cualquiera@gmail.com")).toBe(false);
  });

  it("sin correo no entra, y no consulta la base", async () => {
    const { puedeIniciarSesion } = await import("@/lib/auth/revalidacion");
    expect(await puedeIniciarSesion(null)).toBe(false);
    expect(select).not.toHaveBeenCalled();
  });
});
