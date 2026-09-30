import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { type CanalActivo } from "@/lib/atribucion/canal";
import { ARBOL_VACIO, emparejar, type ArbolDePauta } from "@/lib/atribucion/emparejar";
import { utmsDelEnvio, type UtmsDelEnvio } from "@/lib/atribucion/utm-del-envio";

const pauta: CanalActivo = {
  id: "pauta",
  nombre: "Meta",
  utmSource: null,
  utmMedium: "paid_social",
  areaId: "paid",
  formato: "plantilla_pauta",
  activo: true,
};
const historico: CanalActivo = {
  id: "historico",
  nombre: "Facebook historico",
  utmSource: "facebook",
  utmMedium: "cpc",
  areaId: "paid",
  formato: "meta_historico",
  activo: true,
};
const organico: CanalActivo = {
  id: "organico",
  nombre: "Organico",
  utmSource: "instagram",
  utmMedium: "organic",
  areaId: "organic",
  formato: null,
  activo: true,
};
const closer: CanalActivo = {
  id: "closer",
  nombre: "Closer",
  utmSource: "closer",
  utmMedium: "referido",
  areaId: "sales",
  formato: "closer",
  activo: true,
};

const VACIOS: UtmsDelEnvio = { source: null, medium: null, campaign: null, content: null, term: null, id: null };
const ARBOL: ArbolDePauta = {
  anuncios: [
    { id: "ad-2", conjuntoId: "set-2", campanaId: "camp-2" },
    { id: "ad-1", conjuntoId: "set-1", campanaId: "camp-1" },
  ],
  campanas: [
    { id: "camp-2", nombre: "Siempre verde" },
    { id: "camp-1", nombre: "Lanzamiento" },
  ],
};

describe("UTM crudos del envio", () => {
  it("prioriza columnas y recupera content, term e id desde respuestas", () => {
    expect(
      utmsDelEnvio({
        utmSource: "facebook",
        utmMedium: "cpc",
        utmCampaign: "cruda",
        utmContent: "columna",
        utmTerm: null,
        utmId: null,
        respuestas: { utm_content: "ignorado", " UTM_Term ": "ad-1", " utm_ID ": " 42 " },
      }),
    ).toEqual({ source: "facebook", medium: "cpc", campaign: "cruda", content: "columna", term: "ad-1", id: " 42 " });

    expect(
      utmsDelEnvio({
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
        utmContent: null,
        utmTerm: null,
        utmId: null,
        respuestas: null,
      }),
    ).toEqual(VACIOS);
  });

  it("desde el 116 el id del anuncio sale de su columna, y respuestas queda para lo anterior", () => {
    const base = { utmSource: "ig", utmMedium: "paid_social", utmCampaign: "c", utmContent: null, utmTerm: null };
    expect(utmsDelEnvio({ ...base, utmId: "120212", respuestas: { utm_id: "viejo" } }).id).toBe("120212");
    expect(utmsDelEnvio({ ...base, utmId: null, respuestas: { utm_id: "viejo" } }).id).toBe("viejo");
  });
});

