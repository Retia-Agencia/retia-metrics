import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { CanalActivo } from "@/lib/atribucion/canal";
import { ARBOL_VACIO, emparejar } from "@/lib/atribucion/emparejar";
import { generarLink, sanearUtm } from "@/lib/atribucion/link-de-captacion";
import type { UtmsDelEnvio } from "@/lib/atribucion/utm-del-envio";

/**
 * Ticket 092 — el generador de links de captacion. El corazon del ticket: **el emparejador
 * reconoce el link que el generador acaba de producir**. Son dos actos (armar el link y
 * leerlo al llegar el envio) y si divergen, el lead entra "sin clasificar" sin un error.
 */

const canal = (c: Partial<CanalActivo> & Pick<CanalActivo, "id" | "utmMedium">): CanalActivo => ({
  nombre: c.id,
  utmSource: null,
  areaId: "area",
  formato: null,
  activo: true,
  ...c,
});

const CATALOGO: CanalActivo[] = [
  canal({ id: "ig-bio", utmSource: "instagram", utmMedium: "bio" }),
  canal({ id: "linktree", utmSource: "l.linktr.ee", utmMedium: "referral" }),
  canal({ id: "closer", utmSource: "closer", utmMedium: "referido", formato: "closer" }),
  canal({ id: "organico", utmSource: null, utmMedium: "organic" }),
];

/** Lo que el formulario captura del link: sus parametros, tal cual llegan al envio. */
function utmsQueLlegan(link: string): UtmsDelEnvio {
  const p = new URL(link).searchParams;
  return {
    source: p.get("utm_source"),
    medium: p.get("utm_medium"),
    campaign: p.get("utm_campaign"),
    content: p.get("utm_content"),
    term: p.get("utm_term"),
    id: p.get("utm_id"),
  };
}

describe("sanearUtm (ADR 0051: minúsculas, snake_case, sin tildes ni espacios)", () => {
  it.each([
    ["Lanzamiento Octubre", "lanzamiento_octubre"],
    ["  Campaña  Ñandú ", "campana_nandu"],
    ["post-123/reel", "post_123_reel"],
    ["__ya_bien__", "ya_bien"],
  ])("%s → %s", (entrada, salida) => {
    expect(sanearUtm(entrada)).toBe(salida);
  });
});

describe("generarLink", () => {
  it("conserva la query del destino y reemplaza un UTM repetido", () => {
    const link = generarLink("https://form.typeform.com/to/abc?ref=x&utm_source=viejo", {
      source: "instagram",
      medium: "bio",
      campaign: "Octubre",
    });
    const p = new URL(link).searchParams;
    expect(p.get("ref")).toBe("x");
    expect(p.getAll("utm_source")).toEqual(["instagram"]);
    expect(p.get("utm_campaign")).toBe("octubre");
    expect(p.has("utm_content")).toBe(false);
    expect(p.has("utm_term")).toBe(false);
  });

  it("borra todo utm_* del destino: un utm_id copiado de pauta no se cuela al link orgánico", () => {
    const link = generarLink("https://form.typeform.com/to/abc?utm_id=123&UTM_Term=x&ref=y", {
      source: "instagram",
      medium: "bio",
      campaign: "octubre",
    });
    const p = new URL(link).searchParams;
    expect(p.has("utm_id")).toBe(false);
    expect(p.has("UTM_Term")).toBe(false);
    expect(p.get("ref")).toBe("y");
    expect(emparejar(utmsQueLlegan(link), CATALOGO, {
      anuncios: [{ id: "123", conjuntoId: "c", campanaId: "meta" }],
      campanas: [],
    }).anuncio).toBeNull();
  });

  it("source y medium salen del canal sin reescribirse (un punto no se vuelve _)", () => {
    const link = generarLink("https://form.typeform.com/to/abc", {
      source: "l.linktr.ee",
      medium: "referral",
      campaign: "bio",
    });
    expect(new URL(link).searchParams.get("utm_source")).toBe("l.linktr.ee");
  });

  it("sin campaña o sin canal no hay link (400)", () => {
    expect(() =>
      generarLink("https://x.co/f", { source: "instagram", medium: "bio", campaign: " ¿? " }),
    ).toThrow(expect.objectContaining({ status: 400 }));
    expect(() => generarLink("https://x.co/f", { source: "", medium: "bio", campaign: "c" })).toThrow(
      expect.objectContaining({ status: 400 }),
    );
  });
});

