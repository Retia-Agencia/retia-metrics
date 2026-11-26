import { abonoDePrueba } from "./helpers/catalogo-de-prueba";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  calls,
  cohorts,
  dealEtapaHistorial,
  deals,
  leads,
  programs,
  users,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { cajaRecaudada, embudoDelRango, embudoPorCloser, leadsDelRango, vistaDeCohorteActiva } from "@/lib/queries/dashboard";
import { claveHistorica } from "@/lib/closers/identidad";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";
import { duenoDePrueba } from "./helpers/dueno-de-prueba";
import { FECHA_LEAD_DE_PRUEBA } from "./helpers/crear-lead-de-prueba";

/**
 * Ticket 004 — consultas del dashboard.
 *
 * Base PGlite nueva por test. Se siembran a mano los pocos datos que cada caso
 * necesita: personas, cohortes, llamadas, ventas y abonos de un programa, y se
 * verifica que las tasas y sumas salgan sobre el universo correcto.
 */

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let programaA: string;

async function crearPrograma(slug: string, nombre: string): Promise<string> {
  const [p] = await db
    .insert(programs)
    .values({ ...PROGRAMA_DE_PRUEBA, slug, nombre, ticketUsd: "797.00" })
    .returning();
  return p.id;
}

// Aplicar todas las migraciones sobre PGlite puede pasar los 10s por defecto
// cuando la maquina esta cargada; se sube el timeout del hook, no la logica.
beforeAll(async () => {
  ({ db, cerrar, vaciar } = await crearBaseReutilizable());
}, 60_000);

beforeEach(async () => {
  await vaciar();
  programaA = await crearPrograma("programa-a", "Programa A");
}, 60_000);

afterAll(async () => {
  await cerrar();
});

let secuenciaDeLead = 0;

/**
 * Siembra un lead nuevo con su deal y devuelve el id del deal.
 *
 * Cada llamada crea SU lead: dos deals abiertos del mismo lead y programa chocan
 * contra el indice unico parcial del ADR 0037, que es justo lo que muerde
 * `tests/modelo-crm-indices.test.ts`.
 */
async function sembrarDeal(
  programId: string,
  extra: Record<string, unknown> = {},
): Promise<string> {
  secuenciaDeLead += 1;
  const [lead] = await db
    .insert(leads)
    .values({ fechaPrimeraAplicacion: FECHA_LEAD_DE_PRUEBA, programId, emailNormalizado: `lead-${secuenciaDeLead}@correo.co` })
    .returning();
  const [deal] = await db
    .insert(deals)
    .values({ leadId: lead.id, programId, ...extra } as never)
    .returning();
  return deal.id;
}

/**
 * Un deal ya vendido, con el movimiento de venta que `moverEtapa` siempre escribe: la cohorte cuenta
 * sus ventas hasta el día de la vista (299), así que una venta sin historial no tiene día.
 */
async function sembrarVenta(programId: string, extra: Record<string, unknown> & { etapa: "ganado_parcial" | "ganado_completo" }) {
  const dealId = await sembrarDeal(programId, extra);
  await db.insert(dealEtapaHistorial).values({ dealId, de: null, a: extra.etapa, fecha: new Date("2026-09-01T10:00:00-05:00") });
  return dealId;
}

/** El id de un usuario con ese `closerId`, para poder ser dueno de un deal. */
async function sembrarCloser(closerId: string): Promise<string> {
  const [u] = await db
    .insert(users)
    .values({ email: `${closerId.toLowerCase()}@retiagrowth.com`, rol: "closer", closerId })
    .returning();
  return u.id;
}

async function marcarVenta(dealId: string, fecha: Date, ownerUserId?: string) {
  // Una venta vigente tiene dueño (ADR 0122): sin uno explicito, un closer del programa del deal.
  if (!ownerUserId) {
    const [d] = await db.select({ programId: deals.programId }).from(deals).where(eq(deals.id, dealId));
    ownerUserId = await duenoDePrueba(db, d.programId);
  }
  await db
    .update(deals)
    .set({ etapa: "ganado_parcial", ownerUserId })
    .where(eq(deals.id, dealId));
  await db.insert(dealEtapaHistorial).values({
    dealId,
    de: null,
    a: "ganado_parcial",
    fecha,
    userId: ownerUserId,
  });
}

