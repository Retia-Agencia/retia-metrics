import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import {
  categoriasRecurso,
  enlacesPago,
  plataformasPrograma,
  miembrosPrograma,
  plataformasPago,
  programs,
  recursos,
  users,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";

/**
 * Ticket 023 + enmienda del 19-sep: crear/reemplazar/desactivar recursos y enlaces de
 * pago lo pueden hacer gerente Y closer, con el molde del ADR 0016 (el de productos):
 * quien ADMINISTRA (gerente/developer) entra a cualquier programa; un closer solo a
 * los programas donde tiene membresia ACTIVA, y NUNCA a un recurso global.
 *
 * La barrera es de servidor (ADR 0003): un closer sin acceso recibe `ok:false`, no
 * solo un boton escondido. Mismo patron que `tests/acciones-productos.test.ts`: `auth`
 * mockeado, base PGlite inyectada, y la cookie de vista mockeada para el developer.
 */

const auth = vi.fn();
vi.mock("@/lib/auth", () => ({ auth }));

// La cookie de vista (ticket 028) la lee `rolDeVista` via `next/headers`. Solo importa
// para el developer; un gerente/closer no la lee.
let cookieDeVista: string | undefined;
function ponerVista(v: string | undefined) {
  cookieDeVista = v;
}
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (nombre: string) =>
      nombre === "vista" && cookieDeVista !== undefined
        ? { name: nombre, value: cookieDeVista }
        : undefined,
  }),
}));

