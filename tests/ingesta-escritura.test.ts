import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { changeLog, leadContactos, leads, programs, sources, submissions } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import type { EntradaEnvio } from "@/lib/ingesta/envio";
import { ingerirEntradas, resumirEnvios } from "@/lib/ingesta/ingerir";
import type { ConfigCalificacion } from "@/lib/ingesta/calificacion";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";

/**
 * La escritura de la ingesta (tickets 048-050), contra PGlite con TODAS las migraciones:
 * el indice `(fuente, token, es_parcial)` y el de `lead_contactos` son los de verdad.
 *
 * Lo que un bug aqui hace no es fallar: es mezclar dos personas, perder el evento "inicio
 * el formulario" o duplicar un envio en cada reintento del webhook. Por eso cada regla
 * tiene su caso.
 */

let db: Db;
let cerrar: () => Promise<void>;
let programId: string;
let sourceId: string;

const CAMPOS = {
  token: "Token",
  correo: "Correo",
  telefono: "WhatsApp",
  fechaEnvio: "Submitted At",
  utmSource: "utm_source",
  utmMedium: "utm_medium",
  utmCampaign: "utm_campaign",
} as const;

/** Una entrada con forma de fila de hoja. `fecha` nula = parcial (placeholder de Typeform). */
function entrada(o: {
  token: string;
  correo?: string;
  telefono?: string;
  fecha?: string | null;
  posicion?: number | null;
  utmSource?: string;
  pregunta?: string;
  agenda?: string;
  fuente?: string;
}): EntradaEnvio {
  return {
    sourceId: o.fuente ?? sourceId,
    zona: "UTC",
    posicion: o.posicion === undefined ? null : o.posicion,
    columnas: {
      Token: o.token,
      Correo: o.correo ?? "",
      WhatsApp: o.telefono ?? "",
      "Submitted At": o.fecha === null ? "1/1/0001 0:00:00" : (o.fecha ?? "2026-09-20T15:00:00Z"),
      utm_source: o.utmSource ?? "",
      utm_medium: "",
      utm_campaign: "",
      "Cuanto puedes invertir": o.pregunta ?? "",
      "Agenda aquí tu entrevista": o.agenda ?? "",
    },
    campos: { ...CAMPOS },
  };
}

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  const [p] = await db.insert(programs).values({ slug: "tactical", nombre: "Tactical", ticketUsd: "1500" }).returning();
  programId = p.id;
  const [f] = await db.insert(sources).values({ programId, nombre: "Typeform", tipo: "google_sheet" }).returning();
  sourceId = f.id;
});

afterEach(async () => {
  await cerrar();
});