// ─────────────────────────────────────── 1. abono de hoy sobre venta vieja

describe("la caja se ancla en la fecha del abono (ADR 0013)", () => {
  it("un abono de hoy sobre un deal del mes pasado suma a la caja de hoy", async () => {
    const venta = { id: await sembrarDeal(programaA) };

    await abonoDePrueba(db, { dealId: venta.id, programId: programaA, fecha: "2026-09-15", monto: "750.00", moneda: "USD" });

    const rango = { desde: "2026-09-15", hasta: "2026-09-15" };

    // La caja se ancla en la fecha del ABONO, no en la del deal (ADR 0013): son dos
    // metricas separadas y ninguna se deriva de la otra.
    const caja = await cajaRecaudada({ programId: programaA, rango: rango }, db);
    expect(caja).toEqual([{ moneda: "USD", total: 750 }]);
  });

  it("la caja se agrupa por moneda y nunca mezcla dos monedas en un solo numero", async () => {
    const ventaUsd = { id: await sembrarDeal(programaA) };
    const ventaCop = { id: await sembrarDeal(programaA) };

    await abonoDePrueba(db, [
      { dealId: ventaUsd.id, programId: programaA, fecha: "2026-09-15", monto: "500.00", moneda: "USD" },
      { dealId: ventaUsd.id, programId: programaA, fecha: "2026-09-15", monto: "250.00", moneda: "USD" },
      { dealId: ventaCop.id, programId: programaA, fecha: "2026-09-15", monto: "2000000.00", moneda: "COP" },
    ]);

    const caja = await cajaRecaudada({ programId: programaA, rango: { desde: "2026-09-15", hasta: "2026-09-15" } }, db);
    const porMoneda = Object.fromEntries(caja.map((c) => [c.moneda, c.total]));
    expect(porMoneda).toEqual({ USD: 750, COP: 2_000_000 });
  });
});

// ─────────────────────────────────────── 5. tasas y division por cero

describe("% de show y % de cierre", () => {
  it("salen del mismo universo de agendas y no dividen por cero", async () => {
    const rango = { desde: "2026-09-15", hasta: "2026-09-15" };
    const fecha = new Date("2026-09-15T14:00:00Z");

    // 4 agendas de 4 personas: 2 shows, 1 compromiso_pago (tambien show), 1 no_show.
    // De las que hicieron show, 1 cerro. Las tasas van sobre esas personas (ADR 0079).
    const [d1, d2, d3, d4] = await Promise.all([1, 2, 3, 4].map(() => sembrarDeal(programaA)));
    await db.insert(calls).values([
      { programId: programaA, dealId: d1, fechaAgenda: fecha, resultado: "show" },
      { programId: programaA, dealId: d2, fechaAgenda: fecha, resultado: "cerrada" },
      { programId: programaA, dealId: d3, fechaAgenda: fecha, resultado: "compromiso_pago" },
      { programId: programaA, dealId: d4, fechaAgenda: fecha, resultado: "no_show" },
    ]);
    await marcarVenta(d2, fecha);

    const embudo = await embudoDelRango({ programId: programaA, rango: rango }, db);
    expect(embudo.agendas).toBe(4);
    expect(embudo.llamadasConShow).toBe(3);
    expect(embudo.cierres).toBe(1);
    expect(embudo.razonShow.valor).toBeCloseTo(3 / 4);
    expect(embudo.razonCierre.valor).toBeCloseTo(1 / 3);
  });

  it("con 0 agendas las tasas son null, no NaN", async () => {
    const embudo = await embudoDelRango({ programId: programaA, rango: { desde: "2026-09-15", hasta: "2026-09-15" } }, db);
    expect(embudo.agendas).toBe(0);
    expect(embudo.razonShow.valor).toBeNull();
    expect(embudo.razonCierre.valor).toBeNull();
  });

  it("cuenta una sola vez un deal que pasa por abonado y completo", async () => {
    const fecha = new Date("2026-09-15T14:00:00Z");
    await db.insert(calls).values({
      programId: programaA,
      fechaAgenda: fecha,
      resultado: "show",
    });
    const dealId = await sembrarDeal(programaA, { etapa: "ganado_completo", ownerUserId: await duenoDePrueba(db, programaA) });
    await db.insert(dealEtapaHistorial).values([
      { dealId, de: null, a: "ganado_parcial", fecha, userId: null },
      { dealId, de: "ganado_parcial", a: "ganado_completo", fecha: new Date("2026-09-15T15:00:00Z"), userId: null },
    ]);

    const embudo = await embudoDelRango(
      { programId: programaA, rango: { desde: "2026-09-15", hasta: "2026-09-15" } },
      db,
    );
    expect(embudo.cierres).toBe(1);
  });

  it("cuenta una llamada perdida como show ocurrido", async () => {
    const fecha = new Date("2026-09-15T14:00:00Z");
    await db.insert(calls).values({
      programId: programaA,
      fechaAgenda: fecha,
      resultado: "perdida",
    });

    const embudo = await embudoDelRango(
      { programId: programaA, rango: { desde: "2026-09-15", hasta: "2026-09-15" } },
      db,
    );
    expect(embudo.llamadasConShow).toBe(1);
  });
});

