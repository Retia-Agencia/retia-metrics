import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  abonos,
  calls,
  cohorts,
  dealEtapaHistorial,
  deals,
  motivos,
  leads,
  programs,
  users,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { cajaRecaudada, dealsPerdidosPorMotivo, embudoDelRango, embudoPorCanal, embudoPorCloser, leadsDelRango, vistaDeCohorteActiva } from "@/lib/queries/dashboard";
import { claveHistorica } from "@/lib/closers/identidad";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * Ticket 004 — consultas del dashboard.
 *
 * Base PGlite nueva por test. Se siembran a mano los pocos datos que cada caso
 * necesita: personas, cohortes, llamadas, ventas y abonos de un programa, y se
 * verifica que las tasas y sumas salgan sobre el universo correcto.
 */

let db: Db;
let cerrar: () => Promise<void>;
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
beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  programaA = await crearPrograma("programa-a", "Programa A");
}, 60_000);

afterEach(async () => {
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
    .values({ programId, emailNormalizado: `lead-${secuenciaDeLead}@correo.co` })
    .returning();
  const [deal] = await db
    .insert(deals)
    .values({ leadId: lead.id, programId, ...extra } as never)
    .returning();
  return deal.id;
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

    await db
      .insert(abonos)
      .values({ dealId: venta.id, programId: programaA, fecha: "2026-09-15", monto: "750.00", moneda: "USD" });

    const rango = { desde: "2026-09-15", hasta: "2026-09-15" };

    // La caja se ancla en la fecha del ABONO, no en la del deal (ADR 0013): son dos
    // metricas separadas y ninguna se deriva de la otra.
    const caja = await cajaRecaudada({ programId: programaA, rango: rango }, db);
    expect(caja).toEqual([{ moneda: "USD", total: 750 }]);
  });

  it("la caja se agrupa por moneda y nunca mezcla dos monedas en un solo numero", async () => {
    const ventaUsd = { id: await sembrarDeal(programaA) };
    const ventaCop = { id: await sembrarDeal(programaA) };

    await db.insert(abonos).values([
      { dealId: ventaUsd.id, programId: programaA, fecha: "2026-09-15", monto: "500.00", moneda: "USD" },
      { dealId: ventaUsd.id, programId: programaA, fecha: "2026-09-15", monto: "250.00", moneda: "USD" },
      { dealId: ventaCop.id, programId: programaA, fecha: "2026-09-15", monto: "2000000.00", moneda: "COP" },
    ]);

    const caja = await cajaRecaudada({ programId: programaA, rango: { desde: "2026-09-15", hasta: "2026-09-15" } }, db);
    const porMoneda = Object.fromEntries(caja.map((c) => [c.moneda, c.total]));
    expect(porMoneda).toEqual({ USD: 750, COP: 2_000_000 });
  });
});

// ─────────────────────────────────────── 3. sheets + app se suman igual

describe("sheets y app se suman sin logica especial", () => {
  it("cuenta las filas de calls y abonos con origen 'sheets' y 'app' por igual", async () => {
    const rango = { desde: "2026-09-15", hasta: "2026-09-15" };

    await db.insert(calls).values([
      { programId: programaA, fechaAgenda: new Date("2026-09-15T14:00:00Z"), resultado: "agendada", origen: "sheets" },
      { programId: programaA, fechaAgenda: new Date("2026-09-15T15:00:00Z"), resultado: "agendada", origen: "app" },
    ]);

    const vSheets = { id: await sembrarDeal(programaA) };
    const vApp = { id: await sembrarDeal(programaA) };

    await db.insert(abonos).values([
      { dealId: vSheets.id, programId: programaA, fecha: "2026-09-15", monto: "100.00", moneda: "USD", origen: "sheets" },
      { dealId: vApp.id, programId: programaA, fecha: "2026-09-15", monto: "200.00", moneda: "USD", origen: "app" },
    ]);

    const embudo = await embudoDelRango({ programId: programaA, rango: rango }, db);
    expect(embudo.agendas).toBe(2);

    const caja = await cajaRecaudada({ programId: programaA, rango: rango }, db);
    expect(caja).toEqual([{ moneda: "USD", total: 300 }]);
  });
});

// ─────────────────────────────────────── 4. nunca se suman dos programas

