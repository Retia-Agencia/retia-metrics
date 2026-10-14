import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import fixture from "./fixtures/trm/datos-gov-2026-10-01-a-15.json";
import { tasasCambio } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { tasaDelDia, tasasDelRango } from "@/lib/trm/consultar";
import { leerTrmPublicada } from "@/lib/trm/fuente";
import { leerTrm } from "@/lib/trm/registrar";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;

function fetchGrabado(datos: unknown = fixture): ReturnType<typeof vi.fn> & typeof fetch {
  return vi.fn(async () => Response.json(datos)) as unknown as ReturnType<typeof vi.fn> & typeof fetch;
}

beforeAll(async () => {
  ({ db, cerrar, vaciar } = await crearBaseReutilizable());
});

beforeEach(async () => vaciar());
afterAll(async () => cerrar());

describe("TRM oficial", () => {
  it("registra dos lecturas sin duplicar publicaciones", async () => {
    const fetchImpl = fetchGrabado();
    const primera = await leerTrm(db, { hoy: "2026-10-14", fetchImpl });
    const segunda = await leerTrm(db, { hoy: "2026-10-14", fetchImpl });

    expect(primera).toEqual({ leidas: 10, desde: "2026-09-14", hasta: "2026-10-15" });
    expect(segunda).toEqual({ leidas: 10, desde: "2026-10-08", hasta: "2026-10-15" });
    expect(await db.select().from(tasasCambio)).toHaveLength(10);
    const primeraUrl = new URL(String(fetchImpl.mock.calls[0][0]));
    expect(primeraUrl.searchParams.get("$where")).toBe(
      "vigenciadesde between '2026-09-14T00:00:00' and '2026-10-15T00:00:00'",
    );
    expect(primeraUrl.searchParams.get("$order")).toBe("vigenciadesde");
    expect(primeraUrl.searchParams.get("$limit")).toBe("5000");
  });

  it("resuelve la publicación vigente en sábado y no inventa una tasa", async () => {
    await leerTrm(db, { hoy: "2026-10-14", fetchImpl: fetchGrabado() });
    await expect(tasaDelDia(db, "2026-10-11")).resolves.toEqual({
      fecha: "2026-10-11",
      pesosPorDolar: 3194.44,
      vigenteDesde: "2026-10-10",
      etiqueta: "TRM 3.194 (10 oct 2026)",
    });
    await expect(tasaDelDia(db, "2026-09-20")).resolves.toBeNull();
  });

  it("expande rangos, reporta faltantes y construye ambas etiquetas", async () => {
    await leerTrm(db, { hoy: "2026-10-14", fetchImpl: fetchGrabado() });
    const una = await tasasDelRango(db, "2026-10-11", "2026-10-12");
    expect([...una.porDia]).toEqual([["2026-10-11", 3194.44], ["2026-10-12", 3194.44]]);
    expect(una).toMatchObject({ faltantes: [], etiqueta: "TRM 3.194 (10 oct 2026)" });

    const varias = await tasasDelRango(db, "2026-09-30", "2026-10-02");
    expect(varias.faltantes).toEqual(["2026-09-30"]);
    expect(varias.etiqueta).toBe("TRM 3.308 a 3.313");
  });

  it.each([
    [{ ...fixture[0], unidad: "USD" }],
    [{ ...fixture[0], valor: "0" }],
  ])("rechaza una publicación inválida", async (datos) => {
    await expect(leerTrmPublicada("2026-10-01", "2026-10-15", fetchGrabado(datos))).rejects.toThrow();
  });
});