// ─────────────────────────────────────── 6. sesgo de zona

describe("anclaje de fechas en Bogota", () => {
  it("una llamada a las 02:00Z del 16-sep es del 15-sep en Bogota y cae en el rango del 15-sep", async () => {
    // 2026-09-16T02:00:00Z es 2026-09-15 21:00 en Bogota (UTC-5).
    await db.insert(calls).values({
      programId: programaA,
      fechaAgenda: new Date("2026-09-16T02:00:00Z"),
      resultado: "agendada",
    });

    const del15 = await embudoDelRango({ programId: programaA, rango: { desde: "2026-09-15", hasta: "2026-09-15" } }, db);
    expect(del15.agendas).toBe(1);

    const del16 = await embudoDelRango({ programId: programaA, rango: { desde: "2026-09-16", hasta: "2026-09-16" } }, db);
    expect(del16.agendas).toBe(0);
  });
});

// ─────────────────────────────────────── 8. cohorte con ventana declarada

async function crearCohorteActiva(args: {
  programId: string;
  codigo: string;
  metaCupos: number;
  fechaInicioVentas: string | null;
  fechaCierreVentas: string;
  metaLeadsDia?: number | null;
}): Promise<string> {
  const [c] = await db
    .insert(cohorts)
    .values({
      programId: args.programId,
      codigo: args.codigo,
      metaCupos: args.metaCupos,
      metaLeadsDia: args.metaLeadsDia ?? null,
      precioUsd: "797.00",
      fechaInicioClases: args.fechaCierreVentas,
      fechaInicioVentas: args.fechaInicioVentas,
      fechaCierreVentas: args.fechaCierreVentas,
    })
    .returning();
  return c.id;
}

describe("vista de cohorte activa con ventana declarada (ADR 0022)", () => {
  it("Comunicarte C2: 14-ago a 21-sep son 27 habiles y el 15-sep es el dia 23", async () => {
    await crearCohorteActiva({
      programId: programaA,
      codigo: "C2",
      metaCupos: 30,
      fechaInicioVentas: "2026-08-14",
      fechaCierreVentas: "2026-09-21",
    });

    const vista = await vistaDeCohorteActiva({ programId: programaA }, "2026-09-15", db);
    expect(vista).not.toBeNull();
    expect(vista!.codigo).toBe("C2");
    expect(vista!.ventana).not.toBeNull();
    expect(vista!.ventana!.total).toBe(27);
    expect(vista!.ventana!.dia).toBe(23);
    expect(vista!.ventana!.inicio).toBe("2026-08-14");
    expect(vista!.ventana!.cierre).toBe("2026-09-21");
  });

});

