import { describe, expect, it } from "vitest";
import { arbolDeCuenta } from "@/lib/pauta/meta-api";

const TOKEN = "token-de-prueba";
const DEMASIADO = { error: { message: "Please reduce the amount of data you're asking for, then retry your request", code: 1 } };

/** Meta de mentira: el borde `ads` rechaza páginas de más de `maximo` filas y sirve `total` anuncios. */
function metaConLimite(maximo: number, total = 3) {
  const limitesPedidos: number[] = [];
  const f = (async (entrada: URL | RequestInfo) => {
    const url = new URL(String(entrada));
    const limite = Number(url.searchParams.get("limit"));
    if (url.pathname.endsWith("/campaigns")) {
      return Response.json({ data: [{ id: "c1", name: "Campaña", effective_status: "ACTIVE" }] });
    }
    if (url.pathname.endsWith("/adsets")) {
      return Response.json({ data: [{ id: "s1", name: "Conjunto", effective_status: "ACTIVE", campaign_id: "c1" }] });
    }
    limitesPedidos.push(limite);
    if (limite > maximo) return Response.json(DEMASIADO, { status: 500 });
    const desde = Number(url.searchParams.get("after") ?? 0);
    const data = Array.from({ length: Math.min(limite, total - desde) }, (_, i) => ({
      id: `a${desde + i}`, name: "Anuncio", effective_status: "ACTIVE", adset_id: "s1", campaign_id: "c1",
    }));
    const siguiente = desde + data.length;
    const paging = siguiente < total
      ? { next: `${url.origin}${url.pathname}?limit=${limite}&after=${siguiente}&access_token=${TOKEN}` }
      : {};
    return Response.json({ data, paging });
  }) as typeof globalThis.fetch;
  return { f, limitesPedidos };
}

describe("arbolDeCuenta", () => {
  it("una página demasiado grande se vuelve a pedir con la mitad de filas, con el mismo cursor", async () => {
    const { f, limitesPedidos } = metaConLimite(30, 60);
    const arbol = await arbolDeCuenta("123", TOKEN, f);
    expect(arbol.filter((o) => o.nivel === "anuncio")).toHaveLength(60);
    expect(new Set(arbol.filter((o) => o.nivel === "anuncio").map((o) => o.idMeta)).size).toBe(60);
    expect(limitesPedidos.slice(0, 3)).toEqual([100, 50, 25]);
  });

  it("si ni el mínimo pasa, falla con el mensaje de Meta", async () => {
    const { f, limitesPedidos } = metaConLimite(2);
    await expect(arbolDeCuenta("123", TOKEN, f)).rejects.toThrow(/reduce the amount of data/);
    expect(limitesPedidos).toEqual([100, 50, 25, 12, 6, 5]);
  });

  it("otro error de Meta no se reintenta", async () => {
    let llamadas = 0;
    const f = (async () => {
      llamadas += 1;
      return Response.json({ error: { message: "Invalid OAuth access token", code: 190 } }, { status: 400 });
    }) as typeof globalThis.fetch;
    await expect(arbolDeCuenta("123", TOKEN, f)).rejects.toThrow(/Invalid OAuth/);
    expect(llamadas).toBe(3);
  });
});
