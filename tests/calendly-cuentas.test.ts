import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { changeLog, miembrosPrograma, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { cuentasDeCalendly, cuentasPorPrograma } from "@/lib/calendly/cuentas";
import { ErrorDeCalendly } from "@/lib/calendly/cita";
import { asignarCalendlyDeMembresia } from "@/lib/catalogo/usuarios";
import { AuthorizationError } from "@/lib/auth/roles";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * La cuenta de Calendly de cada membresia sale de la organizacion del programa (ticket 096):
 * se elige de la lista que devuelve el PAT y el servidor la vuelve a comprobar. La API de
 * Calendly es de mentira, inyectada por `fetch`.
 */

const ORG = "https://api.calendly.com/organizations/o";

function calendly(miembros: { email: string; name?: string }[], status = 200) {
  return vi.fn(async (url: string) => {
    const json = (cuerpo: unknown) => ({ ok: status === 200, status, json: async () => cuerpo });
    if (url.endsWith("/users/me")) return json({ resource: { current_organization: ORG } });
    if (url.includes("/organization_memberships?")) {
      expect(url).toContain(encodeURIComponent(ORG));
      return json({ collection: miembros.map((user) => ({ user })), pagination: {} });
    }
    throw new Error(`URL inesperada ${url}`);
  });
}

describe("cuentasDeCalendly", () => {
  it("devuelve las cuentas de la organizacion, en minusculas y sin repetir", async () => {
    const cuentas = await cuentasDeCalendly({
      token: "t",
      fetch: calendly([
        { email: " Maru@Calendly.co ", name: "Maru" },
        { email: "maru@calendly.co", name: "Maru" },
        { email: "andrea@calendly.co", name: "Andrea" },
        { email: "sin-arroba" },
      ]),
    });
    expect(cuentas).toEqual([
      { correo: "andrea@calendly.co", nombre: "Andrea", membresiaId: null },
      { correo: "maru@calendly.co", nombre: "Maru", membresiaId: null },
    ]);
  });

  it("un token rechazado es un error visible, no una lista vacia", async () => {
    await expect(cuentasDeCalendly({ token: "t", fetch: calendly([], 401) })).rejects.toBeInstanceOf(ErrorDeCalendly);
  });
});

describe("vincular la cuenta de una membresia", () => {
  let db: Db;
  let cerrar: () => Promise<void>;
  let programId: string;
  let admin: string;
  let maru: string;
  let andrea: string;
  let membresiaMaru: string;
  let membresiaAndrea: string;

  beforeEach(async () => {
    ({ db, cerrar } = await crearBaseDePrueba());
    const [p] = await db
      .insert(programs)
      .values({ ...PROGRAMA_DE_PRUEBA, slug: "tactical", nombre: "Tactical", ticketUsd: "1500", calendlyToken: "pat" })
      .returning();
    programId = p.id;
    const [a] = await db.insert(users).values({ email: "admin@retiagrowth.com", rol: "gerente" }).returning();
    admin = a.id;
    const [m] = await db.insert(users).values({ email: "maru@retiagrowth.com", rol: "closer" }).returning();
    const [n] = await db.insert(users).values({ email: "andrea@retiagrowth.com", rol: "closer" }).returning();
    maru = m.id;
    andrea = n.id;
    [{ id: membresiaMaru }, { id: membresiaAndrea }] = await db
      .insert(miembrosPrograma)
      .values([
        { userId: m.id, programId },
        { userId: n.id, programId },
      ])
      .returning();
  });

  afterEach(async () => {
    await cerrar();
  });

  const ORGANIZACION = [{ email: "maru@calendly.co", name: "Maru" }, { email: "andrea@calendly.co" }];

  it("la closer asigna y cambia su propia cuenta; cada cambio deja su rastro", async () => {
    const fetch = calendly(ORGANIZACION);
    await asignarCalendlyDeMembresia(db, maru, { membresiaId: membresiaMaru, calendlyEmail: "maru@calendly.co" }, { fetch });
    await asignarCalendlyDeMembresia(db, maru, { membresiaId: membresiaMaru, calendlyEmail: "andrea@calendly.co" }, { fetch });

    const [m] = await db.select().from(miembrosPrograma).where(eq(miembrosPrograma.id, membresiaMaru));
    expect(m.calendlyEmail).toBe("andrea@calendly.co");
    const rastros = await db
      .select()
      .from(changeLog)
      .where(and(eq(changeLog.registroId, membresiaMaru), eq(changeLog.campo, "calendlyEmail")));
    expect(rastros).toHaveLength(2);
    expect(rastros.map((r) => r.userId)).toEqual([maru, maru]);
  });

  it("otra closer recibe 403 y no mueve la membresia ni la bitacora", async () => {
    const intento = asignarCalendlyDeMembresia(
      db,
      andrea,
      { membresiaId: membresiaMaru, calendlyEmail: "maru@calendly.co" },
      { fetch: calendly(ORGANIZACION) },
    );
    await expect(intento).rejects.toBeInstanceOf(AuthorizationError);
    await expect(intento).rejects.toMatchObject({ status: 403 });
    const [m] = await db.select().from(miembrosPrograma).where(eq(miembrosPrograma.id, membresiaMaru));
    expect(m.calendlyEmail).toBeNull();
    const rastros = await db.select().from(changeLog).where(eq(changeLog.registroId, membresiaMaru));
    expect(rastros).toHaveLength(0);
  });

  it("rechaza con 422 una membresía de customer success", async () => {
    await db.update(users).set({ rol: "customer_success" }).where(eq(users.id, maru));
    await expect(
      asignarCalendlyDeMembresia(
        db,
        admin,
        { membresiaId: membresiaMaru, calendlyEmail: "maru@calendly.co" },
        { fetch: calendly(ORGANIZACION) },
      ),
    ).rejects.toMatchObject({
      status: 422,
      message: "Solo quien trabaja leads puede tener cuenta de Calendly en un programa.",
    });
  });

  it("guarda una cuenta de la organizacion, con rastro de quien la vinculo", async () => {
    await asignarCalendlyDeMembresia(
      db,
      admin,
      { membresiaId: membresiaMaru, calendlyEmail: "MARU@calendly.co" },
      { fetch: calendly(ORGANIZACION) },
    );
    const [m] = await db.select().from(miembrosPrograma).where(eq(miembrosPrograma.id, membresiaMaru));
    expect(m.calendlyEmail).toBe("maru@calendly.co");
    const [rastro] = await db
      .select()
      .from(changeLog)
      .where(and(eq(changeLog.registroId, membresiaMaru), eq(changeLog.campo, "calendlyEmail")));
    expect(rastro).toMatchObject({ userId: admin, valorAnterior: null, valorNuevo: "maru@calendly.co" });
  });

  it("rechaza un correo que no esta en la organizacion (nadie lo teclea)", async () => {
    await expect(
      asignarCalendlyDeMembresia(
        db,
        admin,
        { membresiaId: membresiaMaru, calendlyEmail: "otra@calendly.co" },
        { fetch: calendly(ORGANIZACION) },
      ),
    ).rejects.toMatchObject({ status: 422 });
    const [m] = await db.select().from(miembrosPrograma).where(eq(miembrosPrograma.id, membresiaMaru));
    expect(m.calendlyEmail).toBeNull();
  });

  it("una cuenta tomada por otra closer del programa se rechaza con 409", async () => {
    const fetch = calendly(ORGANIZACION);
    await asignarCalendlyDeMembresia(db, maru, { membresiaId: membresiaMaru, calendlyEmail: "maru@calendly.co" }, { fetch });
    await expect(
      asignarCalendlyDeMembresia(db, andrea, { membresiaId: membresiaAndrea, calendlyEmail: "maru@calendly.co" }, { fetch }),
    ).rejects.toMatchObject({
      status: 409,
      message: "Esa cuenta de Calendly ya la tiene otra persona del programa.",
    });
    expect((await db.select().from(miembrosPrograma).where(eq(miembrosPrograma.id, membresiaAndrea)))[0].calendlyEmail).toBeNull();
  });

  it("desvincular no consulta Calendly", async () => {
    const fetch = calendly(ORGANIZACION);
    await asignarCalendlyDeMembresia(db, admin, { membresiaId: membresiaMaru, calendlyEmail: "maru@calendly.co" }, { fetch });
    fetch.mockClear();
    await asignarCalendlyDeMembresia(db, admin, { membresiaId: membresiaMaru, calendlyEmail: null }, { fetch });
    expect(fetch).not.toHaveBeenCalled();
    const [m] = await db.select().from(miembrosPrograma).where(eq(miembrosPrograma.id, membresiaMaru));
    expect(m.calendlyEmail).toBeNull();
  });

  it("un token rechazado sale como 502 y no escribe", async () => {
    await expect(
      asignarCalendlyDeMembresia(
        db,
        admin,
        { membresiaId: membresiaMaru, calendlyEmail: "maru@calendly.co" },
        { fetch: calendly([], 401) },
      ),
    ).rejects.toMatchObject({ status: 502 });
  });

  it("cuentasPorPrograma: el programa sin token dice por que, sin tumbar a los demas", async () => {
    const [sin] = await db
      .insert(programs)
      .values({ ...PROGRAMA_DE_PRUEBA, slug: "otro", nombre: "Otro", ticketUsd: "797", calendlyToken: null, activo: false })
      .returning();
    const r = await cuentasPorPrograma(db, [programId, sin.id], { fetch: calendly(ORGANIZACION) });
    expect(r[programId]).toMatchObject({ ok: true });
    expect(r[sin.id]).toEqual({ ok: false, error: "El programa no tiene token de Calendly." });
  });

  it("cuentasPorPrograma marca la membresía que ocupa la cuenta solo dentro de ese programa", async () => {
    await db.update(miembrosPrograma).set({ calendlyEmail: "maru@calendly.co", activo: false }).where(eq(miembrosPrograma.id, membresiaMaru));
    const [otro] = await db
      .insert(programs)
      .values({ ...PROGRAMA_DE_PRUEBA, slug: "otro-ocupado", nombre: "Otro", ticketUsd: "797", calendlyToken: "pat" })
      .returning();
    await db.insert(miembrosPrograma).values({ userId: maru, programId: otro.id });

    const r = await cuentasPorPrograma(db, [programId, otro.id], { fetch: calendly(ORGANIZACION) });
    expect(r[programId]).toMatchObject({
      ok: true,
      cuentas: expect.arrayContaining([{ correo: "maru@calendly.co", nombre: "Maru", membresiaId: membresiaMaru }]),
    });
    expect(r[otro.id]).toMatchObject({
      ok: true,
      cuentas: expect.arrayContaining([{ correo: "maru@calendly.co", nombre: "Maru", membresiaId: null }]),
    });
  });
});
