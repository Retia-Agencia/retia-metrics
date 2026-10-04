import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  abonos,
  calls,
  cohorts,
  dealEtapaHistorial,
  deals,
  leadContactos,
  leads,
  programs,
  sources,
  submissions,
  users,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ETAPAS, type EtapaDeal } from "@/lib/deals/etapas";
import { opcionesDeTablero, parsearFiltros, tableroKanban } from "@/lib/queries/kanban";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * Ticket 069: el tablero Kanban. Prueba que un deal anulado NUNCA aparece, que los
 * filtros funcionan, que las tarjetas se agrupan por etapa (las doce columnas salen
 * siempre) y que los avisos se calculan. El saldo sale de `saldosDeDeals` y la cartera
 * de `carteraVencida`, no se recalculan aqui.
 */

const HOY = "2026-10-20";

let db: Db;
let cerrar: () => Promise<void>;
let programId: string;
let cohortId: string;
let owner1: string;
let owner2: string;
let sourceId: string;
let leadN = 0;

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  const [p] = await db
    .insert(programs)
    .values({ ...PROGRAMA_DE_PRUEBA, slug: "p", nombre: "P", ticketUsd: "1000" })
    .returning();
  programId = p.id;
  const [s] = await db.insert(sources).values({ programId, nombre: "Typeform" }).returning();
  sourceId = s.id;
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
      estado: "activo",
    })
    .returning();
  cohortId = c.id;
  const [u1] = await db.insert(users).values({ email: "carlos@retia.co", rol: "closer", closerId: "carlos", nombre: "Carlos" }).returning();
  const [u2] = await db.insert(users).values({ email: "maria@retia.co", rol: "closer", closerId: "maria", nombre: "Maria" }).returning();
  owner1 = u1.id;
  owner2 = u2.id;
});

afterEach(async () => {
  await cerrar();
});

interface OpcDeal {
  etapa: EtapaDeal;
  envios?: number;
  pendiente?: "reagenda" | "seguimiento" | "proxima_cohorte" | null;
  owner?: string;
  cohort?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  fechaLimitePago?: string | null;
  fechaSeguimiento?: string | null;
  anulado?: boolean;
  /** Cuando entro a su etapa actual (para dias en etapa); default: hoy. */
  entrada?: string;
  contactoSinConfirmar?: boolean;
  abono?: string;
  creado?: string;
  valorVendido?: string | null;
}

async function deal(o: OpcDeal): Promise<string> {
  const [l] = await db
    .insert(leads)
    .values({
      programId,
      emailNormalizado: `l${++leadN}@correo.co`,
      nombre: `Lead ${leadN}`,
      numAplicaciones: o.envios ?? 1,
    })
    .returning();
  // El canal es del envío que abrió el deal (ADR 0060), no del lead.
  const [env] = await db
    .insert(submissions)
    .values({
      leadId: l.id,
      sourceId,
      token: `t${leadN}`,
      utmSource: o.utmSource === undefined ? "meta" : o.utmSource,
      utmMedium: o.utmMedium === undefined ? "cpc" : o.utmMedium,
    })
    .returning();
  const [d] = await db
    .insert(deals)
    .values({
      leadId: l.id,
      submissionOrigenId: env.id,
      programId,
      cohortId: o.cohort === undefined ? cohortId : o.cohort,
      etapa: o.etapa,
      pendiente: o.pendiente ?? null,
      ownerUserId: o.owner ?? owner1,
      valorVendidoUsd: o.valorVendido === undefined ? "1000.00" : o.valorVendido,
      ...(o.creado ? { createdAt: new Date(o.creado) } : {}),
      fechaLimitePago: o.fechaLimitePago ?? null,
      fechaSeguimiento: o.fechaSeguimiento ?? null,
      ...(o.anulado
        ? { anuladoEn: new Date(), anuladoPor: owner1, motivoAnulacion: "error de tecleo" }
        : {}),
    })
    .returning();
  // Fila de historial hacia la etapa actual, con la fecha de entrada dada.
  const fecha = o.entrada ? new Date(`${o.entrada}T12:00:00-05:00`) : new Date(`${HOY}T12:00:00-05:00`);
  await db.insert(dealEtapaHistorial).values({ dealId: d.id, de: null, a: o.etapa, fecha });
  if (o.abono) {
    await db.insert(abonos).values({ dealId: d.id, programId, fecha: "2026-10-01", monto: o.abono });
  }
  if (o.contactoSinConfirmar) {
    await db.insert(leadContactos).values({
      leadId: l.id,
      programId,
      tipo: "telefono",
      valor: `+5730011100${leadN}`,
      confirmado: false,
    });
  }
  return d.id;
}

