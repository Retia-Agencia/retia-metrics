import { describe, expect, it, vi } from "vitest";
import { ErrorDeGrain } from "@/lib/grain/errores";
import { leerTranscriptDeGrain, linkDeGrainValido } from "@/lib/grain/leer";
import { DATA, paginaDeGrain } from "./helpers/pagina-de-grain";
import { parsearPaginaDeGrain, segmentosDelTranscript } from "@/lib/grain/parser";

const LINK = "https://grain.com/note/34f1d0c1-a5c1-4589-8c5d-e17343158c23/abc";
const respuesta = (cuerpo: string, status = 200) => ({ ok: status < 400, status, text: async () => cuerpo }) as Response;
const codigoDe = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return e instanceof ErrorDeGrain ? e.codigo : "otro";
  }
  return null;
};

describe("parser de la pagina de Grain", () => {
  it("devuelve el crudo con palabras, hablantes y rangos", () => {
    expect(parsearPaginaDeGrain(paginaDeGrain())).toEqual(DATA);
  });

  it("arma los turnos con hablante, tiempos y texto", () => {
    const segmentos = segmentosDelTranscript(parsearPaginaDeGrain(paginaDeGrain()));
    expect(segmentos).toEqual([
      { hablante: "Speaker 1", inicioMs: 3836, finMs: 4763, texto: "Hola, Luis, ¿cómo estás?" },
      { hablante: "Speaker 2", inicioMs: 6841, finMs: 7600, texto: "Bien, gracias." },
    ]);
  });

  it("sin el JSON embebido falla con formato_cambio, y con estado distinto de ok falla con bloqueado", () => {
    expect(() => parsearPaginaDeGrain(paginaDeGrain({ sinMeta: true }))).toThrow(expect.objectContaining({ codigo: "formato_cambio" }));
    expect(() => parsearPaginaDeGrain(paginaDeGrain({ sinMeta: true, status: "locked" }))).toThrow(expect.objectContaining({ codigo: "bloqueado" }));
  });

  it("una llamada que Grain aun procesa es no_procesado", () => {
    expect(() => parsearPaginaDeGrain(paginaDeGrain({ state: "PROCESSING" }))).toThrow(expect.objectContaining({ codigo: "no_procesado" }));
  });

  it("un transcript sin palabras es sin_transcript y uno con otra forma es formato_cambio", () => {
    expect(() => parsearPaginaDeGrain(paginaDeGrain({ data: { ...DATA, results: [] } }))).toThrow(expect.objectContaining({ codigo: "sin_transcript" }));
    expect(() => parsearPaginaDeGrain(paginaDeGrain({ data: { results: "x" } }))).toThrow(expect.objectContaining({ codigo: "formato_cambio" }));
    expect(() => parsearPaginaDeGrain(paginaDeGrain({ data: { ...DATA, results: [[1, 2, 3]] } }))).toThrow(expect.objectContaining({ codigo: "formato_cambio" }));
  });
});

describe("lectura de un link de Grain", () => {
  it("solo acepta https hacia grain.com y rutas de nota", () => {
    expect(linkDeGrainValido(LINK)).not.toBeNull();
    expect(linkDeGrainValido("https://www.grain.com/share/recording/abc/def")).not.toBeNull();
    for (const malo of [
      "http://grain.com/note/a/b",
      "https://grain.com.evil.com/note/a/b",
      "https://evil.com/note/a/b",
      "https://grain.com/login",
      "https://fathom.video/share/abc",
      "no es un link",
    ]) {
      expect(linkDeGrainValido(malo), malo).toBeNull();
    }
  });

  it("un link ajeno no sale a la red", async () => {
    const fetcher = vi.fn();
    expect(await codigoDe(leerTranscriptDeGrain("https://evil.com/note/a/b", fetcher))).toBe("link_invalido");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("traduce el HTTP a codigos tipados y no sigue redirecciones", async () => {
    const con = (r: Response | Error) => async () => {
      if (r instanceof Error) throw r;
      return r;
    };
    expect(await leerTranscriptDeGrain(LINK, con(respuesta(paginaDeGrain())))).toEqual(DATA);
    expect(await codigoDe(leerTranscriptDeGrain(LINK, con(respuesta("", 404))))).toBe("no_encontrado");
    expect(await codigoDe(leerTranscriptDeGrain(LINK, con(respuesta("", 403))))).toBe("bloqueado");
    expect(await codigoDe(leerTranscriptDeGrain(LINK, con(respuesta("", 302))))).toBe("bloqueado");
    expect(await codigoDe(leerTranscriptDeGrain(LINK, con(respuesta("", 503))))).toBe("red");
    expect(await codigoDe(leerTranscriptDeGrain(LINK, con(new Error("timeout"))))).toBe("red");
  });
});
