import { beforeEach, describe, expect, it, vi } from "vitest";
import { MapeoInvalidoError } from "@/lib/sheets/mapeo";

/**
 * La ruta de sincronizacion mueve datos reales: tiene que estar cerrada
 * igual que el resto de endpoints de gerente.
 */

const auth = vi.fn();
vi.mock("@/lib/auth", () => ({ auth }));

const sincronizarPersonas = vi.fn();
vi.mock("@/lib/sheets/sync", () => ({ sincronizarPersonas }));

const select = vi.fn();
vi.mock("@/lib/db", () => ({ db: { select } }));

const sesionCloser = { user: { id: "u-2", email: "closer@retia.co", rol: "closer", closerId: "andrea" } };
const sesionGerente = { user: { id: "u-1", email: "gerente@retia.co", rol: "gerente", closerId: null } };

const params = Promise.resolve({ programa: "comunicarte" });

beforeEach(() => {
  auth.mockReset();
  sincronizarPersonas.mockReset();
  select.mockReset();
});

describe("POST /api/sync/[programa]", () => {
  it("un closer no puede disparar la sincronizacion", async () => {
    auth.mockResolvedValue(sesionCloser);
    const { POST } = await import("@/app/api/sync/[programa]/route");
    const res = await POST(new Request("http://x"), { params });
    expect(res.status).toBe(403);
    expect(sincronizarPersonas).not.toHaveBeenCalled();
  });

  it("sin sesion tampoco", async () => {
    auth.mockResolvedValue(null);
    const { POST } = await import("@/app/api/sync/[programa]/route");
    const res = await POST(new Request("http://x"), { params });
    expect(res.status).toBe(401);
    expect(sincronizarPersonas).not.toHaveBeenCalled();
  });

  it("el gerente si dispara la sincronizacion", async () => {
    auth.mockResolvedValue(sesionGerente);
    select.mockReturnValue({
      from: () => ({ where: () => ({ limit: async () => [{ id: "p-1", slug: "comunicarte" }] }) }),
    });
    sincronizarPersonas.mockResolvedValue({ programa: "comunicarte", personasEnHoja: 1253 });
    const { POST } = await import("@/app/api/sync/[programa]/route");
    const res = await POST(new Request("http://x"), { params });
    expect(res.status).toBe(200);
    expect(sincronizarPersonas).toHaveBeenCalledWith("p-1");
  });

  /**
   * S-04: el catch filtraba por "el error no tiene status" en vez de por tipo, asi
   * que cualquier excepcion interna —el driver de Neon trae host y endpoint,
   * googleapis trae el spreadsheetId— salia entera al navegador con un 422.
   */
  it("un error interno del sync no sale al cliente", async () => {
    auth.mockResolvedValue(sesionGerente);
    select.mockReturnValue({
      from: () => ({ where: () => ({ limit: async () => [{ id: "p-1", slug: "comunicarte" }] }) }),
    });
    sincronizarPersonas.mockRejectedValue(
      new Error("connect ECONNREFUSED ep-cool-boat-123.us-east-2.aws.neon.tech:5432"),
    );
    const espia = vi.spyOn(console, "error").mockImplementation(() => {});

    const { POST } = await import("@/app/api/sync/[programa]/route");
    const res = await POST(new Request("http://x"), { params });

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Error interno." });
    espia.mockRestore();
  });

  it("pero el mapeo invalido si llega completo: es lo que hace falta para arreglarlo", async () => {
    auth.mockResolvedValue(sesionGerente);
    select.mockReturnValue({
      from: () => ({ where: () => ({ limit: async () => [{ id: "p-1", slug: "comunicarte" }] }) }),
    });
    sincronizarPersonas.mockRejectedValue(
      new MapeoInvalidoError("emailNormalizado", ["correo electronico"], ["Nombre", "Telefono"]),
    );

    const { POST } = await import("@/app/api/sync/[programa]/route");
    const res = await POST(new Request("http://x"), { params });

    expect(res.status).toBe(422);
    expect((await res.json()).error).toContain("emailNormalizado");
  });

  /**
   * B-03: el patron de validacion del proyecto. Un slug malformado es una peticion
   * invalida (400), no un recurso que no existe (404). La distincion importa cuando
   * la Fase 4 empiece a recibir cuerpos POST.
   */
  it("un programa malformado da 400, no 404 ni 500", async () => {
    auth.mockResolvedValue(sesionGerente);
    const { POST } = await import("@/app/api/sync/[programa]/route");
    const res = await POST(new Request("http://x"), {
      params: Promise.resolve({ programa: "../../etc/passwd" }),
    });

    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("slug");
    expect(sincronizarPersonas).not.toHaveBeenCalled();
  });

  it("un programa inexistente pero bien formado sigue dando 404", async () => {
    auth.mockResolvedValue(sesionGerente);
    select.mockReturnValue({
      from: () => ({ where: () => ({ limit: async () => [] }) }),
    });
    const { POST } = await import("@/app/api/sync/[programa]/route");
    const res = await POST(new Request("http://x"), {
      params: Promise.resolve({ programa: "programa-que-no-existe" }),
    });

    expect(res.status).toBe(404);
  });

  it("un programa inexistente da 404, no 500", async () => {
    auth.mockResolvedValue(sesionGerente);
    select.mockReturnValue({
      from: () => ({ where: () => ({ limit: async () => [] }) }),
    });
    const { POST } = await import("@/app/api/sync/[programa]/route");
    const res = await POST(new Request("http://x"), { params });
    expect(res.status).toBe(404);
    expect(sincronizarPersonas).not.toHaveBeenCalled();
  });
});

