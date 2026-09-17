import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { cohorts, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";

/**
 * Ticket 014: las server actions de `/ajustes/programas`. Cada accion envuelve la
 * logica pura de `lib/catalogo/{programas,cohortes}` y devuelve un resultado
 * serializable (`{ ok }` | `{ ok:false, error }`), igual que las acciones de
 * catalogos (013) y usuarios (015): una excepcion no viaja al cliente con su tipo.
 *
 * `auth` se mockea para simular la sesion; la base es PGlite en memoria, inyectada
 * en las acciones via un mock de `@/lib/db`. Un closer NUNCA pasa (ADR 0003).
 */

const auth = vi.fn();
vi.mock("@/lib/auth", () => ({ auth }));

let db: Db;
vi.mock("@/lib/db", () => ({
  get db() {
    return db;
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

let cerrar: () => Promise<void>;
let gerenteId: string;
let programId: string;

const sesionGerente = {
  user: { id: "", email: "gerente@retiagrowth.com", rol: "gerente", closerId: null },
};
const sesionCloser = {
  user: { id: "u-2", email: "closer@retiagrowth.com", rol: "closer", closerId: "andrea" },
};

const UUID = "00000000-0000-0000-0000-000000000000";

beforeEach(async () => {
  auth.mockReset();
  ({ db, cerrar } = await crearBaseDePrueba());
  const [g] = await db
    .insert(users)
    .values({ email: "gerente@retiagrowth.com", rol: "gerente", nombre: "Gerencia" })
    .returning();
  gerenteId = g.id;
  sesionGerente.user.id = gerenteId;
  const [p] = await db
    .insert(programs)
    .values({ slug: "programa-a", nombre: "Programa A", ticketUsd: "1000" })
    .returning();
  programId = p.id;
});

afterEach(async () => {
  await cerrar();
});

async function acciones() {
  return import("@/app/(app)/ajustes/programas/acciones");
}

const programaValido = {
  nombre: "Programa Beta",
  slug: "programa-beta",
  ticketUsd: "797.00",
  webUrl: "",
  calendlyUrl: "",
};

const cohorteValida = {
  programId: "",
  codigo: "C1",
  metaCupos: 30,
  metaLeadsDia: 10,
  precioUsd: "797.00",
  fechaInicioClases: "2026-08-11",
  fechaCierreVentas: "2026-08-11",
  trmCohorte: "4000",
  estado: "activo" as const,
};

describe("acciones de programas — barrera de rol (ADR 0003)", () => {
  it("un closer es rechazado en todas las acciones de programa", async () => {
    auth.mockResolvedValue(sesionCloser);
    const {
      crearProgramaAccion,
      editarProgramaAccion,
      desactivarProgramaAccion,
      reactivarProgramaAccion,
    } = await acciones();

    for (const llamada of [
      () => crearProgramaAccion(programaValido),
      () => editarProgramaAccion(UUID, programaValido),
      () => desactivarProgramaAccion(UUID),
      () => reactivarProgramaAccion(UUID),
    ]) {
      const res = await llamada();
      expect(res.ok).toBe(false);
    }
  });

  it("un closer es rechazado en todas las acciones de cohorte", async () => {
    auth.mockResolvedValue(sesionCloser);
    const {
      crearCohorteAccion,
      editarCohorteAccion,
      activarCohorteAccion,
      desactivarCohorteAccion,
    } = await acciones();

    for (const llamada of [
      () => crearCohorteAccion("programa-a", { ...cohorteValida, programId }),
      () => editarCohorteAccion("programa-a", UUID, { ...cohorteValida, programId }),
      () => activarCohorteAccion("programa-a", UUID),
      () => desactivarCohorteAccion("programa-a", UUID),
    ]) {
      const res = await llamada();
      expect(res.ok).toBe(false);
    }
  });
});

describe("acciones de programas — el gerente administra", () => {
  beforeEach(() => auth.mockResolvedValue(sesionGerente));

  it("crea un programa que aparece en la base", async () => {
    const { crearProgramaAccion } = await acciones();
    const res = await crearProgramaAccion(programaValido);
    expect(res.ok).toBe(true);
    const [creado] = await db.select().from(programs).where(eq(programs.slug, "programa-beta"));
    expect(creado).toBeDefined();
  });

  it("un slug invalido devuelve ok:false con mensaje", async () => {
    const { crearProgramaAccion } = await acciones();
    const res = await crearProgramaAccion({ ...programaValido, slug: "Con Mayusculas" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.length).toBeGreaterThan(0);
  });

  it("activar una segunda cohorte en el mismo programa devuelve ok:false con mensaje claro", async () => {
    const { crearCohorteAccion, activarCohorteAccion } = await acciones();
    // Primera cohorte activa.
    const ok1 = await crearCohorteAccion("programa-a", { ...cohorteValida, codigo: "C1", programId });
    expect(ok1.ok).toBe(true);
    // Segunda futura, luego se intenta activar.
    const ok2 = await crearCohorteAccion("programa-a", {
      ...cohorteValida,
      codigo: "C2",
      estado: "futuro",
      programId,
    });
    expect(ok2.ok).toBe(true);
    const [c2] = await db.select().from(cohorts).where(eq(cohorts.codigo, "C2"));
    const res = await activarCohorteAccion("programa-a", c2.id);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.toLowerCase()).toContain("activa");
  });
});
