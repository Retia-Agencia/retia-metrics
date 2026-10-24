import { describe, expect, it } from "vitest";
import { resolverCanal, textoDeRegla } from "@/lib/atribucion/canal";

describe("resolver canal por regla (ticket 246)", () => {
  it.each([
    ["whatsapp rosario", "chat", "organico"],
    ["instagram", "dm", "organico"],
    ["instagram milena", "linktree", "organico"],
    ["tiktok", "manychat", "organico"],
    ["youtube", "linktree", "organico"],
    ["direct", "organic", "organico"],
    ["leadmagnetdiagnostico", "pdf", "organico"],
    ["instagram rosario", "storiesfijadas", "organico"],
    ["instagram", "storiesmanychat", "organico"],
    ["facebook", "cpc", "paid"],
    ["fb", "paid", "paid"],
    ["ig", "paid_social", "paid"],
    [null, "paid_social", "paid"],
    ["closer", "referido", "referidos"],
  ] as const)("%s / %s conserva el área %s", (source, medium, area) => {
    expect(resolverCanal({ source, medium })).toMatchObject({ area });
  });

  it("deriva plataforma, cuenta, clave y nombre del source", () => {
    expect(resolverCanal({ source: "instagram francisco", medium: "dm" })).toEqual({
      area: "organico",
      regla: "con_utm",
      canal: {
        clave: "instagram francisco",
        nombre: "Instagram · Francisco",
        plataforma: "instagram",
        cuenta: "francisco",
      },
    });
    expect(resolverCanal({ source: "tiktok", medium: "video" }).area).toBe("organico");
    expect(resolverCanal({ source: "youtube", medium: "video" }).area).toBe("organico");
  });

  it("trata macros, vacíos y espacios como ausencia", () => {
    expect(resolverCanal({ source: "instagram", medium: "{{placement}}" })).toMatchObject({
      area: "organico",
      regla: "con_utm",
    });
    expect(resolverCanal({ source: null, medium: "{{campaign.name}}" })).toEqual({
      area: "sin_utm",
      canal: null,
      regla: "sin_utm",
    });
    expect(resolverCanal({ source: "  ", medium: " " })).toEqual({
      area: "sin_utm",
      canal: null,
      regla: "sin_utm",
    });
  });

  it("normaliza casing, espacios interiores y aliases de plataforma", () => {
    const esperado = resolverCanal({ source: "instagram rosario", medium: "dm" });
    expect(resolverCanal({ source: "  IG   ROSARIO ", medium: " DM " })).toEqual(esperado);
    expect(resolverCanal({ source: "FB", medium: "organic" }).canal).toMatchObject({
      clave: "facebook",
      nombre: "Facebook",
    });
  });

  it("explica la decisión sin volver a clasificar", () => {
    const resultado = resolverCanal({ source: "facebook", medium: "CPC" });
    expect(textoDeRegla(resultado, { source: "facebook", medium: "CPC" })).toBe("medio pago: cpc");
  });
});
