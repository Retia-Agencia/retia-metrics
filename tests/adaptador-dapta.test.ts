import { readFileSync } from "node:fs";
import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  calidadDesdeScore,
  entradaDesdeDapta,
  payloadDaptaSchema,
  type PayloadDapta,
} from "@/lib/ingesta/adaptador-dapta";
import { construirEnvio } from "@/lib/ingesta/envio";
import { PROVEEDORES } from "@/lib/ingesta/proveedores";
import completo from "./fixtures/dapta-completo.json";
import parcial from "./fixtures/dapta-parcial.json";
import realAgenda from "./fixtures/dapta-real-completo-agenda.json";
import realUtm from "./fixtures/dapta-real-completo-utm.json";
import realParcial from "./fixtures/dapta-real-parcial-sin-agenda.json";

const OPCIONES = { sourceId: "src-dapta", zona: "America/Bogota" };

describe("calidadDesdeScore", () => {
  it.each([
    [50, "con_calendly_sin_agenda", "MUY ALTO VALOR", "High"],
    [30, "con_calendly_sin_agenda", "MUY ALTO VALOR", "High"],
    [29, "con_calendly_sin_agenda", "ALTO VALOR", "High"], // 30 con facilidades de pago
    [28, "con_calendly_sin_agenda", "VALOR MEDIO", "High"], // 30 con las dos de baja intencion
    [20, "con_calendly_sin_agenda", "ALTO VALOR", "High"],
    [10, "con_calendly_sin_agenda", "VALOR MEDIO", "High"],
    [9, "con_calendly_sin_agenda", "BAJO VALOR", "High"],
    [-2, "con_calendly_sin_agenda", "BAJO VALOR", "High"], // 0 puntos y las dos: no descalifica
    [-50, "setteo_no_calificado", "ALTO VALOR", "Low"],
    [-51, "setteo_no_calificado", "VALOR MEDIO", "Low"],
    [-80, "setteo_no_calificado", "VALOR MEDIO", "Low"],
    [-90, "setteo_no_calificado", "BAJO VALOR", "Low"],
    [-100, "setteo_no_calificado", "BAJO VALOR", "Low"],
    [-170, "setteo_no_calificado", "ALTO VALOR", "Low"],
    [-300, "setteo_no_calificado", "BAJO VALOR", "Low"],
  ] as const)("deriva los bordes para score %i", (score, estado, leadValue, leadQuality) => {
    expect(calidadDesdeScore(score)).toEqual({ estado, leadValue, leadQuality });
  });

  // El estandar escrito aparte del generador (docs/dapta/README.md y ADR 0102): si el form generado
  // o el decodificador se apartan, alguna de las 216 combinaciones de algun programa lo dice.
  const INGRESOS: Record<string, [number, boolean][]> = {
    comunicarte: [[0, true], [10, true], [20, false], [30, false]],
    tactical: [[0, true], [10, false], [20, false], [30, false]],
    confianza: [[0, true], [10, false], [20, false], [30, false]],
    memorable: [[0, true], [10, false], [20, false], [30, false]],
  };
  const SITUACION = [0, 0, 10, 20, 20, 10];
  const NIVEL = ["BAJO VALOR", "VALOR MEDIO", "ALTO VALOR", "MUY ALTO VALOR"];

  it.each(Object.keys(INGRESOS))("el form generado de %s y el decodificador dan el estandar en las 216 combinaciones", (slug) => {
    const form = JSON.parse(readFileSync(`docs/dapta/${slug}.json`, "utf8"));
    const paso = (key: string) => form.config.steps.find((s: { key: string }) => s.key === key);
    const puntos = (key: string) => paso(key).options.map((o: { points: number }) => o.points);
    const corte = paso("agenda").hideWhen;
    expect(corte).toEqual({ field: "@score", op: "lt", value: -10 });
    for (const [a, ing] of puntos("ingreso").entries())
      for (const [b, urg] of puntos("urgencia").entries())
        for (const [c, sit] of puntos("situacion").entries())
          for (const [d, inv] of puntos("inversion").entries()) {
            const score = ing + urg + sit + inv;
            const [hvm, descIngreso] = INGRESOS[slug][a];
            const desc = Number(descIngreso) + Number(b === 2) + Number(d === 2);
            const valor = hvm + SITUACION[c];
            const nivel = (valor >= 30 ? 3 : valor >= 15 ? 2 : 1) - Number(desc > 0) - Number(b === 1) - Number(d === 1);
            expect(calidadDesdeScore(score), `${slug} ${[a, b, c, d]}`).toEqual({
              estado: desc ? "setteo_no_calificado" : "con_calendly_sin_agenda",
              leadValue: NIVEL[Math.max(nivel, 0)],
              leadQuality: desc ? "Low" : "High",
            });
            expect(score < corte.value, "ve el Calendly solo sin descalificantes").toBe(desc > 0);
            const outcome = form.config.outcomes.find(
              (o: { minScore: number; maxScore?: number }) => score >= o.minScore && score <= (o.maxScore ?? Infinity),
            );
            expect(outcome.id).toBe(desc ? "en_revision" : "agendado");
          }
  });
});

