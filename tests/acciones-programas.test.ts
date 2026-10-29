import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { changeLog, cohorts, miembrosPrograma, programs, users, usuariosProgramasAlcance } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * Ticket 014: las server actions de programas (en la tab Programa). Cada accion envuelve la
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
// El developer pasa por `rolDeVista`, que lee la cookie de vista.
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));

let cerrar: () => Promise<void>;

let vaciar: () => Promise<void>;
let gerenteId: string;
let programId: string;
let programaAjenoId: string;
let developerId: string;

const sesionGerente = {
  user: { id: "", email: "gerente@retiagrowth.com", rol: "gerente", closerId: null, alcanceLimitado: false },
};
const sesionGerenteLimitado = {
  user: { ...sesionGerente.user, alcanceLimitado: true },
};
const sesionDeveloper = {
  user: { id: "", email: "developer@retiagrowth.com", rol: "developer", closerId: null, alcanceLimitado: false },
};
const sesionCloser = {
  user: { id: "u-2", email: "closer@retiagrowth.com", rol: "closer", closerId: "andrea" },
};

const UUID = "00000000-0000-0000-0000-000000000000";

beforeAll(async () => {
  ({ db, cerrar, vaciar } = await crearBaseReutilizable());
});

beforeEach(async () => {
  await vaciar();
  auth.mockReset();
  const [g] = await db
    .insert(users)
    .values({ email: "gerente@retiagrowth.com", rol: "gerente", nombre: "Gerencia" })
    .returning();
  gerenteId = g.id;
  sesionGerente.user.id = gerenteId;
  sesionGerenteLimitado.user.id = gerenteId;
  const [p] = await db
    .insert(programs)
    .values({ ...PROGRAMA_DE_PRUEBA, slug: "programa-a", nombre: "Programa A", ticketUsd: "1000" })
    .returning();
  programId = p.id;
  const [ajeno] = await db
    .insert(programs)
    .values({ ...PROGRAMA_DE_PRUEBA, slug: "programa-ajeno", nombre: "Programa Ajeno", ticketUsd: "1500" })
    .returning();
  programaAjenoId = ajeno.id;
  const [developer] = await db
    .insert(users)
    .values({ email: sesionDeveloper.user.email, rol: "developer", nombre: "Developer" })
    .returning();
  developerId = developer.id;
  sesionDeveloper.user.id = developerId;
});

afterAll(async () => {
  await cerrar();
});

async function acciones() {
  return import("@/app/(app)/p/[programa]/programa/acciones-programa");
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
  fechaInicioVentas: "2026-08-11",
  fechaCierreVentas: "2026-08-11",
  estado: "activo" as const,
};

