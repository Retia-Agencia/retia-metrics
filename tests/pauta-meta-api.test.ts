import { describe, expect, it, vi } from "vitest";
import { anunciosQueNecesitanCreativo, creativosDeAnuncios } from "@/lib/pauta/meta-api";

const TOKEN = "token-de-prueba";
describe("creativos de Meta", () => {
  it("identifica anuncios nuevos, cambiados o sin fecha legible", () => {
    const conocidos = new Map([
      ["igual", { actualizadoEn: new Date("2026-10-14T12:00:00Z"), formato: "video" as const, urlTags: null }],
      ["cambio", { actualizadoEn: new Date("2026-10-14T12:00:00Z"), formato: "imagen" as const, urlTags: null }],
      ["invalido", { actualizadoEn: new Date("2026-10-14T12:00:00Z"), formato: null, urlTags: null }],
    ]);
    expect(anunciosQueNecesitanCreativo([
      { id: "igual", updated_time: "2026-10-14T12:00:00Z" },
      { id: "cambio", updated_time: "2026-10-14T12:00:01Z" },
      { id: "invalido", updated_time: "sin-fecha" },
      { id: "nuevo", updated_time: "2026-10-01T12:00:00Z" },
    ], conocidos)).toEqual(["cambio", "invalido", "nuevo"]);
  });

  it("pide lotes de 50 con filtering y no usa el parámetro ids", async () => {
    const filtros: string[][] = [];
    const f = vi.fn(async (entrada: string | URL | Request) => {
      const url = new URL(entrada instanceof Request ? entrada.url : String(entrada));
      expect(url.searchParams.has("ids")).toBe(false);
      expect(url.searchParams.get("limit")).toBe("50");
      const filtro = JSON.parse(url.searchParams.get("filtering") ?? "[]") as Array<{ value: string[] }>;
      filtros.push(filtro[0].value);
      return Response.json({ data: filtro[0].value.map((id) => ({
        id, creative: { object_type: "VIDEO", url_tags: `utm_id=${id}` },
      })) });
    }) as typeof globalThis.fetch;
    const ids = Array.from({ length: 101 }, (_, indice) => `ad-${indice}`);
    const creativos = await creativosDeAnuncios("123", ids, TOKEN, f);
    expect(filtros.map((lote) => lote.length).sort((a, b) => b - a)).toEqual([50, 50, 1]);
    expect(creativos.get("ad-100")).toEqual({ formato: "video", urlTagsDelCreativo: "utm_id=ad-100" });
  });

  it("una lista vacía no consulta Meta", async () => {
    const f = vi.fn() as unknown as typeof globalThis.fetch;
    expect(await creativosDeAnuncios("123", [], TOKEN, f)).toEqual(new Map());
    expect(f).not.toHaveBeenCalled();
  });

  it("reintenta una página pesada del creativo con un límite menor", async () => {
    const limites: number[] = [];
    const f = vi.fn(async (entrada: string | URL | Request) => {
      const url = new URL(entrada instanceof Request ? entrada.url : String(entrada));
      const limite = Number(url.searchParams.get("limit"));
      limites.push(limite);
      if (limite === 50) {
        return Response.json({
          error: { message: "Please reduce the amount of data you're asking for", code: 1 },
        }, { status: 500 });
      }
      return Response.json({ data: [{ id: "ad-1", creative: { object_type: "PHOTO" } }] });
    }) as typeof globalThis.fetch;
    expect((await creativosDeAnuncios("123", ["ad-1"], TOKEN, f)).get("ad-1")?.formato)
      .toBe("imagen");
    expect(limites).toEqual([50, 25]);
  });
});
