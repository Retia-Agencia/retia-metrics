import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { eq } from "drizzle-orm";
import {
  changeLog,
  cohorts,
  enlacesPago,
  miembrosPrograma,
  plataformasPago,
  plataformasPrograma,
  programs,
  sources,
  users,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { navParaRol, rutaAlCambiarDePrograma } from "@/lib/nav";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * Ticket 100 — la tab Programa: la ficha del programa (ADR 0050).
 *
 * Lo que se muerde:
 * - La ficha trae SOLO lo del programa pedido (el programa es frontera) y ningún secreto:
 *   ni el token de Calendly, ni la clave de firma, ni el secreto del webhook de una fuente
 *   (ADR 0057, ticket 105). Dice SI los hay, nunca cuáles.
 * - La página: un closer sin membresía en el programa recibe 404 (ADR 0048) y la ficha ni se
 *   lee; un closer con membresía la lee sin el editor de cohortes; quien administra la ve con él.
 * - La escritura que la ficha ofrece es la de Ajustes (las mismas acciones). Se FORJA desde un
 *   closer con membresía: la acción lo rechaza y la base no se mueve, ni `change_log`.
 */

const auth = vi.fn();
vi.mock("@/lib/auth", () => ({ auth }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

class NoEncontrado extends Error {}
const notFound = vi.fn(() => {
  throw new NoEncontrado("NEXT_NOT_FOUND");
});
const redirect = vi.fn((destino: string) => {
  throw new Error(`redirect ${destino}`);
});
vi.mock("next/navigation", () => ({ notFound, redirect, useRouter: () => ({ refresh: vi.fn() }) }));

let db: Db;
vi.mock("@/lib/db", () => ({
  get db() {
    return db;
  },
}));

let cerrar: () => Promise<void>;
let programaA: string;
let programaB: string;
const ids = { closerA: "", closerB: "", gerente: "" };

const TOKEN_A = "token-secreto-de-a";
const FIRMA_A = "clave-de-firma-de-a";
const SECRETO_FUENTE_A = "secreto-hmac-de-a";

function sesion(id: string, rol: "closer" | "gerente" | "developer") {
  return { user: { id, email: `${rol}@retiagrowth.com`, rol, closerId: null } };
}

beforeEach(async () => {
  auth.mockReset();
  notFound.mockClear();
  ({ db, cerrar } = await crearBaseDePrueba());

  const [pa] = await db
    .insert(programs)
    .values({
      ...PROGRAMA_DE_PRUEBA,
      slug: "a",
      nombre: "A",
      ticketUsd: "797",
      comisionPorcentaje: "10.04",
      calendlyToken: TOKEN_A,
      calendlySigningKey: FIRMA_A,
    })
    .returning();
  programaA = pa.id;
  const [pb] = await db
    .insert(programs)
    .values({ ...PROGRAMA_DE_PRUEBA, slug: "b", nombre: "B", ticketUsd: "1500", calendlyToken: "token-de-b" })
    .returning();
  programaB = pb.id;

  const [a] = await db.insert(users).values({ email: "ana@retiagrowth.com", rol: "closer", nombre: "Ana" }).returning();
  const [b] = await db.insert(users).values({ email: "beto@retiagrowth.com", rol: "closer", nombre: "Beto" }).returning();
  const [g] = await db.insert(users).values({ email: "gina@retiagrowth.com", rol: "gerente", nombre: "Gina" }).returning();
  Object.assign(ids, { closerA: a.id, closerB: b.id, gerente: g.id });
  await db.insert(miembrosPrograma).values([
    { userId: a.id, programId: programaA, calendlyEmail: "ana@calendly.com" },
    { userId: b.id, programId: programaB },
  ]);

  await db.insert(cohorts).values([
    {
      programId: programaA,
      codigo: "A-C1",
      metaCupos: 20,
      precioUsd: "797",
      fechaInicioClases: "2026-10-15",
      fechaInicioVentas: "2026-09-01",
      fechaCierreVentas: "2026-10-10",
      estado: "activo",
    },
    {
      programId: programaB,
      codigo: "B-C1",
      metaCupos: 10,
      precioUsd: "1500",
      fechaInicioClases: "2026-10-15",
      fechaInicioVentas: "2026-09-01",
      fechaCierreVentas: "2026-10-10",
      estado: "activo",
    },
  ]);

  await db.insert(sources).values([
    { programId: programaA, nombre: "Typeform A", tipo: "webhook", proveedor: "typeform", secretoWebhook: SECRETO_FUENTE_A, activo: true },
    { programId: programaB, nombre: "Typeform B", tipo: "webhook", proveedor: "typeform", secretoWebhook: "s-b", activo: true },
  ]);

  const [paypal] = await db.insert(plataformasPago).values({ nombre: "Pasarela de prueba" }).returning();
  await db.insert(enlacesPago).values([
    { programId: programaA, plataformaId: paypal.id, monto: "797.00", moneda: "USD", url: "https://paypal.me/a" },
    { programId: programaB, plataformaId: paypal.id, monto: "1500.00", moneda: "USD", url: "https://paypal.me/b" },
  ]);
});

afterEach(async () => {
  await cerrar();
});

/** Todos los elementos de React de un árbol sin renderizar (props.children y demás props). */
function elementos(nodo: ReactNode, acc: ReactElement[] = []): ReactElement[] {
  if (Array.isArray(nodo)) {
    for (const n of nodo) elementos(n, acc);
  } else if (isValidElement(nodo)) {
    acc.push(nodo);
    for (const valor of Object.values(nodo.props as Record<string, unknown>)) {
      elementos(valor as ReactNode, acc);
    }
  }
  return acc;
}

async function abrirFicha(slug: string, seccion?: string) {
  const { default: Pagina } = await import("@/app/(app)/p/[programa]/programa/page");
  return Pagina({
    params: Promise.resolve({ programa: slug }),
    searchParams: Promise.resolve(seccion ? { seccion } : {}),
  });
}

describe("fichaDelPrograma", () => {
  it.each([
    ["forms_link", { formUrl: null, tieneTokenCalendly: true, formulario: { fuente: "F", url: "https://f.co" } }],
    ["calendly_token", { formUrl: "https://f.co", tieneTokenCalendly: false, formulario: { fuente: "F", url: "https://f.co" } }],
    ["fuente_principal", { formUrl: "https://f.co", tieneTokenCalendly: true, formulario: null }],
  ] as const)("faltaParaActivar incluye %s solo cuando falta", async (clave, programa) => {
    const { faltaParaActivar } = await import("@/lib/queries/ficha-programa");
    expect(faltaParaActivar(programa).map((item) => item.clave)).toEqual([clave]);
  });

  it("faltaParaActivar no reporta requisitos presentes y conserva el orden", async () => {
    const { faltaParaActivar } = await import("@/lib/queries/ficha-programa");
    expect(
      faltaParaActivar({ formUrl: null, tieneTokenCalendly: false, formulario: null }).map(
        (item) => item.clave,
      ),
    ).toEqual(["forms_link", "calendly_token", "fuente_principal"]);
    expect(
      faltaParaActivar({
        formUrl: "https://f.co",
        tieneTokenCalendly: true,
        formulario: { fuente: "F", url: "https://f.co" },
      }),
    ).toEqual([]);
  });

  it("trae solo lo del programa pedido", async () => {
    const { fichaDelPrograma } = await import("@/lib/queries/ficha-programa");
    const ficha = await fichaDelPrograma(programaA, db);
    expect(ficha).not.toBeNull();
    expect(ficha!.programa.nombre).toBe("A");
    expect(ficha!.programa.comisionPorcentaje).toBe("10.04");
    expect(ficha!.cohortes.map((c) => c.codigo)).toEqual(["A-C1"]);
    expect(ficha!.fuentes.map((f) => f.nombre)).toEqual(["Typeform A"]);
    expect(ficha!.checkouts.map((c) => c.url)).toEqual(["https://paypal.me/a"]);
    expect(ficha!.equipo.map((m) => m.nombre)).toEqual(["Ana"]);
    expect(ficha!.equipo[0].calendlyEmail).toBe("ana@calendly.com");
  });

  it("separa las plataformas activas vinculadas de las disponibles", async () => {
    const [vinculada, disponible, inactiva, vinculadaAlOtroPrograma] = await db
      .insert(plataformasPago)
      .values([
        { nombre: "Vinculada A" },
        { nombre: "Disponible A" },
        { nombre: "Inactiva A", activo: false },
        { nombre: "Vinculada B" },
      ])
      .returning();
    await db.insert(plataformasPrograma).values([
      { programId: programaA, plataformaId: vinculada.id },
      { programId: programaA, plataformaId: inactiva.id },
      { programId: programaB, plataformaId: vinculadaAlOtroPrograma.id },
    ]);

    const { fichaDelPrograma } = await import("@/lib/queries/ficha-programa");
    const ficha = await fichaDelPrograma(programaA, db);

    expect(ficha!.plataformas).toContainEqual({ id: vinculada.id, nombre: "Vinculada A" });
    expect(ficha!.plataformasDisponibles).toEqual(
      expect.arrayContaining([
        { id: disponible.id, nombre: "Disponible A" },
        { id: vinculadaAlOtroPrograma.id, nombre: "Vinculada B" },
      ]),
    );
    expect(ficha!.plataformasDisponibles).not.toContainEqual(
      expect.objectContaining({ id: vinculada.id }),
    );
    expect(ficha!.plataformas).not.toContainEqual(
      expect.objectContaining({ id: vinculadaAlOtroPrograma.id }),
    );
    expect([...ficha!.plataformas, ...ficha!.plataformasDisponibles]).not.toContainEqual(
      expect.objectContaining({ id: inactiva.id }),
    );
  });

  it("dice si hay token y webhook, nunca cuáles, y no trae el secreto de la fuente", async () => {
    const { fichaDelPrograma } = await import("@/lib/queries/ficha-programa");
    const ficha = await fichaDelPrograma(programaA, db);
    expect(ficha!.programa.tieneTokenCalendly).toBe(true);
    expect(ficha!.programa.webhookCalendlyConectado).toBe(true);
    const texto = JSON.stringify(ficha);
    for (const secreto of [TOKEN_A, FIRMA_A, SECRETO_FUENTE_A]) expect(texto).not.toContain(secreto);
  });

  it("un id que no existe es null; uno inválido es un 400, no un 500", async () => {
    const { fichaDelPrograma } = await import("@/lib/queries/ficha-programa");
    expect(await fichaDelPrograma("00000000-0000-0000-0000-000000000000", db)).toBeNull();
    await expect(fichaDelPrograma("no-es-uuid", db)).rejects.toMatchObject({ status: 400 });
  });

  it("sin fuente principal lo dice (ADR 0068)", async () => {
    const { avisoDelFormulario } = await import("@/lib/queries/ficha-programa");
    expect(avisoDelFormulario(null)).toMatch(/no tiene fuente principal/);
    expect(avisoDelFormulario({ fuente: "Typeform", url: "https://form.typeform.com/to/x" })).toBeNull();
  });

  it("el formulario de la ficha es la fuente principal, no programs.form_url", async () => {
    const { fichaDelPrograma } = await import("@/lib/queries/ficha-programa");
    const { sources } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");
    const antes = await fichaDelPrograma(programaA, db);
    expect(antes!.programa.formulario).toBeNull();
    const [fuente] = await db.select().from(sources).where(eq(sources.programId, programaA)).limit(1);
    await db
      .update(sources)
      .set({ activo: true, urlPublica: "https://form.typeform.com/to/principal", principal: true })
      .where(eq(sources.id, fuente.id));
    const despues = await fichaDelPrograma(programaA, db);
    expect(despues!.programa.formulario).toEqual({
      fuente: fuente.nombre,
      url: "https://form.typeform.com/to/principal",
    });
    await db.update(sources).set({ principal: false }).where(eq(sources.id, fuente.id));
  });
});

describe("la página de la ficha", () => {
  it("un closer sin membresía en el programa recibe 404", async () => {
    auth.mockResolvedValue(sesion(ids.closerB, "closer"));
    await expect(abrirFicha("a")).rejects.toBeInstanceOf(NoEncontrado);
    // Su propio programa sí abre: el 404 es por alcance, no por rol.
    await expect(abrirFicha("b")).resolves.toBeTruthy();
  });

  it("un closer con membresía la lee, sin el editor de cohortes ni los enlaces a Ajustes", async () => {
    auth.mockResolvedValue(sesion(ids.closerA, "closer"));
    const { CohortesAdmin } = await import("@/components/cohortes-admin");
    const arbol = elementos(await abrirFicha("a", "ventas"));
    expect(arbol.some((e) => e.type === CohortesAdmin)).toBe(false);
    const hrefs = arbol.map((e) => (e.props as { href?: string }).href).filter(Boolean);
    expect(hrefs.some((h) => h!.startsWith("/ajustes"))).toBe(false);
  });

  it("quien administra (gerente y developer) la ve con el editor de cohortes", async () => {
    const { CohortesAdmin } = await import("@/components/cohortes-admin");
    for (const s of [sesion(ids.gerente, "gerente"), sesion(ids.gerente, "developer")]) {
      auth.mockResolvedValue(s);
      const arbol = elementos(await abrirFicha("a", "ventas"));
      const editor = arbol.find((e) => e.type === CohortesAdmin);
      expect(editor).toBeDefined();
      expect((editor!.props as { programId: string }).programId).toBe(programaA);
    }
  });

  it("un slug que no existe es 404 también para quien administra", async () => {
    auth.mockResolvedValue(sesion(ids.gerente, "gerente"));
    await expect(abrirFicha("no-existe")).rejects.toBeInstanceOf(NoEncontrado);
  });
});

describe("forjar la escritura desde un closer con membresía", () => {
  async function bitacora() {
    return (await db.select().from(changeLog)).length;
  }

  it("crear una cohorte se rechaza y la base no se mueve", async () => {
    auth.mockResolvedValue(sesion(ids.closerA, "closer"));
    const { crearCohorteAccion } = await import("@/app/(app)/p/[programa]/programa/acciones-programa");
    const antes = await bitacora();
    const r = await crearCohorteAccion("a", {
      programId: programaA,
      codigo: "A-C2",
      metaCupos: 5,
      precioUsd: "797",
      fechaInicioClases: "2026-12-01",
      fechaCierreVentas: "2026-11-25",
      estado: "futuro",
    });
    expect(r.ok).toBe(false);
    expect(await db.select().from(cohorts).where(eq(cohorts.programId, programaA))).toHaveLength(1);
    expect(await bitacora()).toBe(antes);
  });

  it("editar la comisión del programa se rechaza y la base no se mueve", async () => {
    auth.mockResolvedValue(sesion(ids.closerA, "closer"));
    const { editarProgramaAccion } = await import("@/app/(app)/p/[programa]/programa/acciones-programa");
    const antes = await bitacora();
    const r = await editarProgramaAccion(
      programaA,
      { nombre: "A", slug: "a", ticketUsd: "797", comisionPorcentaje: "50", formUrl: "https://form.typeform.com/to/prueba" },
      "",
    );
    expect(r.ok).toBe(false);
    const [p] = await db.select().from(programs).where(eq(programs.id, programaA));
    expect(p.comisionPorcentaje).toBe("10.04");
    expect(await bitacora()).toBe(antes);
  });
});

describe("la tab en la navegación", () => {
  it("la ven closer, gerente y developer en el programa elegido", () => {
    for (const rol of ["closer", "gerente", "developer"] as const) {
      expect(navParaRol(rol, "a").map((i) => i.href)).toContain("/p/a/programa");
    }
    expect(navParaRol("closer", null).map((i) => i.href)).not.toContain("/p/a/programa");
  });

  it("cambiar de programa desde la ficha se queda en la ficha", () => {
    expect(rutaAlCambiarDePrograma("/p/a/programa", "b")).toBe("/p/b/programa");
  });
});