describe("tableroKanban", () => {
  it("las once columnas salen siempre, en el orden del recorrido, aunque esten vacias", async () => {
    const t = await tableroKanban(db, programId, { tipo: "todos" }, {}, HOY);
    const orden = t.columnas.map((c) => c.etapa);
    // Todas las etapas, cada una una vez: el orden de pantalla no pierde ninguna.
    expect([...orden].sort()).toEqual([...ETAPAS].sort());
    // Los pendientes no crean columnas; Cierre Perdido cierra el tablero.
    expect(orden.at(-1)).toBe("cierre_perdido");
    expect(t.total).toBe(0);
    expect(t.columnas.every((columna) => columna.potencialUsd === 0 && columna.confirmadoUsd === 0)).toBe(true);
  });

  it("ordena por actividad o creacion en ambos sentidos y desempata por creacion descendente", async () => {
    const a = await deal({ etapa: "contactado", creado: "2026-09-01T12:00:00-05:00", entrada: "2026-10-10" });
    const b = await deal({ etapa: "contactado", creado: "2026-09-02T12:00:00-05:00", entrada: "2026-10-05" });
    const c = await deal({ etapa: "contactado", creado: "2026-09-03T12:00:00-05:00", entrada: "2026-10-05" });
    const ahora = new Date("2026-10-21T12:00:00-05:00");
    const ids = async (campo: "actividad" | "creado", sentido: "asc" | "desc") => {
      const tablero = await tableroKanban(db, programId, { tipo: "todos" }, { orden: { campo, sentido } }, HOY, ahora);
      return tablero.columnas.find((columna) => columna.etapa === "contactado")!.tarjetas.map((tarjeta) => tarjeta.dealId);
    };

    expect(await ids("actividad", "desc")).toEqual([a, c, b]);
    expect(await ids("actividad", "asc")).toEqual([c, b, a]);
    expect(await ids("creado", "desc")).toEqual([c, b, a]);
    expect(await ids("creado", "asc")).toEqual([a, b, c]);
  });

  it("desempata fechas iguales por deal id ascendente", async () => {
    const fecha = "2026-09-01T12:00:00-05:00";
    const uno = await deal({ etapa: "contactado", creado: fecha, entrada: "2026-10-05" });
    const dos = await deal({ etapa: "contactado", creado: fecha, entrada: "2026-10-05" });
    const tablero = await tableroKanban(
      db,
      programId,
      { tipo: "todos" },
      { orden: { campo: "actividad", sentido: "desc" } },
      HOY,
      new Date("2026-10-21T12:00:00-05:00"),
    );
    const ids = tablero.columnas.find((columna) => columna.etapa === "contactado")!.tarjetas.map((tarjeta) => tarjeta.dealId);
    expect(ids).toEqual([uno, dos].sort());
  });

  it("suma potencial y confirmado visibles desde saldosDeDeals y el ticket de cohorte", async () => {
    const vendido = await deal({ etapa: "ganado_completo", owner: owner1, valorVendido: "900.25", abono: "100.10" });
    await db.insert(abonos).values({
      dealId: vendido,
      programId,
      fecha: "2026-10-02",
      monto: "500",
      anuladoEn: new Date(),
      anuladoPor: owner1,
      motivoAnulacion: "error",
    });
    await deal({ etapa: "ganado_completo", owner: owner2, valorVendido: null, abono: "200.20" });

    const completo = (await tableroKanban(db, programId, { tipo: "todos" }, {}, HOY)).columnas
      .find((columna) => columna.etapa === "ganado_completo")!;
    expect(completo.potencialUsd).toBe(1900.25);
    expect(completo.confirmadoUsd).toBe(300.3);

    const filtrado = (await tableroKanban(db, programId, { tipo: "todos" }, { ownerUserId: owner1 }, HOY)).columnas
      .find((columna) => columna.etapa === "ganado_completo")!;
    expect(filtrado.potencialUsd).toBe(900.25);
    expect(filtrado.confirmadoUsd).toBe(100.1);
  });

  it("un deal ANULADO no aparece en ninguna columna", async () => {
    await deal({ etapa: "contactado" });
    await deal({ etapa: "contactado", anulado: true });
    const t = await tableroKanban(db, programId, { tipo: "todos" }, {}, HOY);
    expect(t.total).toBe(1);
    const enContacto = t.columnas.find((c) => c.etapa === "contactado")!;
    expect(enContacto.tarjetas).toHaveLength(1);
  });

  it("cuenta las propiedades faltantes de etapas distintas y excluye el deal anulado", async () => {
    await deal({ etapa: "registrado" });
    await deal({ etapa: "contactado" });
    await deal({ etapa: "contactado", anulado: true, cohort: null });

    const t = await tableroKanban(db, programId, { tipo: "todos" }, {}, HOY);
    expect(t.total).toBe(2);
    expect(t.columnas.find((c) => c.etapa === "registrado")!.tarjetas[0].avisos.faltanALaEtapa).toBe(0);
    expect(t.columnas.find((c) => c.etapa === "contactado")!.tarjetas[0].avisos.faltanALaEtapa).toBe(1);
  });

  it("no cuenta llamadas ni abonos anulados como propiedades de la etapa", async () => {
    const atendido = await deal({ etapa: "atendido" });
    const ganado = await deal({ etapa: "ganado_completo" });
    const anulacion = { anuladoEn: new Date(), anuladoPor: owner1, motivoAnulacion: "error" };
    await db.insert(calls).values({
      dealId: atendido, programId, resultado: "show", origen: "app", ...anulacion,
    });
    await db.insert(abonos).values({
      dealId: ganado, programId, fecha: "2026-10-01", monto: "1000", ...anulacion,
    });

    const t = await tableroKanban(db, programId, { tipo: "todos" }, {}, HOY);
    expect(t.columnas.find((c) => c.etapa === "atendido")!.tarjetas[0].avisos.faltanALaEtapa).toBe(2);
    expect(t.columnas.find((c) => c.etapa === "ganado_completo")!.tarjetas[0].avisos.faltanALaEtapa).toBe(3);
  });

  it("agrupa por etapa y muestra el dueño", async () => {
    await deal({ etapa: "registrado", owner: owner1 });
    await deal({ etapa: "contactado", owner: owner2 });
    await deal({ etapa: "contactado", owner: owner1 });
    const t = await tableroKanban(db, programId, { tipo: "todos" }, {}, HOY);
    const enContacto = t.columnas.find((c) => c.etapa === "contactado")!;
    const setteo = t.columnas.find((c) => c.etapa === "registrado")!;
    expect(enContacto.tarjetas).toHaveLength(2);
    expect(setteo.tarjetas).toHaveLength(1);
    expect([owner1, owner2]).toContain(enContacto.tarjetas[0].ownerUserId);
    expect(enContacto.tarjetas.some((x) => x.ownerNombre === "Maria")).toBe(true);
  });

  it("expone el número de envíos del lead en la tarjeta", async () => {
    await deal({ etapa: "registrado", envios: 3 });
    const t = await tableroKanban(db, programId, { tipo: "todos" }, {}, HOY);
    expect(t.columnas.find((c) => c.etapa === "registrado")!.tarjetas[0].envios).toBe(3);
  });

  it("filtra por dueño", async () => {
    await deal({ etapa: "contactado", owner: owner1 });
    await deal({ etapa: "contactado", owner: owner2 });
    const t = await tableroKanban(db, programId, { tipo: "todos" }, { ownerUserId: owner2 }, HOY);
    expect(t.total).toBe(1);
    expect(t.columnas.find((c) => c.etapa === "contactado")!.tarjetas[0].ownerUserId).toBe(owner2);
  });

  it("el alcance de dueño ignora un owner ajeno forjado en la URL", async () => {
    await deal({ etapa: "contactado", owner: owner1 });
    await deal({ etapa: "contactado", owner: owner2 });
    const t = await tableroKanban(db, programId, { tipo: "dueno", userId: owner1 }, { ownerUserId: owner2 }, HOY);
    const tarjetas = t.columnas.flatMap((columna) => columna.tarjetas);
    expect(tarjetas.map((tarjeta) => tarjeta.ownerUserId)).toEqual([owner1]);
  });

  it("gerente y developer usan alcance todos", async () => {
    await deal({ etapa: "contactado", owner: owner1 });
    await deal({ etapa: "contactado", owner: owner2 });
    const t = await tableroKanban(db, programId, { tipo: "todos" }, {}, HOY);
    expect(t.columnas.flatMap((columna) => columna.tarjetas)).toHaveLength(2);
  });

  it("filtra por canal (source|medium del envío de origen)", async () => {
    await deal({ etapa: "contactado", utmSource: "meta", utmMedium: "cpc" });
    await deal({ etapa: "contactado", utmSource: "google", utmMedium: "cpc" });
    const t = await tableroKanban(db, programId, { tipo: "todos" }, { canal: "google|cpc" }, HOY);
    expect(t.total).toBe(1);
  });

  it("filtra por antiguedad minima en la etapa", async () => {
    await deal({ etapa: "contactado", entrada: "2026-10-01" }); // 19 dias
    await deal({ etapa: "contactado", entrada: HOY }); // 0 dias
    const t = await tableroKanban(db, programId, { tipo: "todos" }, { antiguedadMinima: 7 }, HOY);
    expect(t.total).toBe(1);
    expect(t.columnas.find((c) => c.etapa === "contactado")!.tarjetas[0].diasEnEtapa).toBe(19);
  });

  it("filtra por cohorte de origen", async () => {
    const [otra] = await db
      .insert(cohorts)
      .values({
        programId,
        codigo: "C2",
        metaCupos: 5,
        precioUsd: "1000",
        fechaInicioClases: "2026-12-15",
        fechaCierreVentas: "2026-12-01",
        estado: "futuro",
      })
      .returning();
    await deal({ etapa: "contactado", cohort: cohortId });
    await deal({ etapa: "contactado", cohort: otra.id });
    const t = await tableroKanban(db, programId, { tipo: "todos" }, { cohorteId: otra.id }, HOY);
    expect(t.total).toBe(1);
  });

  it("aviso: compromiso verbal con fecha limite pasada", async () => {
    await deal({ etapa: "compromiso_verbal", fechaLimitePago: "2026-10-01" });
    const t = await tableroKanban(db, programId, { tipo: "todos" }, {}, HOY);
    const tarjeta = t.columnas.find((c) => c.etapa === "compromiso_verbal")!.tarjetas[0];
    expect(tarjeta.avisos.compromisoVencido).toBe(true);
  });

  it("aviso: seguimiento con fecha de seguimiento pasada", async () => {
    await deal({ etapa: "atendido", pendiente: "seguimiento", fechaSeguimiento: "2026-10-01" });
    const t = await tableroKanban(db, programId, { tipo: "todos" }, {}, HOY);
    const tarjeta = t.columnas.find((c) => c.etapa === "atendido")!.tarjetas[0];
    expect(tarjeta.pendiente).toBe("seguimiento");
    expect(tarjeta.avisos.seguimientoVencido).toBe(true);
  });

  it("aviso: cartera vencida (abonado, saldo > 0, fecha limite pasada) sale de carteraVencida", async () => {
    await deal({ etapa: "ganado_parcial", abono: "400", fechaLimitePago: "2026-10-01" });
    const t = await tableroKanban(db, programId, { tipo: "todos" }, {}, HOY);
    const tarjeta = t.columnas.find((c) => c.etapa === "ganado_parcial")!.tarjetas[0];
    expect(tarjeta.avisos.carteraVencida).toBe(true);
    expect(tarjeta.saldo).toBe(600);
    expect(tarjeta.moneda).toBe("USD");
  });

  it("aviso: lead unido por telefono (contacto sin confirmar)", async () => {
    await deal({ etapa: "contactado", contactoSinConfirmar: true });
    const t = await tableroKanban(db, programId, { tipo: "todos" }, {}, HOY);
    const tarjeta = t.columnas.find((c) => c.etapa === "contactado")!.tarjetas[0];
    expect(tarjeta.avisos.leadUnidoPorTelefono).toBe(true);
  });
});

