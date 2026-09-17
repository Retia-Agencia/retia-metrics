import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { changeLog, cohorts, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import {
  crearPrograma,
  desactivarPrograma,
  editarPrograma,
  esquemaPrograma,
  listarProgramas,
  reactivarPrograma,
} from "@/lib/catalogo/programas";
import {
  activarCohorte,
  crearCohorte,
  desactivarCohorte,
  editarCohorte,
  esquemaCohorte,
  listarCohortes,
} from "@/lib/catalogo/cohortes";
import { programasActivos, programasActivosParaAsignar } from "@/lib/queries/programas";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";

/**
 * Ticket 014 — administrar programas y cohortes desde /ajustes.
 *
 * Programas y cohortes son instancias del molde (ADR 0012): tabla con `activo`, un
 * solo esquema zod, y cada cambio a `change_log`. Nunca se borran, se desactivan.
 * Dos reglas de negocio propias que el molde no expresa y se prueban aca:
 *  - El slug de un programa no se puede editar despues de creado (400).
 *  - Maximo una cohorte activa por programa: lo garantiza un indice unico PARCIAL
 *    en la base (ADR 0005), y el segundo intento sale como un 400 claro en español.
 *
 * Base PGlite nueva por test: cada caso mira `change_log` y conteos.
 */

let db: Db;
let cerrar: () => Promise<void>;
let gerenteId: string;

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  // change_log.userId es FK a users: insertamos un gerente de prueba, como en los
  // demas tests de base.
  const [g] = await db
    .insert(users)
    .values({ email: "gerente@retiagrowth.com", rol: "gerente", nombre: "Gerencia" })
    .returning();
  gerenteId = g.id;
});

afterEach(async () => {
  await cerrar();
});

async function logDe(registroId: string) {
  return db.select().from(changeLog).where(eq(changeLog.registroId, registroId));
}

const programaValido = {
  nombre: "Programa Alfa",
  slug: "programa-alfa",
  ticketUsd: "797.00",
  webUrl: "https://retia.co/alfa",
  calendlyUrl: "https://calendly.com/retia/alfa",
};

describe("esquema de programa", () => {
  it("acepta un programa valido", () => {
    const datos = esquemaPrograma.parse(programaValido);
    expect(datos.slug).toBe("programa-alfa");
  });

  it("rechaza un slug con mayusculas o espacios", () => {
    expect(esquemaPrograma.safeParse({ ...programaValido, slug: "Programa Alfa" }).success).toBe(
      false,
    );
    expect(esquemaPrograma.safeParse({ ...programaValido, slug: "alfa_1" }).success).toBe(false);
  });

  it("acepta webUrl y calendlyUrl vacios (opcionales)", () => {
    const datos = esquemaPrograma.parse({
      nombre: "Sin urls",
      slug: "sin-urls",
      ticketUsd: "100",
      webUrl: "",
      calendlyUrl: "",
    });
    expect(datos.webUrl).toBeNull();
    expect(datos.calendlyUrl).toBeNull();
  });

  it("rechaza una url invalida", () => {
    expect(
      esquemaPrograma.safeParse({ ...programaValido, webUrl: "no-es-url" }).success,
    ).toBe(false);
  });
});

describe("crear programa", () => {
  it("crea un programa y deja change_log con origen app y userId", async () => {
    const creado = await crearPrograma(db, gerenteId, programaValido);
    expect(creado.slug).toBe("programa-alfa");
    expect(creado.activo).toBe(true);

    const log = await logDe(creado.id);
    expect(log.length).toBeGreaterThan(0);
    expect(log.every((l) => l.origen === "app")).toBe(true);
    expect(log.every((l) => l.userId === gerenteId)).toBe(true);
    expect(log.some((l) => l.campo === "slug" && l.valorNuevo === "programa-alfa")).toBe(true);
  });

  it("aparece en la query de programas activos que usa el sidebar", async () => {
    await crearPrograma(db, gerenteId, programaValido);
    const activos = await programasActivos(db);
    expect(activos.some((p) => p.slug === "programa-alfa")).toBe(true);
  });

  it("rechaza un slug invalido con 400", async () => {
    const error = await crearPrograma(db, gerenteId, {
      ...programaValido,
      slug: "Mayusculas",
    }).catch((e) => e);
    expect(error).toBeInstanceOf(ErrorDeApp);
    expect((error as ErrorDeApp).status).toBe(400);
  });
});

