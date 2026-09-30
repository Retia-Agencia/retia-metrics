import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  abonos,
  calls,
  cohorts,
  dealActividades,
  deals,
  leads,
  miembrosPrograma,
  plataformasPago,
  productos,
  programs,
  rarezasMigracion,
  sources,
  submissions,
  users,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { abrirDeal } from "@/lib/deals/mover-etapa";
import { consolidar } from "@/lib/migracion/consolidar";
import { importarGestion } from "@/lib/migracion/importar";
import { extraccionVacia, type DealTemplate, type Extraccion } from "@/lib/migracion/template";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * Ticket 078 paso 4 — el importador: del template a la base por el escritor historico.
 * Lo que se prueba es lo que el ADR 0059 promete: correrlo dos veces no escribe nada, lo vivo
 * gana, y lo que no cruza con la base queda VISIBLE como rareza, nunca adivinado.
 */

const P = "prog-a";
const setteo = (correo: string, extra: Partial<DealTemplate> = {}): DealTemplate => ({
  huella: `sheets:${P}:setteo:${correo}`,
  correo,
  etapa: "en_contacto",
  closer: "Maru",
  fechaEtapa: "2026-08-05T05:00:00.000Z",
  cohorte: null,
  precio: null,
  acuerdoPago: null,
  mailOnboarding: false,
  notas: [{ texto: "Registro 1: le escribí", fecha: "2026-08-05T05:00:00.000Z" }],
  ...extra,
});
const estudiante = (correo: string, extra: Partial<DealTemplate> = {}): DealTemplate => ({
  ...setteo(correo),
  huella: `sheets:${P}:estudiantes-julio:${correo}`,
  etapa: "completo",
  closer: "Jero",
  cohorte: "C1",
  precio: "1500.00",
  notas: [],
  ...extra,
});

let db: Db;
let cerrar: () => Promise<void>;
let programa: string;
let script: string;
let maru: string;
let ana: string;
let producto: string;

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  const [p] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: P, nombre: "Programa A", ticketUsd: "1500" }).returning();
  programa = p.id;
  await db.insert(cohorts).values({
    programId: programa,
    codigo: "C1",
    metaCupos: 30,
    precioUsd: "1500",
    fechaInicioVentas: "2026-07-01",
    fechaCierreVentas: "2026-08-18",
    fechaInicioClases: "2026-08-20",
    estado: "cerrado",
  });
  const [prod] = await db.insert(productos).values({ programId: programa, nombre: "Programa", precioLista: "1500" }).returning();
  producto = prod.id;
  // `MercadoPago` ya viene sembrada por la migracion 0003.
  const [s] = await db.insert(users).values({ email: "script@retiagrowth.com", rol: "developer" }).returning();
  script = s.id;
  const [m] = await db.insert(users).values({ email: "maru@retiagrowth.com", rol: "closer", closerId: "Maru" }).returning();
  maru = m.id;
  await db.insert(miembrosPrograma).values({ userId: maru, programId: programa, activo: true });
  const filas = await db
    .insert(leads)
    .values(["ana@c.co", "beto@c.co", "caro@c.co"].map((e) => ({ programId: programa, emailNormalizado: e })))
    .returning();
  ana = filas[0].id;
});

afterEach(async () => {
  await cerrar();
});

function template(): Extraccion {
  const t = extraccionVacia();
  t.deals.push(setteo("ana@c.co"), estudiante("beto@c.co"), setteo("beto@c.co"), setteo("nadie@c.co"));
  t.abonos.push({
    huella: `sheets:${P}:estudiantes-julio:beto@c.co:abono`,
    dealHuella: `sheets:${P}:estudiantes-julio:beto@c.co`,
    fecha: null,
    monto: "1500.00",
    plataforma: "mercadopago",
    closer: "Jero",
  });
  t.llamadas.push(
    { huella: `sheets:${P}:registro:2`, correo: "beto@c.co", fecha: "2026-08-10T20:00:00.000Z", closer: "Andrea", resultado: "cerrada", categoria: null, subcategoria: null, link: "https://grain.co/x", notas: null },
    { huella: `sheets:${P}:registro:3`, correo: "caro@c.co", fecha: null, closer: "Andrea", resultado: "no_show", categoria: "FOLLOW UP", subcategoria: "FU-3", link: null, notas: null },
  );
  t.rarezas.push({ huella: `sheets:${P}:estudiantes-julio:beto@c.co:abono`, tipo: "fecha_aproximada", detalle: "sin fecha" });
  t.sinDeal.push({ huella: `sheets:${P}:setteo:viejo@c.co`, razon: "pendiente_viejo_sin_actividad" });
  return t;
}