// ─────────────────────────────────────── 9. cohorte sin inicio de ventas

describe("cohorte sin fechaInicioVentas no inventa dias habiles (ADR 0022)", () => {
  it("una cohorte cerrada sin inicio de ventas no es la activa: la vista devuelve null y no inventa ventana", async () => {
    // El CHECK de la base (ADR 0022) impide que una cohorte ACTIVA no tenga
    // fechaInicioVentas; solo las cerradas viejas pueden tenerla en null, y una
    // cohorte cerrada nunca es la activa. Asi, si el programa solo tiene esa
    // cohorte cerrada, la vista devuelve null: no se inventa ninguna ventana ni
    // ningun dia habil a partir de un inicio que nadie declaro.
    await db.insert(cohorts).values({
      programId: programaA,
      codigo: "C1",
      metaCupos: 20,
      precioUsd: "797.00",
      fechaInicioClases: "2026-08-11",
      fechaInicioVentas: null,
      fechaCierreVentas: "2026-09-10",
    });

    const vista = await vistaDeCohorteActiva({ programId: programaA }, "2026-09-15", db);
    expect(vista).toBeNull();
  });
});

// ─────────────────────────────────────── 10. cero dias habiles restantes

describe("meta dinamica no divide por cero", () => {
  it("con 0 dias habiles restantes la meta dinamica es el faltante completo, no NaN", async () => {
    await crearCohorteActiva({
      programId: programaA,
      codigo: "C2",
      metaCupos: 30,
      fechaInicioVentas: "2026-08-14",
      // Cierra un sábado: ese día la cohorte sigue activa (ADR 0137 punto 5) y ya no quedan días hábiles.
      fechaCierreVentas: "2026-09-19",
    });
    // 5 ventas de la cohorte: faltan 25. Una venta es un deal en Abonado o Completo
    // (ADR 0037), no un deal cualquiera.
    const cohorteDeLaMeta = (await vistaDeCohorteActiva({ programId: programaA }, "2026-09-15", db))!
      .cohorteId;
    for (let i = 0; i < 5; i++) {
      await sembrarVenta(programaA, { cohortId: cohorteDeLaMeta, etapa: "ganado_parcial", ownerUserId: await duenoDePrueba(db, programaA) });
    }

    // Último día de la ventana, sábado 19-sep: habilesRestantes = 0. Un día después ya no hay
    // cohorte activa: la que cerró no se queda activa a mano.
    const vista = await vistaDeCohorteActiva({ programId: programaA }, "2026-09-19", db);
    expect(vista!.ventana!.habilesRestantes).toBe(0);
    expect(Number.isNaN(vista!.ventana!.metaDinamica)).toBe(false);
    expect(vista!.ventana!.metaDinamica).toBe(25);
  });
});

// ─────────────────────────────────────── 11. compromisos abiertos

async function crearPersona(programId: string, email: string, extra?: {
  entrada?: "formulario" | "crm";
  fechaPrimeraAplicacion?: Date | null;
}): Promise<string> {
  const [p] = await db
    .insert(leads)
    .values({
      programId,
      emailNormalizado: email,
      entrada: extra?.entrada ?? "formulario",
      fechaPrimeraAplicacion: extra?.fechaPrimeraAplicacion ?? null,
    })
    .returning();
  return p.id;
}

