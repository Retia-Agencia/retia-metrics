import { describe, expect, it } from "vitest";
import {
  CAMPOS_PROMOVIDOS,
  construirEnvio,
  normalizarTelefono,
  type EntradaEnvio,
} from "@/lib/ingesta/envio";
import { entradasDesdeMatriz } from "@/lib/ingesta/adaptador-sheets";
import { MapeoInvalidoError, ZONA_BOGOTA } from "@/lib/sheets/mapeo";

/**
 * Tickets 048 y 049, la parte pura: una fila de la hoja (o un payload de webhook) se
 * convierte en un Envio. Nada de esto toca la base; la escritura por lotes llega con
 * el resto del 049.
 *
 * El Envio son las columnas promovidas de `submissions` + `respuestas` con TODO lo
 * demas, SIN repetir las promovidas adentro (ADR 0036, opcion A').
 */

const ENCABEZADOS = [
  "Nombre completo",
  "Correo electronico",
  "WhatsApp",
  "¿Cuanto ganas mensualmente?",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "Submitted At",
  "Token",
  "Estado",
];

const FILA = [
  "Ana Perez",
  "Ana@Correo.co ",
  "+57 300 123 4567",
  "Mas de $3.000 USD",
  "facebook",
  "cpc",
  "Metodo_Comunicarte",
  "",
  "anuncio-7",
  "16/9/2026 23:05:00",
  "tok-ana-1",
  "📞 Setteo No Calificado",
];

const FUENTE = { sourceId: "fuente-1", zona: "UTC" };

describe("el adaptador de Sheets produce entradas, una por fila con datos", () => {
  it("la posicion es la fila real de la hoja: el encabezado es la 1", () => {
    const entradas = entradasDesdeMatriz([ENCABEZADOS, FILA, FILA.map(() => ""), FILA], FUENTE);
    // La fila vacia no produce entrada pero SI cuenta para la posicion.
    expect(entradas.map((e) => e.posicion)).toEqual([2, 4]);
  });

  it("si falta la columna del token, del correo o de la fecha, falla ruidosamente", () => {
    const sinToken = ENCABEZADOS.filter((h) => h !== "Token");
    expect(() => entradasDesdeMatriz([sinToken], FUENTE)).toThrow(MapeoInvalidoError);
  });

  it("lee hasta el ultimo encabezado no vacio: lo que hay mas a la derecha no entra", () => {
    const [entrada] = entradasDesdeMatriz(
      [[...ENCABEZADOS, "", ""], [...FILA, "", "basura sin encabezado"]],
      FUENTE,
    );
    expect(Object.keys(entrada.columnas)).toHaveLength(ENCABEZADOS.length);
  });
});