describe("GET /api/cron/sync", () => {
  const original = process.env.CRON_SECRET;
  beforeEach(() => { process.env.CRON_SECRET = "secreto-de-prueba"; });

  it("rechaza sin el secreto", async () => {
    const { GET } = await import("@/app/api/cron/sync/route");
    const res = await GET(new Request("http://x"));
    expect(res.status).toBe(401);
  });

  it("rechaza con el secreto equivocado", async () => {
    const { GET } = await import("@/app/api/cron/sync/route");
    const res = await GET(new Request("http://x", { headers: { authorization: "Bearer otro" } }));
    expect(res.status).toBe(401);
  });

  /**
   * S-07: esta ruta esta en la lista de publicas de proxy.ts, y el cuerpo incluia
   * e.message. Un MapeoInvalidoError imprime por diseno todos los encabezados
   * reales de la hoja, o sea las preguntas del formulario de aplicacion, saliendo
   * por una ruta sin sesion.
   */
  it("no devuelve el mensaje de error del sync en el cuerpo", async () => {
    select.mockReturnValue({
      from: () => ({ where: async () => [{ id: "p-1", slug: "comunicarte", activo: true }] }),
    });
    sincronizarPersonas.mockRejectedValue(
      new MapeoInvalidoError("estado", ["estado"], ["Cuanto ganas mensualmente", "Por que aplicaste"]),
    );
    const espia = vi.spyOn(console, "error").mockImplementation(() => {});

    const { GET } = await import("@/app/api/cron/sync/route");
    const res = await GET(
      new Request("http://x", { headers: { authorization: "Bearer secreto-de-prueba" } }),
    );
    const cuerpo = await res.json();

    expect(JSON.stringify(cuerpo)).not.toContain("Cuanto ganas");
    expect(cuerpo).toEqual({ ok: false, programas: 1, sincronizados: 0, fallidos: 1 });
    espia.mockRestore();
  });

  it("un secreto del mismo largo pero distinto tampoco pasa", async () => {
    const { GET } = await import("@/app/api/cron/sync/route");
    const res = await GET(
      new Request("http://x", { headers: { authorization: "Bearer secreto-de-pruebA" } }),
    );
    expect(res.status).toBe(401);
  });

  it("no corre si CRON_SECRET no esta configurado, en vez de quedar abierto", async () => {
    delete process.env.CRON_SECRET;
    const { GET } = await import("@/app/api/cron/sync/route");
    const res = await GET(new Request("http://x", { headers: { authorization: "Bearer lo-que-sea" } }));
    expect(res.status).toBe(500);
    process.env.CRON_SECRET = original;
  });
});
