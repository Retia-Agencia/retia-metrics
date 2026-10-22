import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { anotar } from "@/lib/deals/anotar";
import { asignarProximaCohorte } from "@/lib/deals/asignar-proxima-cohorte";
import { activarCohorte, desactivarCohorte } from "@/lib/catalogo/cohortes";
import { changeLog, cohorts, dealActividades, dealEtapaHistorial, deals, leads, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import { ventasPorCohorte } from "@/lib/queries/dashboard";
import { dealsDeProximaCohorte } from "@/lib/queries/proxima-cohorte";
import { tableroKanban } from "@/lib/queries/kanban";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let programId: string;
let activaId: string;
let futuraId: string;
let cerradaId: string;
let closerId: string;
let gerenteId: string;
let secuencia = 0;

const closer = () => ({ userId: closerId, rol: "closer" as const, operaComoCloser: false });
const gerente = () => ({ userId: gerenteId, rol: "gerente" as const, operaComoCloser: false });

beforeAll(async () => ({ db, cerrar, vaciar } = await crearBaseReutilizable()));
afterAll(async () => cerrar());

beforeEach(async () => {
  await vaciar();
  const [programa] = await db.insert(programs).values({
    ...PROGRAMA_DE_PRUEBA,
    slug: "proxima-cohorte",
    nombre: "Próxima cohorte",
    ticketUsd: "1000",
  }).returning();
  programId = programa.id;
  const filas = await db.insert(cohorts).values([
    {
      programId, codigo: "C1", metaCupos: 10, precioUsd: "1000", estado: "activo",
      fechaInicioClases: "2026-11-01", fechaInicioVentas: "2026-10-01", fechaCierreVentas: "2026-10-31",
    },
    {
      programId, codigo: "C2", metaCupos: 10, precioUsd: "1000", estado: "futuro",
      fechaInicioClases: "2027-02-01", fechaInicioVentas: "2027-01-01", fechaCierreVentas: "2027-01-31",
    },
    {
      programId, codigo: "C0", metaCupos: 10, precioUsd: "1000", estado: "cerrado",
      fechaInicioClases: "2026-08-01", fechaInicioVentas: "2026-07-01", fechaCierreVentas: "2026-07-31",
    },
  ]).returning();
  activaId = filas[0].id;
  futuraId = filas[1].id;
  cerradaId = filas[2].id;
  closerId = (await db.insert(users).values({ email: "closer@retia.co", nombre: "Closer", rol: "closer" }).returning())[0].id;
  gerenteId = (await db.insert(users).values({ email: "gerente@retia.co", nombre: "Gerente", rol: "gerente" }).returning())[0].id;
});

async function nuevoDeal(cohortId = activaId, ownerUserId: string | null = closerId, programa = programId) {
  const [lead] = await db.insert(leads).values({
    programId: programa,
    emailNormalizado: `proxima-${secuencia++}@retia.co`,
    nombre: `Lead ${secuencia}`,
  }).returning();
  return (await db.insert(deals).values({
    programId: programa,
    leadId: lead.id,
    cohortId,
    ownerUserId,
    etapa: "contactado",
  }).returning())[0];
}

async function esperarTexto(dealId: string, texto = "la siguiente") {
  return anotar(db, closer(), { dealId, proximaCohorte: { textoCohorte: texto } });
}

describe("Próxima cohorte", () => {
  it("Anotar con futura asigna destino sin mudar; el texto usa la nota nueva", async () => {
    const asignado = await nuevoDeal();
    await anotar(db, closer(), { dealId: asignado.id, proximaCohorte: { cohorteDestinoId: futuraId } });
    expect((await db.select().from(deals).where(eq(deals.id, asignado.id)))[0]).toMatchObject({
      cohortId: activaId,
      pendiente: "proxima_cohorte",
      cohorteDestinoId: futuraId,
      cohorteDestinoTexto: null,
      etapa: "contactado",
    });

    const libre = await nuevoDeal();
    await esperarTexto(libre.id, "  2027  ");
    expect((await db.select().from(deals).where(eq(deals.id, libre.id)))[0]).toMatchObject({
      cohortId: activaId, pendiente: "proxima_cohorte", cohorteDestinoId: null, cohorteDestinoTexto: "2027",
    });
    expect(await db.select().from(dealActividades).where(eq(dealActividades.dealId, libre.id))).toEqual([
      expect.objectContaining({ userId: null, nota: "Esperando cohorte: 2027" }),
    ]);
  });

  it("consulta dos cohortes de origen, separa vistas, excluye otro programa y anulados, y lee ambas notas", async () => {
    const nuevo = await nuevoDeal(activaId);
    await esperarTexto(nuevo.id, "enero");
    const legado = await nuevoDeal(cerradaId);
    await db.update(deals).set({ pendiente: "proxima_cohorte", cohorteDestinoTexto: "marzo" }).where(eq(deals.id, legado.id));
    await db.insert(dealActividades).values({ dealId: legado.id, tipo: "nota", userId: null, nota: "Esperando corte: marzo", fecha: new Date("2026-10-01T12:00:00Z") });
    const asignado = await nuevoDeal();
    await anotar(db, closer(), { dealId: asignado.id, proximaCohorte: { cohorteDestinoId: futuraId } });
    const anulado = await nuevoDeal();
    await esperarTexto(anulado.id);
    await db.update(deals).set({ anuladoEn: new Date(), anuladoPor: gerenteId, motivoAnulacion: "duplicado" }).where(eq(deals.id, anulado.id));
    const [otroPrograma] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "otro-proxima", nombre: "Otro", ticketUsd: "1000" }).returning();
    const [otraCohorte] = await db.insert(cohorts).values({ programId: otroPrograma.id, codigo: "O1", metaCupos: 1, precioUsd: "1000", estado: "futuro" }).returning();
    const ajeno = await nuevoDeal(otraCohorte.id, closerId, otroPrograma.id);
    await db.update(deals).set({ pendiente: "proxima_cohorte", cohorteDestinoTexto: "otra" }).where(eq(deals.id, ajeno.id));

    const sinAsignar = await dealsDeProximaCohorte(db, programId, "sin_asignar");
    expect(sinAsignar.map((d) => d.dealId).sort()).toEqual([nuevo.id, legado.id].sort());
    expect(sinAsignar.map((d) => d.cohorteOrigenCodigo).sort()).toEqual(["C0", "C1"]);
    expect(sinAsignar.every((d) => d.esperaDesde instanceof Date)).toBe(true);
    expect((await dealsDeProximaCohorte(db, programId, "asignada")).map((d) => d.dealId)).toEqual([asignado.id]);
  });

  it("asignar a futura solo escribe destino; un lote inválido es atómico y el no dueño recibe 403", async () => {
    const uno = await nuevoDeal();
    const dos = await nuevoDeal();
    await esperarTexto(uno.id, "enero");
    await esperarTexto(dos.id, "febrero");
    await asignarProximaCohorte(db, { dealIds: [uno.id, dos.id], destinoId: futuraId, actor: gerente() });
    const escritos = await db.select().from(deals);
    expect(escritos.filter((d) => d.id === uno.id || d.id === dos.id).every((d) =>
      d.cohortId === activaId && d.cohorteDestinoId === futuraId && d.pendiente === "proxima_cohorte"
    )).toBe(true);

    const valido = await nuevoDeal();
    await esperarTexto(valido.id);
    const sinTag = await nuevoDeal();
    await expect(asignarProximaCohorte(db, { dealIds: [valido.id, sinTag.id], destinoId: futuraId, actor: gerente() }))
      .rejects.toMatchObject({ status: 422 });
    expect((await db.select().from(deals).where(eq(deals.id, valido.id)))[0].cohorteDestinoId).toBeNull();

    const [programaAjeno] = await db.insert(programs).values({
      ...PROGRAMA_DE_PRUEBA, slug: "asignar-ajeno", nombre: "Asignar ajeno", ticketUsd: "1000",
    }).returning();
    const [cohorteAjena] = await db.insert(cohorts).values({
      programId: programaAjeno.id, codigo: "A1", metaCupos: 1, precioUsd: "1000", estado: "futuro",
    }).returning();
    const extranjero = await nuevoDeal(cohorteAjena.id, closerId, programaAjeno.id);
    await db.update(deals).set({ pendiente: "proxima_cohorte", cohorteDestinoTexto: "otra" }).where(eq(deals.id, extranjero.id));
    await expect(asignarProximaCohorte(db, { dealIds: [valido.id, extranjero.id], destinoId: futuraId, actor: gerente() }))
      .rejects.toMatchObject({ status: 422 });
    expect((await db.select().from(deals).where(eq(deals.id, valido.id)))[0].cohorteDestinoId).toBeNull();

    const anulado = await nuevoDeal();
    await esperarTexto(anulado.id);
    await db.update(deals).set({ anuladoEn: new Date(), anuladoPor: gerenteId, motivoAnulacion: "error" }).where(eq(deals.id, anulado.id));
    await expect(asignarProximaCohorte(db, { dealIds: [valido.id, anulado.id], destinoId: futuraId, actor: gerente() }))
      .rejects.toMatchObject({ status: 422 });
    expect((await db.select().from(deals).where(eq(deals.id, valido.id)))[0].cohorteDestinoId).toBeNull();

    const ajeno = await nuevoDeal(activaId, gerenteId);
    await db.update(deals).set({ pendiente: "proxima_cohorte", cohorteDestinoTexto: "otra" }).where(eq(deals.id, ajeno.id));
    const error = await asignarProximaCohorte(db, { dealIds: [ajeno.id], destinoId: futuraId, actor: closer() }).catch((e) => e as ErrorDeApp);
    expect(error).toMatchObject({ status: 403 });
  });

  it("asignar a la activa muda ya, conserva etapa y limpia la espera", async () => {
    const deal = await nuevoDeal(cerradaId);
    await esperarTexto(deal.id);
    await asignarProximaCohorte(db, { dealIds: [deal.id], destinoId: activaId, actor: gerente() });
    expect((await db.select().from(deals).where(eq(deals.id, deal.id)))[0]).toMatchObject({
      cohortId: activaId, etapa: "contactado", pendiente: null, cohorteDestinoId: null, cohorteDestinoTexto: null,
    });
  });

  it("activar muda solo el destino coincidente, con etapa, nota y change_log, y cambia las métricas", async () => {
    const mueve = await nuevoDeal(activaId);
    await esperarTexto(mueve.id);
    await db.update(deals).set({
      etapa: "ganado_parcial", valorVendidoUsd: "1000", cohorteDestinoId: futuraId,
    }).where(eq(deals.id, mueve.id));
    await db.insert(dealEtapaHistorial).values({ dealId: mueve.id, de: "contactado", a: "ganado_parcial" });
    const [otraFutura] = await db.insert(cohorts).values({ programId, codigo: "C3", metaCupos: 2, precioUsd: "1000", estado: "futuro" }).returning();
    const quieto = await nuevoDeal();
    await esperarTexto(quieto.id);
    await db.update(deals).set({ cohorteDestinoId: otraFutura.id }).where(eq(deals.id, quieto.id));
    const alcance = { programId, rango: { desde: "2020-01-01", hasta: "2099-12-31" } };
    expect((await ventasPorCohorte(alcance, db)).find((f) => f.cohorteId === activaId)?.ventas).toBe(1);

    await desactivarCohorte(db, gerenteId, activaId);
    await activarCohorte(db, gerenteId, futuraId);

    expect((await db.select().from(deals).where(eq(deals.id, mueve.id)))[0]).toMatchObject({
      cohortId: futuraId, etapa: "ganado_parcial", pendiente: null, cohorteDestinoId: null, cohorteDestinoTexto: null,
    });
    expect((await db.select().from(deals).where(eq(deals.id, quieto.id)))[0]).toMatchObject({
      cohortId: activaId, pendiente: "proxima_cohorte", cohorteDestinoId: otraFutura.id,
    });
    expect(await db.select().from(dealActividades).where(eq(dealActividades.dealId, mueve.id))).toEqual(expect.arrayContaining([
      expect.objectContaining({ nota: "Próxima cohorte: C1 → C2. Estaba en Ganado Pago Parcial." }),
    ]));
    expect(await db.select().from(changeLog).where(eq(changeLog.registroId, mueve.id))).toEqual(expect.arrayContaining([
      expect.objectContaining({ campo: "cohortId", valorAnterior: activaId, valorNuevo: futuraId }),
      expect.objectContaining({ campo: "pendiente", valorAnterior: "proxima_cohorte", valorNuevo: null }),
    ]));
    const despues = await ventasPorCohorte(alcance, db);
    expect(despues.find((f) => f.cohorteId === activaId)?.ventas ?? 0).toBe(0);
    expect(despues.find((f) => f.cohorteId === futuraId)?.ventas).toBe(1);
  });

  it("el Kanban excluye los etiquetados y devuelve el conteo aun con otra cohorte filtrada", async () => {
    const visible = await nuevoDeal();
    const esperando = await nuevoDeal(cerradaId);
    await esperarTexto(esperando.id);
    const tablero = await tableroKanban(db, programId, { tipo: "todos" }, { cohorteId: activaId });
    expect(tablero.columnas.flatMap((c) => c.tarjetas).map((t) => t.dealId)).toContain(visible.id);
    expect(tablero.columnas.flatMap((c) => c.tarjetas).map((t) => t.dealId)).not.toContain(esperando.id);
    expect(tablero.enProximaCohorte).toHaveLength(1);
  });
});
