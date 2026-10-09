import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  abonos,
  calls,
  changeLog,
  cohorts,
  dealActividades,
  dealEtapaHistorial,
  deals,
  enlacesPago,
  leadContactos,
  leads,
  motivos,
  programs,
  plataformasPago,
  sources,
  submissions,
  users,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { anularAbono, registrarAbono } from "@/lib/deals/abonos";
import { anularDeal } from "@/lib/deals/anular-deal";
import { nombreDelDeal } from "@/lib/deals/nombre";
import { fichaDeDeal, opcionesDeFicha, respuestasLegibles } from "@/lib/queries/ficha-deal";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * Ticket 074: `fichaDeDeal`, la lectura de la pantalla. Cubre: la cabecera con sus nombres,
 * lo anulado que SE MUESTRA marcado pero NO entra en los totales (que salen de `saldosDeDeals`),
 * el historial con "sistema" cuando nadie movio, la sugerencia de fecha limite, y la frontera:
 * un deal de otro programa o inexistente devuelve `null`.
 */

let db: Db;
let cerrar: () => Promise<void>;
let programId: string;
let otroPrograma: string;
let cohortId: string;
let closer: string;
let dealId: string;

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  const [p] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "p", nombre: "P", ticketUsd: "1000" }).returning();
  programId = p.id;
  const [q] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "q", nombre: "Q", ticketUsd: "500" }).returning();
  otroPrograma = q.id;
  const [c] = await db
    .insert(cohorts)
    .values({
      programId,
      codigo: "C1",
      metaCupos: 10,
      precioUsd: "1000",
      fechaInicioClases: "2026-10-01",
      fechaInicioVentas: "2026-09-01",
      fechaCierreVentas: "2026-09-30",
      estado: "activo",
    })
    .returning();
  cohortId = c.id;
  const [u] = await db.insert(users).values({ email: "maru@retiagrowth.com", rol: "closer", closerId: "Maru", nombre: "Maru" }).returning();
  closer = u.id;
  const [l] = await db
    .insert(leads)
    .values({ programId, emailNormalizado: "ana@correo.co", nombre: "Ana", telefono: "300", numAplicaciones: 3 })
    .returning();
  const [fuente] = await db.insert(sources).values({ programId, nombre: "Typeform" }).returning();
  const [env] = await db
    .insert(submissions)
    .values({ leadId: l.id, sourceId: fuente.id, token: "t1", utmSource: "facebook", utmMedium: "cpc" })
    .returning();
  const [d] = await db
    .insert(deals)
    .values({ leadId: l.id, submissionOrigenId: env.id, programId, cohortId, etapa: "atendido", ownerUserId: closer,valorVendidoUsd: "1000.00", acuerdoPago: "30% en octubre" })
    .returning();
  dealId = d.id;
}, 60_000);

afterEach(async () => {
  await cerrar();
});

const comoCloser = () => ({ userId: closer, rol: "closer" as const });

