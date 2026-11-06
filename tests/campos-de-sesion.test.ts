import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { JWT } from "@auth/core/jwt";
import { programs, users, usuariosProgramasAlcance } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";
import { crearBaseReutilizable, type BaseDePrueba } from "./helpers/base-de-prueba";

const baseDeLaApp = vi.hoisted(() => ({ db: undefined as Db | undefined }));
vi.mock("@/lib/db", () => ({ get db() { return baseDeLaApp.db; } }));

describe("campos de sesion compartidos", () => {
  let base: BaseDePrueba;
  let db: Db;

  beforeAll(async () => {
    base = await crearBaseReutilizable();
    db = base.db;
    baseDeLaApp.db = db;
  }, 60_000);

  afterAll(async () => {
    await base.cerrar();
  });

  it("produce los mismos campos que revalidarToken para cada rol y alcance", async () => {
    const [programa] = await db.insert(programs).values({
      ...PROGRAMA_DE_PRUEBA,
      slug: "campos-sesion",
      nombre: "Campos de sesion",
      ticketUsd: "1000",
    }).returning();
    const registros = await db.insert(users).values([
      { email: "gerente-limitado@retia.co", rol: "gerente" },
      { email: "gerente-global@retia.co", rol: "gerente" },
      { email: "closer-campos@retia.co", rol: "closer", closerId: "Closer" },
      { email: "dev-campos@retia.co", rol: "developer" },
    ]).returning();
    await db.insert(usuariosProgramasAlcance).values({
      userId: registros[0]!.id,
      programId: programa.id,
    });

    const { camposDeSesionDeUsuario } = await import("@/lib/auth/campos-de-sesion");
    const { revalidarToken } = await import("@/lib/auth/revalidacion");
    for (const registro of registros) {
      const directo = await camposDeSesionDeUsuario(registro, db);
      const token = await revalidarToken({ email: registro.email } as JWT);
      expect(directo).toEqual({
        usuarioId: token.usuarioId,
        rol: token.rol,
        operaComoCloser: token.operaComoCloser,
        closerId: token.closerId,
        alcanceLimitado: token.alcanceLimitado,
      });
    }

    const invalido = {
      id: registros[2]!.id,
      email: "invalido-campos@retia.co",
      rol: "invalido",
      operaComoCloser: false,
      closerId: null,
      activo: true,
    };
    baseDeLaApp.db = {
      select: () => ({
        from: () => ({ where: () => ({ limit: async () => [invalido] }) }),
      }),
    } as unknown as Db;
    const directo = await camposDeSesionDeUsuario(invalido, db);
    const token = await revalidarToken({ email: invalido.email } as JWT);
    expect(directo).toEqual({
      usuarioId: token.usuarioId,
      rol: token.rol,
      operaComoCloser: token.operaComoCloser,
      closerId: token.closerId,
      alcanceLimitado: token.alcanceLimitado,
    });
    expect(directo).toMatchObject({ rol: "closer", alcanceLimitado: false });
    baseDeLaApp.db = db;
  });
});
