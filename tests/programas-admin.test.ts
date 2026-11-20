import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
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
  crearCohorte,
  editarCohorte,
  esquemaCohorte,
  listarCohortes,
} from "@/lib/catalogo/cohortes";
import {
  activarFuente,
  crearFuente,
  marcarFuentePrincipal,
  rotarSecretoDeFuente,
} from "@/lib/catalogo/fuentes";
import { programasActivos } from "@/lib/queries/programas";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { guardarIntegracion, tokenCalendly } from "@/lib/integraciones";
import { conectarCalendly, type FetchConCuerpo } from "@/lib/calendly/suscripcion";

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
let vaciar: () => Promise<void>;
let gerenteId: string;

beforeAll(async () => {
  ({ db, cerrar, vaciar } = await crearBaseReutilizable());
});

beforeEach(async () => {
  await vaciar();
  // change_log.userId es FK a users: insertamos un gerente de prueba, como en los
  // demas tests de base.
  const [g] = await db
    .insert(users)
    .values({ email: "gerente@retiagrowth.com", rol: "gerente", nombre: "Gerencia" })
    .returning();
  gerenteId = g.id;
});

afterAll(async () => {
  await cerrar();
});

async function logDe(registroId: string) {
  return db.select().from(changeLog).where(eq(changeLog.registroId, registroId));
}

async function conectarCalendlyPrueba(base: Db, actorId: string, programId: string, token: string) {
  return guardarIntegracion(base, actorId, programId, "calendly", token, async () =>
    Response.json({ resource: { current_organization: "https://api.calendly.com/organizations/prueba" } }),
  );
}

/** La API de Calendly simulada para crear la suscripción del webhook: ningún test la toca. */
const calendlySimulado: FetchConCuerpo = async (url, init) => {
  const method = init?.method ?? "GET";
  const ok = (json: unknown, status = 200) => ({ ok: status < 300, status, json: async () => json });
  if (url.endsWith("/users/me")) {
    return ok({ resource: { current_organization: "https://api.calendly.com/organizations/prueba" } });
  }
  if (method === "GET" && url.includes("/webhook_subscriptions")) {
    return ok({ collection: [], pagination: { next_page: null } });
  }
  if (method === "POST") return ok({ resource: {} }, 201);
  return ok({}, 404);
};

/**
 * El paso Calendly completo (token y avisos en vivo), como lo deja la app al guardar el token:
 * desde onboarding-calendly el paso exige las dos cosas para activar.
 */
async function conectarCalendlyCompleto(base: Db, actorId: string, programId: string, token: string) {
  await conectarCalendlyPrueba(base, actorId, programId, token);
  await conectarCalendly(base, actorId, programId, { urlBase: "https://crm.retia.co", fetch: calendlySimulado });
}

const programaValido = {
  nombre: "Programa Alfa",
  slug: "programa-alfa",
  ticketUsd: "797.00",
  webUrl: "https://retia.co/alfa",
  calendlyUrl: "https://calendly.com/retia/alfa",
};

/** Una fuente webhook activa del programa, con URL publica, por el camino de la app. */
async function fuenteActiva(base: Db, actorId: string, programId: string, nombre = "Formulario") {
  const actor = { id: actorId, rol: "gerente" as const };
  const fuente = await crearFuente(base, actor, {
    programId,
    nombre,
    tipo: "webhook",
    proveedor: "typeform",
    urlPublica: "https://form.typeform.com/to/alfa",
  });
  await rotarSecretoDeFuente(base, actor, fuente.id);
  await activarFuente(base, actor, fuente.id);
  return fuente;
}

/** Le da al programa una fuente principal (ADR 0068). */
async function darFuentePrincipal(base: Db, actorId: string, programId: string) {
  const fuente = await fuenteActiva(base, actorId, programId);
  await marcarFuentePrincipal(base, { id: actorId, rol: "gerente" }, fuente.id);
}

/**
 * Crea un programa y lo deja ACTIVO. La reja (ADR 0057 y 0068) exige Calendly (token y
 * webhook) y fuente principal, y `crearPrograma` nace inactivo (el token no viaja por el
 * alta): este helper conecta Calendly, le da una fuente principal y reactiva. Devuelve la
 * fila ya activa.
 */
