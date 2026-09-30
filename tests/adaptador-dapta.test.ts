import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  entradaDesdeDapta,
  payloadDaptaSchema,
  type PayloadDapta,
} from "@/lib/ingesta/adaptador-dapta";
import { construirEnvio } from "@/lib/ingesta/envio";
import { PROVEEDORES } from "@/lib/ingesta/proveedores";
import completo from "./fixtures/dapta-completo.json";
import parcial from "./fixtures/dapta-parcial.json";

const OPCIONES = { sourceId: "src-dapta", zona: "America/Bogota" };

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

  it("separa outcome literalmente y nunca deduce una cita desde data.agenda", () => {
    const entrada = entradaDesdeDapta(payload(), OPCIONES);
    expect(entrada.columnas.outcome).toBe("con_calendly_sin_agenda|MUY ALTO VALOR|High");
    expect(entrada.columnas.__estado).toBe("con_calendly_sin_agenda");
    expect(entrada.leadValue).toBe("MUY ALTO VALOR");
    expect(entrada.leadQuality).toBe("High");
    expect(entrada.linkAgenda).toBeNull();
  });

  it("copia y redondea el score del formulario sin calcularlo", () => {
    const p = payload();
    p.submission.score = 17.6;
    expect(entradaDesdeDapta(p, OPCIONES).puntaje).toBe(18);
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
