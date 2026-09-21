import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import {
  calls,
  cohorts,
  miembrosPrograma,
  leads,
  programs,
  users,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";

/**
 * Ticket 003 — server actions de `/mi-dia` (ADR 0003, 0011, 0015, 0021).
 *
 * `auth` se mockea para simular la sesion; la base es PGlite en memoria inyectada
 * via un mock de `@/lib/db`, igual que `tests/acciones-productos.test.ts`. La
 * barrera de rol es lo que se prueba aca: la pantalla es del closer (ADR 0003), asi
 * que un gerente no registra y sin sesion no pasa nada.
 *
 * Tambien se prueba la conversion de fecha del <input type="date"> anclada al
 * mediodia de Bogota: la accion, no la mutacion, hace el `new Date(...T12:00:00-05:00)`
 * y sin eso el compromiso de pago se correria un dia hacia atras.
 */

const auth = vi.fn();
vi.mock("@/lib/auth", () => ({ auth }));

/**
 * La cookie de vista (ticket 028) la lee `rolDeVista` via `next/headers`, que fuera de
 * un request real lanza. Se mockea con un store controlable: `ponerVista` fija el
 * valor para un test; por defecto no hay cookie (vista `todo`). Solo importa para el
 * developer: un gerente o closer nunca llegan a leerla.
 */
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
    .values({ slug: "programa-a", nombre: "Programa A", ticketUsd: "797.00" })
    .returning();
  programaA = a.id;

  const [b] = await db
    .insert(programs)
    .values({ slug: "programa-b", nombre: "Programa B", ticketUsd: "1500.00" })
    .returning();
  programaB = b.id;

  await db.insert(miembrosPrograma).values({ userId: closerId, programId: programaA, activo: true });
  // El developer es miembro SOLO de A: en vista closer no debe encontrar leads de B.
  await db.insert(miembrosPrograma).values({ userId: developerId, programId: programaA, activo: true });

  // Cohorte activa para poder registrar llamadas (registrarLlamada la exige).
  await db.insert(cohorts).values({
    programId: programaA,
    codigo: "C1",
    metaCupos: 10,
    precioUsd: "797",
    fechaInicioClases: "2026-10-01",
    fechaInicioVentas: "2026-09-01",
    fechaCierreVentas: "2026-09-30",
    estado: "activo",
  });
});

afterEach(async () => {
  await cerrar();
});

async function acciones() {
  return import("@/app/(app)/mi-dia/acciones");
}

/** La busqueda vive en `personas/`: la comparten `/mi-dia` y `/personas`. */
async function accionesPersonas() {
  return import("@/app/(app)/personas/acciones");
}

// ─────────────────────────────────────────────── barrera de rol (ADR 0003)

describe("la pantalla es del closer: el gerente no registra (ADR 0003)", () => {
  beforeEach(() => auth.mockResolvedValue(sesionGerente));

  /**
   * 18-sep: este test afirmaba que un gerente NO puede buscar personas, y eso no era
   * una regla sino un hueco escrito como si lo fuera. `/personas/[id]` solo se alcanza
   * desde el buscador, asi que un gerente no tenia ninguna forma de abrir el historial
   * de un lead. Lo que el ADR 0003 prohibe es que el gerente REGISTRE (los tests de
   * abajo), no que mire. Se cambio a conciencia.
   */
  it("un gerente SI puede buscar personas (ve todos los programas activos)", async () => {
    await db
      .insert(leads)
      .values({ programId: programaA, emailNormalizado: "juan@correo.co", nombre: "Juan" });

    const { buscarPersonasAccion } = await accionesPersonas();
    const res = await buscarPersonasAccion("Juan");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.personas).toHaveLength(1);
  });

  it("un gerente no puede registrar una llamada", async () => {
    const { registrarLlamadaAccion } = await acciones();
    const res = await registrarLlamadaAccion({ programId: programaA, resultado: "show" });
    expect(res.ok).toBe(false);
    // No se escribio nada.
    const filas = await db.select().from(calls);
    expect(filas).toHaveLength(0);
  });

  it("un gerente no puede tomar una persona", async () => {
    const [p] = await db
      .insert(leads)
      .values({ programId: programaA, emailNormalizado: "libre@correo.co" })
      .returning();
    const { tomarPersonaAccion } = await acciones();
    const res = await tomarPersonaAccion(p.id);
    expect(res.ok).toBe(false);
  });

  it("un gerente no puede crear una persona manual", async () => {
    const { crearPersonaAccion } = await acciones();
    const res = await crearPersonaAccion({ programId: programaA, correo: "x@correo.co" });
    expect(res.ok).toBe(false);
  });
});

