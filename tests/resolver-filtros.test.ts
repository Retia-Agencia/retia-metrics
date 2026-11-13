import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { cohorts, deals, leads, miembrosPrograma, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { resolverCohorte, resolverDueno } from "@/lib/queries/resolver-filtros";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let programId: string;
let nicolasA: string;
let cohorteId: string;

beforeAll(async () => ({ db, cerrar, vaciar } = await crearBaseReutilizable()));
beforeEach(async () => {
  await vaciar();
  const [programa] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "resolver", nombre: "Resolver", ticketUsd: "797" }).returning();
  programId = programa.id;
  const [a, b, cesar] = await db.insert(users).values([
    { email: "nico-a@retia.test", nombre: "Nicolás Pérez", rol: "closer", closerId: "nico-a" },
    { email: "nico-b@retia.test", nombre: "Nicolás Rojas", rol: "closer", closerId: "nico-b" },
    { email: "cesar@retia.test", nombre: "César Núñez", rol: "closer", closerId: "cesar" },
  ]).returning();
  nicolasA = a.id;
  await db.insert(miembrosPrograma).values([a, b, cesar].map((usuario) => ({ userId: usuario.id, programId })));
  const [cohorte] = await db.insert(cohorts).values({ programId, codigo: "NOV-26", metaCupos: 10, precioUsd: "797", fechaInicioVentas: "2026-11-01", fechaCierreVentas: "2026-11-30", fechaInicioClases: "2026-12-01", estado: "activo" }).returning();
  cohorteId = cohorte.id;
  const [lead] = await db.insert(leads).values({ programId, emailNormalizado: "dueno@retia.test", fechaPrimeraAplicacion: new Date("2026-11-01T12:00:00-05:00") }).returning();
  await db.insert(deals).values({ programId, leadId: lead.id, ownerUserId: a.id, cohortId: cohorte.id, etapa: "agendado" });
});
afterAll(async () => cerrar());

describe("resolución de filtros semánticos", () => {
  it("resuelve dueño por id, nombre exacto sin tildes y coincidencia única", async () => {
    expect((await resolverDueno(db, programId, "Resolver", nicolasA)).id).toBe(nicolasA);
    expect((await resolverDueno(db, programId, "Resolver", "cesar nunez")).nombre).toBe("César Núñez");
    expect((await resolverDueno(db, programId, "Resolver", "Rojas")).nombre).toBe("Nicolás Rojas");
  });

  it("un nombre inexistente o ambiguo falla con opciones e ids, nunca como cero filas", async () => {
    await expect(resolverDueno(db, programId, "Resolver", "Nadie")).rejects.toThrow(/en Resolver.*Opciones:.*Nicolás/);
    await expect(resolverDueno(db, programId, "Resolver", "Nicolás")).rejects.toThrow(new RegExp(`ambiguo:.*${nicolasA}.*Usa el id`));
  });

  it("resuelve cohorte por código o id y todas quita el filtro", async () => {
    expect((await resolverCohorte(db, programId, "Resolver", "nov-26")).id).toBe(cohorteId);
    expect((await resolverCohorte(db, programId, "Resolver", cohorteId)).id).toBe(cohorteId);
    expect((await resolverCohorte(db, programId, "Resolver", "todas")).id).toBeNull();
  });
});