describe("construirEnvio", () => {
  const [entrada] = entradasDesdeMatriz([ENCABEZADOS, FILA], FUENTE);

  it("llena las promovidas con el valor crudo, fechado con la zona de la fuente", () => {
    const r = construirEnvio(entrada);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const e = r.envio;
    expect(e.sourceId).toBe("fuente-1");
    expect(e.token).toBe("tok-ana-1");
    expect(e.esParcial).toBe(false);
    expect(e.fechaEnvio!.toISOString()).toBe("2026-09-16T23:05:00.000Z");
    expect(e.estadoHoja).toBe("📞 Setteo No Calificado");
    // El Estado ya traducido al valor del enum (ADR 0054, ticket 051).
    expect(e.estado).toBe("setteo_no_calificado");
    expect(e.utmSource).toBe("facebook");
    expect(e.utmMedium).toBe("cpc");
    expect(e.utmCampaign).toBe("Metodo_Comunicarte");
    expect(e.posicionEnHoja).toBe(2);
  });

  it("ninguna llave de `respuestas` es una columna promovida (A': nada dos veces)", () => {
    const r = construirEnvio(entrada);
    if (!r.ok) throw new Error("debia construir");
    const llaves = Object.keys(r.envio.respuestas);
    for (const h of ["utm_source", "utm_medium", "utm_campaign", "Submitted At", "Token", "Estado"]) {
      expect(llaves).not.toContain(h);
    }
    // Lo que no se promueve entra con el texto del encabezado como llave.
    expect(r.envio.respuestas["¿Cuanto ganas mensualmente?"]).toBe("Mas de $3.000 USD");
  });

  it("utm_content y utm_term se promueven a sus columnas y no se repiten en respuestas (ticket 116)", () => {
    expect(CAMPOS_PROMOVIDOS).toEqual(expect.arrayContaining(["utmId", "utmContent", "utmTerm"]));
    const r = construirEnvio(entrada);
    if (!r.ok) throw new Error("debia construir");
    expect(r.envio.utmContent).toBe("anuncio-7");
    expect(r.envio.utmTerm).toBeNull();
    expect(r.envio.utmId).toBeNull();
    expect(r.envio.respuestas).not.toHaveProperty("utm_content");
    expect(r.envio.respuestas).not.toHaveProperty("utm_term");
  });

  it("una macro de Meta sin expandir se guarda tal cual: la juzga el emparejador, no la ingesta (ticket 116)", () => {
    const [e] = entradasDesdeMatriz([[...ENCABEZADOS, "utm_id"], [...FILA.slice(0, 8), "{{ad.name}}", ...FILA.slice(9), "{{ad.id}}"]], FUENTE);
    const r = construirEnvio(e);
    if (!r.ok) throw new Error("debia construir");
    expect(r.envio.utmContent).toBe("{{ad.name}}");
    expect(r.envio.utmId).toBe("{{ad.id}}");
    expect(r.envio.respuestas).not.toHaveProperty("utm_id");
  });

  it("correo y telefono salen normalizados para la identidad y se quedan en respuestas", () => {
    const r = construirEnvio(entrada);
    if (!r.ok) throw new Error("debia construir");
    expect(r.envio.identidad).toEqual({ correo: "ana@correo.co", telefono: "573001234567" });
    // No son columnas de `submissions`: el texto de la celda es el unico rastro del envio.
    expect(r.envio.respuestas["Correo electronico"]).toBe("Ana@Correo.co");
  });

  it("un UTM ausente es null, no un centinela inventado (ADR 0004)", () => {
    const fila = [...FILA];
    fila[4] = "";
    fila[5] = "  ";
    const [e] = entradasDesdeMatriz([ENCABEZADOS, fila], FUENTE);
    const r = construirEnvio(e);
    if (!r.ok) throw new Error("debia construir");
    expect(r.envio.utmSource).toBeNull();
    expect(r.envio.utmMedium).toBeNull();
  });

  it('el centinela "xxxxx" en un UTM se trata como sin UTM (null), sin mayusculas ni espacios (Mani, 28-sep)', () => {
    // El Forms Link de los programas trae utm_*=xxxxx como plantilla; el link crudo llega
    // "xxxxx". Es un centinela de "sin UTM", no un dato. Camino de HOJA.
    const fila = [...FILA];
    fila[4] = "xxxxx"; // utm_source
    fila[5] = " XXXXX "; // utm_medium (mayusculas y espacios)
    fila[6] = "Xxxxx"; // utm_campaign
    const [e] = entradasDesdeMatriz([ENCABEZADOS, fila], FUENTE);
    const r = construirEnvio(e);
    if (!r.ok) throw new Error("debia construir");
    expect(r.envio.utmSource).toBeNull();
    expect(r.envio.utmMedium).toBeNull();
    expect(r.envio.utmCampaign).toBeNull();
  });

  it('el centinela "xxxxx" tampoco queda en utm_term ni utm_content', () => {
    const fila = [...FILA];
    fila[7] = "xxxxx"; // utm_term
    fila[8] = "XXXXX"; // utm_content
    const [e] = entradasDesdeMatriz([ENCABEZADOS, fila], FUENTE);
    const r = construirEnvio(e);
    if (!r.ok) throw new Error("debia construir");
    expect(r.envio.utmTerm).toBeNull();
    expect(r.envio.utmContent).toBeNull();
  });

  it('una UTM que el mapeo de la fuente no apunta queda en respuestas, sin el centinela "xxxxx"', () => {
    const [base] = entradasDesdeMatriz([ENCABEZADOS, FILA.map((v, i) => (i === 8 ? "XXXXX" : v))], FUENTE);
    const campos = { ...base.campos };
    delete campos.utmContent;
    const r = construirEnvio({ ...base, campos });
    if (!r.ok) throw new Error("debia construir");
    expect(r.envio.utmContent).toBeNull();
    expect(r.envio.respuestas["utm_content"]).toBeNull();
  });

  it('"xxxxx" en una respuesta que NO es UTM se conserva tal cual (ADR 0004)', () => {
    // El centinela es SOLO de UTM. Una respuesta de negocio con ese texto no se toca.
    const fila = [...FILA];
    fila[3] = "xxxxx"; // ¿Cuanto ganas mensualmente?
    const [e] = entradasDesdeMatriz([ENCABEZADOS, fila], FUENTE);
    const r = construirEnvio(e);
    if (!r.ok) throw new Error("debia construir");
    expect(r.envio.respuestas["¿Cuanto ganas mensualmente?"]).toBe("xxxxx");
  });

  it("un parcial de Typeform (fecha placeholder 1/1/0001) es parcial y sin fecha", () => {
    const fila = [...FILA];
    fila[9] = "1/1/0001 0:00:00";
    const [e] = entradasDesdeMatriz([ENCABEZADOS, fila], FUENTE);
    const r = construirEnvio(e);
    if (!r.ok) throw new Error("debia construir");
    expect(r.envio.esParcial).toBe(true);
    expect(r.envio.fechaEnvio).toBeNull();
  });

  it("parcial y completa con el mismo token son DOS envios", () => {
    const parcial = [...FILA];
    parcial[9] = "1/1/0001 0:00:00";
    const entradas = entradasDesdeMatriz([ENCABEZADOS, parcial, FILA], FUENTE);
    const envios = entradas.map(construirEnvio);
    expect(envios.every((r) => r.ok)).toBe(true);
    expect(envios.map((r) => (r.ok ? [r.envio.token, r.envio.esParcial] : null))).toEqual([
      ["tok-ana-1", true],
      ["tok-ana-1", false],
    ]);
  });

  it("una columna nueva en la hoja aparece sola en respuestas", () => {
    const [e] = entradasDesdeMatriz([[...ENCABEZADOS, "Pregunta nueva"], [...FILA, "si"]], FUENTE);
    const r = construirEnvio(e);
    if (!r.ok) throw new Error("debia construir");
    expect(r.envio.respuestas["Pregunta nueva"]).toBe("si");
  });

  it("dos encabezados con el mismo texto no se pisan en el jsonb", () => {
    // 🩸 `Registro de llamadas` de ComunicArte tiene encabezados corridos: si dos columnas
    // se llamaran igual, la segunda borraria a la primera sin error.
    const [e] = entradasDesdeMatriz(
      [[...ENCABEZADOS, "Notas", "Notas"], [...FILA, "primera", "segunda"]],
      FUENTE,
    );
    const r = construirEnvio(e);
    if (!r.ok) throw new Error("debia construir");
    expect(r.envio.respuestas["Notas"]).toBe("primera");
    expect(r.envio.respuestas["Notas (2)"]).toBe("segunda");
  });

  it("sin token no hay envio: se rechaza con motivo, no se inventa una llave", () => {
    const fila = [...FILA];
    fila[10] = "";
    const [e] = entradasDesdeMatriz([ENCABEZADOS, fila], FUENTE);
    expect(construirEnvio(e)).toEqual({ ok: false, motivo: "sin_token", posicion: 2 });
  });
});

