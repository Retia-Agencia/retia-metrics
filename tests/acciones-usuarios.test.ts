import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { changeLog, miembrosPrograma, programs, users, usuariosProgramasAlcance } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";
import { guardarAlcanceDeUsuario } from "@/lib/catalogo/usuarios";

/**
 * Ticket 015: las server actions de `/ajustes/usuarios`. Cada accion envuelve la
 * logica pura de `lib/catalogo/usuarios` y devuelve un resultado serializable
 * (`{ ok }` | `{ ok:false, error }`), igual que las acciones de catalogos (013): una
 * excepcion no viaja al cliente con su tipo.
 *
 * `auth` se mockea para simular la sesion; la base es PGlite en memoria, inyectada
 * en las acciones via un mock de `@/lib/db`. Un closer NUNCA pasa (ADR 0003).
 */

const auth = vi.fn();
vi.mock("@/lib/auth", () => ({ auth }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
  headers: async () => new Headers({ "next-action": "prueba" }),
}));

// Las acciones usan la `db` de la app; en el test se apunta a la de PGlite.
let db: Db;
vi.mock("@/lib/db", () => ({
  get db() {
    return db;
  },
}));

// revalidatePath no hace nada util fuera de una request de Next.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

let cerrar: () => Promise<void>;

let vaciar: () => Promise<void>;
let gerenteId: string;
let programaAId: string;
let programaBId: string;

const sesionGerente = {
  user: { id: "", email: "gerente@retiagrowth.com", rol: "gerente", closerId: null, alcanceLimitado: false },
};
const sesionGerenteLimitado = {
  user: { ...sesionGerente.user, alcanceLimitado: true },
};
const sesionCloser = {
  user: { id: "u-2", email: "closer@retiagrowth.com", rol: "closer", closerId: "andrea" },
};
const sesionDeveloper = {
  user: { id: "", email: "dev@retiagrowth.com", rol: "developer", closerId: null },
};
const sesionPaidTrafficker = {
  user: { id: "", email: "pauta@retiagrowth.com", rol: "paid_trafficker", closerId: null, alcanceLimitado: false },
};

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
  const programasInsertados = await db
    .insert(programs)
    .values([
      { ...PROGRAMA_DE_PRUEBA, slug: "programa-a", nombre: "Programa A", ticketUsd: "1000" },
      { ...PROGRAMA_DE_PRUEBA, slug: "programa-b", nombre: "Programa B", ticketUsd: "1000" },
    ])
    .returning();
  programaAId = programasInsertados.find((programa) => programa.slug === "programa-a")!.id;
  programaBId = programasInsertados.find((programa) => programa.slug === "programa-b")!.id;
  const [developer] = await db
    .insert(users)
    .values({ email: sesionDeveloper.user.email, rol: "developer" })
    .returning();
  sesionDeveloper.user.id = developer.id;
  const [paidTrafficker] = await db
    .insert(users)
    .values({ email: sesionPaidTrafficker.user.email, rol: "paid_trafficker" })
    .returning();
  sesionPaidTrafficker.user.id = paidTrafficker.id;
});

describe("paid trafficker no administra usuarios (ADR 0094)", () => {
  it("no puede cambiar un rol a developer y la fila queda igual", async () => {
    const [objetivo] = await db
      .insert(users)
      .values({ email: "objetivo@retiagrowth.com", rol: "closer", nombre: "Objetivo" })
      .returning();
    auth.mockResolvedValue(sesionPaidTrafficker);
    const { editarUsuarioAccion } = await acciones();

    const resultado = await editarUsuarioAccion(objetivo.id, {
      email: objetivo.email,
      nombre: objetivo.nombre ?? "",
      rol: "developer",
      closerId: "",
      programas: [],
    });

    expect(resultado).toMatchObject({ ok: false });
    const [despues] = await db.select().from(users).where(eq(users.id, objetivo.id));
    expect(despues.rol).toBe("closer");
  });
});

afterAll(async () => {
  await cerrar();
});

async function acciones() {
  return import("@/app/(app)/ajustes/usuarios/acciones");
}

describe("acciones de usuarios — barrera de rol (ADR 0003)", () => {
  it("un closer es rechazado en crear, editar, desactivar y reactivar", async () => {
    auth.mockResolvedValue(sesionCloser);
    const { crearUsuarioAccion, editarUsuarioAccion, desactivarUsuarioAccion, reactivarUsuarioAccion } =
      await acciones();

    const UUID = "00000000-0000-0000-0000-000000000000";
    for (const llamada of [
      () =>
        crearUsuarioAccion({
          email: "x@retiagrowth.com",
          rol: "gerente",
          closerId: "",
          programas: [],
        }),
      () =>
        editarUsuarioAccion(UUID, {
          email: "x@retiagrowth.com",
          rol: "gerente",
          closerId: "",
          programas: [],
        }),
      () => desactivarUsuarioAccion(UUID),
      () => reactivarUsuarioAccion(UUID),
    ]) {
      const res = await llamada();
      expect(res.ok).toBe(false);
    }
  });
});