describe("fichaDeDeal", () => {
  it("arma la cabecera con los nombres y la fecha limite sugerida (inicio de clases)", async () => {
    const f = await fichaDeDeal(db, programId, dealId);

    expect(f).not.toBeNull();
    expect(f).toMatchObject({
      dealId,
      etapa: "atendido",
      lead: { email: "ana@correo.co", nombre: "Ana", envios: 3 },
      origen: { utm: { source: "facebook", medium: "cpc", campaign: null } },
      owner: { id: closer, nombre: "Maru" },
      cohorte: { codigo: "C1", inicioClases: "2026-10-01" },
      acuerdoPago: "30% en octubre",
      fechaLimiteSugerida: "2026-10-01",
      anulado: null,
    });
  });

  it("de otro programa o inexistente devuelve null: la frontera no se cruza", async () => {
    expect(await fichaDeDeal(db, otroPrograma, dealId)).toBeNull();
    expect(await fichaDeDeal(db, programId, crypto.randomUUID())).toBeNull();
  });

  it("devuelve los UTM exactamente como llegaron y recupera utm_id de respuestas", async () => {
    await db
      .update(submissions)
      .set({
        utmSource: " Facebook ",
        utmMedium: "CPC",
        utmCampaign: "{{campaign.name}}",
        utmContent: "Anuncio 1",
        utmTerm: null,
        utmId: null,
        respuestas: { " utm_ID ": "42" },
      })
      .where(eq(submissions.token, "t1"));

    const f = (await fichaDeDeal(db, programId, dealId))!;
    expect(f.origen?.utm).toEqual({
      source: " Facebook ",
      medium: "CPC",
      campaign: "{{campaign.name}}",
      content: "Anuncio 1",
      term: null,
      id: "42",
    });
  });

  it("sin envío de origen devuelve origen null", async () => {
    await db.update(deals).set({ submissionOrigenId: null }).where(eq(deals.id, dealId));
    expect((await fichaDeDeal(db, programId, dealId))!.origen).toBeNull();
  });

  it("usa fecha_envio para el origen y cae a created_at cuando falta", async () => {
    const fechaEnvio = new Date("2026-09-02T14:00:00Z");
    const createdAt = new Date("2026-09-03T15:00:00Z");
    await db.update(submissions).set({ fechaEnvio, createdAt }).where(eq(submissions.token, "t1"));
    expect((await fichaDeDeal(db, programId, dealId))!.origen?.fecha).toEqual(fechaEnvio);

    await db.update(submissions).set({ fechaEnvio: null }).where(eq(submissions.token, "t1"));
    expect((await fichaDeDeal(db, programId, dealId))!.origen?.fecha).toEqual(createdAt);
  });

  it("toma lead quality y lead value del lead", async () => {
    await db.update(leads).set({ leadQuality: "Alta", leadValue: "Premium" }).where(eq(leads.emailNormalizado, "ana@correo.co"));
    await db.update(submissions).set({ respuestas: { Pregunta: "Respuesta" } }).where(eq(submissions.token, "t1"));
    expect((await fichaDeDeal(db, programId, dealId))!.perfil).toEqual({
      leadQuality: "Alta",
      leadValue: "Premium",
      respuestas: [{ pregunta: "Pregunta", respuesta: "Respuesta" }],
    });
  });

  it("ordena los contactos con el principal primero y no mezcla otro lead", async () => {
    const [otroLead] = await db.insert(leads).values({ programId, emailNormalizado: "otra@correo.co" }).returning();
    await db.insert(leadContactos).values([
      { leadId: otroLead.id, programId, tipo: "correo", valor: "otra@correo.co", esPrincipal: true },
      { leadId: (await db.select({ id: leads.id }).from(leads).where(eq(leads.emailNormalizado, "ana@correo.co")))[0].id, programId, tipo: "telefono", valor: "301", esPrincipal: false },
      { leadId: (await db.select({ id: leads.id }).from(leads).where(eq(leads.emailNormalizado, "ana@correo.co")))[0].id, programId, tipo: "correo", valor: "ana@correo.co", esPrincipal: true },
    ]);

    const f = (await fichaDeDeal(db, programId, dealId))!;
    expect(f.contactos.map((c) => [c.tipo, c.valor, c.esPrincipal])).toEqual([
      ["correo", "ana@correo.co", true],
      ["telefono", "301", false],
    ]);
  });

  it("combina etapas y cambios del deal y sus registros, excluye otros deals y ordena por fecha", async () => {
    const [abono] = await db.insert(abonos).values({ dealId, programId, fecha: "2026-09-10", monto: "100", moneda: "USD" }).returning();
    const [otroLead] = await db.insert(leads).values({ programId, emailNormalizado: "otro-log@correo.co" }).returning();
    const [otroDeal] = await db.insert(deals).values({ leadId: otroLead.id, programId, etapa: "atendido" }).returning();
    await db.insert(dealEtapaHistorial).values({
      dealId,
      de: "agendado",
      a: "atendido",
      userId: closer,
      fecha: new Date("2026-09-10T10:00:00Z"),
    });
    await db.insert(changeLog).values([
      { tabla: "deals", registroId: dealId, campo: "owner_user_id", valorAnterior: "anterior", valorNuevo: closer, userId: closer, detectadoEn: new Date("2026-09-12T10:00:00Z"), origen: "app" },
      { tabla: "abonos", registroId: abono.id, campo: "deal_id", valorAnterior: null, valorNuevo: dealId, detectadoEn: new Date("2026-09-11T10:00:00Z"), origen: "app" },
      { tabla: "abonos", registroId: abono.id, campo: "monto", valorAnterior: null, valorNuevo: "100", detectadoEn: new Date("2026-09-11T10:00:00Z"), origen: "app" },
      { tabla: "abonos", registroId: abono.id, campo: "moneda", valorAnterior: null, valorNuevo: "USD", detectadoEn: new Date("2026-09-11T10:00:00Z"), origen: "app" },
      { tabla: "deals", registroId: otroDeal.id, campo: "etapa", valorAnterior: "agendado", valorNuevo: "atendido", detectadoEn: new Date("2026-09-13T10:00:00Z"), origen: "app" },
    ]);

    const f = (await fichaDeDeal(db, programId, dealId))!;
    expect(f.log).toMatchObject([
      { tipo: "cambio", tabla: "deals", accion: "editado", campos: [{ campo: "owner_user_id", valorAnterior: "anterior", valorNuevo: closer }] },
      { tipo: "cambio", tabla: "abonos", accion: "creado", campos: expect.arrayContaining([
        { campo: "deal_id", valorAnterior: null, valorNuevo: dealId },
        { campo: "monto", valorAnterior: null, valorNuevo: "100" },
        { campo: "moneda", valorAnterior: null, valorNuevo: "USD" },
      ]) },
      { tipo: "etapa", de: "agendado", a: "atendido" },
    ]);
    expect(f.log).toHaveLength(3);
    expect(f.log[0].porNombre).toBe("Maru");
  });

  it("solo titula creado el primer grupo aunque una edición posterior llene un campo vacío", async () => {
    await db.insert(changeLog).values([
      { tabla: "deals", registroId: dealId, campo: "lead_id", valorAnterior: null, valorNuevo: "inicial", detectadoEn: new Date("2026-09-10T10:00:00Z"), origen: "app" },
      { tabla: "deals", registroId: dealId, campo: "owner_user_id", valorAnterior: null, valorNuevo: closer, detectadoEn: new Date("2026-09-11T10:00:00Z"), origen: "app" },
    ]);

    const cambios = (await fichaDeDeal(db, programId, dealId))!.log
      .filter((evento) => evento.tipo === "cambio");
    expect(cambios.map((evento) => evento.accion)).toEqual(["editado", "creado"]);
  });

  it("incluye solo enlaces de pago vigentes del programa", async () => {
    const [plataforma] = await db.insert(plataformasPago).values({ nombre: "Pasarela vigente" }).returning();
    const [otraPlataforma] = await db.insert(plataformasPago).values({ nombre: "Pasarela de otro programa" }).returning();
    await db.insert(enlacesPago).values([
      { programId, plataformaId: plataforma.id, url: "https://pago.test/vigente", monto: "100", moneda: "USD", vigente: true, activo: true },
      { programId, plataformaId: plataforma.id, url: "https://pago.test/viejo", monto: "200", moneda: "USD", vigente: false, activo: true },
      { programId: otroPrograma, plataformaId: otraPlataforma.id, url: "https://pago.test/otro", monto: "300", moneda: "USD", vigente: true, activo: true },
    ]);

    expect((await fichaDeDeal(db, programId, dealId))!.enlacesDePago.map((e) => e.url)).toEqual(["https://pago.test/vigente"]);
  });

  it("los abonos anulados se muestran marcados pero NO entran en abonado ni saldo", async () => {
    const a1 = await registrarAbono(db, comoCloser(), { dealId, fecha: "2026-09-20", monto: "300", comprobanteUrl: "https://drive.google.com/c" });
    await registrarAbono(db, comoCloser(), { dealId, fecha: "2026-09-21", monto: "200" });
    await anularAbono(db, comoCloser(), { abonoId: a1.abonoId, motivo: "pago mal tecleado" });

    const f = (await fichaDeDeal(db, programId, dealId))!;

    expect(f.abonos).toHaveLength(2);
    const anulado = f.abonos.find((a) => a.id === a1.abonoId)!;
    expect(anulado.anuladoEn).toBeInstanceOf(Date);
    expect(anulado.motivoAnulacion).toBe("pago mal tecleado");
    expect(anulado.anuladoPorNombre).toBe("Maru");
    // La cifra sale del modulo de saldo: solo lo vigente (200 de 1.000).
    expect(f.saldo).toMatchObject({ abonado: 200, saldo: 800, abonosVigentes: 1 });
    // Y el saldo de la ficha es exactamente el del modulo.
    const { saldosDeDeals } = await import("@/lib/queries/saldo");
    expect((await saldosDeDeals(db, [dealId])).get(dealId)).toEqual(f.saldo);
  });

  it("las llamadas anuladas tambien se ven marcadas", async () => {
    await db.insert(calls).values({ dealId, programId, resultado: "show", fechaAgenda: new Date("2026-09-20T15:00:00Z"), closerUserId: closer, origen: "crm" });
    await db.insert(calls).values({
      dealId,
      programId,
      resultado: "agendada",
      fechaAgenda: new Date("2026-09-25T15:00:00Z"),
      origen: "crm",
      anuladoEn: new Date(),
      anuladoPor: closer,
      motivoAnulacion: "duplicada",
    });

    const f = (await fichaDeDeal(db, programId, dealId))!;

    expect(f.llamadas).toHaveLength(2);
    // La mas reciente primero.
    expect(f.llamadas[0].resultado).toBe("agendada");
    expect(f.llamadas[0]).toMatchObject({ motivoAnulacion: "duplicada", anuladoPorNombre: "Maru" });
    expect(f.llamadas[1]).toMatchObject({ resultado: "show", closerNombre: "Maru", anuladoEn: null });
  });

  it("el historial dice quien movio (null = sistema) y el motivo; las actividades, su autor", async () => {
    const [m] = await db.insert(motivos).values({ nombre: "Sin dinero", tipo: "perdida" }).returning();
    await db.insert(dealEtapaHistorial).values([
      { dealId, de: null, a: "registrado", userId: null, fecha: new Date("2026-09-01T10:00:00Z") },
      { dealId, de: "registrado", a: "atendido", userId: closer, motivoId: m.id, fecha: new Date("2026-09-02T10:00:00Z") },
    ]);
    await db.insert(dealActividades).values([
      { dealId, tipo: "contacto", canal: "WhatsApp", userId: closer, nota: "Le escribí", fecha: new Date("2026-09-03T10:00:00Z") },
      { dealId, tipo: "nota", userId: null, nota: "Nota del sistema", fecha: new Date("2026-09-04T10:00:00Z") },
    ]);

    const f = (await fichaDeDeal(db, programId, dealId))!;

    expect(f.historial.map((h) => [h.de, h.a, h.porNombre, h.motivoNombre])).toEqual([
      [null, "registrado", null, null],
      ["registrado", "atendido", "Maru", "Sin dinero"],
    ]);
    // Las actividades, de la mas nueva a la mas vieja.
    expect(f.actividades.map((a) => [a.tipo, a.autorNombre])).toEqual([
      ["nota", null],
      ["contacto", "Maru"],
    ]);
  });

  it("un deal anulado SE ABRE, marcado con quien y por que", async () => {
    await anularDeal(db, comoCloser(), { dealId, motivo: "lo registré mal" });
    const f = (await fichaDeDeal(db, programId, dealId))!;
    expect(f.anulado).toMatchObject({ porNombre: "Maru", motivo: "lo registré mal" });
    expect(f.etapa).toBe("atendido");
  });

  it("sin cohorte propia, la sugerencia es el inicio de clases de la activa; sin ninguna, null", async () => {
    await db.update(deals).set({ cohortId: null });
    expect((await fichaDeDeal(db, programId, dealId))!.fechaLimiteSugerida).toBe("2026-10-01");
    await db.update(cohorts).set({ estado: "cerrado" });
    expect((await fichaDeDeal(db, programId, dealId))!.fechaLimiteSugerida).toBeNull();
  });
});

