import { describe, expect, it } from "vitest";
import { resolverCanal, type CanalActivo } from "@/lib/atribucion/canal";

const exacto: CanalActivo = {
  id: "exacto",
  nombre: "Facebook histórico",
  utmSource: "facebook",
  utmMedium: "cpc",
  areaId: "paid",
  formato: "meta_historico",
  activo: true,
};
const comodin: CanalActivo = {
  id: "comodin",
  nombre: "Meta",
  utmSource: null,
  utmMedium: "paid_social",
  areaId: "paid",
  formato: "plantilla_pauta",
  activo: true,
};

describe("resolver canal (ticket 101)", () => {
  it("el exacto gana y compara con lower/trim", () => {
    expect(
      resolverCanal({ source: " Facebook ", medium: " CPC ", campaign: "Lanzamiento" }, [
        comodin,
        exacto,
      ]),
    ).toEqual({ tipo: "canal", canal: exacto });
  });

  it("una macro en source cae al comodín del medium", () => {
    expect(
      resolverCanal(
        { source: "{{site_source_name}}", medium: " paid_social ", campaign: "C1" },
        [comodin],
      ),
    ).toEqual({ tipo: "canal", canal: comodin });
  });

  it("distingue sin UTM de un envío sin clasificar", () => {
    expect(resolverCanal({ source: " ", medium: null, campaign: "{{campaign.name}}" }, [])).toEqual({
      tipo: "sin_utm",
    });
    expect(resolverCanal({ source: "instagram", medium: "stories", campaign: null }, [])).toEqual({
      tipo: "sin_clasificar",
    });
  });

  it("ignora canales inactivos", () => {
    expect(
      resolverCanal({ source: "facebook", medium: "cpc", campaign: null }, [
        { ...exacto, activo: false },
      ]),
    ).toEqual({ tipo: "sin_clasificar" });
  });

  it("no cambia el resultado al invertir el catálogo", () => {
    const envio = { source: "facebook", medium: "cpc", campaign: "C1" };
    const otro: CanalActivo = { ...comodin, id: "otro", utmMedium: "cpc" };
    expect(resolverCanal(envio, [exacto, otro])).toEqual(resolverCanal(envio, [otro, exacto]));
    expect(resolverCanal(envio, [otro, exacto])).toEqual({ tipo: "canal", canal: exacto });
  });
});
