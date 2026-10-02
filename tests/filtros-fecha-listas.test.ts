import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { abonos, calls, dealEtapaHistorial, deals, leads, programs, sources, submissions, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { filtroDeFechaDeLaUrl } from "@/lib/periodo";
import { CAMPOS_DE_FECHA_DE_DEAL, parsearFiltros, tableroKanban } from "@/lib/queries/kanban";
import { CAMPOS_DE_FECHA_DE_LEAD, leadsDelPrograma } from "@/lib/queries/leads";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * Ticket 141: los filtros de fecha relativos en la lista de deals (creado, última actividad,
 * cierre) y en la base de leads (creado, último envío), con el selector del 136 en modo solo A.
 */

const bogota = (dia: string, hora = "12:00") => new Date(`${dia}T${hora}:00-05:00`);

describe("141: el filtro de fecha de una lista, desde la URL", () => {
  it("sin `fecha`, o con un campo que la lista no tiene, no hay filtro: la lista muestra todo", () => {
    expect(filtroDeFechaDeLaUrl({}, CAMPOS_DE_FECHA_DE_DEAL, "2026-10-01")).toBeNull();
    expect(filtroDeFechaDeLaUrl({ periodo: "ayer" }, CAMPOS_DE_FECHA_DE_DEAL, "2026-10-01")).toBeNull();
    expect(filtroDeFechaDeLaUrl({ fecha: "ultimo_envio" }, CAMPOS_DE_FECHA_DE_DEAL, "2026-10-01")).toBeNull();
  });

  it("toma solo A, sin B ni avisos de B", () => {
    const filtro = filtroDeFechaDeLaUrl({ fecha: "creado", periodo: "este_mes" }, CAMPOS_DE_FECHA_DE_LEAD, "2026-10-01");
    expect(filtro).toMatchObject({ campo: "creado", periodo: { preset: "este_mes", a: { desde: "2026-10-01", hasta: "2026-10-01" }, b: null } });
    expect(filtro!.periodo.aviso).toBeUndefined();
  });

  it("un rango libre se respeta y uno invertido cae a Hoy con aviso", () => {
    const libre = filtroDeFechaDeLaUrl(
      { fecha: "cierre", periodo: "custom", a_desde: "2026-09-01", a_hasta: "2026-09-15" },
      CAMPOS_DE_FECHA_DE_DEAL,
      "2026-10-01",
    );
    expect(libre!.periodo.a).toEqual({ desde: "2026-09-01", hasta: "2026-09-15" });
    const invertido = filtroDeFechaDeLaUrl(
      { fecha: "cierre", periodo: "custom", a_desde: "2026-09-15", a_hasta: "2026-09-01" },
      CAMPOS_DE_FECHA_DE_DEAL,
      "2026-10-01",
    );
    expect(invertido!.periodo.a).toEqual({ desde: "2026-10-01", hasta: "2026-10-01" });
    expect(invertido!.periodo.aviso).toMatch(/inválido/);
  });

  it("una lista no tiene cohorte: el atajo de cohorte cae a Hoy y lo dice", () => {
    const filtro = filtroDeFechaDeLaUrl({ fecha: "creado", periodo: "cohorte_actual" }, CAMPOS_DE_FECHA_DE_DEAL, "2026-10-01");
    expect(filtro!.periodo).toMatchObject({ preset: "hoy", a: { desde: "2026-10-01", hasta: "2026-10-01" } });
    expect(filtro!.periodo.aviso).toMatch(/cohorte/);
  });
});

describe("141: la lista de deals y la base de leads, contra la base", () => {
  let db: Db;
  let cerrar: () => Promise<void>;
  let programId: string;
  const id: Record<string, string> = {};

  beforeAll(async () => {
    ({ db, cerrar } = await crearBaseDePrueba());
    const [p] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "p", nombre: "P", ticketUsd: "1000" }).returning();
    programId = p.id;
    const [fuente] = await db.insert(sources).values({ programId, nombre: "Typeform" }).returning();
    const [owner] = await db.insert(users).values({ email: "ana@example.test", rol: "closer", closerId: "Ana" }).returning();

    const deal = async (clave: string, creado: Date, lead: Partial<typeof leads.$inferInsert> = {}) => {
      const [l] = await db.insert(leads).values({ programId, emailNormalizado: `${clave}@example.test`, ...lead }).returning();
      const [d] = await db.insert(deals).values({ programId, leadId: l.id, ownerUserId: owner.id, createdAt: creado }).returning();
      id[clave] = d.id;
      return { lead: l, deal: d };
    };

    // "Ayer" visto el 1-oct a las 11 pm de Bogotá (ya 2-oct en UTC) es el 30-sep de Bogotá.
    await deal("ayerTarde", bogota("2026-09-30", "23:00")); // 1-oct en UTC: solo entra si se usa Bogotá
    await deal("hoyTemprano", bogota("2026-10-01", "01:00")); // 1-oct en Bogotá y en UTC

    // GC-07: el deal "nace" el día de su envío de origen, no el de la fila.
    const conEnvio = await deal("conEnvio", bogota("2026-09-25"));
    const [envio] = await db.insert(submissions).values({
      leadId: conEnvio.lead.id, sourceId: fuente.id, token: "t-1", esParcial: false, fechaEnvio: bogota("2026-09-10"),
    }).returning();

    await db.update(deals).set({ submissionOrigenId: envio.id }).where(eq(deals.id, conEnvio.deal.id));

    // Última actividad: un deal viejo con un abono reciente, y otro viejo y quieto.
    const activo = await deal("viejoActivo", bogota("2026-08-01"));
    await db.insert(abonos).values({ programId, dealId: activo.deal.id, fecha: "2026-09-29", monto: "100", moneda: "USD" });
    await deal("viejoQuieto", bogota("2026-08-01"));

    // Cierre: la primera entrada a Abonado, Completo o Cierre Perdido.
    const vendido = await deal("vendido", bogota("2026-08-01"));
    await db.insert(dealEtapaHistorial).values([
      { dealId: vendido.deal.id, a: "contactado", fecha: bogota("2026-09-01") }, // abierto: no es cierre
      { dealId: vendido.deal.id, de: "contactado", a: "ganado_parcial", fecha: bogota("2026-09-05") },
      { dealId: vendido.deal.id, de: "ganado_parcial", a: "ganado_completo", fecha: bogota("2026-09-20") },
    ]);
    const perdido = await deal("perdido", bogota("2026-08-01"));
    await db.insert(dealEtapaHistorial).values({ dealId: perdido.deal.id, a: "cierre_perdido", fecha: bogota("2026-09-20") });
    // Perdido el 3-sep, recuperado (transicion R) y vendido el 22-sep: cierra el 22, no el 3.
    const recuperado = await deal("recuperado", bogota("2026-08-01"));
    await db.insert(dealEtapaHistorial).values([
      { dealId: recuperado.deal.id, a: "cierre_perdido", fecha: bogota("2026-09-03") },
      { dealId: recuperado.deal.id, de: "cierre_perdido", a: "contactado", fecha: bogota("2026-09-08") },
      { dealId: recuperado.deal.id, de: "contactado", a: "ganado_parcial", fecha: bogota("2026-09-22") },
    ]);
    // Perdido el 4-sep y recuperado: hoy esta abierto, no tiene fecha de cierre.
    const reabierto = await deal("reabierto", bogota("2026-08-01"));
    await db.insert(dealEtapaHistorial).values([
      { dealId: reabierto.deal.id, a: "cierre_perdido", fecha: bogota("2026-09-04") },
      { dealId: reabierto.deal.id, de: "cierre_perdido", a: "agendado", fecha: bogota("2026-09-09") },
    ]);
    // Una cita agendada para el futuro no es actividad ocurrida.
    const conCita = await deal("conCitaFutura", bogota("2026-08-02"));
    await db.insert(calls).values({ programId, dealId: conCita.deal.id, origen: "calendly", createdAt: bogota("2026-08-02"), fechaAgenda: bogota("2026-10-06") });

    // Leads sin deal para "creado" contra "último envío".
    // Un lead dado de alta a mano: sin primera aplicación, "creado" es su alta.
    await db.insert(leads).values({ programId, emailNormalizado: "manual@example.test", entrada: "crm", createdAt: bogota("2026-09-03") });
    await db.insert(leads).values({
      programId,
      emailNormalizado: "lead@example.test",
      fechaPrimeraAplicacion: bogota("2026-09-02"),
      fechaUltimaAplicacion: bogota("2026-09-28", "23:30"), // 29-sep en UTC
    });
  }, 60_000);

  afterAll(async () => cerrar());
  afterEach(() => vi.useRealTimers());

  async function idsDelTablero(busqueda: Record<string, string>) {
    const tablero = await tableroKanban(db, programId, parsearFiltros(busqueda, "2026-10-01"), "2026-10-01");
    return new Set(tablero.columnas.flatMap((c) => c.tarjetas.map((t) => t.dealId)));
  }

  it("'Ayer' a las 11 pm de Bogotá trae los de ayer de Bogotá, no los de UTC", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(bogota("2026-10-01", "23:00"));
    // Sin `hoy` explícito: el día lo pone `hoyEnBogota()`, como en la página.
    const filtros = parsearFiltros({ fecha: "creado", periodo: "ayer" });
    expect(filtros.fecha!.periodo.a).toEqual({ desde: "2026-09-30", hasta: "2026-09-30" });
    vi.useRealTimers();
    const tablero = await tableroKanban(db, programId, filtros, "2026-10-01");
    const ids = new Set(tablero.columnas.flatMap((c) => c.tarjetas.map((t) => t.dealId)));
    expect(ids).toEqual(new Set([id.ayerTarde]));
  });

  it("creado usa la fecha del envío de origen", async () => {
    expect(await idsDelTablero({ fecha: "creado", periodo: "custom", a_desde: "2026-09-10", a_hasta: "2026-09-10" }))
      .toEqual(new Set([id.conEnvio]));
    expect((await idsDelTablero({ fecha: "creado", periodo: "custom", a_desde: "2026-09-25", a_hasta: "2026-09-25" })).size).toBe(0);
  });

  it("última actividad: un abono reciente mueve un deal viejo; uno quieto se queda en su alta", async () => {
    const recientes = await idsDelTablero({ fecha: "actividad", periodo: "custom", a_desde: "2026-09-29", a_hasta: "2026-09-29" });
    expect(recientes).toEqual(new Set([id.viejoActivo]));
    const deAgosto = await idsDelTablero({ fecha: "actividad", periodo: "custom", a_desde: "2026-08-01", a_hasta: "2026-08-01" });
    expect(deAgosto.has(id.viejoQuieto)).toBe(true);
    expect(deAgosto.has(id.viejoActivo)).toBe(false);
  });

  it("cierre: la primera entrada a una etapa cerrada, ganada o perdida; pasar a Completo no cierra otra vez", async () => {
    expect(await idsDelTablero({ fecha: "cierre", periodo: "custom", a_desde: "2026-09-05", a_hasta: "2026-09-05" }))
      .toEqual(new Set([id.vendido]));
    expect(await idsDelTablero({ fecha: "cierre", periodo: "custom", a_desde: "2026-09-20", a_hasta: "2026-09-20" }))
      .toEqual(new Set([id.perdido]));
  });

  it("un perdido que se recupera cierra el día de la venta; uno recuperado y abierto no tiene cierre", async () => {
    const enSeptiembre = await idsDelTablero({ fecha: "cierre", periodo: "custom", a_desde: "2026-09-01", a_hasta: "2026-09-30" });
    expect(enSeptiembre.has(id.reabierto)).toBe(false);
    expect((await idsDelTablero({ fecha: "cierre", periodo: "custom", a_desde: "2026-09-03", a_hasta: "2026-09-03" })).has(id.recuperado)).toBe(false);
    expect(await idsDelTablero({ fecha: "cierre", periodo: "custom", a_desde: "2026-09-22", a_hasta: "2026-09-22" }))
      .toEqual(new Set([id.recuperado]));
  });

  it("una cita futura no cuenta como última actividad en la lista", async () => {
    const tablero = async (dia: string) => {
      const filtros = parsearFiltros({ fecha: "actividad", periodo: "custom", a_desde: dia, a_hasta: dia }, "2026-10-01");
      const t = await tableroKanban(db, programId, filtros, "2026-10-01", bogota("2026-10-01", "18:00"));
      return new Set(t.columnas.flatMap((c) => c.tarjetas.map((x) => x.dealId)));
    };
    expect((await tablero("2026-10-06")).has(id.conCitaFutura)).toBe(false);
    expect((await tablero("2026-08-02")).has(id.conCitaFutura)).toBe(true);
  });

  it("sin filtro de fecha el tablero trae todos", async () => {
    expect((await idsDelTablero({})).size).toBe(Object.keys(id).length);
  });

  it("leads: creado es la primera aplicación y último envío la última, en días de Bogotá", async () => {
    const correos = async (campo: "creado" | "ultimo_envio", dia: string) =>
      (await leadsDelPrograma(db, programId, { fecha: { campo, rango: { desde: dia, hasta: dia } } })).filas.map((f) => f.email);
    expect(await correos("creado", "2026-09-02")).toContain("lead@example.test");
    expect(await correos("ultimo_envio", "2026-09-28")).toContain("lead@example.test");
    expect(await correos("ultimo_envio", "2026-09-29")).not.toContain("lead@example.test");
    expect(await correos("creado", "2026-09-03")).toContain("manual@example.test");
  });
});

describe("141: la última actividad tiene UNA definición", () => {
  it("la define solo `lib/queries/ultima-actividad.ts` y la importan el Inbox y la lista de deals", () => {
    const leer = (ruta: string) => readFileSync(ruta, "utf8");
    expect(leer("lib/queries/ultima-actividad.ts")).toMatch(/export async function ultimaActividadPorDeal/);
    for (const ruta of ["lib/queries/inbox.ts", "lib/queries/kanban.ts"]) {
      expect(leer(ruta)).toMatch(/import \{ ultimaActividadPorDeal \} from "@\/lib\/queries\/ultima-actividad"/);
      expect(leer(ruta)).not.toMatch(/function ultimaActividadPorDeal/);
    }
  });
});
