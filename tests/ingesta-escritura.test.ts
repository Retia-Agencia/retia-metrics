import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { changeLog, leadContactos, leads, programs, sources, submissions } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import type { EntradaEnvio } from "@/lib/ingesta/envio";
import type { Calificacion } from "@/lib/ingesta/calificacion";
import { entradasDesdeMatriz } from "@/lib/ingesta/adaptador-sheets";
import { ingerirEntradas, resumirEnvios } from "@/lib/ingesta/ingerir";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

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
  nombre: "Nombre completo",
  fechaEnvio: "Submitted At",
  estadoHoja: "Estado",
  utmSource: "utm_source",
  utmMedium: "utm_medium",
  utmCampaign: "utm_campaign",
} as const;

/** Una entrada con forma de fila de hoja. `fecha` nula = parcial (placeholder de Typeform). */
function entrada(o: {
  token: string;
  correo?: string;
  telefono?: string;
  nombre?: string;
  fecha?: string | null;
  posicion?: number | null;
  utmSource?: string;
  pregunta?: string;
  agenda?: string;
  estado?: string;
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
      "Nombre completo": o.nombre ?? "",
      "Submitted At": o.fecha === null ? "1/1/0001 0:00:00" : (o.fecha ?? "2026-09-20T15:00:00Z"),
      Estado: o.estado ?? "",
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
  const [p] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "tactical", nombre: "Tactical", ticketUsd: "1500" }).returning();
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
    const [otro] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "comunicarte", nombre: "C", ticketUsd: "797" }).returning();
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
    const [otro] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "comunicarte", nombre: "C", ticketUsd: "797" }).returning();
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

describe("ingerirEntradas: el Estado lo pone el formulario (ADR 0054, ticket 051)", () => {
  // Cada fila del contrato, con la etiqueta EXACTA que escribe el Apps Script en la
  // columna Estado y el valor del enum que le corresponde.
  const CONTRATO: [etiqueta: string, valor: Calificacion][] = [
    ["🗑️ Descartado", "descartado"],
    ["📞 Setteo No Calificado", "setteo_no_calificado"],
    ["📅 Con Calendly", "con_calendly"],
    ["📅 Con Calendly (Juanito)", "con_calendly"],
  ];

  it.each(CONTRATO)("la etiqueta de la hoja %s entra por el adaptador como %s", async (etiqueta, valor) => {
    // Por el adaptador de Sheets: una matriz con encabezados reales y la etiqueta cruda.
    const matriz: unknown[][] = [
      ["token", "correo electronico", "submitted at", "estado"],
      ["t1", "ana@correo.co", "2026-09-20T15:00:00Z", etiqueta],
    ];
    const [uno] = entradasDesdeMatriz(matriz, { sourceId, zona: "UTC" });
    const r = await ingerirEntradas(db, programId, [uno]);
    expect(r.sinCalificar).toEqual([]);
    const [envio] = await db.select().from(submissions);
    expect(envio.calificacion).toBe(valor);
    expect(envio.estadoHoja).toBe(etiqueta);
    const [lead] = await db.select().from(leads);
    expect(lead.calificacion).toBe(valor);
  });

  it.each(CONTRATO)("el valor del codigo %2$s entra directo por un Envio", async (_etiqueta, valor) => {
    // Lo que mandara el webhook (ticket 106): el valor del enform en la variable `estado`.
    await ingerirEntradas(db, programId, [entrada({ token: "t1", correo: "ana@correo.co", estado: valor })]);
    const [envio] = await db.select().from(submissions);
    expect(envio.calificacion).toBe(valor);
    const [lead] = await db.select().from(leads);
    expect(lead.calificacion).toBe(valor);
  });

  it("un valor inventado entra SIN calificacion y aparece en sinCalificar con su motivo", async () => {
    const r = await ingerirEntradas(db, programId, [
      entrada({ token: "t1", correo: "ana@correo.co", estado: "con calendly!" }),
    ]);
    expect(r.sinCalificar).toEqual([{ motivo: "estado no reconocido: con calendly!", envios: 1 }]);
    const [envio] = await db.select().from(submissions);
    expect(envio.calificacion).toBeNull();
    const [lead] = await db.select().from(leads);
    expect(lead.calificacion).toBeNull();
  });

  it("un COMPLETO sin estado es error visible; un PARCIAL sin estado NO lo es", async () => {
    // El completo (con fecha) sin estado se reporta; el parcial (sin fecha) no.
    const r = await ingerirEntradas(db, programId, [
      entrada({ token: "t1", correo: "ana@correo.co" }),
      entrada({ token: "t2", correo: "beto@correo.co", fecha: null }),
    ]);
    expect(r.sinCalificar).toEqual([{ motivo: "sin estado", envios: 1 }]);
  });

  it("un lead con un parcial POSTERIOR a su completo conserva el Estado del completo", async () => {
    // El completo trae Con Calendly; luego llega un parcial (sin fecha, sin estado). El
    // resumen del lead se queda con el del completo, no lo borra la parcial.
    await ingerirEntradas(db, programId, [
      entrada({ token: "t1", correo: "ana@correo.co", fecha: "2026-09-01T10:00:00Z", estado: "con_calendly", posicion: 2 }),
    ]);
    await ingerirEntradas(db, programId, [
      entrada({ token: "t1", correo: "ana@correo.co", fecha: null, posicion: 3 }),
    ]);
    const [lead] = await db.select().from(leads);
    expect(lead.calificacion).toBe("con_calendly");
  });
});

