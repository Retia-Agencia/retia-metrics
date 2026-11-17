import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { alertasActivas, REGISTRO_DE_ALERTAS } from "@/lib/alertas/registro";
import { calls, programs, sobresCrudos, sources, submissions, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import type { SaludDeFuenteConDatos } from "@/lib/queries/salud-fuentes";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

const AHORA = new Date("2026-11-13T10:00:00-05:00");
const hace = (horas: number) => new Date(AHORA.getTime() - horas * 3_600_000);

const FUENTE_CON_TRAZA: SaludDeFuenteConDatos = {
  sourceId: "fuente-traza",
  nombre: "Formulario principal",
  programId: "programa-traza",
  programaNombre: "Programa Alertas",
  estado: "al_dia",
  marcada: true,
  sobresPendientes: 0,
  sinCalidad: 0,
  pagos: 5,
  pagosSinId: 4,
  pagosSinFbclid: 0,
  pagosIdDesconocido: 0,
  trazaRota: true,
  fbclidRoto: false,
  umbralSinRespuestaHoras: 48,
  umbralMuertaHoras: 120,
  ultimo: AHORA,
  penultimo: hace(1),
  llamadasSueltasViejas: 0,
  dealsConCitaSinLlamada: 0,
  diagnosticoTraza: null,
  anunciosSinId: [],
};

const textoDeTraza = (cambios: Partial<SaludDeFuenteConDatos>) =>
  REGISTRO_DE_ALERTAS.traza_de_pauta_rota.evaluar({
    fuentes: [{ ...FUENTE_CON_TRAZA, ...cambios }],
    hostsSinCloser: [],
  }, AHORA)[0].texto;

describe("texto de traza_de_pauta_rota", () => {
  it("explica cuando la traza se pierde antes del formulario", () => {
    expect(textoDeTraza({ diagnosticoTraza: "se_pierde_antes_del_formulario" })).toBe(
      "🟡 Programa Alertas · Formulario principal: de 5 envíos pagos, 4 sin identificador del anuncio. Los anuncios de Meta sí lo mandan: se pierde entre el clic y el formulario. Revisar la landing o el formulario.",
    );
  });

  it("nombra los anuncios cuyas plantillas no mandan el identificador", () => {
    expect(textoDeTraza({ diagnosticoTraza: "anuncios_sin_id", anunciosSinId: ["Anuncio A", "Anuncio B"] })).toBe(
      "🟡 Programa Alertas · Formulario principal: de 5 envíos pagos, 4 sin identificador del anuncio. Estos anuncios de Meta no lo llevan en sus parámetros de URL: Anuncio A, Anuncio B. Corregirlos en Meta.",
    );
  });

  it("conserva el texto actual cuando no hay diagnostico", () => {
    expect(textoDeTraza({ diagnosticoTraza: null })).toBe(
      "🟡 Programa Alertas · Formulario principal: de 5 envíos pagos, 4 sin identificador del anuncio. Revisar en Ajustes › Webhook Health.",
    );
  });

  it("agrega el problema de clic como una frase aparte", () => {
    expect(textoDeTraza({
      diagnosticoTraza: "se_pierde_antes_del_formulario",
      fbclidRoto: true,
      pagosSinFbclid: 3,
    })).toBe(
      "🟡 Programa Alertas · Formulario principal: de 5 envíos pagos, 4 sin identificador del anuncio. Los anuncios de Meta sí lo mandan: se pierde entre el clic y el formulario. Revisar la landing o el formulario. Además, 3 sin identificador del clic.",
    );
  });
});

describe("registro de alertas tecnicas", () => {
  let db: Db;
  let cerrar: () => Promise<void>;
  let vaciar: () => Promise<void>;
  let programId: string;
  let sourceId: string;
  let closerId: string;

  beforeAll(async () => {
    ({ db, cerrar, vaciar } = await crearBaseReutilizable());
  });

  beforeEach(async () => {
    await vaciar();
    const [programa] = await db.insert(programs).values({
      ...PROGRAMA_DE_PRUEBA,
      slug: "alertas",
      nombre: "Programa Alertas",
      ticketUsd: "1000",
    }).returning();
    programId = programa.id;
    const [fuente] = await db.insert(sources).values({
      programId,
      nombre: "Formulario principal",
      tipo: "webhook",
      proveedor: "typeform",
      activo: true,
    }).returning();
    sourceId = fuente.id;
    const [closer] = await db.insert(users).values({
      email: "closer-alertas@retia.test",
      nombre: "Closer Alertas",
      rol: "closer",
    }).returning();
    closerId = closer.id;
  });

  afterAll(async () => cerrar());

  it("publica un sobre pendiente y lo retira cuando se limpia el error, sin filtrar datos personales", async () => {
    await db.insert(submissions).values({
      sourceId,
      token: "reciente",
      createdAt: hace(1),
      leadQuality: "High",
    });
    const [sobre] = await db.insert(sobresCrudos).values({
      sourceId,
      programId,
      cuerpo: JSON.stringify({ nombre: "Nombre Privado", email: "privado@example.com" }),
      error: "fallo simulado",
    }).returning();

    const alertas = await alertasActivas(db, AHORA);

    expect(alertas).toHaveLength(1);
    expect(alertas[0]).toMatchObject({
      clave: `sobres_con_error:${sourceId}`,
      tipo: "sobres_con_error",
      severidad: "critica",
    });
    expect(JSON.stringify(alertas)).not.toContain("Nombre Privado");
    expect(JSON.stringify(alertas)).not.toContain("privado@example.com");

    await db.update(sobresCrudos).set({ error: null }).where(eq(sobresCrudos.id, sobre.id));
    expect(await alertasActivas(db, AHORA)).toEqual([]);
  });

  it("publica una fuente silenciosa despues de superar su umbral", async () => {
    await db.insert(submissions).values({
      sourceId,
      token: "silenciosa",
      createdAt: hace(49),
      leadQuality: "High",
    });

    const alertas = await alertasActivas(db, AHORA);

    expect(alertas).toHaveLength(2);
    const alerta = alertas.find((item) => item.tipo === "fuente_silenciosa");
    expect(alerta).toMatchObject({
      clave: `fuente_silenciosa:${sourceId}`,
      tipo: "fuente_silenciosa",
      severidad: "critica",
    });
    expect(alerta?.texto).toContain("49 horas sin envíos");
  });

  it("publica el silencio global cuando toda fuente activa lleva mas de tres horas sin envios", async () => {
    await db.insert(submissions).values({
      sourceId,
      token: "global-silenciosa",
      createdAt: hace(4),
      leadQuality: "High",
    });

    expect(await alertasActivas(db, AHORA)).toContainEqual(expect.objectContaining({
      clave: "sin_envios_global:todas",
      tipo: "sin_envios_global",
      severidad: "critica",
    }));
  });

  it("no publica el silencio global cuando hay un envio reciente", async () => {
    await db.insert(submissions).values({
      sourceId,
      token: "global-reciente",
      createdAt: hace(2),
      leadQuality: "High",
    });

    expect((await alertasActivas(db, AHORA)).some((alerta) => alerta.tipo === "sin_envios_global")).toBe(false);
  });

  it("no publica el silencio global cuando no hay fuentes activas", async () => {
    await db.update(sources).set({ activo: false }).where(eq(sources.id, sourceId));

    expect((await alertasActivas(db, AHORA)).some((alerta) => alerta.tipo === "sin_envios_global")).toBe(false);
  });

  it("publica una cuenta host con una cita sin closer sin filtrar el correo del lead", async () => {
    await db.insert(calls).values({
      programId,
      origen: "calendly",
      resultado: "agendada",
      calendlyHostEmail: "Cuenta@Calendly.co",
      emailLead: "lead-privado@ejemplo.co",
      fechaAgenda: hace(-24),
    });

    const alertas = (await alertasActivas(db, AHORA))
      .filter((alerta) => alerta.tipo === "host_de_calendly_sin_closer");

    expect(alertas).toHaveLength(1);
    expect(alertas[0]).toMatchObject({
      clave: `host_de_calendly_sin_closer:${programId}:cuenta@calendly.co`,
      tipo: "host_de_calendly_sin_closer",
      severidad: "critica",
    });
    expect(alertas[0].texto).toContain("Programa Alertas");
    expect(alertas[0].texto).toContain("cuenta@calendly.co");
    expect(alertas[0].texto).toContain("1 cita agendada");
    expect(alertas[0].texto).not.toContain("lead-privado@ejemplo.co");
  });

  it("agrupa dos citas del mismo host sin distinguir mayusculas", async () => {
    await db.insert(calls).values([
      { programId, origen: "calendly", resultado: "agendada", calendlyHostEmail: "Cuenta@Calendly.co" },
      { programId, origen: "calendly", resultado: "agendada", calendlyHostEmail: "cuenta@calendly.CO" },
    ]);

    const alertas = (await alertasActivas(db, AHORA))
      .filter((alerta) => alerta.tipo === "host_de_calendly_sin_closer");

    expect(alertas).toHaveLength(1);
    expect(alertas[0].texto).toContain("2 citas agendadas");
  });

  it("ignora citas con closer, anuladas o con un resultado distinto de agendada", async () => {
    await db.insert(calls).values([
      {
        programId,
        origen: "calendly",
        resultado: "agendada",
        calendlyHostEmail: "con-closer@calendly.co",
        closerUserId: closerId,
      },
      {
        programId,
        origen: "calendly",
        resultado: "agendada",
        calendlyHostEmail: "anulada@calendly.co",
        anuladoEn: AHORA,
        anuladoPor: closerId,
        motivoAnulacion: "Prueba",
      },
      {
        programId,
        origen: "calendly",
        resultado: "show",
        calendlyHostEmail: "show@calendly.co",
      },
    ]);

    expect((await alertasActivas(db, AHORA))
      .some((alerta) => alerta.tipo === "host_de_calendly_sin_closer")).toBe(false);
  });

  it("mantiene el mismo host separado por programa", async () => {
    const [segundoPrograma] = await db.insert(programs).values({
      ...PROGRAMA_DE_PRUEBA,
      slug: "alertas-segundo",
      nombre: "Programa Alertas Segundo",
      ticketUsd: "1000",
    }).returning();
    await db.insert(calls).values([
      { programId, origen: "calendly", resultado: "agendada", calendlyHostEmail: "host@calendly.co" },
      { programId: segundoPrograma.id, origen: "calendly", resultado: "agendada", calendlyHostEmail: "host@calendly.co" },
    ]);

    const alertas = (await alertasActivas(db, AHORA))
      .filter((alerta) => alerta.tipo === "host_de_calendly_sin_closer");

    expect(alertas).toHaveLength(2);
    expect(alertas.map((alerta) => alerta.clave)).toEqual([
      `host_de_calendly_sin_closer:${programId}:host@calendly.co`,
      `host_de_calendly_sin_closer:${segundoPrograma.id}:host@calendly.co`,
    ].sort());
  });
});
