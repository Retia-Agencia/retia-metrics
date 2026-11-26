import { abonoDePrueba } from "./helpers/catalogo-de-prueba";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import {
  archivos,
  calls,
  cohorts,
  dealEtapaHistorial,
  deals,
  leads,
  miembrosPrograma,
  notificacionesCalendly,
  programs,
  sources,
  submissions,
  users,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import type { EtapaDeal, PendienteDeal } from "@/lib/deals/etapas";
import { registrarNovedadCalendly } from "@/lib/notificaciones-calendly/notificaciones";
import {
  conteoSinVer,
} from "@/lib/mi-espacio/notificaciones";
import {
  pendientesDelCloserEnPrograma,
  TIPOS_DE_PENDIENTE,
  type TipoDePendiente,
} from "@/lib/mi-espacio/pendientes";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";
import { FECHA_LEAD_DE_PRUEBA } from "./helpers/crear-lead-de-prueba";

// La ruta `/api/mi-espacio/sin-ver` lee la base por el singleton `@/lib/db` y la sesion por
// `@/lib/auth`: se controlan con holders.
const dbHolder: { db: Db | null } = { db: null };
vi.mock("@/lib/db", () => ({
  get db() {
    return dbHolder.db;
  },
}));
const sesionHolder: { rol: string | null; id: string } = { rol: null, id: "" };
vi.mock("@/lib/auth/index", () => ({
  auth: async () =>
    sesionHolder.rol ? { user: { id: sesionHolder.id, rol: sesionHolder.rol } } : null,
}));
vi.mock("@/lib/auth/vista", () => ({
  rolDeVista: async (session: { user?: { rol?: string } }) => session?.user?.rol ?? null,
  sesionEfectiva: async <T,>(session: T) => session,
}));

/**
 * Los predicados de pendientes y el distintivo del menú conservan su frontera por programa,
 * dueño y vigencia después de retirar la pestaña Notificaciones.
 */

const HOY = "2026-10-20";
const AYER = "2026-10-19";
const MANANA = "2026-10-21";

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let programId: string;
let otroProgramId: string;
let cohortId: string;
let yo: string;
let otro: string;
let sourceId: string;
let otroSourceId: string;
let leadN = 0;

beforeAll(async () => {
  ({ db, cerrar, vaciar } = await crearBaseReutilizable());
});

beforeEach(async () => {
  await vaciar();
  dbHolder.db = db;
  sesionHolder.rol = null;
  sesionHolder.id = "";
  const [p] = await db
    .insert(programs)
    .values({ ...PROGRAMA_DE_PRUEBA, slug: "p", nombre: "P", ticketUsd: "1000" })
    .returning();
  programId = p.id;
  const [p2] = await db
    .insert(programs)
    .values({ ...PROGRAMA_DE_PRUEBA, slug: "p2", nombre: "P2", ticketUsd: "1000" })
    .returning();
  otroProgramId = p2.id;
  const [s] = await db.insert(sources).values({ programId, nombre: "Typeform" }).returning();
  sourceId = s.id;
  const [s2] = await db.insert(sources).values({ programId: otroProgramId, nombre: "Typeform" }).returning();
  otroSourceId = s2.id;
  const [c] = await db
    .insert(cohorts)
    .values({
      programId,
      codigo: "C1",
      metaCupos: 10,
      precioUsd: "1000",
      fechaInicioClases: "2026-11-15",
      fechaInicioVentas: "2026-09-01",
      fechaCierreVentas: "2026-11-14",
    })
    .returning();
  cohortId = c.id;
  const [u1] = await db.insert(users).values({ email: "yo@retia.co", rol: "closer", closerId: "yo", nombre: "Yo" }).returning();
  const [u2] = await db.insert(users).values({ email: "otro@retia.co", rol: "closer", closerId: "otro", nombre: "Otro" }).returning();
  yo = u1.id;
  otro = u2.id;
});

afterEach(async () => {
  dbHolder.db = null;
});

afterAll(async () => {
  await cerrar();
});

interface OpcDeal {
  etapa: EtapaDeal;
  pendiente?: PendienteDeal | null;
  owner?: string;
  programa?: string;
  source?: string;
  fechaSeguimiento?: string | null;
  fechaLimitePago?: string | null;
  nuevo?: boolean;
  creado?: string;
}

async function deal(o: OpcDeal): Promise<{ dealId: string; leadId: string }> {
  const prog = o.programa ?? programId;
  const src = o.source ?? (prog === programId ? sourceId : otroSourceId);
  const [l] = await db
    .insert(leads)
    .values({
      fechaPrimeraAplicacion: FECHA_LEAD_DE_PRUEBA,
      programId: prog,
      emailNormalizado: `l${++leadN}@correo.co`,
      nombre: `Lead ${leadN}`,
      numAplicaciones: 1,
    })
    .returning();
  const [env] = await db
    .insert(submissions)
    .values({ leadId: l.id, sourceId: src, token: `t${leadN}`, utmSource: "meta", utmMedium: "cpc" })
    .returning();
  const [d] = await db
    .insert(deals)
    .values({
      leadId: l.id,
      submissionOrigenId: env.id,
      programId: prog,
      cohortId: prog === programId ? cohortId : null,
      etapa: o.etapa,
      pendiente: o.pendiente ?? null,
      cohorteDestinoTexto: o.pendiente === "proxima_cohorte" ? "2027" : null,
      ownerUserId: o.owner ?? yo,
      ownerNovedadEn: o.nuevo ? new Date("2026-10-20T12:00:00Z") : null,
      valorVendidoUsd: "1000.00",
      fechaSeguimiento: o.fechaSeguimiento ?? null,
      fechaLimitePago: o.fechaLimitePago ?? null,
      ...(o.creado ? { createdAt: new Date(o.creado) } : {}),
    })
    .returning();
  const fecha = new Date(`${o.creado ? o.creado.slice(0, 10) : HOY}T12:00:00-05:00`);
  await db.insert(dealEtapaHistorial).values({ dealId: d.id, de: null, a: o.etapa, fecha });
  return { dealId: d.id, leadId: l.id };
}

/** Una llamada vigente (o anulada) colgada de un deal, con su día de Bogotá. */
async function llamada(dealId: string, dia: string, prog = programId, anulada = false): Promise<string> {
  const [c] = await db
    .insert(calls)
    .values({
      dealId,
      programId: prog,
      fechaLlamada: new Date(`${dia}T12:00:00-05:00`),
      resultado: "show",
      ...(anulada ? { anuladoEn: new Date(), anuladoPor: yo, motivoAnulacion: "error" } : {}),
    })
    .returning();
  return c.id;
}

async function dealId(o: OpcDeal): Promise<string> {
  return (await deal(o)).dealId;
}

async function todas(tipo: TipoDePendiente, userId = yo): Promise<string[]> {
  const resultado = await pendientesDelCloserEnPrograma(db, {
    programId,
    userId,
    dia: HOY,
    ahora: new Date(`${HOY}T18:00:00-05:00`),
  });
  return resultado.filas.filter((fila) => fila.tipo === tipo).map((fila) => fila.dealId);
}

describe("notificaciones de Mi espacio (222)", () => {
  it("reagenda y seguimiento conservan el predicado central", async () => {
    const r = await dealId({ etapa: "contactado", pendiente: "reagenda", fechaSeguimiento: MANANA });
    const s = await dealId({ etapa: "atendido", pendiente: "seguimiento", fechaSeguimiento: MANANA });
    await dealId({ etapa: "potencial" });

    expect(await todas("reagenda")).toEqual([r]);
    expect(await todas("seguimiento")).toEqual([s]);
  });

  it("vencidos: seguimiento vencido o compromiso/cartera vencidos (avisos de la tarjeta)", async () => {
    const segVencido = await dealId({ etapa: "atendido", pendiente: "seguimiento", fechaSeguimiento: AYER });
    const compromisoVencido = await dealId({ etapa: "compromiso_verbal", fechaLimitePago: AYER });
    await dealId({ etapa: "atendido", pendiente: "seguimiento", fechaSeguimiento: MANANA });

    const ids = await todas("vencidos");
    expect(new Set(ids)).toEqual(new Set([segVencido, compromisoVencido]));
  });

  it("sin_comprobante: exige abono vigente sin URL ni archivo y ordena por el más antiguo", async () => {
    const antiguo = await deal({ etapa: "atendido" });
    const reciente = await deal({ etapa: "atendido" });
    const anulado = await deal({ etapa: "atendido" });
    const conArchivo = await deal({ etapa: "atendido" });
    const [archivo] = await db.insert(archivos).values({
      programId,
      ruta: "comprobantes/428.png",
      tipoMime: "image/png",
      bytes: 8,
      subidoPorUserId: yo,
    }).returning();
    await abonoDePrueba(db, [
      { dealId: antiguo.dealId, programId, fecha: "2026-10-01", monto: "100", moneda: "USD" },
      { dealId: reciente.dealId, programId, fecha: "2026-10-18", monto: "100", moneda: "USD" },
      { dealId: anulado.dealId, programId, fecha: "2026-09-01", monto: "100", moneda: "USD", anuladoEn: new Date(), anuladoPor: yo, motivoAnulacion: "Error" },
      { dealId: conArchivo.dealId, programId, fecha: "2026-09-01", monto: "100", moneda: "USD", comprobanteArchivoId: archivo.id },
    ]);

    expect(await todas("sin_comprobante")).toEqual([antiguo.dealId, reciente.dealId]);
  });

  it("sin_grain: un Show sin link entra; con link, anulado o de otro dueño no (226)", async () => {
    const sinGrain = await deal({ etapa: "atendido" });
    await llamada(sinGrain.dealId, AYER);
    const conGrain = await deal({ etapa: "atendido" });
    const idConGrain = await llamada(conGrain.dealId, AYER);
    await db.update(calls).set({ linkGrain: "https://grain.com/share/x" }).where(eq(calls.id, idConGrain));
    const anulada = await deal({ etapa: "atendido" });
    await llamada(anulada.dealId, AYER, programId, true);
    const ajeno = await deal({ etapa: "atendido", owner: otro });
    await llamada(ajeno.dealId, AYER);

    const lista = await todas("sin_grain");
    expect(lista).toContain(sinGrain.dealId);
    expect(lista).not.toContain(conGrain.dealId);
    expect(lista).not.toContain(anulada.dealId);
    expect(lista).not.toContain(ajeno.dealId);
  });

  it("sin_resultado: la cita pasada agendada del deal abierto entra; la marcada, la futura, la anulada y la de otro dueño no (390)", async () => {
    const hora = async (d: { dealId: string }, dia: string, resultado: string, anulada = false, prog = programId) => {
      await db.insert(calls).values({
        dealId: d.dealId, programId: prog, fechaAgenda: new Date(`${dia}T12:00:00-05:00`), fechaLlamada: new Date(`${dia}T12:00:00-05:00`),
        resultado: resultado as "agendada" | "show",
        ...(anulada ? { anuladoEn: new Date(), anuladoPor: yo, motivoAnulacion: "error" } : {}),
      });
    };
    const porMarcar = await deal({ etapa: "contactado" });
    await hora(porMarcar, AYER, "agendada");
    const marcada = await deal({ etapa: "contactado" });
    await hora(marcada, AYER, "show");
    const futura = await deal({ etapa: "contactado" });
    await hora(futura, "2099-01-01", "agendada");
    const anulada = await deal({ etapa: "contactado" });
    await hora(anulada, AYER, "agendada", true);
    const ajeno = await deal({ etapa: "contactado", owner: otro });
    await hora(ajeno, AYER, "agendada");

    expect(await todas("sin_resultado")).toEqual([porMarcar.dealId]);
  });

  it("nuevos: solo los que el dueño no ha abierto", async () => {
    const nuevo = await dealId({ etapa: "registrado", nuevo: true });
    await dealId({ etapa: "registrado", nuevo: false });
    expect(await todas("nuevos")).toEqual([nuevo]);
  });

  it("calendly: deals con novedad del usuario+programa, leídas o no", async () => {
    const conNovedad = await deal({ etapa: "agendado" });
    const callId = await llamada(conNovedad.dealId, HOY);
    const ok = await registrarNovedadCalendly(db, {
      programId,
      dealId: conNovedad.dealId,
      callId,
      tipo: "cita_nueva",
      claveEvento: "ev-1",
    });
    expect(ok).toBe(true);
    await deal({ etapa: "agendado" });

    expect(await todas("calendly")).toEqual([conNovedad.dealId]);
  });

  it("el builder devuelve una fila por deal y tipo", async () => {
    // Un surtido que cae en varios chips.
    const d1 = await deal({ etapa: "atendido", pendiente: "seguimiento", fechaSeguimiento: HOY });
    await llamada(d1.dealId, HOY);
    await dealId({ etapa: "contactado", pendiente: "reagenda", fechaSeguimiento: AYER });
    await dealId({ etapa: "registrado", nuevo: true });

    const resultado = await pendientesDelCloserEnPrograma(db, {
      programId, userId: yo, dia: HOY, ahora: new Date(`${HOY}T18:00:00-05:00`),
    });
    const llaves = resultado.filas.map((fila) => `${fila.dealId}:${fila.tipo}`);
    expect(new Set(llaves).size).toBe(llaves.length);
  });

  it("un deal de otro programa o de otro dueño nunca aparece (ids forjados)", async () => {
    // Deals que caerían en varios chips, pero de otro dueño o programa.
    const otroDuenoLlamada = await deal({ etapa: "atendido", owner: otro });
    await llamada(otroDuenoLlamada.dealId, HOY);
    const otroProgLlamada = await deal({ etapa: "atendido", programa: otroProgramId });
    await llamada(otroProgLlamada.dealId, HOY, otroProgramId);
    await dealId({ etapa: "atendido", pendiente: "seguimiento", fechaSeguimiento: HOY, owner: otro });
    await dealId({ etapa: "registrado", nuevo: true, owner: otro });
    await dealId({ etapa: "compromiso_verbal", fechaLimitePago: AYER, programa: otroProgramId });

    for (const { tipo } of TIPOS_DE_PENDIENTE) {
      // Mi universo (yo + programId) no tiene ninguno de esos deals.
      const mios = await todas(tipo, yo);
      expect(mios, tipo).not.toContain(otroDuenoLlamada.dealId);
      expect(mios, tipo).not.toContain(otroProgLlamada.dealId);
    }
    // Forjar el userId del otro dueño sí ve lo suyo, nunca lo mío: la frontera es el universo.
    const forjado = await pendientesDelCloserEnPrograma(db, {
      programId, userId: otro, dia: HOY, ahora: new Date(`${HOY}T18:00:00-05:00`),
    });
    expect(forjado.filas.map((fila) => fila.dealId)).not.toContain(otroProgLlamada.dealId);
    expect(forjado.filas.map((fila) => fila.dealId)).toContain(otroDuenoLlamada.dealId);
  });
});

/** Marca como leida (vista) la novedad de Calendly de un deal. */
async function marcarCalendlyLeida(dealId: string): Promise<void> {
  await db
    .update(notificacionesCalendly)
    .set({ leidaEn: new Date() })
    .where(eq(notificacionesCalendly.dealId, dealId));
}

/** Registra una novedad de Calendly sin leer sobre un deal (con una llamada de hoy). */
async function novedadCalendly(dealId: string, clave: string): Promise<void> {
  const callId = await llamada(dealId, HOY);
  const ok = await registrarNovedadCalendly(db, {
    programId,
    dealId,
    callId,
    tipo: "cita_nueva",
    claveEvento: clave,
  });
  expect(ok).toBe(true);
}

describe("conteoSinVer: el numero del circulito (223)", () => {
  it("cuenta Calendly sin leer + nuevos + seguimientos/reagendas de hoy o vencidos", async () => {
    const calendly = await deal({ etapa: "agendado" });
    await novedadCalendly(calendly.dealId, "ev-sinleer");
    const nuevo = await dealId({ etapa: "registrado", nuevo: true });
    const segHoy = await dealId({ etapa: "atendido", pendiente: "seguimiento", fechaSeguimiento: HOY });
    const reagendaVencida = await dealId({ etapa: "contactado", pendiente: "reagenda", fechaSeguimiento: AYER });
    // No cuentan: seguimiento futuro, deal viejo ya abierto, proxima_cohorte.
    await dealId({ etapa: "atendido", pendiente: "seguimiento", fechaSeguimiento: MANANA });
    await dealId({ etapa: "registrado", nuevo: false });
    await dealId({ etapa: "atendido", pendiente: "proxima_cohorte" });

    const total = await conteoSinVer(db, { programId, userId: yo }, HOY);
    expect(total).toBe(4);
    expect(new Set([calendly.dealId, nuevo, segHoy, reagendaVencida]).size).toBe(4);
  });

  it("un deal con DOS razones cuenta una sola vez", async () => {
    const d = await deal({ etapa: "registrado", nuevo: true, pendiente: "seguimiento", fechaSeguimiento: AYER });
    await novedadCalendly(d.dealId, "ev-doble");

    expect(await conteoSinVer(db, { programId, userId: yo }, HOY)).toBe(1);
  });

  it("una novedad de Calendly ya LEIDA no cuenta", async () => {
    const d = await deal({ etapa: "agendado" });
    await novedadCalendly(d.dealId, "ev-leida");
    await marcarCalendlyLeida(d.dealId);

    expect(await conteoSinVer(db, { programId, userId: yo }, HOY)).toBe(0);
  });

  it("otro programa u otro dueno nunca cuentan", async () => {
    await dealId({ etapa: "registrado", nuevo: true, owner: otro });
    await dealId({ etapa: "atendido", pendiente: "seguimiento", fechaSeguimiento: AYER, owner: otro });
    await dealId({ etapa: "registrado", nuevo: true, programa: otroProgramId });

    expect(await conteoSinVer(db, { programId, userId: yo }, HOY)).toBe(0);
  });

  it("coincide con la suma de las razones distintas (consistencia con los chips)", async () => {
    const calendly = await deal({ etapa: "agendado" });
    await novedadCalendly(calendly.dealId, "ev-c");
    await dealId({ etapa: "registrado", nuevo: true });
    await dealId({ etapa: "atendido", pendiente: "seguimiento", fechaSeguimiento: HOY });

    expect(await conteoSinVer(db, { programId, userId: yo }, HOY)).toBe(3);
  });
});

describe("GET /api/mi-espacio/sin-ver: el numero por la ruta (223)", () => {
  async function pedir(slug: string | null) {
    const { GET } = await import("@/app/api/mi-espacio/sin-ver/route");
    const url =
      slug == null
        ? "http://x/api/mi-espacio/sin-ver"
        : `http://x/api/mi-espacio/sin-ver?programa=${slug}`;
    return GET(new Request(url));
  }

  it("un closer con membresia recibe su numero", async () => {
    await db.insert(miembrosPrograma).values({ userId: yo, programId, activo: true });
    await dealId({ etapa: "registrado", nuevo: true });
    sesionHolder.rol = "closer";
    sesionHolder.id = yo;

    const res = await pedir("p");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ total: 1 });
  });

  it("un programa que la sesion no ve responde 404", async () => {
    sesionHolder.rol = "closer";
    sesionHolder.id = yo;

    const res = await pedir("p");
    expect(res.status).toBe(404);
  });

  it("un rol que no trabaja leads responde { total: 0 } (no un error)", async () => {
    sesionHolder.rol = "gerente";
    sesionHolder.id = yo;

    const res = await pedir("p");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ total: 0 });
  });

  it("sin sesion responde 401", async () => {
    sesionHolder.rol = null;

    const res = await pedir("p");
    expect(res.status).toBe(401);
  });

  it("sin ?programa responde 400", async () => {
    sesionHolder.rol = "closer";
    sesionHolder.id = yo;

    const res = await pedir(null);
    expect(res.status).toBe(400);
  });
});