describe("ingerirEntradas", () => {
  it("la parcial y la completa del mismo token son DOS envios y UN lead (ADR 0036 punto 4)", async () => {
    const r = await ingerirEntradas(db, programId, [
      entrada({ token: "t1", correo: "Ana@Correo.co", telefono: "300 123 4567", fecha: null, posicion: 2 }),
      entrada({ token: "t1", correo: "ana@correo.co", telefono: "3001234567", posicion: 3, pregunta: "Si" }),
    ]);

    expect(r.envios).toBe(2);
    expect(r.leadsNuevos).toBe(1);
    const envios = await db.select().from(submissions);
    expect(envios.map((e) => e.esParcial).sort()).toEqual([false, true]);
    expect(new Set(envios.map((e) => e.leadId)).size).toBe(1);

    const [lead] = await db.select().from(leads);
    expect(lead.emailNormalizado).toBe("ana@correo.co");
    // Una aplicacion, no dos: la parcial es el evento "inicio", no otra aplicacion.
    expect(lead.numAplicaciones).toBe(1);
    expect(lead.fechaPrimeraAplicacion?.toISOString()).toBe("2026-09-20T15:00:00.000Z");
    expect(lead.telefono).toBe("3001234567");

    const contactos = await db.select().from(leadContactos);
    expect(contactos.map((c) => [c.tipo, c.valor, c.esPrincipal, c.confirmado]).sort()).toEqual([
      ["correo", "ana@correo.co", true, true],
      ["telefono", "3001234567", true, true],
    ]);
    // Cada contacto sabe de que envio llego: el primero, la parcial.
    const parcial = envios.find((e) => e.esParcial)!;
    expect(contactos.every((c) => c.submissionId === parcial.id)).toBe(true);
  });

  it("es idempotente: un reintento no duplica nada ni escribe bitacora", async () => {
    const lote = [
      entrada({ token: "t1", correo: "ana@correo.co", telefono: "3001234567", posicion: 2 }),
      entrada({ token: "t2", correo: "beto@correo.co", posicion: 3 }),
    ];
    await ingerirEntradas(db, programId, lote);
    const r = await ingerirEntradas(db, programId, lote);

    expect(r.leadsNuevos).toBe(0);
    expect(r.leadsActualizados).toBe(0);
    expect(r.contactosNuevos).toBe(0);
    expect(r.cambiosRegistrados).toBe(0);
    expect(await db.select().from(submissions)).toHaveLength(2);
    expect(await db.select().from(leads)).toHaveLength(2);
    expect(await db.select().from(changeLog)).toHaveLength(0);
  });

  it("cuando llega la hermana completa, el lead se recalcula y deja rastro", async () => {
    await ingerirEntradas(db, programId, [entrada({ token: "t1", correo: "ana@correo.co", fecha: null })]);
    let [lead] = await db.select().from(leads);
    expect(lead.fechaPrimeraAplicacion).toBeNull();

    const r = await ingerirEntradas(db, programId, [
      entrada({ token: "t1", correo: "ana@correo.co", utmSource: "facebook" }),
    ]);
    [lead] = await db.select().from(leads);
    expect(lead.fechaPrimeraAplicacion?.toISOString()).toBe("2026-09-20T15:00:00.000Z");
    expect(lead.utmSource).toBe("facebook");
    expect(r.leadsActualizados).toBe(1);

    const rastro = await db.select().from(changeLog).where(eq(changeLog.registroId, lead.id));
    expect(rastro.map((c) => c.campo).sort()).toEqual([
      "fechaPrimeraAplicacion",
      "fechaUltimaAplicacion",
      "utmSource",
    ]);
  });

  it("un telefono conocido con otro correo une al MISMO lead, marcado y sin confirmar", async () => {
    await ingerirEntradas(db, programId, [entrada({ token: "t1", correo: "papa@correo.co", telefono: "3001234567" })]);
    const r = await ingerirEntradas(db, programId, [
      entrada({ token: "t2", correo: "hija@correo.co", telefono: "3001234567" }),
    ]);

    expect(r.leadsNuevos).toBe(0);
    expect(await db.select().from(leads)).toHaveLength(1);
    expect(r.posiblesDuplicados).toHaveLength(1);
    expect(r.posiblesDuplicados[0].motivo).toBe("unido_por_telefono");
    const [hija] = await db.select().from(leadContactos).where(eq(leadContactos.valor, "hija@correo.co"));
    expect(hija.confirmado).toBe(false);
    expect(hija.esPrincipal).toBe(false);
  });

  it("un telefono nuevo de un lead que ya tiene uno NO entra como segundo principal", async () => {
    await ingerirEntradas(db, programId, [entrada({ token: "t1", correo: "ana@correo.co", telefono: "3001234567" })]);
    await ingerirEntradas(db, programId, [entrada({ token: "t2", correo: "ana@correo.co", telefono: "3119998877" })]);

    const telefonos = await db.select().from(leadContactos).where(eq(leadContactos.tipo, "telefono"));
    expect(telefonos.filter((t) => t.esPrincipal).map((t) => t.valor)).toEqual(["3001234567"]);
    const [lead] = await db.select().from(leads);
    expect(lead.telefono).toBe("3001234567");
    expect(lead.numAplicaciones).toBe(2);
  });

  it("un envio sin correo y sin telefono conocido se guarda, sin lead", async () => {
    const r = await ingerirEntradas(db, programId, [entrada({ token: "t1", fecha: null })]);
    expect(r.envios).toBe(1);
    expect(r.enviosSinLead).toBe(1);
    const [envio] = await db.select().from(submissions);
    expect(envio.leadId).toBeNull();
    expect(await db.select().from(leads)).toHaveLength(0);
  });

  it("una fila sin token se rechaza con su posicion y no se inventa una llave", async () => {
    const r = await ingerirEntradas(db, programId, [entrada({ token: "", correo: "ana@correo.co", posicion: 7 })]);
    expect(r.rechazadas).toEqual([{ posicion: 7, motivo: "sin_token" }]);
    expect(await db.select().from(submissions)).toHaveLength(0);
  });

  it("dos versiones de la misma parcial se funden: gana la ultima de la hoja", async () => {
    const r = await ingerirEntradas(db, programId, [
      entrada({ token: "t1", correo: "ana@correo.co", fecha: null, posicion: 5, pregunta: "despues" }),
      entrada({ token: "t1", correo: "ana@correo.co", fecha: null, posicion: 2, pregunta: "antes" }),
    ]);
    expect(r.envios).toBe(1);
    const [envio] = await db.select().from(submissions);
    expect(envio.posicionEnHoja).toBe(5);
    expect((envio.respuestas as Record<string, string>)["Cuanto puedes invertir"]).toBe("despues");
  });

  it("el programa es frontera: una fuente de otro programa no escribe NADA", async () => {
    const [otro] = await db.insert(programs).values({ slug: "comunicarte", nombre: "C", ticketUsd: "797" }).returning();
    const [ajena] = await db.insert(sources).values({ programId: otro.id, nombre: "Otra" }).returning();

    await expect(
      ingerirEntradas(db, programId, [
        entrada({ token: "t1", correo: "ana@correo.co" }),
        entrada({ token: "t2", correo: "beto@correo.co", fuente: ajena.id }),
      ]),
    ).rejects.toMatchObject({ status: 422 });
    expect(await db.select().from(submissions)).toHaveLength(0);
    expect(await db.select().from(leads)).toHaveLength(0);
  });

  it("la misma persona en otro programa es OTRO lead", async () => {
    const [otro] = await db.insert(programs).values({ slug: "comunicarte", nombre: "C", ticketUsd: "797" }).returning();
    const [suya] = await db.insert(sources).values({ programId: otro.id, nombre: "Otra" }).returning();

    await ingerirEntradas(db, programId, [entrada({ token: "t1", correo: "ana@correo.co", telefono: "3001234567" })]);
    const r = await ingerirEntradas(db, otro.id, [
      entrada({ token: "t1", correo: "ana@correo.co", telefono: "3001234567", fuente: suya.id }),
    ]);
    expect(r.leadsNuevos).toBe(1);
    expect(r.posiblesDuplicados).toHaveLength(0);
    expect(await db.select().from(leads)).toHaveLength(2);
  });
});

