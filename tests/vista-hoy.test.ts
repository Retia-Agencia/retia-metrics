import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { abonos, calls, cohorts, dealEtapaHistorial, deals, leads, programs, sources, submissions, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { hoyEnBogota } from "@/lib/format";
import { cajaRecaudada, type VistaDeCohorte } from "@/lib/queries/dashboard";
import { armarVistaDelDashboard, type VistaDelDashboard } from "@/lib/queries/vista-dashboard";
import { armarVistaDeHoy, cajaDelDiaPorOrigen, contextoDelDia, horizontesDeCupos } from "@/lib/queries/vista-hoy";
import { detalleDeCifra } from "@/lib/queries/vista-metrica";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * Hub › Hoy (ticket 252). Hoy no calcula métricas: ordena las de `armarVistaDelDashboard` con el periodo
 * de hoy. Lo que sí agrega (el contexto y la caja por origen) se prueba aquí, y la caja contra la de
 * Dinero: las dos partes suman siempre lo mismo que `cajaRecaudada`.
 */

const cohorte = (ventana: VistaDeCohorte["ventana"]): VistaDeCohorte => ({
  cohorteId: "c-1", codigo: "C3", meta: 50, vendidos: 20, vendidosDelCloser: null, faltan: 30, ventana,
});
const VENTANA = {
  inicio: "2026-09-25", cierre: "2026-11-06", dia: 13, total: 32, habilesRestantes: 20,
  metaDinamica: 1.5, metaLineal: 50 / 32, esperado: 20.3, cumplimiento: 0.985,
};

describe("la línea de contexto (252)", () => {
  it("el 14-oct-2026: semana día 3 de 5, octubre día 10 de 22, la cohorte en su día", () => {
    expect(contextoDelDia("2026-10-14", cohorte(VENTANA))).toEqual({
      semana: { dia: 3, total: 5 },
      mes: { mes: "2026-10", dia: 10, total: 22 },
      cohorte: { codigo: "C3", dia: 13, total: 32 },
    });
  });

  it("un sábado cuenta como el viernes y el lunes abre la semana", () => {
    expect(contextoDelDia("2026-10-17", null).semana).toEqual({ dia: 5, total: 5 });
    expect(contextoDelDia("2026-10-19", null).semana).toEqual({ dia: 1, total: 5 });
  });

  it("un domingo es el último día de su semana, no el primero de la siguiente", () => {
    expect(contextoDelDia("2026-10-18", null).semana).toEqual({ dia: 5, total: 5 });
  });

  it("cruza el fin de mes y de año sin moverse de día", () => {
    expect(contextoDelDia("2026-12-31", null).mes).toEqual({ mes: "2026-12", dia: 23, total: 23 });
    expect(contextoDelDia("2027-01-01", null).mes).toEqual({ mes: "2027-01", dia: 1, total: 21 });
  });

  it("sin cohorte o sin ventana declarada no inventa días", () => {
    expect(contextoDelDia("2026-10-14", null).cohorte).toBeNull();
    expect(contextoDelDia("2026-10-14", cohorte(null)).cohorte).toBeNull();
  });
});

describe("los cupos del día, la semana, la cohorte y el mes (252)", () => {
  const vista = (cambios: Partial<VistaDelDashboard>) => ({
    cohorte: cohorte(VENTANA),
    embudo: { cierres: 3 },
    metasDelMes: {
      mesSinVentana: false, metaCupos: 30, vendidos: 12, cumplimiento: 0.9,
      compensacionSemanal: { desde: "2026-10-12", hasta: "2026-10-18", meta: 8, vendidos: 4, faltan: 4, porDia: 2, diasHabilesRestantes: 2 },
    },
    ...cambios,
  }) as unknown as VistaDelDashboard;

  it("cada número sale tal cual de la vista: no se recalcula", () => {
    expect(horizontesDeCupos(vista({}))).toEqual([
      { clave: "dia", meta: 1.5, real: 3, cumplimiento: 2 },
      { clave: "semana", meta: 8, real: 4, cumplimiento: 0.5 },
      { clave: "cohorte", meta: 50, real: 20, cumplimiento: 0.985 },
      { clave: "mes", meta: 30, real: 12, cumplimiento: 0.9 },
    ]);
  });

  it("sin cohorte, sin semana o sin ventana en el mes: meta nula y cumplimiento nulo, nunca cero", () => {
    const sinNada = horizontesDeCupos(vista({
      cohorte: null,
      metasDelMes: { mesSinVentana: true, metaCupos: 0, vendidos: 0, cumplimiento: null, compensacionSemanal: null } as never,
    }));
    for (const h of sinNada) {
      expect(h.meta).toBeNull();
      expect(h.cumplimiento).toBeNull();
    }
  });

  it("con la meta del día ya cumplida (meta dinámica 0) el cumplimiento no divide por cero", () => {
    const [dia] = horizontesDeCupos(vista({ cohorte: cohorte({ ...VENTANA, metaDinamica: 0 }) }));
    expect(dia).toEqual({ clave: "dia", meta: 0, real: 3, cumplimiento: null });
  });
});

describe("la caja de hoy por origen (252)", () => {
  const HOY = "2026-10-14";
  let db: Db;
  let cerrar: () => Promise<void>;
  let vaciar: () => Promise<void>;

  beforeAll(async () => {
    ({ db, cerrar, vaciar } = await crearBaseReutilizable());
  });

  beforeEach(async () => {
    await vaciar();
  }, 60_000);

  afterAll(async () => cerrar());

  async function sembrar() {
    const [programa] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "programa-a", nombre: "Programa A", ticketUsd: "797" }).returning();
    const [otro] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "programa-b", nombre: "Programa B", ticketUsd: "1500" }).returning();
    const deal = async (programId: string, correo: string, vendidoEl: string) => {
      const [lead] = await db.insert(leads).values({ programId, emailNormalizado: correo }).returning();
      const [d] = await db.insert(deals).values({ programId, leadId: lead.id, etapa: "ganado_parcial", valorVendidoUsd: "797" }).returning();
      await db.insert(dealEtapaHistorial).values({ dealId: d.id, de: "atendido", a: "ganado_parcial", fecha: new Date(`${vendidoEl}T15:00:00Z`) });
      return d;
    };
    const deHoy = await deal(programa.id, "hoy@retia.co", HOY);
    const deAntes = await deal(programa.id, "antes@retia.co", "2026-10-02");
    const ajeno = await deal(otro.id, "ajeno@retia.co", HOY);
    const [gerente] = await db.insert(users).values({ email: "gerente@retia.co", rol: "gerente" }).returning();
    await db.insert(abonos).values([
      { dealId: deHoy.id, programId: programa.id, fecha: HOY, monto: "300", moneda: "USD" },
      { dealId: deAntes.id, programId: programa.id, fecha: HOY, monto: "200", moneda: "USD" },
      { dealId: deAntes.id, programId: programa.id, fecha: HOY, monto: "400000", moneda: "COP" },
      // Ayer no es caja de hoy.
      { dealId: deAntes.id, programId: programa.id, fecha: "2026-10-13", monto: "100", moneda: "USD" },
      // Anulado: no cuenta en ninguna parte (ADR 0026).
      { dealId: deHoy.id, programId: programa.id, fecha: HOY, monto: "999", moneda: "USD", anuladoEn: new Date(), anuladoPor: gerente.id, motivoAnulacion: "tecleo" },
      // Otro programa: frontera (ADR 0043).
      { dealId: ajeno.id, programId: otro.id, fecha: HOY, monto: "1500", moneda: "USD" },
    ]);
    return programa;
  }

  it("separa lo de las ventas de hoy de lo que completa ventas anteriores", async () => {
    const programa = await sembrar();
    expect(await cajaDelDiaPorOrigen({ programId: programa.id, hoy: HOY }, db)).toEqual([
      { moneda: "COP", total: 400000, deVentasDeHoy: 0, deVentasAnteriores: 400000 },
      { moneda: "USD", total: 500, deVentasDeHoy: 300, deVentasAnteriores: 200 },
    ]);
  });

  it("el total por moneda es la misma caja de Dinero (cajaRecaudada) y de la vista de hoy", async () => {
    const programa = await sembrar();
    const rango = { desde: HOY, hasta: HOY };
    const [porOrigen, deDinero, vista] = await Promise.all([
      cajaDelDiaPorOrigen({ programId: programa.id, hoy: HOY }, db),
      cajaRecaudada({ programId: programa.id, rango, claveCloser: null }, db),
      armarVistaDelDashboard({ programId: programa.id, hoy: HOY, preset: "hoy", periodo: { preset: "hoy" } }, db),
    ]);
    const ordenar = (filas: { moneda: string; total: number }[]) =>
      filas.map(({ moneda, total }) => ({ moneda, total })).sort((a, b) => a.moneda.localeCompare(b.moneda));
    expect(ordenar(porOrigen)).toEqual(ordenar(deDinero));
    expect(ordenar(porOrigen)).toEqual(ordenar(vista.caja));
    for (const fila of porOrigen) expect(fila.deVentasDeHoy + fila.deVentasAnteriores).toBeCloseTo(fila.total, 2);
  });

  it("las ventas del día de Hoy son los cierres de hoy de Comercial", async () => {
    const programa = await sembrar();
    await db.insert(calls).values({ programId: programa.id, closerId: "Ana", fechaAgenda: new Date(`${HOY}T14:00:00Z`), resultado: "show" });
    const vista = await armarVistaDelDashboard({ programId: programa.id, hoy: HOY, preset: "hoy", periodo: { preset: "hoy" } }, db);
    const [dia] = horizontesDeCupos(vista);
    expect(dia.real).toBe(vista.embudo.cierres);
    expect(dia.real).toBe(1);
  });

  it("sin abonos hoy no hay filas, no hay ceros inventados", async () => {
    const [programa] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "vacio", nombre: "Vacío", ticketUsd: "797" }).returning();
    expect(await cajaDelDiaPorOrigen({ programId: programa.id, hoy: HOY }, db)).toEqual([]);
  });

  it("hoy arma la misma vista, contexto, horizontes y caja que el camino anterior", async () => {
    const dia = hoyEnBogota();
    const [programa] = await db.insert(programs).values({
      ...PROGRAMA_DE_PRUEBA,
      slug: "equivalencia",
      nombre: "Equivalencia",
      ticketUsd: "797",
    }).returning();
    const anterior = await armarVistaDelDashboard({
      programId: programa.id,
      hoy: dia,
      periodo: { preset: "hoy" },
      preset: "hoy",
      claveCloser: null,
    }, db);
    const resultado = await armarVistaDeHoy({ programId: programa.id, dia }, db);

    expect(resultado.vista).toEqual(anterior);
    expect(resultado.contexto).toEqual(contextoDelDia(dia, anterior.cohorte));
    expect(resultado.horizontes).toEqual(horizontesDeCupos(anterior));
    expect(resultado.caja).toEqual(await cajaDelDiaPorOrigen({ programId: programa.id, hoy: dia }, db));
  });

  it("arma un día pasado con ventas, metas y contexto como estaban al cierre", async () => {
    const dia = "2026-10-14";
    const [programa] = await db.insert(programs).values({
      ...PROGRAMA_DE_PRUEBA,
      slug: "dia-armado",
      nombre: "Día armado",
      ticketUsd: "797",
    }).returning();
    const [cohorteActiva] = await db.insert(cohorts).values({
      programId: programa.id,
      codigo: "C10",
      metaCupos: 10,
      precioUsd: "797",
      fechaInicioClases: "2026-11-01",
      fechaInicioVentas: "2026-10-12",
      fechaCierreVentas: "2026-10-16",
      estado: "activo",
    }).returning();
    let secuencia = 0;
    const venta = async (vendidoEl: string) => {
      secuencia += 1;
      const [lead] = await db.insert(leads).values({
        programId: programa.id,
        emailNormalizado: `venta-${secuencia}@retia.co`,
      }).returning();
      const [deal] = await db.insert(deals).values({
        programId: programa.id,
        leadId: lead.id,
        cohortId: cohorteActiva.id,
        etapa: "ganado_parcial",
      }).returning();
      await db.insert(dealEtapaHistorial).values({
        dealId: deal.id,
        a: "ganado_parcial",
        fecha: new Date(`${vendidoEl}T11:00:00-05:00`),
      });
    };
    await venta("2026-10-13");
    await venta(dia);
    await venta("2026-10-15");

    const resultado = await armarVistaDeHoy({ programId: programa.id, dia }, db);
    expect(resultado.vista.cohorte?.vendidos).toBe(2);
    expect(resultado.vista.cohorte?.ventana?.metaDinamica).toBeCloseTo(8 / 3);
    expect(resultado.horizontes.find((h) => h.clave === "dia")?.real).toBe(1);
    expect(resultado.horizontes.find((h) => h.clave === "semana")?.real).toBe(2);
    expect(resultado.vista.metasDelMes.vendidos).toBe(2);
    expect(resultado.contexto).toEqual({
      semana: { dia: 3, total: 5 },
      mes: { mes: "2026-10", dia: 10, total: 22 },
      cohorte: { codigo: "C10", dia: 3, total: 5 },
    });
  });

  it("cuenta solo las citas reagendadas vigentes del día", async () => {
    const dia = "2026-10-14";
    const [programa] = await db.insert(programs).values({
      ...PROGRAMA_DE_PRUEBA,
      slug: "reagendadas",
      nombre: "Reagendadas",
      ticketUsd: "797",
    }).returning();
    const [gerente] = await db.insert(users).values({ email: "anula@retia.co", rol: "gerente" }).returning();
    await db.insert(calls).values([
      { programId: programa.id, fechaAgenda: new Date(`${dia}T10:00:00-05:00`), resultado: "reagendada" },
      {
        programId: programa.id,
        fechaAgenda: new Date(`${dia}T11:00:00-05:00`),
        resultado: "reagendada",
        anuladoEn: new Date(`${dia}T12:00:00-05:00`),
        anuladoPor: gerente.id,
        motivoAnulacion: "Corrección",
      },
      { programId: programa.id, fechaAgenda: new Date("2026-10-15T10:00:00-05:00"), resultado: "reagendada" },
    ]);

    const resultado = await armarVistaDeHoy({ programId: programa.id, dia }, db);
    expect(resultado.vista.embudo.reagendadas).toBe(1);
  });

  it("agendasCreadas coincide con el resumen de la lista del mismo día", async () => {
    const dia = "2026-10-14";
    const [programa] = await db.insert(programs).values({
      ...PROGRAMA_DE_PRUEBA,
      slug: "agendas-creadas",
      nombre: "Agendas creadas",
      ticketUsd: "797",
    }).returning();
    await db.insert(calls).values([
      {
        programId: programa.id,
        fechaAgenda: new Date("2026-10-20T10:00:00-05:00"),
        createdAt: new Date(`${dia}T09:00:00-05:00`),
      },
      {
        programId: programa.id,
        fechaAgenda: new Date("2026-10-21T10:00:00-05:00"),
        createdAt: new Date(`${dia}T15:00:00-05:00`),
      },
      {
        programId: programa.id,
        fechaAgenda: new Date("2026-10-20T10:00:00-05:00"),
        createdAt: new Date("2026-10-13T15:00:00-05:00"),
      },
    ]);

    const resultado = await armarVistaDeHoy({ programId: programa.id, dia }, db);
    const detalle = await detalleDeCifra("agendas_creadas", {
      programId: programa.id,
      slug: programa.slug,
      hoy: dia,
      periodo: resultado.vista.periodo,
      claveCloser: null,
    }, db);
    expect(resultado.agendasCreadas).toBe(2);
    expect(resultado.agendasCreadas).toBe(detalle.resumen.subtotal.cantidad);
  });

  it("registros cuenta cada envío completo del día y coincide con su lista", async () => {
    const dia = "2026-10-14";
    const [programa, otroPrograma] = await db.insert(programs).values([
      { ...PROGRAMA_DE_PRUEBA, slug: "registros", nombre: "Registros", ticketUsd: "797" },
      { ...PROGRAMA_DE_PRUEBA, slug: "registros-otro", nombre: "Registros otro", ticketUsd: "797" },
    ]).returning();
    const [fuente, fuenteAjena] = await db.insert(sources).values([
      { programId: programa.id, nombre: "Typeform" },
      { programId: otroPrograma.id, nombre: "Typeform otro" },
    ]).returning();
    const [persona, personaAjena] = await db.insert(leads).values([
      { programId: programa.id, emailNormalizado: "repite@retia.co" },
      { programId: otroPrograma.id, emailNormalizado: "repite@retia.co" },
    ]).returning();
    await db.insert(submissions).values([
      { leadId: persona.id, sourceId: fuente.id, token: "completo-1", fechaEnvio: new Date(`${dia}T08:00:00-05:00`) },
      { leadId: persona.id, sourceId: fuente.id, token: "completo-2", fechaEnvio: new Date(`${dia}T23:30:00-05:00`) },
      { leadId: persona.id, sourceId: fuente.id, token: "parcial", esParcial: true, fechaEnvio: new Date(`${dia}T12:00:00-05:00`) },
      { leadId: persona.id, sourceId: fuente.id, token: "otro-dia", fechaEnvio: new Date("2026-10-13T12:00:00-05:00") },
      { leadId: personaAjena.id, sourceId: fuenteAjena.id, token: "otro-programa", fechaEnvio: new Date(`${dia}T12:00:00-05:00`) },
    ]);

    const resultado = await armarVistaDeHoy({ programId: programa.id, dia }, db);
    const detalle = await detalleDeCifra("registros", {
      programId: programa.id,
      slug: programa.slug,
      hoy: dia,
      periodo: resultado.vista.periodo,
      claveCloser: null,
    }, db);

    expect(resultado.registros).toBe(2);
    expect(resultado.registros).toBe(detalle.resumen.subtotal.cantidad);
  });
});