async function crearProgramaActivo(
  base: Db,
  actorId: string,
  input: typeof programaValido = programaValido,
) {
  const creado = await crearPrograma(base, actorId, input);
  await conectarCalendlyCompleto(base, actorId, creado.id, "tok-calendly-de-prueba");
  await darFuentePrincipal(base, actorId, creado.id);
  return reactivarPrograma(base, actorId, creado.id);
}

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

  it("el esquema ya no lleva la URL del formulario: sale de la fuente principal (ADR 0068)", () => {
    const datos = esquemaPrograma.parse({ ...programaValido, formUrl: "https://form.co/x" });
    expect(datos).not.toHaveProperty("formUrl");
  });

  it("rechaza una url invalida", () => {
    expect(
      esquemaPrograma.safeParse({ ...programaValido, webUrl: "no-es-url" }).success,
    ).toBe(false);
  });
});

describe("la reja de activación (ADR 0057 y 0068)", () => {
  it("reactivar sin fuente principal ni token es 422 y la fila no se mueve", async () => {
    // Nace inactivo, sin token y sin fuentes.
    const creado = await crearPrograma(db, gerenteId, programaValido);
    expect(creado.activo).toBe(false);
    const logAntes = await logDe(creado.id);

    const error = await reactivarPrograma(db, gerenteId, creado.id).catch((e) => e);
    expect(error).toBeInstanceOf(ErrorDeApp);
    expect((error as ErrorDeApp).status).toBe(422);
    const msg = (error as ErrorDeApp).message.toLowerCase();
    expect(msg).toContain("formulario principal");
    expect(msg).toContain("calendly");

    // La fila sigue inactiva y no se escribió nada nuevo en change_log.
    const [enBase] = await db.select().from(programs).where(eq(programs.id, creado.id));
    expect(enBase.activo).toBe(false);
    const logDespues = await logDe(creado.id);
    expect(logDespues.length).toBe(logAntes.length);
  });

  it("reactivar con fuente principal pero sin token es 422 y nombra solo Calendly", async () => {
    const creado = await crearPrograma(db, gerenteId, programaValido);
    await darFuentePrincipal(db, gerenteId, creado.id);
    const error = await reactivarPrograma(db, gerenteId, creado.id).catch((e) => e);
    expect(error).toBeInstanceOf(ErrorDeApp);
    expect((error as ErrorDeApp).status).toBe(422);
    const msg = (error as ErrorDeApp).message.toLowerCase();
    expect(msg).toContain("calendly");
    expect(msg).not.toContain("formulario principal");
  });

  it("con fuente principal y token pero sin webhook, reactivar es 422 y nombra Calendly", async () => {
    const creado = await crearPrograma(db, gerenteId, programaValido);
    await darFuentePrincipal(db, gerenteId, creado.id);
    await conectarCalendlyPrueba(db, gerenteId, creado.id, "tok");
    const error = await reactivarPrograma(db, gerenteId, creado.id).catch((e) => e);
    expect(error).toBeInstanceOf(ErrorDeApp);
    expect((error as ErrorDeApp).status).toBe(422);
    expect((error as ErrorDeApp).message.toLowerCase()).toContain("calendly");
    const [enBase] = await db.select().from(programs).where(eq(programs.id, creado.id));
    expect(enBase.activo).toBe(false);
  });

  it("con Calendly y una fuente activa que NO es principal, reactivar es 422 y no se mueve", async () => {
    const creado = await crearPrograma(db, gerenteId, programaValido);
    await conectarCalendlyCompleto(db, gerenteId, creado.id, "tok");
    await fuenteActiva(db, gerenteId, creado.id, "Sin marcar");
    const error = await reactivarPrograma(db, gerenteId, creado.id).catch((e) => e);
    expect(error).toBeInstanceOf(ErrorDeApp);
    expect((error as ErrorDeApp).status).toBe(422);
    const msg = (error as ErrorDeApp).message.toLowerCase();
    expect(msg).toContain("formulario principal");
    expect(msg).not.toContain("calendly");
    const [enBase] = await db.select().from(programs).where(eq(programs.id, creado.id));
    expect(enBase.activo).toBe(false);
  });

  it("la principal de OTRO programa no cuenta", async () => {
    const otro = await crearPrograma(db, gerenteId, { ...programaValido, slug: "otro" });
    await darFuentePrincipal(db, gerenteId, otro.id);
    const creado = await crearPrograma(db, gerenteId, programaValido);
    await conectarCalendlyCompleto(db, gerenteId, creado.id, "tok");
    const logAntes = await logDe(creado.id);
    const error = await reactivarPrograma(db, gerenteId, creado.id).catch((e) => e);
    expect((error as ErrorDeApp).status).toBe(422);
    const [enBase] = await db.select().from(programs).where(eq(programs.id, creado.id));
    expect(enBase.activo).toBe(false);
    expect((await logDe(creado.id)).length).toBe(logAntes.length);
  });

  it("con fuente principal y Calendly conectado, reactivar activa el programa", async () => {
    const activo = await crearProgramaActivo(db, gerenteId);
    expect(activo.activo).toBe(true);
  });

  it("crear un programa lo deja inactivo (el token no viaja por el alta)", async () => {
    const creado = await crearPrograma(db, gerenteId, programaValido);
    expect(creado.activo).toBe(false);
  });
});