const op = () => ({ programId: programa, actorId: script });

describe("consolidar", () => {
  it("el estudiante absorbe su fila de Setteo: un deal, con las notas del contacto", () => {
    const c = consolidar(template());
    const beto = c.deals.filter((d) => d.correo === "beto@c.co");
    expect(beto).toHaveLength(1);
    expect(beto[0].etapa).toBe("completo");
    expect(beto[0].notas.map((n) => n.texto)).toEqual(["Registro 1: le escribí"]);
    expect(c.sinDeal.map((s) => s.razon)).toContain("es_estudiante");
    expect(c.dealDeCorreo.get("beto@c.co")).toBe(`sheets:${P}:estudiantes-julio:beto@c.co`);
  });

  it("un correo en dos pestañas de Estudiantes queda con sus dos deals y marcado", () => {
    const t = extraccionVacia();
    t.deals.push(estudiante("ana@c.co"), estudiante("ana@c.co", { huella: `sheets:${P}:estudiantes-septiembre:ana@c.co`, cohorte: "C2" }));
    const c = consolidar(t);
    expect(c.deals).toHaveLength(2);
    expect(c.rarezas.map((r) => r.tipo)).toEqual(["en_dos_cohortes", "en_dos_cohortes"]);
  });
});

describe("importarGestion (ADR 0059)", () => {
  it("escribe deals, abono y llamadas por el escritor, con sus cruces", async () => {
    const r = await importarGestion(db, template(), op());

    expect(r.deals).toEqual({ creado: 2, lead_no_encontrado: 1 });
    const todos = await db.select().from(deals);
    const deAna = todos.find((d) => d.leadId === ana)!;
    expect(deAna.ownerUserId).toBe(maru);
    const deBeto = todos.find((d) => d.etapa === "completo")!;
    expect(deBeto.productoId).toBe(producto);
    expect(deBeto.ownerUserId).toBeNull(); // Jero no tiene cuenta

    // El abono sin fecha toma el cierre de ventas de su cohorte, y la plataforma cruza sin espacios.
    const [abono] = await db.select().from(abonos);
    expect(abono).toMatchObject({ dealId: deBeto.id, fecha: "2026-08-18", monto: "1500.00" });
    expect(abono.plataformaId).not.toBeNull();

    // La llamada de beto cuelga de su deal de estudiante; la de caro (sin deal migrado) entra suelta.
    const llamadas = await db.select().from(calls);
    expect(llamadas.find((l) => l.huellaFila?.endsWith(":2"))?.dealId).toBe(deBeto.id);
    const suelta = llamadas.find((l) => l.huellaFila?.endsWith(":3"))!;
    expect(suelta).toMatchObject({ dealId: null, resultado: "no_show", motivoPerdida: "FOLLOW UP · FU-3" });

    // Las notas del Setteo de beto quedaron en su deal de estudiante.
    expect(await db.select().from(dealActividades).where(eq(dealActividades.dealId, deBeto.id))).toHaveLength(1);

    const rarezas = await db.select().from(rarezasMigracion);
    expect(rarezas.map((x) => x.tipo).sort()).toEqual(["fecha_aproximada", "lead_no_encontrado", "llamada_sin_deal"]);
    expect(rarezas.find((x) => x.tipo === "fecha_aproximada")?.abonoId).toBe(abono.id);
    expect(r.sinDeal).toEqual({ es_estudiante: 1, pendiente_viejo_sin_actividad: 1 });
  });

  it("la segunda corrida no escribe nada", async () => {
    await importarGestion(db, template(), op());
    const antes = await Promise.all([deals, abonos, calls, dealActividades, rarezasMigracion].map((t) => db.select().from(t)));

    const r = await importarGestion(db, template(), op());

    expect(r.deals).toEqual({ ya_migrado: 2, lead_no_encontrado: 1 });
    expect(r.abonos).toEqual({ ya_migrado: 1 });
    expect(r.rarezasNuevas).toBe(0);
    const despues = await Promise.all([deals, abonos, calls, dealActividades, rarezasMigracion].map((t) => db.select().from(t)));
    expect(despues.map((x) => x.length)).toEqual(antes.map((x) => x.length));
  });

  it("gana el deal vivo: la fila queda como rareza y no se le cuelga nada", async () => {
    const vivo = await abrirDeal(db, { leadId: ana, programId: programa, etapa: "pendiente_setteo", actor: { tipo: "sistema" } });
    const t = extraccionVacia();
    t.deals.push(setteo("ana@c.co"));
    t.llamadas.push({ huella: `sheets:${P}:registro:9`, correo: "ana@c.co", fecha: null, closer: null, resultado: "show", categoria: null, subcategoria: null, link: null, notas: null });

    const r = await importarGestion(db, t, op());

    expect(r.deals).toEqual({ lead_con_deal_vivo: 1 });
    const [llamada] = await db.select().from(calls);
    expect(llamada.dealId).toBeNull();
    const rarezas = await db.select().from(rarezasMigracion);
    expect(rarezas.find((x) => x.tipo === "ya_tiene_deal_vivo")?.dealId).toBe(vivo);
  });

  it("revision de Codex: dos cohortes → llamada suelta; producto COP no cruza; plataforma ambigua; abono sin deal visible", async () => {
    await db.insert(productos).values({ programId: programa, nombre: "En pesos", precioLista: "700", moneda: "COP" });
    await db.insert(plataformasPago).values({ nombre: "Mercado Pago" }); // misma clave que la sembrada `MercadoPago`
    const t = extraccionVacia();
    t.deals.push(
      estudiante("ana@c.co"),
      estudiante("ana@c.co", { huella: `sheets:${P}:estudiantes-septiembre:ana@c.co` }),
      estudiante("beto@c.co", { precio: "700.00" }),
    );
    t.abonos.push(
      { huella: `sheets:${P}:estudiantes-julio:beto@c.co:abono`, dealHuella: `sheets:${P}:estudiantes-julio:beto@c.co`, fecha: "2026-08-01", monto: "700.00", plataforma: "mercado pago", closer: null },
      { huella: `sheets:${P}:estudiantes-julio:huerfano:abono`, dealHuella: `sheets:${P}:estudiantes-julio:huerfano`, fecha: "2026-08-01", monto: "100.00", plataforma: null, closer: null },
    );
    t.llamadas.push({ huella: `sheets:${P}:registro:5`, correo: "ana@c.co", fecha: null, closer: null, resultado: "show", categoria: null, subcategoria: null, link: null, notas: null });

    await importarGestion(db, t, op());

    const [llamada] = await db.select().from(calls);
    expect(llamada.dealId).toBeNull();
    const deBeto = (await db.select().from(deals)).find((d) => d.productoId === null && d.leadId !== ana);
    expect(deBeto).toBeDefined();
    const [abono] = await db.select().from(abonos);
    expect(abono.plataformaId).toBeNull();
    const tipos = (await db.select().from(rarezasMigracion)).map((x) => x.tipo);
    expect(tipos).toEqual(
      expect.arrayContaining(["en_dos_cohortes", "llamada_sin_deal", "producto_no_encontrado", "plataforma_fuera_de_catalogo", "abono_sin_deal"]),
    );
  });

  it("el deal nace con su origen: el envío más reciente del lead, o nulo sin envíos (ADR 0060)", async () => {
    const [fuente] = await db.insert(sources).values({ programId: programa, nombre: "Typeform" }).returning();
    const [, nuevo] = await db
      .insert(submissions)
      .values([
        { leadId: ana, sourceId: fuente.id, token: "viejo", fechaEnvio: new Date("2026-07-01T12:00:00-05:00") },
        { leadId: ana, sourceId: fuente.id, token: "nuevo", fechaEnvio: new Date("2026-08-01T12:00:00-05:00") },
        // Un parcial sin fecha nunca le gana a uno fechado.
        { leadId: ana, sourceId: fuente.id, token: "parcial", esParcial: true },
      ])
      .returning();

    await importarGestion(db, template(), op());

    const todos = await db.select().from(deals);
    expect(todos.find((d) => d.leadId === ana)?.submissionOrigenId).toBe(nuevo.id);
    expect(todos.find((d) => d.etapa === "completo")?.submissionOrigenId).toBeNull(); // beto no tiene envíos
  });

  it("lo que no cruza es rareza: plataforma fuera de catalogo y precio sin producto", async () => {
    const t = extraccionVacia();
    t.deals.push(estudiante("beto@c.co", { precio: "999.00" }));
    t.abonos.push({ huella: `sheets:${P}:estudiantes-julio:beto@c.co:abono`, dealHuella: `sheets:${P}:estudiantes-julio:beto@c.co`, fecha: "2026-08-01", monto: "999.00", plataforma: "Bootcamp", closer: null });

    await importarGestion(db, t, op());

    const [d] = await db.select().from(deals);
    expect(d.productoId).toBeNull();
    const [a] = await db.select().from(abonos);
    expect(a.plataformaId).toBeNull();
    const tipos = (await db.select().from(rarezasMigracion)).map((x) => x.tipo).sort();
    expect(tipos).toEqual(["plataforma_fuera_de_catalogo", "producto_no_encontrado"]);
  });
});
