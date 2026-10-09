import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { leads, programs, sources, submissions, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { preguntasDisponiblesDelPrograma, respuestasDelUltimoEnvio } from "@/lib/queries/leads";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * Ticket 209 — "Mostrar respuestas del formulario" en la lista de Leads. Las columnas extra salen
 * del ÚLTIMO envío de cada lead (`respuestas` jsonb, la llave es el texto de la pregunta) y la lista
 * de preguntas disponibles son las llaves distintas de los envíos del programa. El programa es
 * frontera: nunca se cruza a otro. Ningún título de pregunta se escribe en el código: sale de los
 * datos sembrados.
 */

const MOTIVO = "¿Qué te motivó a hacer parte del programa?";
const EXPECTATIVA = "¿Qué esperas lograr?";
const AJENA = "Pregunta de otro programa";

let db: Db;
let cerrar: () => Promise<void>;
let programId: string;
let otroProgramId: string;
let sourceId: string;
let sourceAjeno: string;
const id: Record<string, string> = {};

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  const [p, q] = await db
    .insert(programs)
    .values([
      { ...PROGRAMA_DE_PRUEBA, slug: "p", nombre: "P", ticketUsd: "1000" },
      { ...PROGRAMA_DE_PRUEBA, slug: "q", nombre: "Q", ticketUsd: "1000" },
    ])
    .returning();
  programId = p.id;
  otroProgramId = q.id;
  const [f] = await db.insert(sources).values({ programId, nombre: "Typeform" }).returning();
  sourceId = f.id;
  const [fq] = await db.insert(sources).values({ programId: otroProgramId, nombre: "Typeform Q" }).returning();
  sourceAjeno = fq.id;
  await db.insert(users).values({ email: "g@retiagrowth.com", rol: "gerente" });

  const filas = await db
    .insert(leads)
    .values([
      { programId, emailNormalizado: "ana@c.co" },
      { programId, emailNormalizado: "beto@c.co" },
      { programId, emailNormalizado: "sin-envio@c.co" },
      { programId: otroProgramId, emailNormalizado: "ajeno@c.co" },
    ])
    .returning();
  for (const l of filas) id[l.emailNormalizado.split("@")[0]] = l.id;

  // Ana: dos envíos; el MÁS NUEVO (fechaEnvio mayor) gana. El viejo trae otra respuesta.
  await db.insert(submissions).values([
    {
      leadId: id.ana,
      sourceId,
      token: "ana-viejo",
      esParcial: false,
      fechaEnvio: new Date("2026-09-01T12:00:00Z"),
      respuestas: { [MOTIVO]: "respuesta vieja", [EXPECTATIVA]: "crecer (viejo)" },
    },
    {
      leadId: id.ana,
      sourceId,
      token: "ana-nuevo",
      esParcial: false,
      fechaEnvio: new Date("2026-09-10T12:00:00Z"),
      respuestas: { [MOTIVO]: "quería mejorar mis ventas", utm_source: "facebook" },
    },
  ]);
  // Beto: un solo envío, con una pregunta que Ana no tiene en su último envío.
  await db.insert(submissions).values({
    leadId: id.beto,
    sourceId,
    token: "beto-1",
    esParcial: false,
    fechaEnvio: new Date("2026-09-05T12:00:00Z"),
    respuestas: { [EXPECTATIVA]: "cerrar más tratos", [MOTIVO]: "" },
  });
  // El otro programa tiene su propia pregunta: nunca debe aparecer en el programa P.
  await db.insert(submissions).values({
    leadId: id.ajeno,
    sourceId: sourceAjeno,
    token: "ajeno-1",
    esParcial: false,
    fechaEnvio: new Date("2026-09-06T12:00:00Z"),
    respuestas: { [AJENA]: "algo" },
  });
});

afterEach(async () => {
  await cerrar();
});

describe("respuestasDelUltimoEnvio", () => {
  it("trae las respuestas del ÚLTIMO envío de cada lead pedido, con la pregunta como llave", async () => {
    const mapa = await respuestasDelUltimoEnvio(db, programId, [id.ana, id.beto]);
    expect(mapa.get(id.ana)).toEqual({ [MOTIVO]: "quería mejorar mis ventas" });
    // El envío viejo de Ana (y su EXPECTATIVA) no gana.
    expect(mapa.get(id.ana)).not.toHaveProperty(EXPECTATIVA);
    // Las UTM no entran como respuesta (tienen su propia columna "Canal").
    expect(mapa.get(id.ana)).not.toHaveProperty("utm_source");
    // Beto: una respuesta vacía no se guarda (es "sin dato", no un valor).
    expect(mapa.get(id.beto)).toEqual({ [EXPECTATIVA]: "cerrar más tratos" });
  });

  it("solo responde por los leads pedidos", async () => {
    const mapa = await respuestasDelUltimoEnvio(db, programId, [id.ana]);
    expect([...mapa.keys()]).toEqual([id.ana]);
  });

  it("un lead sin envíos no aparece en el mapa", async () => {
    const mapa = await respuestasDelUltimoEnvio(db, programId, [id.ana, id["sin-envio"]]);
    expect(mapa.has(id["sin-envio"])).toBe(false);
  });

  it("NUNCA trae un envío de otro programa, aunque se pase su id de lead", async () => {
    const mapa = await respuestasDelUltimoEnvio(db, programId, [id.ana, id.ajeno]);
    expect(mapa.has(id.ajeno)).toBe(false);
    // Y pedir el lead ajeno desde SU programa sí lo trae: la frontera es el programa, no el lead.
    const ajeno = await respuestasDelUltimoEnvio(db, otroProgramId, [id.ajeno]);
    expect(ajeno.get(id.ajeno)).toEqual({ [AJENA]: "algo" });
  });

  it("con la lista de ids vacía no consulta nada", async () => {
    const mapa = await respuestasDelUltimoEnvio(db, programId, []);
    expect(mapa.size).toBe(0);
  });
});

describe("preguntasDisponiblesDelPrograma", () => {
  it("son las llaves distintas de los envíos del programa, ordenadas, sin UTM", async () => {
    const preguntas = await preguntasDisponiblesDelPrograma(db, programId);
    expect(preguntas).toEqual([EXPECTATIVA, MOTIVO].sort((a, b) => a.localeCompare(b, "es")));
    expect(preguntas).not.toContain("utm_source");
  });

  it("NUNCA incluye las preguntas de otro programa", async () => {
    const preguntas = await preguntasDisponiblesDelPrograma(db, programId);
    expect(preguntas).not.toContain(AJENA);
    const ajenas = await preguntasDisponiblesDelPrograma(db, otroProgramId);
    expect(ajenas).toEqual([AJENA]);
  });

  it("un programa sin envíos devuelve una lista vacía", async () => {
    const [vacio] = await db
      .insert(programs)
      .values({ ...PROGRAMA_DE_PRUEBA, slug: "vacio", nombre: "Vacío", ticketUsd: "1000" })
      .returning();
    expect(await preguntasDisponiblesDelPrograma(db, vacio.id)).toEqual([]);
  });
});