let db: Db;
vi.mock("@/lib/db", () => ({
  get db() {
    return db;
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

let cerrar: () => Promise<void>;
let gerenteId: string;
let closerId: string;
let developerId: string;
let programaA: string;
let programaB: string;
let categoria: string;
let plataforma: string;

const sesionGerente = {
  user: { id: "", email: "gerente@retiagrowth.com", rol: "gerente", closerId: null },
};
const sesionCloser = {
  user: { id: "", email: "closer@retiagrowth.com", rol: "closer", closerId: "Ana" },
};
const sesionDeveloper = {
  user: { id: "", email: "dev@retiagrowth.com", rol: "developer", closerId: "Dev" },
};

beforeEach(async () => {
  auth.mockReset();
  cookieDeVista = undefined;
  ({ db, cerrar } = await crearBaseDePrueba());

  const [g] = await db
    .insert(users)
    .values({ email: "gerente@retiagrowth.com", rol: "gerente", nombre: "Gerencia" })
    .returning();
  gerenteId = g.id;
  sesionGerente.user.id = gerenteId;

  const [c] = await db
    .insert(users)
    .values({ email: "closer@retiagrowth.com", rol: "closer", nombre: "Ana", closerId: "Ana" })
    .returning();
  closerId = c.id;
  sesionCloser.user.id = closerId;

  const [dev] = await db
    .insert(users)
    .values({ email: "dev@retiagrowth.com", rol: "developer", nombre: "Dev", closerId: "Dev" })
    .returning();
  developerId = dev.id;
  sesionDeveloper.user.id = developerId;

  const [a] = await db
    .insert(programs)
    .values({ slug: "comunicarte", nombre: "Comunicarte", ticketUsd: "797.00" })
    .returning();
  programaA = a.id;
  const [b] = await db
    .insert(programs)
    .values({ slug: "tactical", nombre: "Tactical Investor", ticketUsd: "1500.00" })
    .returning();
  programaB = b.id;

  const [cat] = await db.insert(categoriasRecurso).values({ nombre: "Brochure" }).returning();
  categoria = cat.id;

  // PayPal ya viene sembrada por la migracion 0003; se reusa en vez de insertarla.
  const [pl] = await db
    .select()
    .from(plataformasPago)
    .where(eq(plataformasPago.nombre, "PayPal"));
  plataforma = pl.id;

  // El closer solo es miembro ACTIVO del programa A. El developer, tambien de A (para
  // acotarlo en vista `closer`), pero como administrador entra a todo.
  await db.insert(miembrosPrograma).values({ userId: closerId, programId: programaA, activo: true });
  await db
    .insert(miembrosPrograma)
    .values({ userId: developerId, programId: programaA, activo: true });
});

afterEach(async () => {
  await cerrar();
});

async function acciones() {
  return import("@/app/(app)/recursos/acciones");
}

const recursoEn = (programId: string | null) => ({
  programId,
  categoriaId: categoria,
  titulo: "Brochure",
  url: "https://drive.google.com/brochure",
});

const enlaceEn = (programId: string) => ({
  programId,
  plataformaId: plataforma,
  monto: "797.00",
  moneda: "USD" as const,
  url: "https://paypal.com/pago",
});

// ─────────────────────────────────────────── closer en su programa (A)

describe("acciones de recursos — closer en su programa (A)", () => {
  beforeEach(() => auth.mockResolvedValue(sesionCloser));

  it("un closer crea un recurso en SU programa y aparece en la base", async () => {
    const { crearRecursoAccion } = await acciones();
    const res = await crearRecursoAccion(recursoEn(programaA));
    expect(res.ok).toBe(true);
    const [creado] = await db.select().from(recursos).where(eq(recursos.programId, programaA));
    expect(creado).toBeDefined();
  });

  it("un closer crea un enlace de pago en SU programa", async () => {
    const { crearEnlacePagoAccion } = await acciones();
    const res = await crearEnlacePagoAccion(enlaceEn(programaA));
    expect(res.ok).toBe(true);
  });

  it("un closer NO puede crear un recurso en un programa donde no vende (B)", async () => {
    const { crearRecursoAccion } = await acciones();
    const res = await crearRecursoAccion(recursoEn(programaB));
    expect(res.ok).toBe(false);
    expect(await db.select().from(recursos)).toHaveLength(0);
  });

  it("un closer NO puede crear un enlace de pago en un programa donde no vende (B)", async () => {
    const { crearEnlacePagoAccion } = await acciones();
    const res = await crearEnlacePagoAccion(enlaceEn(programaB));
    expect(res.ok).toBe(false);
    expect(await db.select().from(enlacesPago)).toHaveLength(0);
  });

  it("un closer NO puede crear un recurso GLOBAL (programId nulo)", async () => {
    const { crearRecursoAccion } = await acciones();
    const res = await crearRecursoAccion(recursoEn(null));
    expect(res.ok).toBe(false);
    expect(await db.select().from(recursos)).toHaveLength(0);
  });

  it("un closer NO puede editar ni desactivar un recurso GLOBAL existente", async () => {
    // El gerente crea el global; el closer intenta tocarlo.
    auth.mockResolvedValue(sesionGerente);
    const { crearRecursoAccion } = await acciones();
    await crearRecursoAccion(recursoEn(null));
    const [global] = await db.select().from(recursos);

    auth.mockResolvedValue(sesionCloser);
    const { desactivarRecursoAccion, reemplazarRecursoAccion } = await acciones();
    expect((await desactivarRecursoAccion(global.id)).ok).toBe(false);
    expect((await reemplazarRecursoAccion(global.id, "https://drive.google.com/v2")).ok).toBe(false);
    // Sigue activo y vigente: nada se movio.
    const [sigue] = await db.select().from(recursos).where(eq(recursos.id, global.id));
    expect(sigue.activo).toBe(true);
    expect(sigue.vigente).toBe(true);
  });

  it("un closer NO puede desactivar un recurso de un programa donde no vende (B)", async () => {
    auth.mockResolvedValue(sesionGerente);
    const { crearRecursoAccion } = await acciones();
    await crearRecursoAccion(recursoEn(programaB));
    const [enB] = await db.select().from(recursos).where(eq(recursos.programId, programaB));

    auth.mockResolvedValue(sesionCloser);
    const { desactivarRecursoAccion } = await acciones();
    expect((await desactivarRecursoAccion(enB.id)).ok).toBe(false);
  });
});

// ─────────────────────────────────────────── administrador: todos los programas

describe("acciones de recursos — un administrador entra a todo", () => {
  beforeEach(() => auth.mockResolvedValue(sesionGerente));

  it("un gerente crea un recurso en un programa donde no es miembro (B)", async () => {
    const { crearRecursoAccion } = await acciones();
    expect((await crearRecursoAccion(recursoEn(programaB))).ok).toBe(true);
  });

  it("un gerente crea un recurso GLOBAL", async () => {
    const { crearRecursoAccion } = await acciones();
    expect((await crearRecursoAccion(recursoEn(null))).ok).toBe(true);
  });

  it("una url http:// (no https) devuelve ok:false con mensaje", async () => {
    const { crearRecursoAccion } = await acciones();
    const res = await crearRecursoAccion({ ...recursoEn(programaA), url: "http://inseguro.com" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.length).toBeGreaterThan(0);
  });

  it("reemplaza un recurso conservando el historial", async () => {
    const { crearRecursoAccion, reemplazarRecursoAccion } = await acciones();
    await crearRecursoAccion(recursoEn(programaA));
    const [creado] = await db.select().from(recursos).where(eq(recursos.programId, programaA));
    expect((await reemplazarRecursoAccion(creado.id, "https://drive.google.com/v2")).ok).toBe(true);
    const filas = await db.select().from(recursos).where(eq(recursos.programId, programaA));
    expect(filas).toHaveLength(2);
  });
});

// ─────────────────────────────────────────── developer: el dueno, todo (ADR 0025)

describe("acciones de recursos — el developer es el dueno (ADR 0025)", () => {
  beforeEach(() => auth.mockResolvedValue(sesionDeveloper));

  it("en vista 'todo' (por defecto) crea un recurso GLOBAL y en cualquier programa", async () => {
    const { crearRecursoAccion } = await acciones();
    expect((await crearRecursoAccion(recursoEn(null))).ok).toBe(true);
    expect((await crearRecursoAccion(recursoEn(programaB))).ok).toBe(true);
  });

  it("en vista 'closer' se acota como un closer: NO crea en B ni global, SI en A", async () => {
    ponerVista("closer");
    const { crearRecursoAccion } = await acciones();
    expect((await crearRecursoAccion(recursoEn(programaB))).ok).toBe(false);
    expect((await crearRecursoAccion(recursoEn(null))).ok).toBe(false);
    expect((await crearRecursoAccion(recursoEn(programaA))).ok).toBe(true);
  });
});

/**
 * Ticket 030 (ADR 0026 punto 5) para recursos: un recurso creado por error, que nadie
 * reemplazo todavia, se borra de verdad. Uno con historial NO se borra —el historial
 * es justo el punto del ticket 023— y el acceso por programa sigue siendo del servidor:
 * un closer no borra en un programa donde no vende, ni un recurso GLOBAL.
 */
describe("acciones de recursos — borrar solo lo que nunca se uso (ticket 030)", () => {
  it("un gerente borra un recurso sin historial y desaparece de la base", async () => {
    auth.mockResolvedValue(sesionGerente);
    const { crearRecursoAccion, borrarRecursoAccion } = await acciones();
    await crearRecursoAccion(recursoEn(programaA));
    const [creado] = await db.select().from(recursos);

    const res = await borrarRecursoAccion(creado.id);
    expect(res).toEqual({ ok: true, borrado: true });
    expect(await db.select().from(recursos)).toHaveLength(0);
  });

  it("un recurso YA reemplazado no se borra: devuelve el conteo y la fila sigue", async () => {
    auth.mockResolvedValue(sesionGerente);
    const { crearRecursoAccion, reemplazarRecursoAccion, borrarRecursoAccion } = await acciones();
    await crearRecursoAccion(recursoEn(programaA));
    const [original] = await db.select().from(recursos);
    await reemplazarRecursoAccion(original.id, "https://drive.google.com/brochure-v2");

    const res = await borrarRecursoAccion(original.id);
    expect(res).toEqual({ ok: true, borrado: false, referencias: 1 });

    // El historial se conserva entero: ni la version vieja ni la nueva se tocaron.
    const enBase = await db.select().from(recursos).where(eq(recursos.id, original.id));
    expect(enBase).toHaveLength(1);
  });

  it("un closer NO puede borrar un recurso de un programa donde no vende (B)", async () => {
    auth.mockResolvedValue(sesionGerente);
    const { crearRecursoAccion } = await acciones();
    await crearRecursoAccion(recursoEn(programaB));
    const [ajeno] = await db.select().from(recursos);

    auth.mockResolvedValue(sesionCloser);
    const { borrarRecursoAccion } = await acciones();
    const res = await borrarRecursoAccion(ajeno.id);
    expect(res.ok).toBe(false);
    expect(await db.select().from(recursos).where(eq(recursos.id, ajeno.id))).toHaveLength(1);
  });

  it("un closer NO puede borrar un recurso GLOBAL", async () => {
    auth.mockResolvedValue(sesionGerente);
    const { crearRecursoAccion } = await acciones();
    await crearRecursoAccion(recursoEn(null));
    const [global] = await db.select().from(recursos);

    auth.mockResolvedValue(sesionCloser);
    const { borrarRecursoAccion } = await acciones();
    const res = await borrarRecursoAccion(global.id);
    expect(res.ok).toBe(false);
    expect(await db.select().from(recursos).where(eq(recursos.id, global.id))).toHaveLength(1);
  });
});

/**
 * ADR 0034: el vinculo plataforma-programa es dato propio, no derivado de
 * `enlaces_pago`. Por eso crear un enlace tiene que ESCRIBIRLO: sin esto, el closer
 * carga el link de cobro y despues no encuentra esa plataforma en el selector del
 * abono del mismo programa, sin que nada falle.
 */
describe("crear un enlace de pago vincula la plataforma con el programa (ADR 0034)", () => {
  it("el vinculo no existia y queda creado", async () => {
    auth.mockResolvedValue(sesionCloser);
    expect(await db.select().from(plataformasPrograma)).toHaveLength(0);

    const { crearEnlacePagoAccion } = await acciones();
    expect((await crearEnlacePagoAccion(enlaceEn(programaA))).ok).toBe(true);

    const vinculos = await db.select().from(plataformasPrograma);
    expect(vinculos).toHaveLength(1);
    expect(vinculos[0].plataformaId).toBe(plataforma);
    expect(vinculos[0].programId).toBe(programaA);
  });

  it("dos enlaces de la misma plataforma y programa no duplican el vinculo", async () => {
    auth.mockResolvedValue(sesionCloser);
    const { crearEnlacePagoAccion } = await acciones();
    await crearEnlacePagoAccion(enlaceEn(programaA));
    await crearEnlacePagoAccion({ ...enlaceEn(programaA), url: "https://paypal.com/otro" });

    expect(await db.select().from(plataformasPrograma)).toHaveLength(1);
    expect(await db.select().from(enlacesPago)).toHaveLength(2);
  });

  it("un enlace rechazado por acceso no deja vinculo (el closer no vende en B)", async () => {
    auth.mockResolvedValue(sesionCloser);
    const { crearEnlacePagoAccion } = await acciones();
    expect((await crearEnlacePagoAccion(enlaceEn(programaB))).ok).toBe(false);
    expect(await db.select().from(plataformasPrograma)).toHaveLength(0);
  });
});
