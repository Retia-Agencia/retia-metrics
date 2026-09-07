import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * F-08: el nombre de la pestana se interpolaba crudo dentro de las comillas simples
 * del rango. Sheets escapa un apostrofo literal duplicandolo, asi que una pestana
 * llamada `Estudiantes 'Agosto'` generaba un rango invalido.
 */

const get = vi.fn();
vi.mock("googleapis", () => ({
  google: { sheets: () => ({ spreadsheets: { values: { get } } }) },
}));
vi.mock("@/lib/sheets/auth", () => ({ clienteGoogle: () => ({}) }));

beforeEach(() => {
  get.mockReset();
  get.mockResolvedValue({ data: { values: [] } });
});

const rangoPedido = () => get.mock.calls[0][0].range as string;

describe("leerPestana", () => {
  it("duplica el apostrofo del nombre de la pestana", async () => {
    const { leerPestana } = await import("@/lib/sheets/leer");
    await leerPestana("sheet-1", "Estudiantes 'Agosto'");
    expect(rangoPedido()).toBe("'Estudiantes ''Agosto'''!A1:BZ");
  });

  it("deja intactos los nombres con emoji, que son los que hay hoy", async () => {
    const { leerPestana } = await import("@/lib/sheets/leer");
    await leerPestana("sheet-1", "📞 Setteo No Calificados");
    expect(rangoPedido()).toBe("'📞 Setteo No Calificados'!A1:BZ");
  });
});