describe("ingerirEntradas: el nombre del lead y sus contactos (tarea A del ticket 106)", () => {
  it("el nombre se escribe en submissions.nombre y en leads.nombre", async () => {
    await ingerirEntradas(db, programId, [
      entrada({ token: "t1", correo: "ana@correo.co", nombre: "Ana Pérez", fecha: "2026-09-20T15:00:00Z" }),
    ]);
    const [envio] = await db.select().from(submissions);
    expect(envio.nombre).toBe("Ana Pérez");
    const [lead] = await db.select().from(leads);
    expect(lead.nombre).toBe("Ana Pérez");
  });

  it("un nombre con solo espacios queda null (no un nombre en blanco)", async () => {
    await ingerirEntradas(db, programId, [
      entrada({ token: "t1", correo: "ana@correo.co", nombre: "   " }),
    ]);
    const [envio] = await db.select().from(submissions);
    expect(envio.nombre).toBeNull();
    const [lead] = await db.select().from(leads);
    expect(lead.nombre).toBeNull();
  });

  it("cuando llega un envio con nombre, el lead lo adquiere y deja rastro en change_log", async () => {
    await ingerirEntradas(db, programId, [entrada({ token: "t1", correo: "ana@correo.co", fecha: null })]);
    let [lead] = await db.select().from(leads);
    expect(lead.nombre).toBeNull();

    await ingerirEntradas(db, programId, [
      entrada({ token: "t1", correo: "ana@correo.co", nombre: "Ana Pérez", fecha: "2026-09-20T15:00:00Z" }),
    ]);
    [lead] = await db.select().from(leads);
    expect(lead.nombre).toBe("Ana Pérez");
    const rastro = await db
      .select()
      .from(changeLog)
      .where(eq(changeLog.registroId, lead.id));
    expect(rastro.map((c) => c.campo)).toContain("nombre");
  });

  it("🩸 un lead con nombre NO lo pierde cuando llega un envio anonimo", async () => {
    await ingerirEntradas(db, programId, [
      entrada({ token: "t1", correo: "ana@correo.co", nombre: "Ana Pérez", fecha: "2026-09-20T15:00:00Z", posicion: 2 }),
    ]);
    // Un re-envio (otro token) sin nombre: el resumen se recalcula, pero el nombre se
    // conserva porque el lead ya tenia uno.
    await ingerirEntradas(db, programId, [
      entrada({ token: "t2", correo: "ana@correo.co", fecha: "2026-09-25T15:00:00Z", posicion: 3 }),
    ]);
    const [lead] = await db.select().from(leads);
    expect(lead.nombre).toBe("Ana Pérez");
  });

  it("todo correo y todo telefono de todos los envios terminan en lead_contactos", async () => {
    // Dos envios con datos de contacto distintos: el correo manda (mismo lead), y el
    // segundo telefono entra como contacto no principal. El principal es el primero.
    await ingerirEntradas(db, programId, [
      entrada({ token: "t1", correo: "ana@correo.co", telefono: "+573001234567", nombre: "Ana", posicion: 2 }),
    ]);
    await ingerirEntradas(db, programId, [
      entrada({ token: "t2", correo: "ana@correo.co", telefono: "3119998877", posicion: 3 }),
    ]);
    const contactos = await db.select().from(leadContactos);
    // El correo y los dos telefonos, todos guardados.
    const correos = contactos.filter((c) => c.tipo === "correo").map((c) => c.valor);
    const telefonos = contactos.filter((c) => c.tipo === "telefono").map((c) => c.valor).sort();
    expect(correos).toEqual(["ana@correo.co"]);
    expect(telefonos).toEqual(["3119998877", "573001234567"]);
    // El principal es el primero; leads.telefono es ese.
    const [lead] = await db.select().from(leads);
    expect(lead.telefono).toBe("573001234567");
  });

  it("el formato +57 de Typeform se normaliza a digitos como principal", async () => {
    await ingerirEntradas(db, programId, [
      entrada({ token: "t1", correo: "ana@correo.co", telefono: "+573001234567" }),
    ]);
    const [lead] = await db.select().from(leads);
    expect(lead.telefono).toBe("573001234567");
    const [tel] = await db.select().from(leadContactos).where(eq(leadContactos.tipo, "telefono"));
    expect(tel.valor).toBe("573001234567");
    expect(tel.esPrincipal).toBe(true);
  });
});