describe("emparejador de atribucion", () => {
  it("distingue N0 y reporta todas las macros en orden fijo", () => {
    expect(emparejar(VACIOS, [], ARBOL_VACIO)).toMatchObject({ nivel: "N0", origen: { tipo: "sin_utm" }, macros: [] });
    const macro = "{{sin.expandir}}";
    expect(
      emparejar({ source: macro, medium: macro, campaign: macro, content: macro, term: macro, id: macro }, [pauta], ARBOL),
    ).toMatchObject({
      nivel: "N0",
      origen: { tipo: "sin_utm" },
      macros: ["source", "medium", "campaign", "content", "term", "id"],
      anuncio: null,
      campana: null,
    });
  });

  it("mantiene sin clasificar en su propio nivel", () => {
    expect(emparejar({ ...VACIOS, source: "desconocido", medium: "otro" }, [], ARBOL_VACIO)).toMatchObject({
      nivel: "sin_clasificar",
      origen: { tipo: "sin_clasificar" },
    });
  });

  it("resuelve el anuncio de pauta hasta N3", () => {
    expect(
      emparejar(
        { source: "instagram", medium: "paid_social", campaign: "Lanzamiento", content: " Anuncio A ", term: " Feed ", id: " ad-1 " },
        [pauta],
        ARBOL,
      ),
    ).toMatchObject({
      nivel: "N3",
      anuncio: { anuncioId: "ad-1", conjuntoId: "set-1", campanaId: "camp-1" },
      campana: { tipo: "meta", campanaId: "camp-1" },
      contenido: { formato: "plantilla_pauta", anuncioNombre: "Anuncio A", placement: "Feed" },
      avisos: [],
    });
  });

  it("avisa un anuncio desconocido y cae a N2 o N1", () => {
    const base = { ...VACIOS, source: "ig", medium: "paid_social", id: "ausente" };
    expect(emparejar({ ...base, campaign: " lanzamiento " }, [pauta], ARBOL)).toMatchObject({
      nivel: "N2",
      campana: { tipo: "meta", campanaId: "camp-1" },
      anuncio: null,
      avisos: ["anuncio_desconocido"],
    });
    expect(emparejar(base, [pauta], ARBOL)).toMatchObject({
      nivel: "N1",
      campana: null,
      anuncio: null,
      avisos: ["anuncio_desconocido"],
    });
  });

  it("resuelve la campana historica unica y rechaza nombres ambiguos", () => {
    const utms = { ...VACIOS, source: "facebook", medium: "cpc", campaign: " LANZAMIENTO ", content: " Conjunto ", term: " Anuncio " };
    expect(emparejar(utms, [historico], ARBOL)).toMatchObject({
      nivel: "N2",
      campana: { tipo: "meta", campanaId: "camp-1" },
      contenido: { formato: "meta_historico", conjunto: "Conjunto", anuncio: "Anuncio" },
      avisos: [],
    });
    expect(
      emparejar(utms, [historico], { ...ARBOL, campanas: [...ARBOL.campanas, { id: "camp-3", nombre: "lanzamiento" }] }),
    ).toMatchObject({ nivel: "N1", campana: null, avisos: ["campana_ambigua"] });
  });

  it("conserva la campana de texto organica y descarta una macro", () => {
    const base = { ...VACIOS, source: "instagram", medium: "organic" };
    expect(emparejar({ ...base, campaign: " Mi Campana " }, [organico], ARBOL_VACIO)).toMatchObject({
      nivel: "N2",
      campana: { tipo: "texto", texto: "Mi Campana" },
      contenido: null,
    });
    expect(emparejar({ ...base, campaign: "{{campaign.name}}" }, [organico], ARBOL_VACIO)).toMatchObject({
      nivel: "N1",
      campana: null,
      macros: ["campaign"],
    });
  });

  it("interpreta el contenido del closer y trata sus macros como ausentes", () => {
    expect(
      emparejar({ ...VACIOS, source: "closer", medium: "referido", content: " ABC-123 ", term: "ignorado" }, [closer], ARBOL_VACIO),
    ).toMatchObject({ nivel: "N1", contenido: { formato: "closer", codigoCloser: "ABC-123" } });
    expect(
      emparejar({ ...VACIOS, source: "closer", medium: "referido", content: "{{codigo}}" }, [closer], ARBOL_VACIO),
    ).toMatchObject({ contenido: { formato: "closer", codigoCloser: null }, macros: ["content"] });
  });

  it("no depende del orden del catalogo ni del arbol", () => {
    const utms = { ...VACIOS, source: "facebook", medium: "cpc", campaign: "Lanzamiento", id: "ad-1" };
    const directo = emparejar(utms, [pauta, organico, historico], ARBOL);
    const invertido = emparejar(utms, [historico, organico, pauta], {
      anuncios: [...ARBOL.anuncios].reverse(),
      campanas: [...ARBOL.campanas].reverse(),
    });
    expect(invertido).toEqual(directo);
  });
});