describe("ingerirEntradas: calificacion y puntaje (T2, T4)", () => {
  const CONFIG: ConfigCalificacion = {
    preguntaPago: "Cuanto puedes invertir",
    respuestasSinRecursos: ["No cuento con los recursos"],
    campoAgenda: "Agenda aqui tu entrevista",
    puntaje: { version: 3, reglas: [{ pregunta: "Cuanto puedes invertir", respuesta: "Si", puntos: 10 }] },
  };
  const configurar = (c: unknown) => db.update(sources).set({ calificacion: c }).where(eq(sources.id, sourceId));

  it("sin configuracion el envio entra igual, SIN calificacion, y queda reportado", async () => {
    const r = await ingerirEntradas(db, programId, [entrada({ token: "t1", correo: "ana@correo.co", pregunta: "Si" })]);
    expect(r.sinCalificar).toEqual([{ motivo: "la fuente no tiene calificacion configurada", envios: 1 }]);
    const [envio] = await db.select().from(submissions);
    expect(envio.calificacion).toBeNull();
  });

  it("la parcial deja al lead incompleto y la completa lo corrige, con su puntaje y version", async () => {
    await configurar(CONFIG);
    await ingerirEntradas(db, programId, [entrada({ token: "t1", correo: "ana@correo.co", fecha: null, posicion: 2 })]);
    let [lead] = await db.select().from(leads);
    expect(lead.calificacion).toBe("incompleto");

    await ingerirEntradas(db, programId, [entrada({ token: "t1", correo: "ana@correo.co", posicion: 3, pregunta: "Si" })]);
    [lead] = await db.select().from(leads);
    expect(lead.calificacion).toBe("setteo");
    expect(lead.puntaje).toBe(10);
    const completa = (await db.select().from(submissions)).find((e) => !e.esParcial)!;
    expect(completa.versionPuntaje).toBe(3);
  });

  it("quien re-aplica con otra respuesta queda con la NUEVA (el script lo ignoraba)", async () => {
    await configurar(CONFIG);
    await ingerirEntradas(db, programId, [
      entrada({ token: "t1", correo: "ana@correo.co", fecha: "2026-09-01T10:00:00Z", pregunta: "No cuento con los recursos" }),
    ]);
    await ingerirEntradas(db, programId, [
      entrada({ token: "t2", correo: "ana@correo.co", fecha: "2026-09-10T10:00:00Z", pregunta: "Si", agenda: "https://calendly.com/x" }),
    ]);
    const [lead] = await db.select().from(leads);
    expect(lead.calificacion).toBe("con_agenda");
  });

  it("una configuracion que no casa con el formulario no califica a nadie como incompleto", async () => {
    await configurar({ ...CONFIG, preguntaPago: "Pregunta que no existe" });
    const r = await ingerirEntradas(db, programId, [entrada({ token: "t1", correo: "ana@correo.co", pregunta: "Si" })]);
    expect(r.sinCalificar[0].motivo).toContain("Pregunta que no existe");
    const [lead] = await db.select().from(leads);
    expect(lead.calificacion).toBeNull();
  });

  it("una configuracion guardada invalida detiene la ingesta sin escribir nada", async () => {
    await configurar({ preguntaPago: "" });
    await expect(
      ingerirEntradas(db, programId, [entrada({ token: "t1", correo: "ana@correo.co" })]),
    ).rejects.toMatchObject({ status: 422 });
    expect(await db.select().from(submissions)).toHaveLength(0);
  });
});

describe("resumirEnvios", () => {
  const base = {
    sourceId: "s",
    utmMedium: null,
    utmCampaign: null,
    posicionEnHoja: null,
    esParcial: false,
    calificacion: null,
    puntaje: null,
  };

  it("una fecha nula nunca le gana a una real, y un UTM vacio no borra el anterior", () => {
    const r = resumirEnvios(
      [
        { ...base, token: "a", fechaEnvio: new Date("2026-09-01T00:00:00Z"), utmSource: "facebook" },
        { ...base, token: "b", fechaEnvio: new Date("2026-09-10T00:00:00Z"), utmSource: null },
        { ...base, token: "c", fechaEnvio: null, utmSource: "parcial" },
      ],
      null,
    );
    expect(r.fechaPrimeraAplicacion?.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(r.fechaUltimaAplicacion?.toISOString()).toBe("2026-09-10T00:00:00.000Z");
    expect(r.utmSource).toBe("facebook");
    expect(r.numAplicaciones).toBe(3);
  });
});
