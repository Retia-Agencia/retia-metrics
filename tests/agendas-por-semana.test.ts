import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { calls, deals, leads, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { semanasDelRango } from "@/lib/rangos";
import type { Metrica } from "@/lib/queries/metricas-con-filas";
import { detallesPorSemana, proximasPorSemana, vistaDeLista, type DetalleDeCifra } from "@/lib/queries/vista-metrica";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * Ticket 189: agendas creadas, ocurridas (con su show y su no-show sobre el grupo del ADR 0079) y
 * futuras, por semana de lunes a domingo en Bogotá. Cada cifra abre su lista y la lista la cuadra.
 */

describe("semanasDelRango", () => {
  it("parte en semanas de lunes a domingo recortadas a los bordes", () => {
    // 30-sep-2026 es miércoles; 13-oct-2026, martes.
    expect(semanasDelRango({ desde: "2026-09-30", hasta: "2026-10-13" })).toEqual([
      { desde: "2026-09-30", hasta: "2026-10-04" },
      { desde: "2026-10-05", hasta: "2026-10-11" },
      { desde: "2026-10-12", hasta: "2026-10-13" },
    ]);
    expect(semanasDelRango({ desde: "2026-10-04", hasta: "2026-10-04" })).toEqual([{ desde: "2026-10-04", hasta: "2026-10-04" }]);
  });
});

describe("ticket 189: agendas por semana", () => {
  let db: Db;
  let cerrar: () => Promise<void>;
  let programaA: string;
  const ahora = new Date("2026-10-07T12:00:00-05:00"); // miércoles
  const hoy = "2026-10-07";
  const rango = { desde: "2026-09-21", hasta: "2026-10-11" };
  const periodo = { preset: "custom" as const, a: rango, b: null };
  const t = (iso: string) => new Date(`${iso}-05:00`);

  beforeAll(async () => {
    ({ db, cerrar } = await crearBaseDePrueba());
    const [a, b] = await db.insert(programs).values([
      { ...PROGRAMA_DE_PRUEBA, ticketUsd: "100", slug: "s189-a", nombre: "A" },
      { ...PROGRAMA_DE_PRUEBA, ticketUsd: "100", slug: "s189-b", nombre: "B" },
    ]).returning();
    programaA = a.id;
    const [closer] = await db.insert(users).values({ email: "c@s189.test", rol: "closer", closerId: "Caro" }).returning();
    const nuevoDeal = async (programId: string, n: number, anulado = false) => {
      const [lead] = await db.insert(leads).values({ programId, emailNormalizado: `l${n}@s189.test` }).returning();
      const [deal] = await db.insert(deals).values({
        programId, leadId: lead.id, ownerUserId: closer.id, etapa: "agendado",
        anuladoEn: anulado ? ahora : null, anuladoPor: anulado ? closer.id : null, motivoAnulacion: anulado ? "Prueba" : null,
      }).returning();
      return deal.id;
    };
    const cita = (programId: string, dealId: string, creada: string, agenda: string, resultado: typeof calls.$inferInsert.resultado, anulada = false) =>
      db.insert(calls).values({
        programId, dealId, closerUserId: closer.id, createdAt: t(creada), fechaAgenda: t(agenda), resultado,
        anuladoEn: anulada ? ahora : null, anuladoPor: anulada ? closer.id : null, motivoAnulacion: anulada ? "Prueba" : null,
      });

    // 1) Creada en septiembre para octubre: creada la semana del 21-sep, ocurre (show) el 6-oct.
    await cita(programaA, await nuevoDeal(programaA, 1), "2026-09-22T09:00:00", "2026-10-06T10:00:00", "show");
    // 2) Creada y ocurrida la semana del 28-sep, no-show.
    await cita(programaA, await nuevoDeal(programaA, 2), "2026-09-28T09:00:00", "2026-09-30T10:00:00", "no_show");
    // 3) Futura: creada el 6-oct, cita el 9-oct, sigue agendada. No es no-show.
    await cita(programaA, await nuevoDeal(programaA, 3), "2026-10-06T09:00:00", "2026-10-09T10:00:00", "agendada");
    // 3b) Futura FUERA del rango (noviembre): las próximas no dependen del periodo. Y una futura cancelada no viene.
    await cita(programaA, await nuevoDeal(programaA, 7), "2026-10-06T09:00:00", "2026-11-04T10:00:00", "agendada");
    await cita(programaA, await nuevoDeal(programaA, 8), "2026-10-06T09:00:00", "2026-10-20T10:00:00", "cancelada");
    // 3c) Futuras que no vienen a nada: la llamada vigente de un deal anulado, y la de una cortesía.
    await cita(programaA, await nuevoDeal(programaA, 9, true), "2026-10-06T09:00:00", "2026-10-21T10:00:00", "agendada");
    const cortesia = await nuevoDeal(programaA, 10);
    await db.update(deals).set({ cortesia: true }).where(eq(deals.id, cortesia));
    await cita(programaA, cortesia, "2026-10-06T09:00:00", "2026-10-22T10:00:00", "agendada");
    // 4) Pasada y sin resultado (7-oct temprano): ocurrió y cuenta como no-show hasta que se registre (ADR 0079).
    await cita(programaA, await nuevoDeal(programaA, 4), "2026-10-05T09:00:00", "2026-10-07T08:00:00", "agendada");
    // 5) Anulados (la cita y su deal) y otro programa: no cuentan en ninguna cifra.
    await cita(programaA, await nuevoDeal(programaA, 5, true), "2026-09-29T09:00:00", "2026-09-30T11:00:00", "no_show", true);
    await cita(b.id, await nuevoDeal(b.id, 6), "2026-09-29T09:00:00", "2026-09-30T11:00:00", "no_show");
  }, 120_000);
  afterAll(async () => cerrar());

  async function filasDe(detalle: DetalleDeCifra) {
    const busqueda = Object.fromEntries(new URL(detalle.href, "https://s189.test").searchParams);
    const vista = await vistaDeLista({ programId: programaA, metrica: busqueda.metrica as Metrica, busqueda, hoy, pagina: 1, ahora }, db);
    expect(vista?.periodo.b).toBeNull();
    return vista!.lista;
  }

  it("cuenta cada cita en la semana que le toca y cada cifra cuadra con su lista", async () => {
    const semanas = await detallesPorSemana({ programId: programaA, slug: "s189-a", hoy, periodo }, db, ahora);
    expect(semanas.map((s) => s.semana.desde)).toEqual(["2026-09-21", "2026-09-28", "2026-10-05"]);
    const cuenta = semanas.map((s) => ({
      creadas: s.creadas.resumen.subtotal.cantidad,
      ocurridas: s.ocurridas.resumen.subtotal.cantidad,
      shows: s.shows.resumen.subtotal.cantidad,
      noShows: s.noShows.resumen.subtotal.cantidad,
      pctNoShow: s.pctNoShow,
    }));
    expect(cuenta).toEqual([
      // La cita 1 se creó aquí, pero ocurre en octubre.
      { creadas: 1, ocurridas: 0, shows: 0, noShows: 0, pctNoShow: null },
      { creadas: 1, ocurridas: 1, shows: 0, noShows: 1, pctNoShow: 1 },
      // Ocurridas: la 1 (show) y la 4 (sin resultado = no-show). La 3 es futura y no entra al no-show.
      { creadas: 6, ocurridas: 2, shows: 1, noShows: 1, pctNoShow: 0.5 },
    ]);

    // Las futuras, desde hoy y por la semana de la cita: la 3 esta semana y la 3b en noviembre;
    // la cancelada no, y no aparecen semanas vacías entre medio.
    const proximas = await proximasPorSemana({ programId: programaA, slug: "s189-a", hoy }, db, ahora);
    expect(proximas.map((p) => [p.semana, p.futuras.resumen.subtotal.cantidad])).toEqual([
      [{ desde: "2026-10-07", hasta: "2026-10-11" }, 1],
      [{ desde: "2026-11-02", hasta: "2026-11-08" }, 1],
    ]);
    for (const p of proximas) expect((await filasDe(p.futuras)).filas.length).toBe(1);

    for (const s of semanas) {
      for (const detalle of [s.creadas, s.ocurridas, s.shows, s.noShows]) {
        const lista = await filasDe(detalle);
        expect(lista.subtotal.cantidad).toBe(detalle.resumen.subtotal.cantidad);
        expect(lista.filas.length).toBe(detalle.resumen.subtotal.cantidad);
      }
    }
  });
});