const PROHIBIDO = [
  { nombre: "identificador de columna UTM", re: /\butm(?:Content|Term|Id)\b/ },
  { nombre: "llave cruda UTM", re: /(["'`])utm_(?:content|term|id)\1/ },
];

/** Detecta lectores de UTM detallados que esquivan el modulo de atribucion. */
export function detectarLecturasUtm(codigo: string): string[] {
  const limpio = codigo.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  return PROHIBIDO.filter(({ re }) => re.test(limpio)).map(({ nombre }) => nombre);
}

describe("guardian: los UTM detallados se leen solo dentro de atribucion", () => {
  const RAIZ = fileURLToPath(new URL("../", import.meta.url));
  const DIRECTORIOS = ["lib", "app", "components", "scripts"];
  const EXTENSIONES = new Set([".ts", ".tsx"]);
  const EXCEPCIONES = new Map([
    [path.join("lib", "db", "schema.ts"), "define las columnas; no las lee"],
    // La ingesta PROMUEVE las UTM a sus columnas (ticket 116): las nombra para copiarlas tal
    // como llegaron, sin interpretarlas. Interpretar sigue siendo solo de lib/atribucion/.
    [path.join("lib", "ingesta", "envio.ts"), "las promueve tal como llegaron; escribe y no interpreta"],
    [path.join("lib", "ingesta", "ingerir.ts"), "escribe las columnas promovidas en submissions; no interpreta"],
    [path.join("lib", "ingesta", "adaptador-sheets.ts"), "mapea el encabezado de la hoja a la columna; no interpreta"],
    [path.join("lib", "ingesta", "adaptador-typeform.ts"), "mapea el campo oculto de Typeform a la columna; no interpreta"],
    [path.join("lib", "ingesta", "mapeo-webhook.ts"), "traduce la llave del mapeo de la fuente; no interpreta"],
    [path.join("scripts", "seed-local.ts"), "arma envios ficticios para la base local; escribe y no interpreta"],
  ]);

  function archivos(dir: string): string[] {
    const abs = path.join(RAIZ, dir);
    if (!fs.existsSync(abs)) return [];
    return fs.readdirSync(abs, { withFileTypes: true }).flatMap((entrada) => {
      const rel = path.join(dir, entrada.name);
      if (entrada.isDirectory()) return archivos(rel);
      return EXTENSIONES.has(path.extname(entrada.name)) ? [rel] : [];
    });
  }

  it("ningun archivo fuera de atribucion lee los campos detallados", () => {
    const hallazgos: string[] = [];
    for (const dir of DIRECTORIOS) {
      for (const rel of archivos(dir)) {
        if (rel.startsWith(`${path.join("lib", "atribucion")}${path.sep}`) || EXCEPCIONES.has(rel)) continue;
        const codigo = fs.readFileSync(path.join(RAIZ, rel), "utf8");
        const detectados = detectarLecturasUtm(codigo);
        if (detectados.length > 0) hallazgos.push(`${rel} — ${detectados.join(", ")}`);
      }
    }
    expect(hallazgos, `Usa lib/atribucion/utm-del-envio.ts:\n${hallazgos.join("\n")}`).toEqual([]);
  });

  it("el detector muerde las dos formas clandestinas", () => {
    expect(detectarLecturasUtm("fila.utmContent")).not.toEqual([]);
    expect(detectarLecturasUtm('r["utm_term"]')).not.toEqual([]);
  });

  it("el detector no castiga las formas autorizadas", () => {
    expect(detectarLecturasUtm('import { utmsDelEnvio } from "@/lib/atribucion/utm-del-envio"')).toEqual([]);
    expect(detectarLecturasUtm("const seleccion = { ...columnasUtmDelEnvio }")).toEqual([]);
  });
});