describe("leadsDelRango", () => {
  it("solo cuenta entrada='formulario'; una persona creada en el CRM no suma", async () => {
    // La cohorte activa fija metaLeadsDia.
    await crearCohorteActiva({
      programId: programaA,
      codigo: "C2",
      metaCupos: 30,
      fechaInicioVentas: "2026-08-14",
      fechaCierreVentas: "2026-09-21",
      metaLeadsDia: 10,
    });

    // Dos leads del formulario el 15-sep y uno creado a mano en el CRM el mismo dia.
    await crearPersona(programaA, "form1@x.com", {
      entrada: "formulario",
      fechaPrimeraAplicacion: new Date("2026-09-15T14:00:00Z"),
    });
    await crearPersona(programaA, "form2@x.com", {
      entrada: "formulario",
      fechaPrimeraAplicacion: new Date("2026-09-15T16:00:00Z"),
    });
    await crearPersona(programaA, "crm1@x.com", {
      entrada: "crm",
      fechaPrimeraAplicacion: new Date("2026-09-15T17:00:00Z"),
    });

    const hoy = { desde: "2026-09-15", hasta: "2026-09-15" };
    const leads = await leadsDelRango({ programId: programaA, rango: hoy }, db);
    expect(leads.leads).toBe(2);
    expect(leads.diasHabiles).toBe(1);
    expect(leads.metaLeadsDia).toBe(10);
    expect(leads.metaDelRango).toBe(10);
    expect(leads.cumplimiento).toBeCloseTo(2 / 10);
  });
});

// ─────────────────────────────────────── 14. por closer y por canal

describe("embudoPorCloser", () => {
  it("los grupos por closer suman el total del programa; un closer con solo abonos aparece", async () => {
    const rango = { desde: "2026-09-15", hasta: "2026-09-15" };
    const fecha = new Date("2026-09-15T14:00:00Z");

    // Ana: 2 agendas (1 show, 1 cerrada), 1 venta, un abono de 100.
    // Beto: 1 agenda (no_show), sin venta, sin abono.
    const anaId = await sembrarCloser("Ana");
    const betoId = await sembrarCloser("Beto");
    await db.insert(calls).values([
      { programId: programaA, closerUserId: anaId, fechaAgenda: fecha, resultado: "show" },
      { programId: programaA, closerUserId: anaId, fechaAgenda: fecha, resultado: "cerrada" },
      { programId: programaA, closerUserId: betoId, fechaAgenda: fecha, resultado: "no_show" },
    ]);
    const ventaAna = { id: await sembrarDeal(programaA) };
    await abonoDePrueba(db, { dealId: ventaAna.id, programId: programaA, closerId: "Ana", fecha: "2026-09-15", monto: "100.00", moneda: "USD" });

    // Caro: SOLO un abono en el rango (sobre una venta vieja sin closer), sin llamadas.
    const ventaVieja = { id: await sembrarDeal(programaA) };
    await abonoDePrueba(db, { dealId: ventaVieja.id, programId: programaA, closerId: "Caro", fecha: "2026-09-15", monto: "50.00", moneda: "USD" });

    const total = await embudoDelRango({ programId: programaA, rango: rango }, db);
    const porCloser = await embudoPorCloser({ programId: programaA, rango: rango }, db);

    // Los conteos por closer suman el total del programa.
    const suma = (k: "agendas" | "llamadasConShow" | "cierres") =>
      porCloser.reduce((acc, c) => acc + c[k], 0);
    expect(suma("agendas")).toBe(total.agendas);
    expect(suma("llamadasConShow")).toBe(total.llamadasConShow);
    expect(suma("cierres")).toBe(total.cierres);

    // Caro no tiene llamadas ni ventas pero registro un abono: tiene que aparecer.
    const caro = porCloser.find((c) => c.closerId === "Caro");
    expect(caro).toBeDefined();
    expect(caro!.agendas).toBe(0);
    expect(caro!.caja).toEqual([{ moneda: "USD", total: 50 }]);

    // La caja por closer suma la caja total del programa.
    const cajaTotal = await cajaRecaudada({ programId: programaA, rango: rango }, db);
    const usdTotal = cajaTotal.find((c) => c.moneda === "USD")!.total;
    const usdPorCloser = porCloser
      .flatMap((c) => c.caja)
      .filter((c) => c.moneda === "USD")
      .reduce((acc, c) => acc + c.total, 0);
    expect(usdPorCloser).toBe(usdTotal);
  });

  it("une por users.id una llamada sin closer_id con los cierres y la caja de esa cuenta", async () => {
    const rango = { desde: "2026-09-15", hasta: "2026-09-15" };
    const fecha = new Date("2026-09-15T14:00:00Z");
    const [closer] = await db.insert(users).values({ email: "fk@retia.co", nombre: "Closer FK", rol: "closer", closerId: null }).returning();
    const dealId = await sembrarDeal(programaA, { ownerUserId: closer.id, valorVendidoUsd: "100" });
    await marcarVenta(dealId, fecha, closer.id);
    await db.insert(calls).values({ programId: programaA, dealId, closerUserId: closer.id, fechaAgenda: fecha, resultado: "show" });
    await abonoDePrueba(db, { programId: programaA, dealId, registradoPorUserId: closer.id, fecha: "2026-09-15", monto: "40", moneda: "USD" });

    const filas = await embudoPorCloser({ programId: programaA, rango }, db);
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({
      clave: closer.id,
      closerId: "Closer FK",
      agendas: 1,
      llamadasConShow: 1,
      cierres: 1,
      caja: [{ moneda: "USD", total: 40 }],
    });
  });

});