describe("la integración de Calendly", () => {
  it("guarda el token pero listarProgramas no lo devuelve", async () => {
    const creado = await crearPrograma(db, gerenteId, programaValido);
    const secreto = "token-super-secreto-de-calendly";
    await conectarCalendlyPrueba(db, gerenteId, creado.id, secreto);

    expect(await tokenCalendly(db, creado.id)).toBe(secreto);

    // Pero ninguna lectura del catálogo lo devuelve: solo el booleano.
    const lista = await listarProgramas(db);
    expect(JSON.stringify(lista)).not.toContain(secreto);
    const vista = lista.find((p) => p.id === creado.id)!;
    expect(vista.tieneTokenCalendly).toBe(true);
  });

  it("un programa sin token reporta tieneTokenCalendly=false", async () => {
    const creado = await crearPrograma(db, gerenteId, programaValido);
    const lista = await listarProgramas(db);
    expect(lista.find((p) => p.id === creado.id)!.tieneTokenCalendly).toBe(false);
  });

  it("el token NUNCA aparece en change_log, pero el cambio sí queda", async () => {
    const creado = await crearPrograma(db, gerenteId, programaValido);
    const secreto = "otro-token-secreto";
    await conectarCalendlyPrueba(db, gerenteId, creado.id, secreto);
    const log = (await db.select().from(changeLog)).filter((fila) => fila.tabla === "integraciones");
    expect(JSON.stringify(log)).not.toContain(secreto);
    const fila = log.find((l) => l.campo === "secretos.token");
    expect(fila).toMatchObject({ valorNuevo: "(oculto)", userId: gerenteId });
    // El primer guardado no tenía token previo: valorAnterior es null.
    expect(fila!.valorAnterior).toBeNull();
  });

  it("reemplazar el token deja valorAnterior oculto (no el valor viejo)", async () => {
    const creado = await crearPrograma(db, gerenteId, programaValido);
    await conectarCalendlyPrueba(db, gerenteId, creado.id, "viejo");
    await conectarCalendlyPrueba(db, gerenteId, creado.id, "nuevo");
    const filas = (await db.select().from(changeLog)).filter((l) => l.campo === "secretos.token");
    expect(filas.length).toBe(2);
    expect(JSON.stringify(filas)).not.toContain("viejo");
    expect(JSON.stringify(filas)).not.toContain("nuevo");
    expect(filas[1]).toMatchObject({ valorAnterior: "(oculto)", valorNuevo: "(oculto)" });
  });

  it("un token vacío es 400 y no toca la base", async () => {
    const creado = await crearPrograma(db, gerenteId, programaValido);
    const error = await conectarCalendlyPrueba(db, gerenteId, creado.id, "   ").catch((e) => e);
    expect(error).toBeInstanceOf(ErrorDeApp);
    expect((error as ErrorDeApp).status).toBe(400);
    expect(await tokenCalendly(db, creado.id)).toBeNull();
  });

  it("guardar el token de un id que no existe es 404", async () => {
    const error = await conectarCalendlyPrueba(
      db,
      gerenteId,
      "00000000-0000-0000-0000-000000000000",
      "x",
    ).catch((e) => e);
    expect(error).toBeInstanceOf(ErrorDeApp);
    expect((error as ErrorDeApp).status).toBe(404);
  });
});

