import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { areas as tablaAreas, canales as tablaCanales, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { areas } from "@/lib/catalogo/areas";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";

/**
 * Ticket 173 — los Canales los administra quien `manejaPauta` (ADR 0052, ADR 0077
 * punto 4): el paid trafficker, el gerente y el developer. La reja es de SERVIDOR y se
 * forja la petición (no se mira el botón): un closer recibe 403 y la base no se mueve;
 * un paid trafficker crea el canal. Mismo molde de mocks que `tests/salud-crm.test.ts`.
 */

const holder: { db: Db | null } = { db: null };
vi.mock("@/lib/db", () => ({
  get db() {
    return holder.db;
  },
}));

// La server action pasa por `requireRole` + `manejaPauta`: se controla el rol con este
// holder para forjar un closer (que NO debe poder) o un paid trafficker (que sí).
const sesionHolder: { rol: string | null; id: string } = { rol: null, id: "u-actor" };
vi.mock("@/lib/auth/index", () => ({
  auth: async () =>
    sesionHolder.rol ? { user: { id: sesionHolder.id, rol: sesionHolder.rol } } : null,
}));
vi.mock("@/lib/auth/vista", () => ({
  rolDeVista: async (session: { user?: { rol?: string } }) => session?.user?.rol ?? null,
  sesionEfectiva: async <T,>(session: T) => session,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

let db: Db;
let cerrar: () => Promise<void>;
let areaId: string;

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  holder.db = db;
  sesionHolder.rol = null;
  // El actor que crea el área (admin) existe; el paid trafficker se siembra para ser el
  // actor de la acción (su id debe existir en `users` por la FK de `change_log`).
  const [admin] = await db.insert(users).values({ email: "admin@retia.local", rol: "gerente" }).returning();
  const [pt] = await db
    .insert(users)
    .values({ email: "pauta@retia.local", rol: "paid_trafficker" })
    .returning();
  sesionHolder.id = pt.id;
  areaId = (await areas(db).crear(admin.id, { nombre: "Paid" })).id;
});

afterEach(async () => {
  holder.db = null;
  await cerrar();
});

function entrada() {
  return {
    nombre: "Meta histórico",
    utmSource: "facebook",
    utmMedium: "cpc",
    areaId,
    formato: "meta_historico" as const,
  };
}

describe("crearCanalAccion: rol en el servidor (ticket 173)", () => {
  it("un closer recibe 403 y la base no se mueve (se forja la petición)", async () => {
    const { crearCanalAccion } = await import("@/app/(app)/ajustes/canales/acciones");
    sesionHolder.rol = "closer";

    const r = await crearCanalAccion(entrada());
    expect(r.ok).toBe(false);
    // No se escribió ningún canal.
    expect(await db.select().from(tablaCanales)).toHaveLength(0);
  });

  it("un paid trafficker crea el canal", async () => {
    const { crearCanalAccion } = await import("@/app/(app)/ajustes/canales/acciones");
    sesionHolder.rol = "paid_trafficker";

    const r = await crearCanalAccion(entrada());
    expect(r.ok).toBe(true);
    const filas = await db.select().from(tablaCanales);
    expect(filas).toHaveLength(1);
    expect(filas[0].utmSource).toBe("facebook");
    // Sanidad: el área sigue existiendo (no la tocó la acción de canal).
    expect(await db.select().from(tablaAreas)).toHaveLength(1);
  });
});
