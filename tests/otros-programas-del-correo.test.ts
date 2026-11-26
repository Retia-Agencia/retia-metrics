import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { deals, leads, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { otrosProgramasDelCorreo } from "@/lib/queries/otros-programas-del-correo";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";
import { FECHA_LEAD_DE_PRUEBA } from "./helpers/crear-lead-de-prueba";

/**
 * Ticket 091 (ADR 0043 punto 6): la unica visibilidad cruzada de un lead. Se prueba el hecho
 * (que otro programa tiene el correo y en que etapa esta su deal) y, sobre todo, la regla: la
 * llama SOLO la ficha del Lead. Ninguna metrica, ningun modulo del dashboard.
 */

describe("otrosProgramasDelCorreo (PGlite)", () => {
  let db: Db;
  let cerrar: () => Promise<void>;
  let vaciar: () => Promise<void>;
  let a: string;
  let b: string;
  let c: string;
  let closer: string;

  beforeAll(async () => {
    ({ db, cerrar, vaciar } = await crearBaseReutilizable());
  });

  beforeEach(async () => {
    await vaciar();
    const programa = (slug: string) => ({ ...PROGRAMA_DE_PRUEBA, slug, nombre: slug.toUpperCase(), ticketUsd: "1000" });
    [{ id: a }, { id: b }, { id: c }] = await db.insert(programs).values([programa("a"), programa("b"), programa("c")]).returning();
    const [u] = await db.insert(users).values({ email: "maru@retia.co", rol: "closer", closerId: "Maru" }).returning();
    closer = u.id;
  }, 60_000);

  afterAll(async () => {
    await cerrar();
  });

  it("un correo que solo esta en su programa no avisa nada", async () => {
    await db.insert(leads).values({ fechaPrimeraAplicacion: FECHA_LEAD_DE_PRUEBA, programId: a, emailNormalizado: "solo@correo.co" });
    expect(await otrosProgramasDelCorreo(db, "solo@correo.co", a)).toEqual([]);
  });

  it("dice en que otros programas esta, con la etapa del deal abierto (o del ultimo)", async () => {
    await db.insert(leads).values({ fechaPrimeraAplicacion: FECHA_LEAD_DE_PRUEBA, programId: a, emailNormalizado: "ana@correo.co" });
    const [lb] = await db.insert(leads).values({ fechaPrimeraAplicacion: FECHA_LEAD_DE_PRUEBA, programId: b, emailNormalizado: "ana@correo.co" }).returning();
    const [lc] = await db.insert(leads).values({ fechaPrimeraAplicacion: FECHA_LEAD_DE_PRUEBA, programId: c, emailNormalizado: "ana@correo.co" }).returning();
    await db.insert(deals).values([
      { leadId: lb.id, programId: b, etapa: "cierre_perdido", createdAt: new Date("2026-09-01T00:00:00Z") },
      { leadId: lb.id, programId: b, etapa: "agendado", createdAt: new Date("2026-08-01T00:00:00Z") },
      // Un deal anulado no es un estado del negocio: no se avisa con su etapa.
      {
        leadId: lc.id, programId: c, etapa: "calificado",
        anuladoEn: new Date(), anuladoPor: closer, motivoAnulacion: "lead equivocado",
      },
    ]);

    const otros = await otrosProgramasDelCorreo(db, "ana@correo.co", a);
    expect(otros).toEqual([
      { programId: b, programaNombre: "B", programaSlug: "b", leadId: lb.id, deal: { etapa: "agendado", cerrado: false } },
      { programId: c, programaNombre: "C", programaSlug: "c", leadId: lc.id, deal: null },
    ]);
  });

  it("no une ni fusiona: los dos leads siguen siendo dos", async () => {
    await db.insert(leads).values({ fechaPrimeraAplicacion: FECHA_LEAD_DE_PRUEBA, programId: a, emailNormalizado: "dos@correo.co" });
    await db.insert(leads).values({ fechaPrimeraAplicacion: FECHA_LEAD_DE_PRUEBA, programId: b, emailNormalizado: "dos@correo.co" });
    await otrosProgramasDelCorreo(db, "dos@correo.co", a);
    expect(await db.select().from(leads)).toHaveLength(2);
  });
});