describe("editar programa", () => {
  it("editar cambiando el slug es un 400 con mensaje claro", async () => {
    const creado = await crearPrograma(db, gerenteId, programaValido);
    const error = await editarPrograma(db, gerenteId, creado.id, {
      ...programaValido,
      slug: "otro-slug",
    }).catch((e) => e);
    expect(error).toBeInstanceOf(ErrorDeApp);
    expect((error as ErrorDeApp).status).toBe(400);
    expect((error as ErrorDeApp).message.toLowerCase()).toContain("slug");
    // El slug en base no cambio.
    const [enBase] = await db.select().from(programs).where(eq(programs.id, creado.id));
    expect(enBase.slug).toBe("programa-alfa");
  });

  it("editar el nombre conservando el slug funciona y registra el cambio", async () => {
    const creado = await crearPrograma(db, gerenteId, programaValido);
    const editado = await editarPrograma(db, gerenteId, creado.id, {
      ...programaValido,
      nombre: "Programa Alfa Renombrado",
    });
    expect(editado.nombre).toBe("Programa Alfa Renombrado");
    const log = await logDe(creado.id);
    expect(log.some((l) => l.campo === "nombre" && l.valorNuevo === "Programa Alfa Renombrado")).toBe(
      true,
    );
  });

  it("un id que no es uuid es un 400", async () => {
    const error = await editarPrograma(db, gerenteId, "no-es-uuid", programaValido).catch((e) => e);
    expect(error).toBeInstanceOf(ErrorDeApp);
    expect((error as ErrorDeApp).status).toBe(400);
  });
});

describe("desactivar y reactivar programa", () => {
  it("desactivar lo saca de los activos pero conserva su fila y sus cohortes", async () => {
    const creado = await crearPrograma(db, gerenteId, programaValido);
    await crearCohorte(db, gerenteId, {
      programId: creado.id,
      codigo: "C1",
      metaCupos: 30,
      metaLeadsDia: 10,
      precioUsd: "797.00",
      fechaInicioClases: "2026-08-11",
      fechaInicioVentas: "2026-08-11",
      fechaCierreVentas: "2026-08-11",
      trmCohorte: "4000",
      estado: "activo",
    });

    await desactivarPrograma(db, gerenteId, creado.id);

    // Fuera del sidebar.
    const activos = await programasActivos(db);
    expect(activos.some((p) => p.slug === "programa-alfa")).toBe(false);
    // La fila sigue en base.
    const [enBase] = await db.select().from(programs).where(eq(programs.id, creado.id));
    expect(enBase).toBeDefined();
    expect(enBase.activo).toBe(false);
    // Sus cohortes siguen ahi.
    const suyas = await db.select().from(cohorts).where(eq(cohorts.programId, creado.id));
    expect(suyas).toHaveLength(1);
  });

  it("reactivar lo devuelve a los activos", async () => {
    const creado = await crearPrograma(db, gerenteId, programaValido);
    await desactivarPrograma(db, gerenteId, creado.id);
    await reactivarPrograma(db, gerenteId, creado.id);
    const activos = await programasActivosParaAsignar(db);
    expect(activos.some((p) => p.id === creado.id)).toBe(true);
  });
});