describe("nunca se suman programas distintos", () => {
  it("cada consulta devuelve solo lo del programa pedido", async () => {
    const programaB = await crearPrograma("programa-b", "Programa B");
    const rango = { desde: "2026-09-15", hasta: "2026-09-15" };

    // Programa A: 1 agenda, 1 venta, un abono de 100.
    await db.insert(calls).values({
      programId: programaA,
      fechaAgenda: new Date("2026-09-15T14:00:00Z"),
      resultado: "agendada",
    });
    const ventaA = { id: await sembrarDeal(programaA) };
    await db
      .insert(abonos)
      .values({ dealId: ventaA.id, programId: programaA, fecha: "2026-09-15", monto: "100.00", moneda: "USD" });

    // Programa B: 3 agendas, 2 ventas, un abono de 999.
    await db.insert(calls).values([
      { programId: programaB, fechaAgenda: new Date("2026-09-15T14:00:00Z"), resultado: "agendada" },
      { programId: programaB, fechaAgenda: new Date("2026-09-15T15:00:00Z"), resultado: "agendada" },
      { programId: programaB, fechaAgenda: new Date("2026-09-15T16:00:00Z"), resultado: "agendada" },
    ]);
    const ventaB = { id: await sembrarDeal(programaB) };
    await sembrarDeal(programaB);
    await db
      .insert(abonos)
      .values({ dealId: ventaB.id, programId: programaB, fecha: "2026-09-15", monto: "999.00", moneda: "USD" });

    const embudoA = await embudoDelRango({ programId: programaA, rango: rango }, db);
    expect(embudoA.agendas).toBe(1);
    expect(await cajaRecaudada({ programId: programaA, rango: rango }, db)).toEqual([{ moneda: "USD", total: 100 }]);

    const embudoB = await embudoDelRango({ programId: programaB, rango: rango }, db);
    expect(embudoB.agendas).toBe(3);
    expect(await cajaRecaudada({ programId: programaB, rango: rango }, db)).toEqual([{ moneda: "USD", total: 999 }]);
  });
});

// ─────────────────────────────────────── 5. tasas y division por cero