describe("sin sesion no pasa nada", () => {
  beforeEach(() => auth.mockResolvedValue(null));

  it("buscar sin sesion falla", async () => {
    const { buscarPersonasAccion } = await accionesPersonas();
    const res = await buscarPersonasAccion("juan");
    expect(res.ok).toBe(false);
  });

  it("registrar sin sesion falla y no escribe", async () => {
    const { registrarLlamadaAccion } = await acciones();
    const res = await registrarLlamadaAccion({ programId: programaA, resultado: "show" });
    expect(res.ok).toBe(false);
    const filas = await db.select().from(calls);
    expect(filas).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────── un closer sí registra

describe("un closer registra en su programa", () => {
  beforeEach(() => auth.mockResolvedValue(sesionCloser));

  it("busca personas de su programa y las recibe en el payload", async () => {
    await db
      .insert(leads)
      .values({ programId: programaA, emailNormalizado: "juan@correo.co", nombre: "Juan" });

    const { buscarPersonasAccion } = await accionesPersonas();
    const res = await buscarPersonasAccion("Juan");
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.personas).toHaveLength(1);
      expect(res.personas[0].nombre).toBe("Juan");
    }
  });

  it("registra un show sobre una persona", async () => {
    const [p] = await db
      .insert(leads)
      .values({ programId: programaA, emailNormalizado: "juan@correo.co", nombre: "Juan" })
      .returning();

    const { registrarLlamadaAccion } = await acciones();
    const res = await registrarLlamadaAccion({
      programId: programaA,
      personId: p.id,
      resultado: "show",
    });
    expect(res.ok).toBe(true);
    const filas = await db.select().from(calls);
    expect(filas).toHaveLength(1);
    expect(filas[0].resultado).toBe("show");
    expect(filas[0].closerId).toBe("Ana");
  });

  it("toma una persona sin responsable y queda como responsable", async () => {
    const [p] = await db
      .insert(leads)
      .values({ programId: programaA, emailNormalizado: "libre@correo.co" })
      .returning();

    const { tomarPersonaAccion } = await acciones();
    const res = await tomarPersonaAccion(p.id);
    expect(res.ok).toBe(true);
    const [fila] = await db.select().from(leads).where(eq(leads.id, p.id));
    expect(fila.responsableCloserId).toBe("Ana");
  });

  it("crea una persona manual con el closer como responsable", async () => {
    const { crearPersonaAccion } = await acciones();
    const res = await crearPersonaAccion({
      programId: programaA,
      correo: "nuevo@correo.co",
      nombre: "Nuevo",
    });
    expect(res.ok).toBe(true);
    const [fila] = await db
      .select()
      .from(leads)
      .where(and(eq(leads.programId, programaA), eq(leads.emailNormalizado, "nuevo@correo.co")));
    expect(fila.responsableCloserId).toBe("Ana");
    expect(fila.entrada).toBe("crm");
  });
});

// ─────────────────────────────── ver como (ticket 028): la vista estrecha el alcance

describe("developer con 'ver como' (ticket 028)", () => {
  beforeEach(() => auth.mockResolvedValue(sesionDeveloper));

  it("en vista 'closer' busca SOLO en sus membresias, no en todos los programas", async () => {
    // Un lead en A (donde el developer es miembro) y otro en B (donde no lo es).
    await db.insert(leads).values([
      { programId: programaA, emailNormalizado: "en-a@correo.co", nombre: "Ana En A" },
      { programId: programaB, emailNormalizado: "en-b@correo.co", nombre: "Ana En B" },
    ]);
    ponerVista("closer");

    const { buscarPersonasAccion } = await accionesPersonas();
    const res = await buscarPersonasAccion("Ana");
    expect(res.ok).toBe(true);
    if (res.ok) {
      // En vista closer la membresia vuelve a importar: solo el lead de A.
      expect(res.personas.map((p) => p.nombre)).toEqual(["Ana En A"]);
    }
  });

  it("en vista 'todo' (por defecto) busca en TODOS los programas activos", async () => {
    await db.insert(leads).values([
      { programId: programaA, emailNormalizado: "en-a@correo.co", nombre: "Ana En A" },
      { programId: programaB, emailNormalizado: "en-b@correo.co", nombre: "Ana En B" },
    ]);
    // Sin cookie: vista `todo`, el developer administra y ve todo.

    const { buscarPersonasAccion } = await accionesPersonas();
    const res = await buscarPersonasAccion("Ana");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.personas).toHaveLength(2);
  });
});



describe("la fecha del formulario se ancla al mediodia de Bogota, no corre el dia", () => {
  beforeEach(() => auth.mockResolvedValue(sesionCloser));

  it("un compromiso_pago con fechaSeguimiento YYYY-MM-DD guarda ese mismo dia en Bogota", async () => {
    const [p] = await db
      .insert(leads)
      .values({ programId: programaA, emailNormalizado: "compromiso@correo.co", nombre: "Compromiso" })
      .returning();

    const { registrarLlamadaAccion } = await acciones();
    const res = await registrarLlamadaAccion({
      programId: programaA,
      personId: p.id,
      resultado: "compromiso_pago",
      fechaSeguimiento: "2026-09-20",
    });
    expect(res.ok).toBe(true);

    const [fila] = await db.select().from(calls);
    expect(fila.fechaSeguimiento).not.toBeNull();
    // El dia en Bogota debe seguir siendo el 20, no el 19. Con new Date('2026-09-20')
    // (medianoche UTC) en Bogota (UTC-5) el dia se leeria como 19.
    const enBogota = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Bogota",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(fila.fechaSeguimiento as Date);
    expect(enBogota).toBe("2026-09-20");
  });
});