describe("crear programa", () => {
  it("crea un programa (inactivo hasta cargar token) y deja change_log con origen app y userId", async () => {
    // ADR 0057: sin token no puede quedar activo, y el token no viaja por el alta.
    const creado = await crearPrograma(db, gerenteId, programaValido);
    expect(creado.slug).toBe("programa-alfa");
    expect(creado.activo).toBe(false);

    const log = await logDe(creado.id);
    expect(log.length).toBeGreaterThan(0);
    expect(log.every((l) => l.origen === "app")).toBe(true);
    expect(log.every((l) => l.userId === gerenteId)).toBe(true);
    expect(log.some((l) => l.campo === "slug" && l.valorNuevo === "programa-alfa")).toBe(true);
  });

  it("con token y fuente principal se reactiva y aparece en los programas activos del sidebar", async () => {
    await crearProgramaActivo(db, gerenteId);
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
    const creado = await crearProgramaActivo(db, gerenteId);
    await crearCohorte(db, gerenteId, {
      programId: creado.id,
      codigo: "C1",
      metaCupos: 30,
      metaLeadsDia: 10,
      precioUsd: "797.00",
      fechaInicioClases: "2026-08-11",
      fechaInicioVentas: "2026-08-11",
      fechaCierreVentas: "2026-08-11",
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
    const creado = await crearProgramaActivo(db, gerenteId);
    await desactivarPrograma(db, gerenteId, creado.id);
    await reactivarPrograma(db, gerenteId, creado.id);
    const activos = await programasActivos(db);
    expect(activos.some((p) => p.id === creado.id)).toBe(true);
  });
});

describe("listar programas", () => {
  it("devuelve activos e inactivos", async () => {
    const a = await crearProgramaActivo(db, gerenteId);
    const b = await crearProgramaActivo(db, gerenteId, {
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

  // ADR 0137 punto 5: sin inicio de ventas la cohorte queda futura por definición.
  it("una cohorte por definir SIN inicio de ventas valida", () => {
    const res = esquemaCohorte.safeParse({
      ...sinInicioVentas(),
      programId: "00000000-0000-0000-0000-000000000000",
    });
    expect(res.success).toBe(true);
  });

  it("una cohorte con inicio de ventas valida y normaliza la fecha", () => {
    const res = esquemaCohorte.safeParse({
      ...cohorteBase,
      programId: "00000000-0000-0000-0000-000000000000",
      fechaInicioVentas: "2026-08-14",
      fechaCierreVentas: "2026-09-21",
    });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.fechaInicioVentas).toBe("2026-08-14");
  });

  it("una cohorte por definir puede quedar sin inicio de ventas", () => {
    const cerrada = esquemaCohorte.safeParse({
      ...sinInicioVentas(),
      programId: "00000000-0000-0000-0000-000000000000",
    });
    expect(cerrada.success).toBe(true);
    if (cerrada.success) expect(cerrada.data.fechaInicioVentas).toBeNull();
  });

  it("el cierre de ventas anterior al inicio no valida", () => {
    const res = esquemaCohorte.safeParse({
      ...cohorteBase,
      programId: "00000000-0000-0000-0000-000000000000",
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

  it("dos programas distintos pueden tener cada uno su cohorte activa", async () => {
    const otro = await crearPrograma(db, gerenteId, {
      ...programaValido,
      nombre: "Beta",
      slug: "beta",
    });
    await crearCohorte(db, gerenteId, { ...cohorteBase, codigo: "C1", programId });
    const okOtro = await crearCohorte(db, gerenteId, {
      ...cohorteBase,
      codigo: "C1",
      programId: otro.id,
    });
    expect(okOtro.programId).toBe(otro.id);
  });

  it("editar una cohorte registra los campos que cambian", async () => {
    const c1 = await crearCohorte(db, gerenteId, { ...cohorteBase, programId });
    await editarCohorte(db, gerenteId, c1.id, { ...cohorteBase, programId, metaCupos: 50 });
    const log = await logDe(c1.id);
    expect(log.some((l) => l.campo === "metaCupos" && l.valorNuevo === "50")).toBe(true);
  });

  it("un id que no es uuid es un 400", async () => {
    const error = await editarCohorte(db, gerenteId, "no-uuid", { ...cohorteBase, programId }).catch((e) => e);
    expect(error).toBeInstanceOf(ErrorDeApp);
    expect((error as ErrorDeApp).status).toBe(400);
  });

});

describe("activar un programa (ADR 0057, enmendado por el 0068 y el 0095)", () => {
  it("un programa nace inactivo por default; la reja de activación vive en el catálogo", async () => {
    const [p] = await db
      .insert(programs)
      .values({ slug: "default", nombre: "Default", ticketUsd: "100" })
      .returning();
    expect(p!.activo).toBe(false);
    await expect(reactivarPrograma(db, gerenteId, p!.id)).rejects.toMatchObject({ status: 422 });
  });
});