describe("bloques puros de la ficha", () => {
  it("convierte respuestas en orden, omite UTM y vacíos y conserva los valores", () => {
    expect(
      respuestasLegibles({
        Nombre: " Ana ",
        utm_source: "facebook",
        " UTM_ID ": "42",
        Vacio: "",
        Nulo: null,
        Opciones: ["A", 2, true, null],
        Puntaje: 7,
        Extra: { a: 1 },
      }),
    ).toEqual([
      { pregunta: "Nombre", respuesta: " Ana " },
      { pregunta: "Opciones", respuesta: "A, 2, true" },
      { pregunta: "Puntaje", respuesta: "7" },
      { pregunta: "Extra", respuesta: '{"a":1}' },
    ]);
    expect(respuestasLegibles(null)).toEqual([]);
    expect(respuestasLegibles(["no es objeto"])).toEqual([]);
  });

  it("deriva el nombre con y sin cohorte y usa el correo cuando falta el nombre", () => {
    expect(nombreDelDeal({ leadNombre: "Ana", leadEmail: "ana@correo.co", programaNombre: "P", cohorteCodigo: "C1" })).toBe("Ana | P | C1");
    expect(nombreDelDeal({ leadNombre: null, leadEmail: "ana@correo.co", programaNombre: "P", cohorteCodigo: null })).toBe(
      "ana@correo.co | P | Sin cohorte",
    );
  });
});