describe("la misma puerta para un webhook (048)", () => {
  it("un payload con forma de webhook produce el mismo Envio que la fila equivalente", () => {
    const [desdeHoja] = entradasDesdeMatriz([ENCABEZADOS, FILA], FUENTE);
    const desdeWebhook: EntradaEnvio = {
      sourceId: "fuente-1",
      zona: "UTC",
      posicion: 2,
      columnas: Object.fromEntries(ENCABEZADOS.map((h, i) => [h, FILA[i]])),
      campos: {
        token: "Token",
        correo: "Correo electronico",
        telefono: "WhatsApp",
        nombre: "Nombre completo",
        fechaEnvio: "Submitted At",
        estadoHoja: "Estado",
        utmSource: "utm_source",
        utmMedium: "utm_medium",
        utmCampaign: "utm_campaign",
        utmContent: "utm_content",
        utmTerm: "utm_term",
      },
    };
    expect(construirEnvio(desdeWebhook)).toEqual(construirEnvio(desdeHoja));
  });

  it("un webhook puede declarar el parcial explicito, sin depender de la fecha", () => {
    const [base] = entradasDesdeMatriz([ENCABEZADOS, FILA], FUENTE);
    const r = construirEnvio({ ...base, posicion: null, esParcial: true });
    if (!r.ok) throw new Error("debia construir");
    expect(r.envio.esParcial).toBe(true);
    expect(r.envio.posicionEnHoja).toBeNull();
  });
});

describe("normalizarTelefono", () => {
  it("guarda solo digitos", () => {
    expect(normalizarTelefono("+57 (300) 123-4567")).toBe("573001234567");
  });

  it("lo que no alcanza a ser un telefono es null: el centinela de un telefono", () => {
    // Una celda con "0", "-" o "N/A" no identifica a nadie, y unir por ella juntaria a
    // desconocidos. Siete digitos es el telefono fijo mas corto de Colombia.
    expect(normalizarTelefono("0")).toBeNull();
    expect(normalizarTelefono("N/A")).toBeNull();
    expect(normalizarTelefono("123456")).toBeNull();
    expect(normalizarTelefono("")).toBeNull();
    expect(normalizarTelefono(null)).toBeNull();
  });
});

describe("la zona por defecto", () => {
  it("sin zona declarada en la entrada, la fecha es de Bogota", () => {
    const [e] = entradasDesdeMatriz([ENCABEZADOS, FILA], { sourceId: "f" });
    expect(e.zona).toBe(ZONA_BOGOTA);
  });
});