describe("opcionesDeTablero", () => {
  it("incluye la cohorte activa aunque no tenga deals", async () => {
    const o = await opcionesDeTablero(db, programId);
    expect(o.cohortes).toEqual([{ id: cohortId, nombre: "C1" }]);
  });

  it("trae owners, cohortes y canales presentes en los deals, y los catalogos", async () => {
    await deal({ etapa: "contactado", owner: owner1, utmSource: "meta", utmMedium: "cpc" });
    await deal({ etapa: "contactado", owner: owner2, utmSource: "google", utmMedium: "organic" });
    const o = await opcionesDeTablero(db, programId);
    expect(o.owners.map((x) => x.id).sort()).toEqual([owner1, owner2].sort());
    expect(o.cohortes.map((x) => x.nombre)).toContain("C1");
    expect(o.canales.map((x) => x.clave).sort()).toEqual(["google|organic", "meta|cpc"]);
  });

  it("un deal anulado no aporta su dueño ni su canal a las opciones", async () => {
    await deal({ etapa: "contactado", owner: owner2, anulado: true });
    const o = await opcionesDeTablero(db, programId);
    expect(o.owners).toHaveLength(0);
  });
});

describe("parsearFiltros", () => {
  it("lee owner, cohorte, canal y antiguedad; ignora vacios y antiguedad no numerica", () => {
    expect(parsearFiltros({ owner: "u1", cohorte: "c1", canal: "meta|cpc", antiguedad: "7" })).toEqual({
      ownerUserId: "u1",
      cohorteId: "c1",
      canal: "meta|cpc",
      antiguedadMinima: 7,
      orden: { campo: "actividad", sentido: "desc" },
    });
    expect(parsearFiltros({ owner: "", antiguedad: "abc" })).toEqual({
      ownerUserId: null,
      cohorteId: null,
      canal: null,
      antiguedadMinima: null,
      orden: { campo: "actividad", sentido: "desc" },
    });
    // Un arreglo (parametro repetido) no es un valor de filtro.
    expect(parsearFiltros({ owner: ["a", "b"] }).ownerUserId).toBeNull();
    // antiguedad 0 no filtra (minimo 1).
    expect(parsearFiltros({ antiguedad: "0" }).antiguedadMinima).toBeNull();
  });

  it("valida el orden y usa sus defaults si falta o es invalido", () => {
    expect(parsearFiltros({}).orden).toEqual({ campo: "actividad", sentido: "desc" });
    expect(parsearFiltros({ orden: "creado", sentido: "asc" }).orden).toEqual({ campo: "creado", sentido: "asc" });
    expect(parsearFiltros({ orden: "otro", sentido: "asc" }).orden).toEqual({ campo: "actividad", sentido: "desc" });
    expect(parsearFiltros({ orden: "creado", sentido: "otro" }).orden).toEqual({ campo: "actividad", sentido: "desc" });
  });

  it("usa la cohorte activa por ausencia, todas como null y conserva un id explicito", () => {
    expect(parsearFiltros({}, HOY, "activa").cohorteId).toBe("activa");
    expect(parsearFiltros({ cohorte: "" }, HOY, "activa").cohorteId).toBe("activa");
    expect(parsearFiltros({ cohorte: "todas" }, HOY, "activa").cohorteId).toBeNull();
    expect(parsearFiltros({ cohorte: "c2" }, HOY, "activa").cohorteId).toBe("c2");
  });
});