// ─────────────────────────────────────── 15. alcance individual por closer (ticket 005)

/**
 * Ticket 005: el dashboard tiene un selector de closer y "todas las metricas a nivel
 * individual" (decision de Mani, 17-sep). El filtro vive en el `Alcance`, no en un
 * modulo aparte, para que la regla de fecha (Bogota) y el agrupado por moneda tengan
 * UNA sola implementacion.
 *
 * Lo que un closer NO tiene es meta propia: la meta de cupos y la de leads/dia son de
 * la cohorte (ADR 0022) y repartirlas entre closers seria inventar el numero contra el
 * que se mide a la gente.
 */
describe("alcance acotado a un closer", () => {
  const rango = { desde: "2026-09-15", hasta: "2026-09-15" };
  const fecha = new Date("2026-09-15T14:00:00Z");

  async function sembrarDosClosers() {
    const anaId = await sembrarCloser("Ana");
    const betoId = await sembrarCloser("Beto");
    await db.insert(calls).values([
      { programId: programaA, closerUserId: anaId, fechaAgenda: fecha, resultado: "show" },
      { programId: programaA, closerUserId: anaId, fechaAgenda: fecha, resultado: "cerrada" },
      { programId: programaA, closerUserId: betoId, fechaAgenda: fecha, resultado: "no_show" },
      { programId: programaA, closerUserId: betoId, fechaAgenda: fecha, resultado: "cerrada" },
    ]);
    const ventaAna = { id: await sembrarDeal(programaA, { ownerUserId: anaId }) };
    const ventaBeto = { id: await sembrarDeal(programaA, { ownerUserId: betoId }) };
    await marcarVenta(ventaAna.id, fecha, anaId);
    await marcarVenta(ventaBeto.id, fecha, betoId);
    await abonoDePrueba(db, [
      { dealId: ventaAna.id, programId: programaA, closerId: "Ana", fecha: "2026-09-15", monto: "100.00", moneda: "USD" },
      { dealId: ventaBeto.id, programId: programaA, closerId: "Beto", fecha: "2026-09-15", monto: "250.00", moneda: "USD" },
    ]);
    return { anaId, betoId };
  }

  it("el embudo y la caja de un closer son solo suyos; sin closer sale el total del programa", async () => {
    const { anaId, betoId } = await sembrarDosClosers();

    const total = await embudoDelRango({ programId: programaA, rango }, db);
    expect(total.agendas).toBe(4);

    const ana = await embudoDelRango({ programId: programaA, rango, claveCloser: anaId }, db);
    expect(ana.agendas).toBe(2);
    expect(ana.llamadasConShow).toBe(2);
    expect(ana.cierres).toBe(1);

    expect(await cajaRecaudada({ programId: programaA, rango, claveCloser: anaId }, db)).toEqual([
      { moneda: "USD", total: 100 },
    ]);
    expect(await cajaRecaudada({ programId: programaA, rango, claveCloser: betoId }, db)).toEqual([
      { moneda: "USD", total: 250 },
    ]);
  });

});