describe("listar programas", () => {
  it("devuelve activos e inactivos", async () => {
    const a = await crearPrograma(db, gerenteId, programaValido);
    const b = await crearPrograma(db, gerenteId, {
      ...programaValido,
      nombre: "Beta",
      slug: "beta",
    });
    await desactivarPrograma(db, gerenteId, b.id);
    const lista = await listarProgramas(db);
    expect(lista.find((p) => p.id === a.id)!.activo).toBe(true);
    expect(lista.find((p) => p.id === b.id)!.activo).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────── cohortes

const cohorteBase = {
  codigo: "C1",
  metaCupos: 30,
  metaLeadsDia: 12,
  precioUsd: "797.00",
  fechaInicioClases: "2026-08-11",
  fechaInicioVentas: "2026-08-11",
  fechaCierreVentas: "2026-08-11",
  trmCohorte: "4000",
  estado: "futuro" as const,
};

/** `cohorteBase` sin `fechaInicioVentas`, para probar la regla del ADR 0022. */
function sinInicioVentas() {
  const copia = { ...cohorteBase };
  delete (copia as Partial<typeof cohorteBase>).fechaInicioVentas;
  return copia;
}

describe("esquema de cohorte", () => {
  it("acepta una cohorte valida", () => {
    const datos = esquemaCohorte.parse({
      ...cohorteBase,
      programId: "00000000-0000-0000-0000-000000000000",
    });
    expect(datos.codigo).toBe("C1");
  });

  it("rechaza un programId que no es uuid", () => {
    expect(
      esquemaCohorte.safeParse({ ...cohorteBase, programId: "no-uuid" }).success,
    ).toBe(false);
  });

  it("rechaza un estado fuera del enum", () => {
    expect(
      esquemaCohorte.safeParse({
        ...cohorteBase,
        programId: "00000000-0000-0000-0000-000000000000",
        estado: "inventado",
      }).success,
    ).toBe(false);
  });

  // ADR 0022: la ventana de venta es dato por cohorte. El inicio es opcional para
  // cohortes cerradas o futuras, pero OBLIGATORIO cuando el estado es activo.
  it("una cohorte activa SIN inicio de ventas no valida (ADR 0022)", () => {
    const res = esquemaCohorte.safeParse({
      ...sinInicioVentas(),
      programId: "00000000-0000-0000-0000-000000000000",
      estado: "activo",
    });
    expect(res.success).toBe(false);
  });

  it("una cohorte activa CON inicio de ventas valida y normaliza la fecha", () => {
    const res = esquemaCohorte.safeParse({
      ...cohorteBase,
      programId: "00000000-0000-0000-0000-000000000000",
      estado: "activo",
      fechaInicioVentas: "2026-08-14",
      fechaCierreVentas: "2026-09-21",
    });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.fechaInicioVentas).toBe("2026-08-14");
  });

  it("una cohorte cerrada o futura puede quedar sin inicio de ventas (las dos C1)", () => {
    const cerrada = esquemaCohorte.safeParse({
      ...sinInicioVentas(),
      programId: "00000000-0000-0000-0000-000000000000",
      estado: "cerrado",
    });
    expect(cerrada.success).toBe(true);
    if (cerrada.success) expect(cerrada.data.fechaInicioVentas).toBeNull();
  });

  it("el cierre de ventas anterior al inicio no valida", () => {
    const res = esquemaCohorte.safeParse({
      ...cohorteBase,
      programId: "00000000-0000-0000-0000-000000000000",
      estado: "activo",
      fechaInicioVentas: "2026-09-21",
      fechaCierreVentas: "2026-08-14",
    });
    expect(res.success).toBe(false);
  });
});

describe("cohortes de un programa", () => {
  let programId: string;

  beforeEach(async () => {
    const p = await crearPrograma(db, gerenteId, programaValido);
    programId = p.id;
  });

  it("crea una cohorte y la lista solo bajo su programa", async () => {
    const creada = await crearCohorte(db, gerenteId, { ...cohorteBase, programId });
    expect(creada.codigo).toBe("C1");
    const lista = await listarCohortes(db, programId);
    expect(lista.map((c) => c.id)).toContain(creada.id);
  });

  it("crear deja change_log con origen app y userId", async () => {
    const creada = await crearCohorte(db, gerenteId, { ...cohorteBase, programId });
    const log = await logDe(creada.id);
    expect(log.length).toBeGreaterThan(0);
    expect(log.every((l) => l.origen === "app")).toBe(true);
    expect(log.every((l) => l.userId === gerenteId)).toBe(true);
    expect(log[0].tabla).toBe("cohorts");
  });

  it("activar una SEGUNDA cohorte en el mismo programa falla con un 400 claro", async () => {
    // La primera nace activa.
    await crearCohorte(db, gerenteId, { ...cohorteBase, codigo: "C1", estado: "activo", programId });
    // La segunda se crea futura y luego se intenta activar: choca con el indice parcial.
    const c2 = await crearCohorte(db, gerenteId, {
      ...cohorteBase,
      codigo: "C2",
      estado: "futuro",
      programId,
    });
    const error = await activarCohorte(db, gerenteId, c2.id).catch((e) => e);
    expect(error).toBeInstanceOf(ErrorDeApp);
    expect((error as ErrorDeApp).status).toBe(400);
    expect((error as ErrorDeApp).message.toLowerCase()).toContain("activa");
  });

  it("crear directamente una SEGUNDA cohorte activa tambien falla con 400", async () => {
    await crearCohorte(db, gerenteId, { ...cohorteBase, codigo: "C1", estado: "activo", programId });
    const error = await crearCohorte(db, gerenteId, {
      ...cohorteBase,
      codigo: "C2",
      estado: "activo",
      programId,
    }).catch((e) => e);
    expect(error).toBeInstanceOf(ErrorDeApp);
    expect((error as ErrorDeApp).status).toBe(400);
    expect((error as ErrorDeApp).message.toLowerCase()).toContain("activa");
  });

  it("dos programas distintos pueden tener cada uno su cohorte activa", async () => {
    const otro = await crearPrograma(db, gerenteId, {
      ...programaValido,
      nombre: "Beta",
      slug: "beta",
    });
    await crearCohorte(db, gerenteId, { ...cohorteBase, codigo: "C1", estado: "activo", programId });
    const okOtro = await crearCohorte(db, gerenteId, {
      ...cohorteBase,
      codigo: "C1",
      estado: "activo",
      programId: otro.id,
    });
    expect(okOtro.estado).toBe("activo");
  });

  it("desactivar una cohorte la pasa a estado 'cerrado' y libera el cupo de activa", async () => {
    const c1 = await crearCohorte(db, gerenteId, {
      ...cohorteBase,
      codigo: "C1",
      estado: "activo",
      programId,
    });
    await desactivarCohorte(db, gerenteId, c1.id);
    const [enBase] = await db.select().from(cohorts).where(eq(cohorts.id, c1.id));
    expect(enBase.estado).toBe("cerrado");
    // Ahora otra puede activarse en el mismo programa.
    const c2 = await crearCohorte(db, gerenteId, {
      ...cohorteBase,
      codigo: "C2",
      estado: "futuro",
      programId,
    });
    const activada = await activarCohorte(db, gerenteId, c2.id);
    expect(activada.estado).toBe("activo");
  });

  it("editar una cohorte registra los campos que cambian", async () => {
    const c1 = await crearCohorte(db, gerenteId, { ...cohorteBase, programId });
    await editarCohorte(db, gerenteId, c1.id, { ...cohorteBase, programId, metaCupos: 50 });
    const log = await logDe(c1.id);
    expect(log.some((l) => l.campo === "metaCupos" && l.valorNuevo === "50")).toBe(true);
  });

  it("un id que no es uuid es un 400", async () => {
    const error = await activarCohorte(db, gerenteId, "no-uuid").catch((e) => e);
    expect(error).toBeInstanceOf(ErrorDeApp);
    expect((error as ErrorDeApp).status).toBe(400);
  });

  // ── Ventana de venta (ADR 0022) ────────────────────────────────
  it("crear una cohorte activa sin inicio de ventas falla con 400 (zod)", async () => {
    const error = await crearCohorte(db, gerenteId, {
      ...sinInicioVentas(),
      estado: "activo",
      programId,
    }).catch((e) => e);
    expect(error).toBeInstanceOf(ErrorDeApp);
    expect((error as ErrorDeApp).status).toBe(400);
  });

  it("si la validacion se salta, el CHECK de la base rechaza y sale como 400 (23514)", async () => {
    // Se crea una cohorte futura sin inicio de ventas: pasa zod (opcional para
    // futura). Activarla no re-valida el esquema: llega directo al UPDATE y choca
    // con el CHECK cohorts_activa_con_inicio_ventas, que debe traducirse a 400.
    const futura = await crearCohorte(db, gerenteId, {
      ...sinInicioVentas(),
      codigo: "CF",
      estado: "futuro",
      programId,
    });
    const error = await activarCohorte(db, gerenteId, futura.id).catch((e) => e);
    expect(error).toBeInstanceOf(ErrorDeApp);
    expect((error as ErrorDeApp).status).toBe(400);
  });
});