describe("acciones de usuarios — el gerente administra", () => {
  beforeEach(() => auth.mockResolvedValue(sesionGerente));

  it("crea un closer con closerId y programa", async () => {
    const { crearUsuarioAccion } = await acciones();
    const res = await crearUsuarioAccion({
      email: "andrea@retiagrowth.com",
      nombre: "Andrea",
      rol: "closer",
      closerId: "Andrea",
      programas: [programaAId],
    });
    expect(res.ok).toBe(true);

    const [creado] = await db
      .select()
      .from(users)
      .where(eq(users.email, "andrea@retiagrowth.com"));
    expect(creado).toBeDefined();
    const membresias = await db
      .select()
      .from(miembrosPrograma)
      .where(eq(miembrosPrograma.userId, creado.id));
    expect(membresias).toHaveLength(1);
  });

  it("un closer sin closerId se crea (167: closerId es opcional)", async () => {
    const { crearUsuarioAccion } = await acciones();
    const res = await crearUsuarioAccion({
      email: "sin-codigo@retiagrowth.com",
      rol: "closer",
      closerId: "",
      programas: [programaAId],
    });
    expect(res.ok).toBe(true);
  });

  it("un gerente no puede desactivarse a si mismo", async () => {
    const { desactivarUsuarioAccion } = await acciones();
    const res = await desactivarUsuarioAccion(gerenteId);
    expect(res.ok).toBe(false);
    const [u] = await db.select().from(users).where(eq(users.id, gerenteId));
    expect(u.activo).toBe(true);
  });
});

describe("acciones de usuarios — gerente limitado", () => {
  beforeEach(async () => {
    await db.insert(usuariosProgramasAlcance).values({ userId: gerenteId, programId: programaAId });
    auth.mockResolvedValue(sesionGerenteLimitado);
  });

  it("crea un closer dentro de su alcance", async () => {
    const { crearUsuarioAccion } = await acciones();
    expect((await crearUsuarioAccion({
      email: "local@retiagrowth.com",
      rol: "closer",
      closerId: "Local",
      programas: [programaAId],
    })).ok).toBe(true);
    const [creado] = await db.select().from(users).where(eq(users.email, "local@retiagrowth.com"));
    expect((await db.select().from(miembrosPrograma).where(eq(miembrosPrograma.userId, creado.id)))
      .map((fila) => fila.programId)).toEqual([programaAId]);
  });

  it("rechaza altas forjadas y no deja filas", async () => {
    const { crearUsuarioAccion } = await acciones();
    const entradas = [
      { email: "dev-nuevo@retia.co", rol: "developer" as const, programas: [] },
      { email: "fuera@retia.co", rol: "closer" as const, programas: [programaBId] },
      { email: "gerente-vacio@retia.co", rol: "gerente" as const, programas: [] },
      { email: "gerente-fuera@retia.co", rol: "gerente" as const, programas: [programaBId] },
      { email: "pauta-vacia@retia.co", rol: "paid_trafficker" as const, programas: [] },
      { email: "pauta-fuera@retia.co", rol: "paid_trafficker" as const, programas: [programaBId] },
    ];
    for (const entrada of entradas) {
      expect((await crearUsuarioAccion(entrada)).ok).toBe(false);
    }
    expect(await db.select().from(users)).toHaveLength(3);
    expect(await db.select().from(miembrosPrograma)).toHaveLength(0);
  });

  it("no cambia el correo de un usuario de su alcance (secuestro de cuenta)", async () => {
    const [local] = await db.insert(users).values({ email: "local-correo@retia.co", rol: "closer" }).returning();
    await db.insert(miembrosPrograma).values({ userId: local.id, programId: programaAId });
    const { editarUsuarioAccion } = await acciones();
    expect((await editarUsuarioAccion(local.id, {
      email: "atacante@gmail.com",
      rol: "closer",
      programas: [programaAId],
    })).ok).toBe(false);
    const [despues] = await db.select().from(users).where(eq(users.id, local.id));
    expect(despues.email).toBe("local-correo@retia.co");
  });

  it("no asciende usuarios ni toca a quien tiene programas ajenos", async () => {
    const [local, ajeno, gerenteLocal] = await db.insert(users).values([
      { email: "local-existente@retia.co", rol: "closer" },
      { email: "ajeno@retia.co", rol: "closer" },
      { email: "gerente-local@retia.co", rol: "gerente", nombre: "Sin cambios" },
    ]).returning();
    await db.insert(miembrosPrograma).values([
      { userId: local.id, programId: programaAId },
      { userId: ajeno.id, programId: programaBId },
    ]);
    await db.insert(usuariosProgramasAlcance).values({ userId: gerenteLocal.id, programId: programaAId });
    const { editarUsuarioAccion, desactivarUsuarioAccion } = await acciones();
    for (const rol of ["gerente", "paid_trafficker", "developer"] as const) {
      expect((await editarUsuarioAccion(local.id, {
        email: local.email,
        rol,
        programas: [programaAId],
      })).ok).toBe(false);
    }
    expect((await editarUsuarioAccion(ajeno.id, {
      email: ajeno.email,
      nombre: "Cambio forjado",
      rol: "closer",
      programas: [programaBId],
    })).ok).toBe(false);
    expect((await desactivarUsuarioAccion(ajeno.id)).ok).toBe(false);
    expect((await editarUsuarioAccion(gerenteLocal.id, {
      email: gerenteLocal.email,
      nombre: "No debe quedar",
      rol: "gerente",
    }, [programaBId])).ok).toBe(false);
    const filas = await db.select().from(users);
    expect(filas.find((fila) => fila.id === local.id)?.rol).toBe("closer");
    expect(filas.find((fila) => fila.id === ajeno.id)).toMatchObject({ nombre: null, activo: true });
    expect(filas.find((fila) => fila.id === gerenteLocal.id)?.nombre).toBe("Sin cambios");
  });

  it("un correo existente fuera del alcance conserva el error de duplicado y no cambia nada", async () => {
    const [ajeno] = await db.insert(users).values({ email: "duplicado@retia.co", rol: "closer" }).returning();
    await db.insert(miembrosPrograma).values({ userId: ajeno.id, programId: programaBId });
    const { crearUsuarioAccion } = await acciones();
    const antes = await db.select().from(miembrosPrograma);
    const resultado = await crearUsuarioAccion({
      email: ajeno.email,
      rol: "closer",
      programas: [programaAId],
    });
    expect(resultado).toMatchObject({ ok: false });
    if (!resultado.ok) expect(resultado.error).toContain("Ya existe");
    expect(await db.select().from(users)).toHaveLength(4);
    expect(await db.select().from(miembrosPrograma)).toEqual(antes);
  });
});