describe("leads y cohorte acotados a un closer", () => {
  const rango = { desde: "2026-09-15", hasta: "2026-09-15" };

  it("filtrado por closer los leads son `null`, no el conteo del programa", async () => {
    // La atribucion de un lead a un closer vivia en `responsableCloserId` y se fue
    // con el ADR 0035; su reemplazo (`deals.owner_user_id`, ADR 0037) no tiene una
    // sola fila hasta la etapa 3. Devolver aqui el conteo del programa entero bajo
    // el nombre de un closer seria una cifra creible y equivocada, que es la familia
    // de bug de la que este repo ya sangro tres veces. `null` dice la verdad.
    await crearCohorteActiva({
      programId: programaA,
      codigo: "C2",
      metaCupos: 30,
      fechaInicioVentas: "2026-08-14",
      fechaCierreVentas: "2026-09-21",
      metaLeadsDia: 10,
    });
    await crearPersona(programaA, "deana@x.com", {
      fechaPrimeraAplicacion: new Date("2026-09-15T14:00:00Z"),
    });
    await crearPersona(programaA, "debeto@x.com", {
      fechaPrimeraAplicacion: new Date("2026-09-15T15:00:00Z"),
    });
    await crearPersona(programaA, "libre@x.com", {
      fechaPrimeraAplicacion: new Date("2026-09-15T16:00:00Z"),
    });

    const programa = await leadsDelRango({ programId: programaA, rango }, db);
    expect(programa.leads).toBe(3);

    const ana = await leadsDelRango({ programId: programaA, rango, claveCloser: claveHistorica("Ana") }, db);
    expect(ana.leads).toBeNull();
    // Sin conteo no hay cumplimiento, pero la meta SIGUE siendo la de la cohorte:
    // no se reparte entre closers (ADR 0023) y eso no cambio.
    expect(ana.cumplimiento).toBeNull();
    expect(ana.metaLeadsDia).toBe(10);
    expect(ana.metaDelRango).toBe(10);
  });

  it("con closer, la cohorte muestra su contribucion sin tocar la meta ni la ventana", async () => {
    const cohorteId = await crearCohorteActiva({
      programId: programaA,
      codigo: "C2",
      metaCupos: 30,
      fechaInicioVentas: "2026-08-14",
      fechaCierreVentas: "2026-09-21",
    });
    // El dueno de un deal es una FK a `users` (ADR 0037), no el texto del ADR 0011.
    // El filtro del dashboard sigue llegando como texto, asi que la contribucion se
    // resuelve por `users.closerId` con `igualCloser` (ADR 0030).
    const ana = await sembrarCloser("Ana");
    const beto = await sembrarCloser("Beto");
    await sembrarVenta(programaA, { cohortId: cohorteId, ownerUserId: ana, etapa: "ganado_parcial" });
    await sembrarVenta(programaA, { cohortId: cohorteId, ownerUserId: ana, etapa: "ganado_completo" });
    await sembrarVenta(programaA, { cohortId: cohorteId, ownerUserId: beto, etapa: "ganado_parcial" });

    const programa = await vistaDeCohorteActiva({ programId: programaA }, "2026-09-15", db);
    expect(programa!.vendidos).toBe(3);
    expect(programa!.vendidosDelCloser).toBeNull();

    const vistaDeAna = await vistaDeCohorteActiva(
      { programId: programaA, claveCloser: claveHistorica("Ana") },
      "2026-09-15",
      db,
    );
    // Su contribucion es suya; la meta, los vendidos de la cohorte y la ventana no cambian.
    expect(vistaDeAna!.vendidosDelCloser).toBe(2);
    expect(vistaDeAna!.vendidos).toBe(3);
    expect(vistaDeAna!.meta).toBe(30);
    expect(vistaDeAna!.faltan).toBe(27);
    expect(vistaDeAna!.ventana!.dia).toBe(programa!.ventana!.dia);
    expect(vistaDeAna!.ventana!.metaDinamica).toBe(programa!.ventana!.metaDinamica);
  });
});
