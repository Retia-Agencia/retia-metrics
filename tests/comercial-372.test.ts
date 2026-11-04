import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { calls, deals, leads, programs, sources, submissions, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { contextoDeCifra } from "@/lib/contexto-de-cifra";
import { resolverPeriodo } from "@/lib/periodo";
import { serieDealsContraAgendas } from "@/lib/queries/deals-contra-agendas";
import { listaDeMetrica, resumenDeMetrica, type Metrica } from "@/lib/queries/metricas-con-filas";
import { vistaDealsContraAgendas } from "@/lib/queries/vista-deals-contra-agendas";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

const HOY = "2026-10-09";
const A = { desde: "2026-10-01", hasta: "2026-10-09" };
const bogota = (dia: string, hora = "12:00") => new Date(`${dia}T${hora}:00-05:00`);

describe("372: el contexto de cada cifra (puro)", () => {
  it("dice cohorte, periodo y closer; 'hoy' cuando el periodo termina hoy", () => {
    expect(contextoDeCifra({ cohorte: "C3", rango: { desde: "2026-10-01", hasta: HOY }, hoy: HOY, closer: null }))
      .toBe("C3 · 1 oct 2026 a hoy · todos los closers");
    expect(contextoDeCifra({ cohorte: null, rango: { desde: HOY, hasta: HOY }, hoy: HOY, closer: "Ana" }))
      .toBe("Todas las cohortes · hoy · Ana");
    expect(contextoDeCifra({ cohorte: null, rango: { desde: "2026-09-01", hasta: "2026-09-30" }, hoy: HOY, closer: null }))
      .toBe("Todas las cohortes · 1 sep 2026 a 30 sep 2026 · todos los closers");
  });
});

describe("372: deals de un formulario completo y de un parcial, aparte", () => {
  let db: Db;
  let cerrar: () => Promise<void>;
  let programId: string;
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    ({ db, cerrar } = await crearBaseReutilizable());
    const [programa] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, ticketUsd: "100", slug: "prueba-372", nombre: "P" }).returning();
    programId = programa.id;
    const [owner] = await db.insert(users).values({ email: "ana@example.test", rol: "closer", closerId: "Ana" }).returning();
    const [fuente] = await db.insert(sources).values({ programId, nombre: "Formulario" }).returning();
    let n = 0;
    const deal = async (clave: string, esParcial: boolean | null, dia: string) => {
      n += 1;
      const [lead] = await db.insert(leads).values({ programId, emailNormalizado: `p${n}@example.test` }).returning();
      const [fila] = await db.insert(deals).values({ programId, leadId: lead.id, ownerUserId: owner.id, createdAt: bogota(dia) }).returning();
      ids[clave] = fila.id;
      if (esParcial === null) return;
      const [envio] = await db.insert(submissions).values({
        leadId: lead.id, sourceId: fuente.id, token: `t-${n}`, esParcial, fechaEnvio: bogota(dia, "10:00"),
      }).returning();
      await db.update(deals).set({ submissionOrigenId: envio.id }).where(eq(deals.id, fila.id));
    };
    await deal("completo", false, "2026-10-05");
    await deal("parcial", true, "2026-10-06");
    await deal("aMano", null, "2026-10-07");
    // Solo el deal del formulario completo agendó.
    await db.insert(calls).values({ programId, dealId: ids.completo, origen: "calendly", createdAt: bogota("2026-10-05"), fechaAgenda: bogota("2026-10-20") });
  }, 60_000);

  afterAll(async () => cerrar());

  it("Deals creados 2 = 1 + 1 (más el abierto a mano, aparte) y el % que agendaron usa 1 de denominador", async () => {
    const total = await serieDealsContraAgendas(db, { programId, rango: A });
    const completo = await serieDealsContraAgendas(db, { programId, rango: A }, "completo");
    const parcial = await serieDealsContraAgendas(db, { programId, rango: A }, "parcial");
    expect(total.puntos.at(-1)!.deals).toBe(3);
    expect(completo.puntos.at(-1)).toMatchObject({ deals: 1, agendaron: 1, pctAgendaron: 1 });
    expect(parcial.puntos.at(-1)).toMatchObject({ deals: 1, agendaron: 0, pctAgendaron: 0 });
    // Lo que no es de ninguna mitad no se pierde ni se reparte: se dice aparte.
    expect(total.puntos.at(-1)!.deals - completo.puntos.at(-1)!.deals - parcial.puntos.at(-1)!.deals).toBe(1);
  });

  it.each([
    ["deals_desde_completo", ["completo"]],
    ["deals_desde_parcial", ["parcial"]],
    ["completos_que_agendaron", ["completo"]],
    ["parciales_que_agendaron", []],
  ] as const)("%s: la lista suma su cifra y es solo de su mitad", async (metrica, claves) => {
    const filtros = { programId, rango: A, hoy: HOY };
    const [resumen] = await resumenDeMetrica(metrica as Metrica, filtros, db);
    const [lista] = await listaDeMetrica(metrica as Metrica, filtros, 1, db);
    expect(resumen.subtotal.cantidad).toBe(claves.length);
    expect(new Set(lista.filas.map((f) => f.id))).toEqual(new Set(claves.map((c) => ids[c])));
  });

  it("con una cohorte puesta, cada mitad se acota igual que el total", async () => {
    const filtros = { programId, rango: A, hoy: HOY, cohorteId: "00000000-0000-4000-8000-000000000000" };
    for (const metrica of ["deals_creados", "deals_desde_completo", "deals_desde_parcial"] as const) {
      const [resumen] = await resumenDeMetrica(metrica, filtros, db);
      expect(resumen.subtotal.cantidad).toBe(0);
    }
  });

  it("con closer no hay cifra de ninguna mitad: nunca el programa entero", async () => {
    const [resumen] = await resumenDeMetrica("deals_desde_completo", { programId, rango: A, hoy: HOY, claveCloser: "historico:ana" }, db);
    expect(resumen.disponible).toBe(false);
  });

  it("la vista trae las dos mitades con sus listas", async () => {
    const periodo = resolverPeriodo({ preset: "este_mes" }, { hoy: HOY });
    const vista = await vistaDealsContraAgendas({ programId, slug: "prueba-372", hoy: HOY, periodo, claveCloser: null, origen: "/p/prueba-372/hub?seccion=comercial" }, db);
    if (!vista.disponible) throw new Error("debería estar disponible");
    expect(vista.porOrigen.completo.a.puntos.at(-1)!.deals).toBe(1);
    expect(vista.porOrigen.parcial.a.puntos.at(-1)!.deals).toBe(1);
    expect(vista.detalles.deals_desde_completo.resumen.subtotal.cantidad).toBe(1);
    expect(vista.detalles.deals_desde_parcial.href).toContain("metrica=deals_desde_parcial");
  });
});
