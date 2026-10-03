import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { calls, changeLog, miembrosPrograma, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { rellenarCloserDeLlamadas } from "@/lib/calendly/rellenar-closer";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

describe("rellenar closer de llamadas de Calendly", () => {
  let db: Db;
  let cerrar: () => Promise<void>;
  let programId: string;
  let closerId: string;
  let actorId: string;

  beforeEach(async () => {
    ({ db, cerrar } = await crearBaseDePrueba());
    const [programa] = await db
      .insert(programs)
      .values({ ...PROGRAMA_DE_PRUEBA, slug: "relleno", nombre: "Relleno", ticketUsd: "1000" })
      .returning();
    programId = programa.id;
    const [closer] = await db.insert(users).values({ email: "host@retia.co", rol: "closer" }).returning();
    const [actor] = await db.insert(users).values({ email: "actor@retia.co", rol: "developer" }).returning();
    closerId = closer.id;
    actorId = actor.id;
    await db.insert(miembrosPrograma).values({
      userId: closerId,
      programId,
      calendlyEmail: "host@calendly.co",
    });
  });

  afterEach(async () => cerrar());

  async function sembrar() {
    const filas = await db
      .insert(calls)
      .values([
        { programId, origen: "calendly", resultado: "agendada", calendlyHostEmail: "HOST@calendly.co", huellaFila: "calendly:casa" },
        { programId, origen: "calendly", resultado: "agendada", calendlyHostEmail: "otra@calendly.co", huellaFila: "calendly:no-casa" },
        {
          programId,
          origen: "calendly",
          resultado: "agendada",
          calendlyHostEmail: "host@calendly.co",
          huellaFila: "calendly:anulada",
          anuladoEn: new Date("2026-10-03T15:00:00Z"),
          anuladoPor: actorId,
          motivoAnulacion: "duplicada",
        },
      ])
      .returning();
    return filas;
  }

  it("en seco cuenta y lista sin cambiar llamadas ni rastro", async () => {
    const filas = await sembrar();
    const resultado = await rellenarCloserDeLlamadas(db, { aplicar: false, actorId });
    expect(resultado).toEqual({
      casan: 1,
      noCasan: [{ callId: filas[1].id, programa: "relleno", hostEmail: "otra@calendly.co" }],
    });
    expect((await db.select().from(calls)).every((fila) => fila.closerUserId === null)).toBe(true);
    expect(await db.select().from(changeLog)).toHaveLength(0);
  });

  it("al aplicar escribe closer y rastro, sin tocar la anulada", async () => {
    const filas = await sembrar();
    const resultado = await rellenarCloserDeLlamadas(db, { aplicar: true, actorId });
    expect(resultado.casan).toBe(1);
    expect((await db.select().from(calls).where(eq(calls.id, filas[0].id)))[0].closerUserId).toBe(closerId);
    expect((await db.select().from(calls).where(eq(calls.id, filas[2].id)))[0].closerUserId).toBeNull();
    const rastros = await db
      .select()
      .from(changeLog)
      .where(and(eq(changeLog.registroId, filas[0].id), eq(changeLog.campo, "closerUserId")));
    expect(rastros).toHaveLength(1);
    expect(rastros[0]).toMatchObject({ userId: actorId, valorNuevo: closerId });
  });
});
