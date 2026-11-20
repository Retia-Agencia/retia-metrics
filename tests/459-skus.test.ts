import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { cohorts, programs, skus, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { codigoDeSku, crearSku, desactivarSku, type EntradaSku } from "@/lib/catalogo/skus";
import { ErrorDeApp } from "@/lib/errors";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

const auth = vi.fn();
vi.mock("@/lib/auth", () => ({ auth }));

let db: Db;
vi.mock("@/lib/db", () => ({
  get db() {
    return db;
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
  headers: async () => ({ get: () => null }),
}));
vi.mock("next/server", () => ({ after: vi.fn() }));

let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let actorId: string;
let programId: string;

const entrada = (cambios: Partial<EntradaSku> = {}): EntradaSku => ({
  programId,
  nombre: "Virtual",
  cohorteN: 4,
  precioListaUsd: "797.00",
  comisionPorcentaje: 10,
  cuentaComoCupo: true,
  ventana: {
    fechaInicioVentas: "2027-01-01",
    fechaCierreVentas: "2027-01-31",
    metaCupos: 30,
  },
  ...cambios,
});

beforeAll(async () => {
  ({ db, cerrar, vaciar } = await crearBaseReutilizable());
});

beforeEach(async () => {
  await vaciar();
  auth.mockReset();
  const [actor] = await db.insert(users).values({
    email: "gerente-459@example.test",
    rol: "gerente",
    nombre: "Gerencia 459",
  }).returning();
  actorId = actor.id;
  const [programa] = await db.insert(programs).values({
    ...PROGRAMA_DE_PRUEBA,
    nombre: "Tactical Investor",
    slug: "tactical-investor",
    ticketUsd: "797",
  }).returning();
  programId = programa.id;
});

afterAll(async () => cerrar());

describe("ticket 459 — catálogo de SKUs", () => {
  it("rechaza una creación forjada por un closer sin dejar SKU ni cohorte", async () => {
    auth.mockResolvedValue({
      user: { id: crypto.randomUUID(), email: "closer@example.test", rol: "closer", closerId: "Closer" },
    });
    const { crearSkuAccion } = await import("@/app/(app)/p/[programa]/programa/acciones-programa");

    const resultado = await crearSkuAccion("tactical-investor", entrada());

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error).toContain("solo para");
    expect(await db.select().from(skus)).toHaveLength(0);
    expect(await db.select().from(cohorts)).toHaveLength(0);
  });

  it("crea C4 y revierte cohorte y SKU si su ventana se solapa", async () => {
    const creado = await crearSku(db, actorId, entrada());
    const [cohorte] = await db.select().from(cohorts).where(eq(cohorts.id, creado.cohortId));
    expect(cohorte).toMatchObject({
      codigo: "C4",
      fechaInicioVentas: "2027-01-01",
      fechaCierreVentas: "2027-01-31",
      metaCupos: 30,
      precioUsd: "797.00",
    });

    const [otra] = await db.insert(programs).values({
      ...PROGRAMA_DE_PRUEBA,
      nombre: "Otro programa",
      slug: "otro-programa",
      ticketUsd: "500",
    }).returning();
    await db.insert(cohorts).values({
      programId: otra.id,
      codigo: "C1",
      metaCupos: 10,
      precioUsd: "500",
      fechaInicioVentas: "2027-03-01",
      fechaCierreVentas: "2027-03-31",
    });
    await db.insert(cohorts).values({
      programId,
      codigo: "C5",
      metaCupos: 10,
      precioUsd: "900",
      fechaInicioVentas: "2027-03-01",
      fechaCierreVentas: "2027-03-31",
    });

    const error = await crearSku(db, actorId, entrada({
      cohorteN: 6,
      ventana: {
        fechaInicioVentas: "2027-03-31",
        fechaCierreVentas: "2027-04-15",
        metaCupos: 12,
      },
    })).catch((causa) => causa);

    expect(error).toBeInstanceOf(ErrorDeApp);
    expect((error as ErrorDeApp).status).toBe(400);
    expect((error as ErrorDeApp).message).toContain("se solapan");
    expect(await db.select().from(cohorts).where(and(
      eq(cohorts.programId, programId), eq(cohorts.codigo, "C6"),
    ))).toHaveLength(0);
    expect(await db.select().from(skus).where(eq(skus.codigo, "tactical_investor_virtual_c6"))).toHaveLength(0);
  });

  it("normaliza el código anticipado", () => {
    expect(codigoDeSku("tactical-investor", "Uno a Uno", 3)).toBe("tactical_investor_uno_a_uno_c3");
    expect(codigoDeSku("tactical-investor", "uno a uno", 3)).toBe("tactical_investor_uno_a_uno_c3");
  });

  it("no desactiva el único SKU activo que sostiene el cupo", async () => {
    const creado = await crearSku(db, actorId, entrada());

    const error = await desactivarSku(db, actorId, creado.id).catch((causa) => causa);

    expect(error).toBeInstanceOf(ErrorDeApp);
    expect((error as ErrorDeApp).status).toBe(400);
    expect((error as ErrorDeApp).message).toBe("La cohorte C4 necesita al menos un SKU activo que cuente como cupo.");
    const [sku] = await db.select().from(skus).where(eq(skus.id, creado.id));
    expect(sku.activo).toBe(true);
  });

  it("un closer no edita la ventana y la cohorte no cambia", async () => {
    const creado = await crearSku(db, actorId, entrada());
    const [antes] = await db.select().from(cohorts).where(eq(cohorts.id, creado.cohortId));
    auth.mockResolvedValue({
      user: { id: crypto.randomUUID(), email: "closer@example.test", rol: "closer", closerId: "Closer" },
    });
    const { editarVentanaDeCohorteAccion } = await import("@/app/(app)/p/[programa]/programa/acciones-programa");

    const resultado = await editarVentanaDeCohorteAccion("tactical-investor", creado.cohortId, {
      fechaInicioVentas: "2027-02-01",
      fechaCierreVentas: "2027-02-28",
      metaCupos: 40,
      metaLeadsDia: 60,
      fechaInicioClases: "2027-03-01",
      notas: "No debe persistir",
    });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error).toContain("solo para");
    const [despues] = await db.select().from(cohorts).where(eq(cohorts.id, creado.cohortId));
    expect(despues).toEqual(antes);
  });

  it("editar la ventana que choca devuelve el error 400 y no cambia la cohorte", async () => {
    await crearSku(db, actorId, entrada());
    const segundo = await crearSku(db, actorId, entrada({
      cohorteN: 5,
      ventana: {
        fechaInicioVentas: "2027-03-01",
        fechaCierreVentas: "2027-03-31",
        metaCupos: 20,
      },
    }));
    const [antes] = await db.select().from(cohorts).where(eq(cohorts.id, segundo.cohortId));
    auth.mockResolvedValue({ user: { id: actorId, email: "gerente-459@example.test", rol: "gerente" } });
    const { editarVentanaDeCohorteAccion } = await import("@/app/(app)/p/[programa]/programa/acciones-programa");

    const resultado = await editarVentanaDeCohorteAccion("tactical-investor", segundo.cohortId, {
      fechaInicioVentas: "2027-01-31",
      fechaCierreVentas: "2027-02-15",
      metaCupos: 25,
      metaLeadsDia: 50,
      fechaInicioClases: null,
      notas: "Choque",
    });

    expect(resultado).toEqual({
      ok: false,
      error: "Las fechas de venta se solapan con otra cohorte de este programa. Ajusta el inicio o el cierre para que no compartan ningún día.",
    });
    const [despues] = await db.select().from(cohorts).where(eq(cohorts.id, segundo.cohortId));
    expect(despues).toEqual(antes);
  });
});
