import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { dealActividades, dealEtapaHistorial, deals, leads, miembrosPrograma, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { incluyendoAnulados } from "@/lib/queries/vigente";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * Ticket 074: las server actions de la ficha del deal, mordidas como las muerde un atacante
 * ("un contrato que nadie mordio es una creencia", AGENTS.md): se invoca la accion a mano,
 * saltandose la interfaz, con la sesion de quien NO deberia poder.
 *
 * Se espera el mensaje de rechazo y **la base sin moverse**. En el mismo viaje: un `userId`
 * o un `ownerUserId` ajeno en el cuerpo se ignora (el actor sale de la sesion), y un deal de
 * un programa que la sesion no ve responde como si no existiera.
 */

const auth = vi.fn();
vi.mock("@/lib/auth", () => ({ auth }));

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));

let db: Db;
vi.mock("@/lib/db", () => ({
  get db() {
    return db;
  },
}));

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath }));

let cerrar: () => Promise<void>;
let programaA: string;
let programaB: string;
let closerA: string;
let closerB: string;
let gerente: string;
let leadN = 0;

const sesion = (id: string, rol: string, closerId: string | null) => ({ user: { id, email: `${id}@x.co`, rol, closerId } });

beforeEach(async () => {
  auth.mockReset();
  revalidatePath.mockReset();
  ({ db, cerrar } = await crearBaseDePrueba());
  const [a] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "a", nombre: "A", ticketUsd: "1000" }).returning();
  programaA = a.id;
  const [b] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "b", nombre: "B", ticketUsd: "1500" }).returning();
  programaB = b.id;
  const [c1] = await db.insert(users).values({ email: "maru@retiagrowth.com", rol: "closer", closerId: "Maru" }).returning();
  closerA = c1.id;
  const [c2] = await db.insert(users).values({ email: "jero@retiagrowth.com", rol: "closer", closerId: "Jero" }).returning();
  closerB = c2.id;
  const [g] = await db.insert(users).values({ email: "gerente@retiagrowth.com", rol: "gerente" }).returning();
  gerente = g.id;
  // Maru vende solo en A; Jero, en A y en B.
  await db.insert(miembrosPrograma).values([
    { userId: closerA, programId: programaA, activo: true },
    { userId: closerB, programId: programaA, activo: true },
    { userId: closerB, programId: programaB, activo: true },
  ]);
}, 60_000);

afterEach(async () => {
  await cerrar();
});

async function nuevoDeal(programId: string, ownerUserId: string | null) {
  const [l] = await db.insert(leads).values({ programId, emailNormalizado: `lead${++leadN}@correo.co` }).returning();
  const [d] = await db
    .insert(deals)
    .values({ leadId: l.id, programId, etapa: "atendido", ownerUserId,})
    .returning();
  return d.id;
}

async function deal(dealId: string) {
  const [d] = await db.select().from(deals).where(and(eq(deals.id, dealId), incluyendoAnulados(deals)));
  return d;
}

const acciones = () => import("@/app/(app)/p/[programa]/deals/[id]/acciones");
const accionesMover = () => import("@/app/(app)/p/[programa]/deals/acciones");

describe("anular el deal, forjando la peticion", () => {
  it("un closer NO anula el deal de otro: el mensaje lo dice y la base no se mueve", async () => {
    const dealId = await nuevoDeal(programaA, closerB);
    auth.mockResolvedValue(sesion(closerA, "closer", "Maru"));

    const r = await (await acciones()).anularDealAccion({ dealId, motivo: "quiero anularlo" });

    expect(r).toMatchObject({ ok: false });
    expect((r as { error: string }).error).toMatch(/dueño del deal o un administrador/);
    expect((await deal(dealId)).anuladoEn).toBeNull();
  });

  it("el dueño anula, y el actor es el de la sesion aunque el cuerpo traiga otro `anuladoPor`", async () => {
    const dealId = await nuevoDeal(programaA, closerA);
    auth.mockResolvedValue(sesion(closerA, "closer", "Maru"));

    const r = await (await acciones()).anularDealAccion({ dealId, motivo: "lo registré mal", anuladoPor: closerB, userId: closerB } as never);

    expect(r).toEqual({ ok: true });
    const d = await deal(dealId);
    expect(d.anuladoPor).toBe(closerA);
    // El Kanban es otra ruta: se invalida por su patron.
    expect(revalidatePath).toHaveBeenCalledWith("/p/[programa]/deals", "page");
  });

  it("el gerente anula el deal de un closer", async () => {
    const dealId = await nuevoDeal(programaA, closerA);
    auth.mockResolvedValue(sesion(gerente, "gerente", null));
    const r = await (await acciones()).anularDealAccion({ dealId, motivo: "duplicado con otro deal" });
    expect(r).toEqual({ ok: true });
    expect((await deal(dealId)).anuladoPor).toBe(gerente);
  });

  it("un deal de un programa que la sesion NO ve responde como si no existiera", async () => {
    // Maru es dueña de un deal de B, pero solo tiene membresia en A: fuera de su alcance.
    const dealId = await nuevoDeal(programaB, closerA);
    auth.mockResolvedValue(sesion(closerA, "closer", "Maru"));

    const r = await (await acciones()).anularDealAccion({ dealId, motivo: "quiero anularlo" });

    expect(r).toEqual({ ok: false, error: "No existe el deal." });
    expect((await deal(dealId)).anuladoEn).toBeNull();
  });

  it("un id que no es un deal responde con error, no revienta", async () => {
    auth.mockResolvedValue(sesion(gerente, "gerente", null));
    const r = await (await acciones()).anularDealAccion({ dealId: "no-es-un-uuid", motivo: "quiero anularlo" });
    expect(r.ok).toBe(false);
  });
});