describe("alcance visible de un usuario (ADR 0094)", () => {
  it("el gerente global y el developer fijan y quitan alcance con change_log", async () => {
    const [objetivo] = await db
      .insert(users)
      .values({ email: "gerente-sbj@estadox.co", rol: "gerente" })
      .returning();
    const entrada = { email: objetivo.email, rol: "gerente" as const, closerId: "", programas: [] };
    const { editarUsuarioAccion } = await acciones();

    auth.mockResolvedValue(sesionGerente);
    expect((await editarUsuarioAccion(objetivo.id, entrada, [programaAId])).ok).toBe(true);
    expect(await db.select().from(usuariosProgramasAlcance)).toHaveLength(1);
    expect((await editarUsuarioAccion(objetivo.id, entrada, null)).ok).toBe(true);

    auth.mockResolvedValue(sesionDeveloper);
    expect((await editarUsuarioAccion(objetivo.id, entrada, [programaAId])).ok).toBe(true);
    expect(await db.select().from(usuariosProgramasAlcance)).toHaveLength(1);
    expect((await db.select().from(changeLog)).some((fila) => fila.tabla === "usuarios_programas_alcance")).toBe(true);

    expect((await editarUsuarioAccion(objetivo.id, entrada, null)).ok).toBe(true);
    expect(await db.select().from(usuariosProgramasAlcance)).toHaveLength(0);
  });

  it("el developer nunca queda limitado por sus propias filas", async () => {
    await db.insert(usuariosProgramasAlcance).values({ userId: sesionDeveloper.user.id, programId: programaAId });
    const [objetivo] = await db.insert(users).values({ email: "pauta-global@retia.co", rol: "paid_trafficker" }).returning();
    await expect(guardarAlcanceDeUsuario(
      db,
      { id: sesionDeveloper.user.id, rol: "developer" },
      objetivo.id,
      [programaBId],
    )).resolves.toBeUndefined();
    expect((await db.select().from(usuariosProgramasAlcance).where(eq(usuariosProgramasAlcance.userId, objetivo.id))))
      .toEqual([expect.objectContaining({ programId: programaBId })]);
  });
});
