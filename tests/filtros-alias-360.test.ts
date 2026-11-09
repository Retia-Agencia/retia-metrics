import { describe, expect, it } from "vitest";
import { conNombresVigentes, queryConNombresVigentes, traeNombresViejos } from "@/lib/filtros-alias";
import { parsearFiltros } from "@/lib/queries/kanban";
import { filtroDeLaUrl } from "@/lib/queries/bitacora";

describe("360: los enlaces viejos de Deals siguen filtrando", () => {
  it("?owner= y ?leadQuality= y ?leadValue= llegan a los filtros vigentes", () => {
    const viejo = parsearFiltros({ owner: "u1", leadQuality: "High", leadValue: "Alto" });
    const nuevo = parsearFiltros({ closer: "u1", calidad: "High", valor: "Alto" });
    expect(viejo).toEqual(nuevo);
    expect(nuevo.ownerUserId).toBe("u1");
    expect(nuevo.leadQuality).toBe("High");
    expect(nuevo.leadValue).toBe("Alto");
  });

  it("si vienen ambos nombres gana el vigente", () => {
    expect(conNombresVigentes({ owner: "viejo", closer: "nuevo" })).toEqual({ closer: "nuevo" });
    expect(conNombresVigentes({ owner: "viejo", closer: "" })).toEqual({ closer: "viejo" });
  });

  it("la pagina redirige a la query con nombres vigentes y conserva el resto", () => {
    expect(traeNombresViejos({ owner: "u1" })).toBe(true);
    expect(traeNombresViejos({ closer: "u1" })).toBe(false);
    expect(queryConNombresVigentes({ owner: "u1", leadQuality: "High", q: "ana", cohorte: ["a", "b"] }))
      .toBe("q=ana&cohorte=a&cohorte=b&closer=u1&calidad=High");
  });
});

describe("360: la bitacora usa el filtro de fecha de las listas", () => {
  it("campo + periodo acota igual que desde/hasta, y los sueltos de antes siguen valiendo", () => {
    const nuevo = filtroDeLaUrl({ fecha: "escritura", periodo: "custom", a_desde: "2026-10-01", a_hasta: "2026-10-05" }, "2026-10-10");
    expect([nuevo.desde, nuevo.hasta]).toEqual(["2026-10-01", "2026-10-05"]);
    const viejo = filtroDeLaUrl({ desde: "2026-10-01", hasta: "2026-10-05" }, "2026-10-10");
    expect([viejo.desde, viejo.hasta]).toEqual(["2026-10-01", "2026-10-05"]);
  });
});

describe("360: la busqueda vive en la URL y sobrevive a abrir un registro y volver", () => {
  it("Leads: abrir un lead desde ?q= y volver devuelve la misma busqueda", async () => {
    const { origenDeLaPagina, enlaceConVuelta, destinoDeVolver } = await import("@/lib/navegacion/volver");
    const origen = origenDeLaPagina("/p/x/leads", { q: "ana pérez", calidad: "high" });
    const enlace = enlaceConVuelta("/p/x/leads/abc", origen);
    const desde = new URL(`https://crm.test${enlace}`).searchParams.get("desde");
    expect(desde).toBe(origen);
    expect(decodeURIComponent(origen)).toContain("q=ana+p");
    expect(destinoDeVolver).toBeTypeOf("function");
  });

  it("el buscador de las listas dice «teléfono», no «celular»", async () => {
    const { readFileSync } = await import("node:fs");
    const fuente = readFileSync("components/filtros/buscador-url.tsx", "utf8");
    expect(fuente).toContain("correo o teléfono");
    expect(fuente).not.toContain("celular");
  });
});

describe("360: Calls filtra la fecha con campo + periodo", () => {
  it("fecha=agenda&periodo=custom acota y el enlace viejo desde/hasta sigue valiendo", async () => {
    const { filtroDeLlamadasDesdeUrl } = await import("@/lib/queries/llamadas");
    const alcance = { tipo: "todos" as const };
    const db = {} as never;
    const nuevo = await filtroDeLlamadasDesdeUrl(db, "p", alcance, { fecha: "agenda", periodo: "custom", a_desde: "2026-10-01", a_hasta: "2026-10-05" }, "2026-10-10");
    expect([nuevo.fecha, nuevo.desde, nuevo.hasta]).toEqual(["agenda", "2026-10-01", "2026-10-05"]);
    const viejo = await filtroDeLlamadasDesdeUrl(db, "p", alcance, { fecha: "agenda", desde: "2026-10-01", hasta: "2026-10-05" }, "2026-10-10");
    expect([viejo.fecha, viejo.desde, viejo.hasta]).toEqual(["agenda", "2026-10-01", "2026-10-05"]);
    const sin = await filtroDeLlamadasDesdeUrl(db, "p", alcance, {}, "2026-10-10");
    expect([sin.fecha, sin.desde, sin.hasta, sin.filtroDeFecha]).toEqual(["llamada", null, null, null]);
  });
});