describe("acciones de programas — barrera de rol (ADR 0003)", () => {
  it("un closer es rechazado en todas las acciones de programa", async () => {
    auth.mockResolvedValue(sesionCloser);
    const {
      editarProgramaAccion,
      desactivarProgramaAccion,
      reactivarProgramaAccion,
      activarProgramaDesdeFichaAccion,
      crearProgramaInactivoAccion,
      agregarAlProgramaAccion,
      quitarDelProgramaAccion,
    } = await acciones();

    for (const llamada of [
      () => editarProgramaAccion(UUID, programaValido),
      () => desactivarProgramaAccion(UUID),
      () => reactivarProgramaAccion(UUID),
      () => activarProgramaDesdeFichaAccion(programId),
      () => crearProgramaInactivoAccion({ nombre: "Forjado", slug: "forjado", ticketUsd: "100" }),
      () => agregarAlProgramaAccion({ userId: UUID, programId }),
      () => quitarDelProgramaAccion({ userId: UUID, programId }),
    ]) {
      const res = await llamada();
      expect(res.ok).toBe(false);
    }
    // Los dos programas del beforeEach, ninguno más.
    expect(await db.select().from(programs)).toHaveLength(2);
    expect(await db.select().from(miembrosPrograma)).toHaveLength(0);
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

  it("un slug invalido devuelve ok:false con mensaje", async () => {
    const { crearProgramaInactivoAccion } = await acciones();
    const res = await crearProgramaInactivoAccion({ nombre: "Inválido", slug: "Con Mayusculas", ticketUsd: "100" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.length).toBeGreaterThan(0);
  });

  it("crea un programa inactivo sin token ni activacion", async () => {
    const { crearProgramaInactivoAccion } = await acciones();
    const resultado = await crearProgramaInactivoAccion({
      nombre: "Programa incompleto",
      slug: "programa-incompleto",
      ticketUsd: "900",
    });
    expect(resultado).toEqual({ ok: true, slug: "programa-incompleto" });
    const [creado] = await db.select().from(programs).where(eq(programs.slug, "programa-incompleto"));
    expect(creado.activo).toBe(false);
  });

  it("activar desde la ficha rechaza faltantes y deja el programa inactivo", async () => {
    const { activarProgramaDesdeFichaAccion } = await acciones();
    await db
      .update(programs)
      .set({ activo: false })
      .where(eq(programs.id, programId));
    const resultado = await activarProgramaDesdeFichaAccion(programId);
    expect(resultado.ok).toBe(false);
    const [programa] = await db.select().from(programs).where(eq(programs.id, programId));
    expect(programa.activo).toBe(false);
  });

  it("un programa INACTIVO se sigue configurando: la reja de alcance no mira si esta activo (ADR 0094)", async () => {
    const { crearCohorteAccion } = await acciones();
    await db.update(programs).set({ activo: false }).where(eq(programs.id, programId));
    const resultado = await crearCohorteAccion("programa-a", { ...cohorteValida, codigo: "INACT", programId });
    expect(resultado).toEqual({ ok: true });
  });

  it("esquemaPrograma acepta diasSinActividad y rechaza cero", async () => {
    const { esquemaPrograma } = await import("@/lib/catalogo/programas");
    expect(esquemaPrograma.parse({ ...programaValido, diasSinActividad: "9" }).diasSinActividad).toBe(9);
    expect(() => esquemaPrograma.parse({ ...programaValido, diasSinActividad: 0 })).toThrow();
  });

  it("el corte de la escalera (319) se edita por quien administra, con rastro; vacio lo borra y cero se rechaza", async () => {
    const { editarProgramaAccion } = await acciones();
    auth.mockResolvedValue({ user: { ...sesionGerente.user, id: gerenteId } });
    const [actual] = await db.select().from(programs).where(eq(programs.id, programId));
    const entrada = { nombre: actual.nombre, slug: actual.slug, ticketUsd: String(actual.ticketUsd), webUrl: "", calendlyUrl: "" };
    const filasDelCorte = () => db.select().from(changeLog).where(eq(changeLog.campo, "cortePagoRapidoDias"));

    expect(await editarProgramaAccion(programId, { ...entrada, cortePagoRapidoDias: "3" })).toEqual({ ok: true });
    expect((await db.select().from(programs).where(eq(programs.id, programId)))[0].cortePagoRapidoDias).toBe(3);
    expect(await filasDelCorte()).toMatchObject([{ valorAnterior: null, valorNuevo: "3", userId: gerenteId, tabla: "programs" }]);

    // Reenviar el mismo valor no escribe rastro; omitir el campo no lo toca.
    await editarProgramaAccion(programId, { ...entrada, cortePagoRapidoDias: "3" });
    await editarProgramaAccion(programId, entrada);
    expect(await filasDelCorte()).toHaveLength(1);
    expect((await db.select().from(programs).where(eq(programs.id, programId)))[0].cortePagoRapidoDias).toBe(3);

    expect(await editarProgramaAccion(programId, { ...entrada, cortePagoRapidoDias: "" })).toEqual({ ok: true });
    expect((await db.select().from(programs).where(eq(programs.id, programId)))[0].cortePagoRapidoDias).toBeNull();
    expect(await filasDelCorte()).toHaveLength(2);

    expect((await editarProgramaAccion(programId, { ...entrada, cortePagoRapidoDias: "0" })).ok).toBe(false);
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

describe("acciones de Programa respetan el alcance de la fila objetivo (ADR 0094)", () => {
  beforeEach(async () => {
    await db.insert(usuariosProgramasAlcance).values({ userId: gerenteId, programId });
    auth.mockResolvedValue(sesionGerenteLimitado);
  });

  it("un gerente limitado no crea programas", async () => {
    const { crearProgramaInactivoAccion } = await acciones();
    expect((await crearProgramaInactivoAccion({ nombre: "Forjado", slug: "forjado", ticketUsd: "100" })).ok).toBe(false);
    expect(await db.select().from(programs).where(eq(programs.slug, "forjado"))).toHaveLength(0);
  });

  it("rechaza programa, cohorte, membresía y plantilla ajenos sin cambiar la base", async () => {
    const [miembro] = await db
      .insert(users)
      .values({ email: "miembro@retiagrowth.com", rol: "closer", nombre: "Miembro" })
      .returning();
    const [membresia] = await db
      .insert(miembrosPrograma)
      .values({ userId: miembro.id, programId: programaAjenoId })
      .returning();
    const [cohorte] = await db
      .insert(cohorts)
      .values({ ...cohorteValida, programId: programaAjenoId, codigo: "AJENA", estado: "futuro" })
      .returning();
    const { editarProgramaAccion, editarCohorteAccion, quitarDelProgramaAccion } = await acciones();
    const { editarPlantillaLeadAccion } = await import("@/app/(app)/p/[programa]/programa/acciones-fuentes");

    expect((await editarProgramaAccion(programaAjenoId, { ...programaValido, slug: "programa-ajeno" })).ok).toBe(false);
    expect((await editarCohorteAccion("slug-forjado", cohorte.id, { ...cohorteValida, programId: programaAjenoId, codigo: "CAMBIO", estado: "futuro" })).ok).toBe(false);
    expect((await quitarDelProgramaAccion({ userId: miembro.id, programId: programaAjenoId })).ok).toBe(false);
    expect((await editarPlantillaLeadAccion(programaAjenoId, { correo: "Email forjado" })).ok).toBe(false);

    const [programa] = await db.select().from(programs).where(eq(programs.id, programaAjenoId));
    const [cohorteDespues] = await db.select().from(cohorts).where(eq(cohorts.id, cohorte.id));
    const [membresiaDespues] = await db.select().from(miembrosPrograma).where(eq(miembrosPrograma.id, membresia.id));
    expect(programa.nombre).toBe("Programa Ajeno");
    expect(programa.plantillaLead).toEqual(PROGRAMA_DE_PRUEBA.plantillaLead);
    expect(cohorteDespues.codigo).toBe("AJENA");
    expect(membresiaDespues.activo).toBe(true);
  });

  it("el developer conserva la creación global", async () => {
    auth.mockResolvedValue(sesionDeveloper);
    const { crearProgramaInactivoAccion } = await acciones();
    expect((await crearProgramaInactivoAccion({ nombre: "Dev", slug: "dev", ticketUsd: "100" })).ok).toBe(true);
  });
});