describe("% de show y % de cierre", () => {
  it("salen del mismo universo de agendas y no dividen por cero", async () => {
    const rango = { desde: "2026-09-15", hasta: "2026-09-15" };
    const fecha = new Date("2026-09-15T14:00:00Z");

    // 4 agendas: 2 shows, 1 compromiso_pago (tambien show), 1 no_show.
    // De las que hicieron show, 1 cerro.
    await db.insert(calls).values([
      { programId: programaA, fechaAgenda: fecha, resultado: "show" },
      { programId: programaA, fechaAgenda: fecha, resultado: "cerrada" },
      { programId: programaA, fechaAgenda: fecha, resultado: "compromiso_pago" },
      { programId: programaA, fechaAgenda: fecha, resultado: "no_show" },
    ]);
    const venta = await sembrarDeal(programaA);
    await marcarVenta(venta, fecha);

    const embudo = await embudoDelRango({ programId: programaA, rango: rango }, db);
    expect(embudo.agendas).toBe(4);
    expect(embudo.llamadasConShow).toBe(3);
    expect(embudo.cierres).toBe(1);
    expect(embudo.pctShow).toBeCloseTo(3 / 4);
    expect(embudo.pctCierre).toBeCloseTo(1 / 3);
  });

  it("con 0 agendas las tasas son null, no NaN", async () => {
    const embudo = await embudoDelRango({ programId: programaA, rango: { desde: "2026-09-15", hasta: "2026-09-15" } }, db);
    expect(embudo.agendas).toBe(0);
    expect(embudo.pctShow).toBeNull();
    expect(embudo.pctCierre).toBeNull();
  });

  it("cuenta una sola vez un deal que pasa por abonado y completo", async () => {
    const fecha = new Date("2026-09-15T14:00:00Z");
    await db.insert(calls).values({
      programId: programaA,
      fechaAgenda: fecha,
      resultado: "show",
    });
    const dealId = await sembrarDeal(programaA);
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

// ─────────────────────────────────────── 7. hoy, esta semana, custom

describe("rangos: hoy, esta semana y custom", () => {
  it("filtra agendas y caja segun el rango pedido", async () => {
    // Semana del lunes 14 al viernes 18 de septiembre de 2026.
    // Agendas en 3 dias distintos.
    await db.insert(calls).values([
      { programId: programaA, fechaAgenda: new Date("2026-09-14T14:00:00Z"), resultado: "agendada" },
      { programId: programaA, fechaAgenda: new Date("2026-09-15T14:00:00Z"), resultado: "agendada" },
      { programId: programaA, fechaAgenda: new Date("2026-09-18T14:00:00Z"), resultado: "agendada" },
      // Fuera de la semana: sabado 19.
      { programId: programaA, fechaAgenda: new Date("2026-09-19T14:00:00Z"), resultado: "agendada" },
    ]);
    const v14 = { id: await sembrarDeal(programaA) };
    const v15 = { id: await sembrarDeal(programaA) };
    await db.insert(abonos).values([
      { dealId: v14.id, programId: programaA, fecha: "2026-09-14", monto: "100.00", moneda: "USD" },
      { dealId: v15.id, programId: programaA, fecha: "2026-09-15", monto: "200.00", moneda: "USD" },
    ]);

    // "Hoy" = 15-sep.
    const hoy = { desde: "2026-09-15", hasta: "2026-09-15" };
    expect((await embudoDelRango({ programId: programaA, rango: hoy }, db)).agendas).toBe(1);
    expect(await cajaRecaudada({ programId: programaA, rango: hoy }, db)).toEqual([{ moneda: "USD", total: 200 }]);

    // "Esta semana" = lunes 14 a domingo 20. Cae la del sabado 19 tambien.
    const semana = { desde: "2026-09-14", hasta: "2026-09-20" };
    expect((await embudoDelRango({ programId: programaA, rango: semana }, db)).agendas).toBe(4);
    expect(await cajaRecaudada({ programId: programaA, rango: semana }, db)).toEqual([{ moneda: "USD", total: 300 }]);

    // Rango custom: 14 al 15.
    const custom = { desde: "2026-09-14", hasta: "2026-09-15" };
    expect((await embudoDelRango({ programId: programaA, rango: custom }, db)).agendas).toBe(2);
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
      estado: "activo",
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

  it("Tactical C2: 19-ago a 29-sep son 30 habiles y el 15-sep es el dia 20", async () => {
    const programaB = await crearPrograma("tactical", "Tactical");
    await crearCohorteActiva({
      programId: programaB,
      codigo: "C2",
      metaCupos: 40,
      fechaInicioVentas: "2026-08-19",
      fechaCierreVentas: "2026-09-29",
    });

    const vista = await vistaDeCohorteActiva({ programId: programaB }, "2026-09-15", db);
    expect(vista!.ventana!.total).toBe(30);
    expect(vista!.ventana!.dia).toBe(20);
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
      estado: "cerrado",
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
      fechaCierreVentas: "2026-09-21",
    });
    // 5 ventas de la cohorte: faltan 25. Una venta es un deal en Abonado o Completo
    // (ADR 0037), no un deal cualquiera.
    const cohorteDeLaMeta = (await vistaDeCohorteActiva({ programId: programaA }, "2026-09-15", db))!
      .cohorteId;
    for (let i = 0; i < 5; i++) {
      await sembrarDeal(programaA, { cohortId: cohorteDeLaMeta, etapa: "ganado_parcial" });
    }

    // hoy despues del cierre: 22-sep. habilesRestantes = 0.
    const vista = await vistaDeCohorteActiva({ programId: programaA }, "2026-09-22", db);
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

// ─────────────────────────────────────── 13. deals perdidos por motivo

describe("dealsPerdidosPorMotivo", () => {
  it("cuenta cierres perdidos vigentes del programa y respeta el owner del closer", async () => {
    const catalogo = await db.select().from(motivos);
    const dinero = catalogo.find((m) => m.nombre === "Dinero")!;
    const horario = catalogo.find((m) => m.nombre === "Horario")!;
    const rango = { desde: "2026-09-15", hasta: "2026-09-15" };
    const fecha = new Date("2026-09-15T14:00:00Z");
    const programaB = await crearPrograma("programa-b-motivos", "Programa B motivos");
    const ana = await sembrarCloser("Ana-motivos");
    const beto = await sembrarCloser("Beto-motivos");
    const datos = [
      { programId: programaA, motivoId: dinero.id, ownerUserId: ana },
      { programId: programaA, motivoId: dinero.id, ownerUserId: beto },
      { programId: programaB, motivoId: dinero.id, ownerUserId: ana },
      {
        programId: programaA,
        motivoId: horario.id,
        ownerUserId: ana,
        anuladoEn: fecha,
        anuladoPor: ana,
        motivoAnulacion: "Prueba de deal anulado",
      },
    ];
    for (const dato of datos) {
      const dealId = await sembrarDeal(dato.programId, { ...dato, etapa: "cierre_perdido" });
      await db.insert(dealEtapaHistorial).values({
        dealId,
        de: null,
        a: "cierre_perdido",
        fecha,
        userId: dato.ownerUserId,
      });
    }

    // No hay ninguna call con motivoId: el bloque sale exclusivamente de deals.
    expect(await dealsPerdidosPorMotivo({ programId: programaA, rango }, db)).toEqual([
      { motivo: "Dinero", deals: 2 },
    ]);
    expect(await dealsPerdidosPorMotivo({ programId: programaA, rango, claveCloser: claveHistorica("Ana-motivos") }, db)).toEqual([
      { motivo: "Dinero", deals: 1 },
    ]);
  });
});

// ─────────────────────────────────────── 14. por closer y por canal

describe("embudoPorCloser", () => {
  it("los grupos por closer suman el total del programa; un closer con solo abonos aparece", async () => {
    const rango = { desde: "2026-09-15", hasta: "2026-09-15" };
    const fecha = new Date("2026-09-15T14:00:00Z");

    // Ana: 2 agendas (1 show, 1 cerrada), 1 venta, un abono de 100.
    // Beto: 1 agenda (no_show), sin venta, sin abono.
    await db.insert(calls).values([
      { programId: programaA, closerId: "Ana", fechaAgenda: fecha, resultado: "show" },
      { programId: programaA, closerId: "Ana", fechaAgenda: fecha, resultado: "cerrada" },
      { programId: programaA, closerId: "Beto", fechaAgenda: fecha, resultado: "no_show" },
    ]);
    const ventaAna = { id: await sembrarDeal(programaA) };
    await db
      .insert(abonos)
      .values({ dealId: ventaAna.id, programId: programaA, closerId: "Ana", fecha: "2026-09-15", monto: "100.00", moneda: "USD" });

    // Caro: SOLO un abono en el rango (sobre una venta vieja sin closer), sin llamadas.
    const ventaVieja = { id: await sembrarDeal(programaA) };
    await db
      .insert(abonos)
      .values({ dealId: ventaVieja.id, programId: programaA, closerId: "Caro", fecha: "2026-09-15", monto: "50.00", moneda: "USD" });

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
    await db.insert(calls).values({ programId: programaA, dealId, closerUserId: closer.id, closerId: null, fechaAgenda: fecha, resultado: "show" });
    await db.insert(abonos).values({ programId: programaA, dealId, registradoPorUserId: closer.id, fecha: "2026-09-15", monto: "40", moneda: "USD" });

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

  it("une una llamada historica por closer normalizado con la venta de la cuenta", async () => {
    const rango = { desde: "2026-09-15", hasta: "2026-09-15" };
    const fecha = new Date("2026-09-15T14:00:00Z");
    const [closer] = await db
      .insert(users)
      .values({ email: "mani@retia.co", rol: "closer", closerId: "Mani" })
      .returning();
    const dealId = await sembrarDeal(programaA, {
      ownerUserId: closer.id,
      valorVendidoUsd: "100",
    });
    await marcarVenta(dealId, fecha, closer.id);
    await db.insert(calls).values({
      programId: programaA,
      dealId,
      closerUserId: null,
      closerId: "mani ",
      fechaAgenda: fecha,
      resultado: "show",
    });

    const filas = await embudoPorCloser({ programId: programaA, rango }, db);

    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({
      clave: closer.id,
      closerId: "Mani",
      agendas: 1,
      cierres: 1,
    });
  });

});

describe("embudoPorCanal", () => {
  it("separa canales, sin UTM y sin clasificar sin cambiar los totales", () => {
    const dimensiones = { programId: programaA, dia: "2026-09-15", duenoUserId: null, cohorteId: null };
    const hechos = [
      { ...dimensiones, areaId: "area-a", canalId: "canal-a", origen: "canal" as const, envios: 2, agendas: 1, shows: 1, ventas: 0 },
      { ...dimensiones, areaId: "area-a", canalId: "canal-a", origen: "canal" as const, envios: 3, agendas: 2, shows: 1, ventas: 1 },
      { ...dimensiones, areaId: null, canalId: null, origen: "sin_utm" as const, envios: 4, agendas: 0, shows: 0, ventas: 0 },
      { ...dimensiones, areaId: null, canalId: null, origen: "sin_clasificar" as const, envios: 1, agendas: 1, shows: 0, ventas: 0 },
    ];
    const filas = embudoPorCanal(
      hechos,
      new Map([["canal-a", { canal: "Meta", area: "Pauta" }]]),
    );

    expect(filas.map((fila) => fila.origen)).toEqual(["canal", "sin_clasificar", "sin_utm"]);
    expect(filas[0]).toMatchObject({ canal: "Meta", area: "Pauta", envios: 5, agendas: 3, shows: 2, ventas: 1 });
    for (const medida of ["envios", "agendas", "shows", "ventas"] as const) {
      expect(filas.reduce((total, fila) => total + fila[medida], 0)).toBe(
        hechos.reduce((total, hecho) => total + hecho[medida], 0),
      );
    }
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
      { programId: programaA, closerId: "Ana", fechaAgenda: fecha, resultado: "show" },
      { programId: programaA, closerId: "Ana", fechaAgenda: fecha, resultado: "cerrada" },
      { programId: programaA, closerId: "Beto", fechaAgenda: fecha, resultado: "no_show" },
      { programId: programaA, closerId: "Beto", fechaAgenda: fecha, resultado: "cerrada" },
    ]);
    const ventaAna = { id: await sembrarDeal(programaA, { ownerUserId: anaId }) };
    const ventaBeto = { id: await sembrarDeal(programaA, { ownerUserId: betoId }) };
    await marcarVenta(ventaAna.id, fecha, anaId);
    await marcarVenta(ventaBeto.id, fecha, betoId);
    await db.insert(abonos).values([
      { dealId: ventaAna.id, programId: programaA, closerId: "Ana", fecha: "2026-09-15", monto: "100.00", moneda: "USD" },
      { dealId: ventaBeto.id, programId: programaA, closerId: "Beto", fecha: "2026-09-15", monto: "250.00", moneda: "USD" },
    ]);
  }

  it("el embudo y la caja de un closer son solo suyos; sin closer sale el total del programa", async () => {
    await sembrarDosClosers();

    const total = await embudoDelRango({ programId: programaA, rango }, db);
    expect(total.agendas).toBe(4);

    const ana = await embudoDelRango({ programId: programaA, rango, claveCloser: claveHistorica("Ana") }, db);
    expect(ana.agendas).toBe(2);
    expect(ana.llamadasConShow).toBe(2);
    expect(ana.cierres).toBe(1);

    expect(await cajaRecaudada({ programId: programaA, rango, claveCloser: claveHistorica("Ana") }, db)).toEqual([
      { moneda: "USD", total: 100 },
    ]);
    expect(await cajaRecaudada({ programId: programaA, rango, claveCloser: claveHistorica("Beto") }, db)).toEqual([
      { moneda: "USD", total: 250 },
    ]);
  });

  it("un closerId sin actividad en el rango da ceros, no revienta", async () => {
    await sembrarDosClosers();

    const nadie = await embudoDelRango({ programId: programaA, rango, claveCloser: claveHistorica("Zoe") }, db);
    expect(nadie.agendas).toBe(0);
    expect(nadie.pctShow).toBeNull();
    expect(await cajaRecaudada({ programId: programaA, rango, claveCloser: claveHistorica("Zoe") }, db)).toEqual([]);
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
    await sembrarDeal(programaA, { cohortId: cohorteId, ownerUserId: ana, etapa: "ganado_parcial" });
    await sembrarDeal(programaA, { cohortId: cohorteId, ownerUserId: ana, etapa: "ganado_completo" });
    await sembrarDeal(programaA, { cohortId: cohorteId, ownerUserId: beto, etapa: "ganado_parcial" });

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

describe("pendientes y desgloses acotados a un closer", () => {
  const rango = { desde: "2026-09-15", hasta: "2026-09-15" };
  const fecha = new Date("2026-09-15T14:00:00Z");

  it("los motivos de perdida se acotan al closer", async () => {
    const catalogoMotivos = await db.select().from(motivos);
    const dinero = catalogoMotivos.find((m) => m.nombre === "Dinero")!;
    const ana = await sembrarCloser("Ana-motivo-individual");
    const beto = await sembrarCloser("Beto-motivo-individual");
    for (const ownerUserId of [ana, beto]) {
      const dealId = await sembrarDeal(programaA, { etapa: "cierre_perdido", motivoId: dinero.id, ownerUserId });
      await db.insert(dealEtapaHistorial).values({ dealId, de: null, a: "cierre_perdido", fecha, userId: ownerUserId });
    }

    const motivosDeAna = await dealsPerdidosPorMotivo(
      { programId: programaA, rango, claveCloser: claveHistorica("Ana-motivo-individual") },
      db,
    );
    expect(motivosDeAna).toEqual([{ motivo: "Dinero", deals: 1 }]);
  });
});