describe("el emparejador reconoce el link que el generador produce", () => {
  const DESTINO = "https://form.typeform.com/to/abc";

  it.each([
    ["ig-bio", { source: "instagram", medium: "bio", campaign: "Lanzamiento Octubre" }],
    ["linktree", { source: "l.linktr.ee", medium: "referral", campaign: "Bio 2026" }],
    ["organico", { source: "Manychat", medium: "organic", campaign: "Webinar", content: "DM día 1", term: "hoy" }],
  ])("canal %s", (esperado, utms) => {
    const link = generarLink(DESTINO, utms);
    const traza = emparejar(utmsQueLlegan(link), CATALOGO, ARBOL_VACIO);
    expect(traza.origen).toMatchObject({ tipo: "canal", canal: { id: esperado } });
    expect(traza.campana).toEqual({ tipo: "texto", texto: sanearUtm(utms.campaign) });
    expect(traza.macros).toEqual([]);
  });

  it("el enlace del closer lleva su código en utm_content y el emparejador lo lee ahí", () => {
    const link = generarLink(DESTINO, {
      source: "closer",
      medium: "referido",
      campaign: "comunicarte",
      content: "c7x2",
    });
    const traza = emparejar(utmsQueLlegan(link), CATALOGO, ARBOL_VACIO);
    expect(traza.origen).toMatchObject({ tipo: "canal", canal: { id: "closer" } });
    expect(traza.contenido).toEqual({ formato: "closer", codigoCloser: "c7x2" });
  });
});

/**
 * Las formas de pegar un utm_source a una URL: `.set/.append("utm_source", …)` sobre
 * cualquier receptor, `new URLSearchParams({ utm_source: … })` y la concatenacion
 * `?utm_source=${…}`. Leer un utm_source (la ingesta, los filtros) no es armar un link.
 */
const ARMA_UN_LINK =
  /\.(set|append)\(\s*["'`]utm_source["'`]|URLSearchParams\(\s*\{[^}]*\butm_source\b|[?&]utm_source=\$\{/;

describe("el guardián del generador muerde", () => {
  it.each([
    [`url.searchParams.set("utm_source", s)`, true],
    [`const p = url.searchParams; p.set("utm_source", s)`, true],
    [`p.append('utm_source', s)`, true],
    [`new URLSearchParams({ utm_medium: m, utm_source: s })`, true],
    ["`${base}?utm_source=${s}`", true],
    [`const s = params.get("utm_source")`, false],
    [`respuestas["utm_source"]`, false],
  ])("%s → %s", (codigo, caza) => {
    expect(ARMA_UN_LINK.test(codigo)).toBe(caza);
  });
});

describe("el generador es uno solo (ADR 0051, AGENTS.md)", () => {
  it("nadie fuera de link-de-captacion.ts pega utm_source a una URL", () => {
    const raices = ["lib", "app", "components"];
    const culpables: string[] = [];
    const recorrer = (dir: string) => {
      for (const nombre of readdirSync(dir)) {
        const ruta = join(dir, nombre);
        if (statSync(ruta).isDirectory()) recorrer(ruta);
        else if (/\.tsx?$/.test(nombre) && !ruta.replaceAll("\\", "/").endsWith("lib/atribucion/link-de-captacion.ts")) {
          const texto = readFileSync(ruta, "utf8");
          if (ARMA_UN_LINK.test(texto)) culpables.push(ruta);
        }
      }
    };
    raices.forEach(recorrer);
    expect(culpables).toEqual([]);
  });
});