function payload(): PayloadDapta {
  return payloadDaptaSchema.parse(structuredClone(completo));
}

describe("entradaDesdeDapta", () => {
  it("verifica x-forms-signature como HMAC-SHA256 hexadecimal", () => {
    const cuerpo = JSON.stringify(completo);
    const secreto = "secreto-dapta";
    const firma = `sha256=${createHmac("sha256", secreto).update(cuerpo).digest("hex")}`;
    expect(PROVEEDORES.dapta.verificarFirma(cuerpo, firma, secreto)).toBe(true);
    expect(PROVEEDORES.dapta.verificarFirma(cuerpo, "sha256=ABCDEF", secreto)).toBe(false);
  });

  it("🩸 la plantilla del programa en titulos de Typeform no le quita el correo a Dapta (117 + 130)", () => {
    // La plantilla vale para todas las fuentes del programa; si pisara la llave fija
    // `email`, ningun envio de Dapta de ese programa tendria lead.
    const conPlantilla = {
      ...OPCIONES,
      mapeo: { campos: { correo: "correo electronico", telefono: "whatsapp", nombre: "nombre completo" } },
    };
    const resultado = construirEnvio(entradaDesdeDapta(payload(), conPlantilla));
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.envio.identidad.correo).toBeTruthy();
  });

  it("marca como parcial solo phase partial", () => {
    expect(entradaDesdeDapta(payloadDaptaSchema.parse(parcial), OPCIONES).esParcial).toBe(true);
    expect(entradaDesdeDapta(payload(), OPCIONES).esParcial).toBe(false);
  });

  it("toma el token de submission.id y la fecha de submittedAt", () => {
    const resultado = construirEnvio(entradaDesdeDapta(payload(), OPCIONES));
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.envio.token).toBe("submission-dapta-001");
    expect(resultado.envio.fechaEnvio?.toISOString()).toBe("2026-09-20T15:00:00.000Z");
  });

  it("convierte data en columnas y aplana objetos sin perder campos nuevos", () => {
    const p = payload();
    p.data = {
      ...p.data,
      booleano: true,
      opciones: ["uno", "dos"],
      direccion: { ciudad: "Bogotá", codigo: 110111 },
      vacio: null,
    };
    const entrada = entradaDesdeDapta(p, OPCIONES);
    expect(entrada.columnas.nombre_dividido).toBe("Ana Pérez");
    expect(entrada.columnas.booleano).toBe("true");
    expect(entrada.columnas.opciones).toBe("uno, dos");
    expect(entrada.columnas["direccion.ciudad"]).toBe("Bogotá");
    expect(entrada.columnas["direccion.codigo"]).toBe("110111");
    expect(entrada.columnas.vacio).toBeNull();
  });

  it("resuelve las cinco UTM nativas y utm_id por el mapeo comun", () => {
    const entrada = entradaDesdeDapta(payload(), OPCIONES);
    const valor = (campo: keyof typeof entrada.campos) =>
      entrada.columnas[entrada.campos[campo]!];
    expect(valor("utmSource")).toBe("facebook");
    expect(valor("utmMedium")).toBe("paid_social");
    expect(valor("utmCampaign")).toBe("tactical-septiembre");
    expect(valor("utmContent")).toBe("anuncio-a");
    expect(valor("utmTerm")).toBe("instagram_reels");
    expect(valor("utmId")).toBe("120212345678900001");
  });

  it("🩸 las UTM del cuerpo REAL de Dapta llegan con prefijo utm_ (130, 1-oct)", () => {
    // El fixture sintetico decia `utm.source`; Dapta manda `utm.utm_source` y `utm.utm_id`.
    // Con la forma inventada, los primeros envios reales entraron sin ninguna UTM y sin error.
    const entrada = entradaDesdeDapta(payloadDaptaSchema.parse(realUtm), OPCIONES);
    const valor = (campo: keyof typeof entrada.campos) =>
      entrada.columnas[entrada.campos[campo]!];
    expect(valor("utmSource")).toBe("prueba");
    expect(valor("utmMedium")).toBe("test");
    expect(valor("utmCampaign")).toBe("p130_4_utm");
    expect(valor("utmContent")).toBe("contenido_a");
    expect(valor("utmTerm")).toBe("termino_b");
    expect(valor("utmId")).toBe("123456");
  });

  it("los cuerpos reales de Dapta pasan el schema y construyen un envio con correo", () => {
    for (const cuerpo of [realParcial, realAgenda, realUtm]) {
      const resultado = construirEnvio(entradaDesdeDapta(payloadDaptaSchema.parse(cuerpo), OPCIONES));
      expect(resultado.ok).toBe(true);
      if (!resultado.ok) continue;
      expect(resultado.envio.identidad.correo).toBe("ana.prueba@example.com");
    }
  });

  it("separa outcome literalmente y nunca deduce una cita desde data.agenda", () => {
    const entrada = entradaDesdeDapta(payload(), OPCIONES);
    expect(entrada.columnas.outcome).toBe("con_calendly_sin_agenda|MUY ALTO VALOR|High");
    expect(entrada.columnas.__estado).toBe("con_calendly_sin_agenda");
    expect(entrada.leadValue).toBe("MUY ALTO VALOR");
    expect(entrada.leadQuality).toBe("High");
    expect(entrada.linkAgenda).toBeNull();
  });

  it.each([
    ["completo con agenda", realAgenda],
    ["completo con UTM", realUtm],
    ["parcial sin agenda", realParcial],
  ])("deriva del score el mismo resultado del outcome original: %s", (_nombre, cuerpo) => {
    const original = entradaDesdeDapta(payloadDaptaSchema.parse(cuerpo), OPCIONES);
    const conTitulo = structuredClone(cuerpo);
    conTitulo.submission.outcome = "Gracias ¡nos vemos en tu entrevista!";
    const derivado = entradaDesdeDapta(payloadDaptaSchema.parse(conTitulo), OPCIONES);

    expect({
      estado: derivado.columnas.__estado,
      leadValue: derivado.leadValue,
      leadQuality: derivado.leadQuality,
    }).toEqual({
      estado: original.columnas.__estado,
      leadValue: original.leadValue,
      leadQuality: original.leadQuality,
    });
    expect(derivado.columnas.outcome).toBe("Gracias ¡nos vemos en tu entrevista!");
  });

  it("copia y redondea el score del formulario sin calcularlo", () => {
    const p = payload();
    p.submission.score = 17.6;
    expect(entradaDesdeDapta(p, OPCIONES).puntaje).toBe(18);
  });

  it("redondea el score antes de derivar la calidad", () => {
    const p = payload();
    p.submission.score = 29.6;
    p.submission.outcome = "Gracias ¡nos vemos en tu entrevista!";
    expect(entradaDesdeDapta(p, OPCIONES).leadValue).toBe("MUY ALTO VALOR");
  });

  it("deja vacia la calidad si el outcome no tiene tres partes y no hay score", () => {
    const p = payload();
    delete p.submission.score;
    p.submission.outcome = "Gracias ¡nos vemos en tu entrevista!";
    const entrada = entradaDesdeDapta(p, OPCIONES);
    expect(entrada.columnas.__estado).toBe("");
    expect(entrada.leadValue).toBeNull();
    expect(entrada.leadQuality).toBeNull();
  });

  it("guarda metadatos permitidos y excluye delivery, sesion y hutk", () => {
    const columnas = entradaDesdeDapta(payload(), OPCIONES).columnas;
    expect(columnas["form.id"]).toBe("form-dapta-tactical");
    expect(columnas["form.name"]).toBe("Aplicación Tactical Investor");
    expect(columnas["visit.pageUri"]).toBe("https://retia.co/tactical");
    expect(columnas).not.toHaveProperty("id");
    expect(columnas).not.toHaveProperty("sessionId");
    expect(columnas).not.toHaveProperty("visit.hutk");
  });

  it("acepta una visita con pagina desconocida (Dapta manda null, no la omite)", () => {
    const crudo = structuredClone(completo) as Record<string, unknown>;
    crudo.visit = { pageUri: null, pageName: null, embedded: true };
    const entrada = entradaDesdeDapta(payloadDaptaSchema.parse(crudo), OPCIONES);
    expect(entrada.columnas["visit.pageUri"]).toBeNull();
  });
});