describe("opcionesDeFicha", () => {
  it("ofrece cohortes no cerradas y limita el destino a futuras distintas de la actual", async () => {
    const [c2, c3] = await db.insert(cohorts).values([
      { programId, codigo: "C2", metaCupos: 10, precioUsd: "1000", fechaInicioClases: "2026-11-01", fechaCierreVentas: "2026-10-31", estado: "futuro" },
      { programId, codigo: "C3", metaCupos: 10, precioUsd: "1000", fechaInicioClases: "2026-12-01", fechaCierreVentas: "2026-11-30", estado: "futuro" },
      { programId, codigo: "C4", metaCupos: 10, precioUsd: "1000", fechaInicioClases: "2027-01-01", fechaCierreVentas: "2026-12-31", estado: "cerrado" },
      { programId: otroPrograma, codigo: "C5", metaCupos: 10, precioUsd: "500", fechaInicioClases: "2027-02-01", fechaCierreVentas: "2027-01-31", estado: "futuro" },
    ]).returning();
    await db.update(deals).set({ cohortId: c2.id }).where(eq(deals.id, dealId));

    const o = await opcionesDeFicha(db, programId, closer, c2.id);

    expect(o.cohortes.map((c) => c.nombre)).toEqual(["C1", "C2", "C3"]);
    expect(o.cohortesDestino.map((c) => c.nombre)).toEqual([c3.codigo]);
    // El dueño actual aparece aunque no tenga membresia (para no dejar el selector sin su valor).
    expect(o.owners.map((x) => x.id)).toEqual([closer]);
  });
});
