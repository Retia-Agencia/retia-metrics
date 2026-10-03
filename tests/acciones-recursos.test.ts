import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import {
  categoriasRecurso,
  changeLog,
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
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * Ticket 023 + enmienda del 19-sep: crear/reemplazar/desactivar recursos y enlaces de
 * pago lo pueden hacer gerente Y closer, con el molde de acceso por programa:
 * quien ADMINISTRA (gerente/developer) entra a cualquier programa; un closer solo a
 * los programas donde tiene membresia ACTIVA, y NUNCA a un recurso global.
 *
 * La barrera es de servidor (ADR 0003): un closer sin acceso recibe `ok:false`, no
 * solo un botón escondido. `auth` está mockeado, la base PGlite se inyecta y la cookie
 * de vista se simula para el developer.
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
    .values({ ...PROGRAMA_DE_PRUEBA, slug: "comunicarte", nombre: "Comunicarte", ticketUsd: "797.00" })
    .returning();
  programaA = a.id;
  const [b] = await db
    .insert(programs)
    .values({ ...PROGRAMA_DE_PRUEBA, slug: "tactical", nombre: "Tactical Investor", ticketUsd: "1500.00" })
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

/**
 * Las acciones de la seccion "Plataformas de pago" de la tab Programa (ticket 171): los
 * enlaces de pago y la plataforma viven aqui desde que `/recursos` paso a solo lectura.
 */
async function accionesPrograma() {
  return import("@/app/(app)/p/[programa]/programa/acciones");
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
    const { crearEnlacePagoAccion } = await accionesPrograma();
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
    const { crearEnlacePagoAccion } = await accionesPrograma();
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

  it("crea un recurso SIN categoriaId (ticket 171) y deja su rastro en change_log", async () => {
    const { crearRecursoAccion } = await acciones();
    // Sin la propiedad `categoriaId`: el esquema la trata como `null` (recurso libre).
    const res = await crearRecursoAccion({
      programId: programaA,
      titulo: "Guion",
      url: "https://drive.google.com/guion",
    });
    expect(res.ok).toBe(true);

    const [creado] = await db.select().from(recursos).where(eq(recursos.programId, programaA));
    expect(creado).toBeDefined();
    expect(creado.categoriaId).toBeNull();

    // La escritura por el molde siempre registra en change_log (ADR 0012/0029).
    const log = await db.select().from(changeLog).where(eq(changeLog.registroId, creado.id));
    expect(log.length).toBeGreaterThan(0);
    expect(log.every((l) => l.tabla === "recursos")).toBe(true);
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

  it("la version VIGENTE de un recurso con historial TAMPOCO se borra", async () => {
    // 🩸 El caso que el recorrido visual destapo y que este archivo no cubria. El
    // molde cuenta quien me apunta con `reemplaza_a` ("quien me reemplazo a MI"), y
    // la version vigente nunca es reemplazada por nadie: contaba CERO y se borraba
    // con cinco versiones detras. La FK es `set null`, asi que no fallaba — se
    // llevaba la cabeza de la cadena y el recurso desaparecia de la pantalla sin
    // salir de la base. Es el caso que el usuario toca, porque es el unico que ve.
    auth.mockResolvedValue(sesionGerente);
    const { crearRecursoAccion, reemplazarRecursoAccion, borrarRecursoAccion } = await acciones();
    await crearRecursoAccion(recursoEn(programaA));
    const [original] = await db.select().from(recursos);
    await reemplazarRecursoAccion(original.id, "https://drive.google.com/brochure-v2");

    const [vigente] = await db.select().from(recursos).where(eq(recursos.vigente, true));
    expect(vigente.id).not.toBe(original.id);

    const res = await borrarRecursoAccion(vigente.id);
    expect(res).toEqual({ ok: true, borrado: false, referencias: 1 });

    // Las DOS filas siguen: el historial no se decapita.
    expect(await db.select().from(recursos)).toHaveLength(2);
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

    const { crearEnlacePagoAccion } = await accionesPrograma();
    expect((await crearEnlacePagoAccion(enlaceEn(programaA))).ok).toBe(true);

    const vinculos = await db.select().from(plataformasPrograma);
    expect(vinculos).toHaveLength(1);
    expect(vinculos[0].plataformaId).toBe(plataforma);
    expect(vinculos[0].programId).toBe(programaA);
  });

  it("dos enlaces de la misma plataforma y programa no duplican el vinculo", async () => {
    auth.mockResolvedValue(sesionCloser);
    const { crearEnlacePagoAccion } = await accionesPrograma();
    await crearEnlacePagoAccion(enlaceEn(programaA));
    await crearEnlacePagoAccion({ ...enlaceEn(programaA), url: "https://paypal.com/otro" });

    expect(await db.select().from(plataformasPrograma)).toHaveLength(1);
    expect(await db.select().from(enlacesPago)).toHaveLength(2);
  });

  it("un enlace rechazado por acceso no deja vinculo (el closer no vende en B)", async () => {
    auth.mockResolvedValue(sesionCloser);
    const { crearEnlacePagoAccion } = await accionesPrograma();
    expect((await crearEnlacePagoAccion(enlaceEn(programaB))).ok).toBe(false);
    expect(await db.select().from(plataformasPrograma)).toHaveLength(0);
  });
});

/**
 * Ticket 171: las plataformas de pago se dan de alta en la tab Programa con un nombre
 * libre (`crearOVincularPlataformaAccion`). La reja sigue siendo de servidor: un closer
 * forjando la accion en un programa donde no vende recibe `ok:false` y la base no se
 * mueve, aunque la seccion aparezca en la pantalla.
 */
describe("acciones de plataformas de la tab Programa (ticket 171)", () => {
  it("un closer da de alta una plataforma por nombre en SU programa", async () => {
    auth.mockResolvedValue(sesionCloser);
    const { crearOVincularPlataformaAccion } = await accionesPrograma();
    const res = await crearOVincularPlataformaAccion("Wise", programaA);
    expect(res.ok).toBe(true);

    const [creada] = await db
      .select()
      .from(plataformasPago)
      .where(eq(plataformasPago.nombre, "Wise"));
    expect(creada).toBeDefined();
    const vinculos = await db
      .select()
      .from(plataformasPrograma)
      .where(eq(plataformasPrograma.plataformaId, creada.id));
    expect(vinculos).toHaveLength(1);
    expect(vinculos[0].programId).toBe(programaA);
  });

  it("un closer forjando la accion en un programa ajeno (B) recibe ok:false y nada se escribe", async () => {
    auth.mockResolvedValue(sesionCloser);
    const { crearOVincularPlataformaAccion } = await accionesPrograma();
    const res = await crearOVincularPlataformaAccion("Wise", programaB);
    expect(res.ok).toBe(false);
    expect(await db.select().from(plataformasPago).where(eq(plataformasPago.nombre, "Wise"))).toHaveLength(0);
    expect(await db.select().from(plataformasPrograma)).toHaveLength(0);
  });

  it("un nombre que ya existe (PayPal) con otras mayusculas vincula, no duplica", async () => {
    auth.mockResolvedValue(sesionCloser);
    const { crearOVincularPlataformaAccion } = await accionesPrograma();
    expect((await crearOVincularPlataformaAccion("paypal", programaA)).ok).toBe(true);

    // Sigue habiendo UNA sola fila PayPal: se reuso la existente.
    const paypal = await db
      .select()
      .from(plataformasPago)
      .where(eq(plataformasPago.id, plataforma));
    expect(paypal).toHaveLength(1);
    const vinculos = await db
      .select()
      .from(plataformasPrograma)
      .where(eq(plataformasPrograma.plataformaId, plataforma));
    expect(vinculos).toHaveLength(1);
    expect(vinculos[0].programId).toBe(programaA);
  });
});