describe("resumirEnvios", () => {
  const base = {
    sourceId: "s",
    nombre: null,
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

  describe("el nombre (tarea A del ticket 106)", () => {
    it("toma el del envio COMPLETO mas reciente con nombre no vacio", () => {
      const r = resumirEnvios(
        [
          { ...base, token: "a", fechaEnvio: new Date("2026-09-01T00:00:00Z"), utmSource: null, nombre: "Ana Vieja" },
          { ...base, token: "b", fechaEnvio: new Date("2026-09-10T00:00:00Z"), utmSource: null, nombre: "Ana Nueva" },
        ],
        null,
      );
      expect(r.nombre).toBe("Ana Nueva");
    });

    it("un completo con nombre le gana a un parcial POSTERIOR sin nombre", () => {
      const r = resumirEnvios(
        [
          { ...base, token: "a", fechaEnvio: new Date("2026-09-01T00:00:00Z"), utmSource: null, nombre: "Ana" },
          { ...base, token: "b", esParcial: true, fechaEnvio: new Date("2026-09-10T00:00:00Z"), utmSource: null, nombre: null },
        ],
        null,
      );
      expect(r.nombre).toBe("Ana");
    });

    it("si ningun completo trae nombre, toma el del parcial mas reciente con nombre", () => {
      const r = resumirEnvios(
        [
          { ...base, token: "a", esParcial: true, fechaEnvio: new Date("2026-09-01T00:00:00Z"), utmSource: null, nombre: "Ana Parcial 1" },
          { ...base, token: "b", esParcial: true, fechaEnvio: new Date("2026-09-05T00:00:00Z"), utmSource: null, nombre: "Ana Parcial 2" },
        ],
        null,
      );
      expect(r.nombre).toBe("Ana Parcial 2");
    });

    it("un envio sin fecha con nombre aporta cuando ninguno fechado lo trae", () => {
      const r = resumirEnvios(
        [{ ...base, token: "a", esParcial: true, fechaEnvio: null, utmSource: null, nombre: "Ana Sin Fecha" }],
        null,
      );
      expect(r.nombre).toBe("Ana Sin Fecha");
    });

    it("🩸 si NINGUN envio trae nombre, conserva el nombre actual del lead", () => {
      const r = resumirEnvios(
        [{ ...base, token: "a", fechaEnvio: new Date("2026-09-01T00:00:00Z"), utmSource: null, nombre: null }],
        null,
        "Nombre Creado A Mano",
      );
      expect(r.nombre).toBe("Nombre Creado A Mano");
    });

    it("sin nombre en los envios y sin nombre actual, queda null", () => {
      const r = resumirEnvios(
        [{ ...base, token: "a", fechaEnvio: new Date("2026-09-01T00:00:00Z"), utmSource: null, nombre: null }],
        null,
      );
      expect(r.nombre).toBeNull();
    });
  });

  describe("los valores del lead: puntaje, leadQuality y leadValue", () => {
    it("🩸 un envio completo con calificacion null pero con valores SI los trae al resumen", () => {
      const r = resumirEnvios(
        [
          {
            ...base,
            token: "a",
            fechaEnvio: new Date("2026-09-01T00:00:00Z"),
            utmSource: null,
            calificacion: null,
            puntaje: 7,
            leadQuality: "High",
            leadValue: "1500",
          },
        ],
        null,
      );
      expect(r.calificacion).toBeNull();
      expect(r.puntaje).toBe(7);
      expect(r.leadQuality).toBe("High");
      expect(r.leadValue).toBe("1500");
    });

    it("con dos envios completos con valores, gana el mas reciente por fecha", () => {
      const r = resumirEnvios(
        [
          {
            ...base,
            token: "a",
            fechaEnvio: new Date("2026-09-01T00:00:00Z"),
            utmSource: null,
            calificacion: null,
            puntaje: 3,
            leadQuality: "Low",
            leadValue: "797",
          },
          {
            ...base,
            token: "b",
            fechaEnvio: new Date("2026-09-10T00:00:00Z"),
            utmSource: null,
            calificacion: null,
            puntaje: 9,
            leadQuality: "High",
            leadValue: "1500",
          },
        ],
        null,
      );
      expect(r.puntaje).toBe(9);
      expect(r.leadQuality).toBe("High");
      expect(r.leadValue).toBe("1500");
    });

    it("sin ningun envio con valores, los tres quedan en null (nunca un valor por defecto)", () => {
      const r = resumirEnvios(
        [
          {
            ...base,
            token: "a",
            fechaEnvio: new Date("2026-09-01T00:00:00Z"),
            utmSource: null,
            calificacion: "con_calendly" as Calificacion,
            puntaje: null,
            leadQuality: null,
            leadValue: null,
          },
        ],
        null,
      );
      expect(r.puntaje).toBeNull();
      expect(r.leadQuality).toBeNull();
      expect(r.leadValue).toBeNull();
    });

    it("la calificacion sigue saliendo del envio calificado, ajena a los valores", () => {
      const r = resumirEnvios(
        [
          {
            ...base,
            token: "a",
            fechaEnvio: new Date("2026-09-01T00:00:00Z"),
            utmSource: null,
            calificacion: "con_calendly" as Calificacion,
            puntaje: null,
            leadQuality: null,
            leadValue: null,
          },
          {
            ...base,
            token: "b",
            fechaEnvio: new Date("2026-09-10T00:00:00Z"),
            utmSource: null,
            calificacion: null,
            puntaje: 8,
            leadQuality: "High",
            leadValue: "1500",
          },
        ],
        null,
      );
      expect(r.calificacion).toBe("con_calendly");
      expect(r.puntaje).toBe(8);
      expect(r.leadQuality).toBe("High");
      expect(r.leadValue).toBe("1500");
    });
  });
});