describe("marcar cortesía, forjando la petición", () => {
  it("el closer dueño recibe el 403 del dominio y la base queda quieta", async () => {
    const dealId = await nuevoDeal(programaA, closerA);
    auth.mockResolvedValue(sesion(closerA, "closer", "Maru"));

    const r = await (await acciones()).marcarCortesiaAccion({ dealId });

    expect(r).toEqual({ ok: false, error: "Marcar una cortesía es de quien administra." });
    expect(await deal(dealId)).toMatchObject({ etapa: "atendido", cortesia: false, valorVendidoUsd: null });
  });
});

describe("editar el deal, forjando la peticion", () => {
  it("mover rechaza un próximo contacto pasado antes de llamar al motor", async () => {
    const dealId = await nuevoDeal(programaA, closerA);
    auth.mockResolvedValue(sesion(closerA, "closer", "Maru"));
    const r = await (await accionesMover()).moverDeal({
      dealId,
      a: "atendido",
      pendiente: "seguimiento",
      datos: { fechaSeguimiento: "2000-01-01" },
    });
    expect(r).toMatchObject({ ok: false, status: 400, error: "El próximo contacto tiene que ser una fecha futura." });
  });

  it("mover un deal de otro programa devuelve 403 y no lo cambia", async () => {
    const dealId = await nuevoDeal(programaB, closerA);
    auth.mockResolvedValue(sesion(closerA, "closer", "Maru"));
    const r = await (await accionesMover()).moverDeal({ dealId, a: "agendado", pendiente: "reagenda" });
    expect(r).toMatchObject({ ok: false, status: 403 });
    expect((await deal(dealId)).etapa).toBe("atendido");
  });

  it("un closer no se reasigna el deal de otro ni el suyo: el `ownerUserId` del cuerpo no manda", async () => {
    const dealId = await nuevoDeal(programaA, closerA);
    auth.mockResolvedValue(sesion(closerA, "closer", "Maru"));

    const r = await (await acciones()).editarDealAccion({ dealId, ownerUserId: closerB });

    expect(r.ok).toBe(false);
    expect((await deal(dealId)).ownerUserId).toBe(closerA);
  });

  it("el gerente si reasigna", async () => {
    const dealId = await nuevoDeal(programaA, closerA);
    auth.mockResolvedValue(sesion(gerente, "gerente", null));
    const r = await (await acciones()).editarDealAccion({ dealId, ownerUserId: closerB });
    expect(r).toEqual({ ok: true });
    expect((await deal(dealId)).ownerUserId).toBe(closerB);
  });

  it("un closer ajeno no edita el deal de otro", async () => {
    const dealId = await nuevoDeal(programaA, closerB);
    auth.mockResolvedValue(sesion(closerA, "closer", "Maru"));
    const r = await (await acciones()).editarDealAccion({ dealId, descuentoUsd: 10 });
    expect(r.ok).toBe(false);
    expect((await deal(dealId)).fechaSeguimiento).toBeNull();
  });
});

describe("registrar una actividad, forjando la peticion", () => {
  it("un closer ajeno no escribe en un deal de otro", async () => {
    const dealId = await nuevoDeal(programaA, closerB);
    auth.mockResolvedValue(sesion(closerA, "closer", "Maru"));
    const r = await (await acciones()).registrarActividadAccion({ dealId, tipo: "nota", nota: "hola" });
    expect(r.ok).toBe(false);
  });

  it("el dueño registra un contacto", async () => {
    const dealId = await nuevoDeal(programaA, closerA);
    auth.mockResolvedValue(sesion(closerA, "closer", "Maru"));
    const r = await (await acciones()).registrarActividadAccion({ dealId, tipo: "contacto", canal: "WhatsApp", nota: "Le escribí" });
    expect(r).toEqual({ ok: true });
  });
});

describe("el paid trafficker no toca deals, forjando la petición (102)", () => {
  // Desde el 102 ve todos los programas (`programaEnAlcance` le dice que sí), así que la única reja
  // de estas acciones es el rol: si alguien la afloja, esto lo dice.
  async function pauta() {
    const [p] = await db.insert(users).values({ email: "pauta@retiagrowth.com", rol: "paid_trafficker" }).returning();
    return p.id;
  }
  async function historial(dealId: string) {
    return db.select().from(dealEtapaHistorial).where(eq(dealEtapaHistorial.dealId, dealId));
  }

  it("mover: 403 y ni la etapa ni el historial se mueven", async () => {
    const dealId = await nuevoDeal(programaA, closerA);
    const antes = (await historial(dealId)).length;
    auth.mockResolvedValue(sesion(await pauta(), "paid_trafficker", null));
    const r = await (await accionesMover()).moverDeal({ dealId, a: "agendado", pendiente: "reagenda" });
    expect(r).toMatchObject({ ok: false, status: 403 });
    expect((await deal(dealId)).etapa).toBe("atendido");
    expect(await historial(dealId)).toHaveLength(antes);
  });

  it("anular y registrar una actividad: rechazado y la base quieta", async () => {
    const dealId = await nuevoDeal(programaA, closerA);
    auth.mockResolvedValue(sesion(await pauta(), "paid_trafficker", null));
    const a = await acciones();
    expect(await a.anularDealAccion({ dealId, motivo: "forjado" })).toMatchObject({ ok: false });
    expect((await deal(dealId)).anuladoEn).toBeNull();
    const actividades = await db.select().from(dealActividades).where(eq(dealActividades.dealId, dealId));
    expect(await a.registrarActividadAccion({ dealId, tipo: "nota", nota: "forjada" })).toMatchObject({ ok: false });
    expect(await db.select().from(dealActividades).where(eq(dealActividades.dealId, dealId))).toHaveLength(actividades.length);
  });
});
