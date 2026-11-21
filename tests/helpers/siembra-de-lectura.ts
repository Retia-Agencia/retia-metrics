import { abonoDePrueba } from "./catalogo-de-prueba";
import {
  calls, cohorts, cuentasPublicitarias, dealEtapaHistorial, deals, gastoPauta, leads, pautaObjetos, programs, sources,
  submissions, users, usuariosProgramasAlcance,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { PROGRAMA_DE_PRUEBA } from "./programa-de-prueba";

/**
 * La siembra de las vistas de lectura (407): dos programas, envíos de pauta y orgánicos (con un parcial que luego se completó),
 * llamadas anuladas, de un deal anulado y sueltas, una venta con primer pago anterior a su etapa, abonos en dos monedas y gasto
 * de pauta con y sin objeto. Es la misma de `tests/mcp-lectura-vistas.test.ts`; el test de la definición única la reusa.
 */
export async function sembrarLectura(db: Db) {
  const ids: Record<string, string> = {};
  const [a, b] = await db.insert(programs).values([
    { ...PROGRAMA_DE_PRUEBA, slug: "lectura-a", nombre: "Lectura A" },
    { ...PROGRAMA_DE_PRUEBA, slug: "lectura-b", nombre: "Lectura B" },
  ]).returning();
  const programaA = a.id;
  const programaB = b.id;
  const [gerente, paid, closer] = await db.insert(users).values([
    { email: "gerente-lectura@retia.test", nombre: "Gerente", rol: "gerente" },
    { email: "paid-lectura@retia.test", nombre: "Paid", rol: "paid_trafficker" },
    { email: "closer-lectura@retia.test", nombre: "Nicolás", rol: "closer", closerId: "Nicolás" },
  ]).returning();
  const gerenteId = gerente.id;
  const paidId = paid.id;
  const closerId = closer.id;
  await db.insert(usuariosProgramasAlcance).values({ userId: paidId, programId: programaA });
  const [cohorte] = await db.insert(cohorts).values({ programId: programaA, codigo: "L-1", metaCupos: 10, fechaInicioVentas: "2026-11-01", fechaCierreVentas: "2026-11-30", fechaInicioClases: "2026-12-01" }).returning();
  const [fuente, fuenteB] = await db.insert(sources).values([
    { programId: programaA, nombre: "Formulario A" },
    { programId: programaB, nombre: "Formulario B" },
  ]).returning();
  const [cuenta] = await db.insert(cuentasPublicitarias).values({ idMeta: "111", programId: programaA, nombre: "Cuenta 1", moneda: "USD", zonaHoraria: "America/Bogota" }).returning();
  const [campana] = await db.insert(pautaObjetos).values({ cuentaId: cuenta.id, programId: programaA, idMeta: "900", nivel: "campana", nombre: "Campaña", estado: "ACTIVE" }).returning();
  const [anuncio] = await db.insert(pautaObjetos).values({ cuentaId: cuenta.id, programId: programaA, idMeta: "999", nivel: "anuncio", padreIdMeta: campana.idMeta, nombre: "Anuncio", estado: "ACTIVE" }).returning();
  const fecha = (iso: string) => new Date(iso);
  const [l1, l2, l3, l4, l5, lb] = await db.insert(leads).values([
    { programId: programaA, emailNormalizado: "ana@retia.test", nombre: "Ana", fechaPrimeraAplicacion: fecha("2026-11-05T23:30:00-05:00") },
    { programId: programaA, emailNormalizado: "beto@retia.test", nombre: "Beto", fechaPrimeraAplicacion: fecha("2026-11-06T00:30:00-05:00") },
    { programId: programaA, emailNormalizado: "cami@retia.test", nombre: "Cami", fechaPrimeraAplicacion: fecha("2026-11-09T10:00:00-05:00") },
    { programId: programaA, emailNormalizado: "dani@retia.test", nombre: "Dani", fechaPrimeraAplicacion: fecha("2026-11-09T10:00:00-05:00") },
    { programId: programaA, emailNormalizado: "eli@retia.test", nombre: "Eli", fechaPrimeraAplicacion: fecha("2026-11-09T10:00:00-05:00") },
    { programId: programaB, emailNormalizado: "otro@retia.test", nombre: "Ajeno", fechaPrimeraAplicacion: fecha("2026-11-05T10:00:00-05:00") },
  ]).returning();
  const [s1, s2, s3, s4, s5, , sb] = await db.insert(submissions).values([
    // 23:30 de Bogotá del 5 es ya el 6 en UTC: el día de negocio sigue siendo el 5.
    { leadId: l1.id, sourceId: fuente.id, token: "s1", fechaEnvio: fecha("2026-11-05T23:30:00-05:00"), utmSource: "instagram", utmMedium: "paid_social" },
    // La misma persona otra vez: dos envíos, un solo correo.
    { leadId: l1.id, sourceId: fuente.id, token: "s2", fechaEnvio: fecha("2026-11-08T10:00:00-05:00"), utmSource: "instagram", utmMedium: "paid_social" },
    { leadId: l2.id, sourceId: fuente.id, token: "s3", fechaEnvio: fecha("2026-11-06T00:30:00-05:00"), utmSource: "IG  Cuenta Uno", utmMedium: "CPC" },
    // Origen orgánico por su UTM, pero su utm_id está en el árbol de pauta: es paid.
    { leadId: l3.id, sourceId: fuente.id, token: "s4", fechaEnvio: fecha("2026-11-09T10:00:00-05:00"), utmSource: "newsletter", utmMedium: "email", utmId: anuncio.idMeta },
    { leadId: l5.id, sourceId: fuente.id, token: "s5", esParcial: true, fechaEnvio: fecha("2026-11-09T11:00:00-05:00"), utmSource: "instagram", utmMedium: "cpc" },
    // Un parcial de s1 que después se completó (mismo formulario y token): no cuenta aparte.
    { leadId: l1.id, sourceId: fuente.id, token: "s1", esParcial: true, utmSource: "instagram", utmMedium: "paid_social" },
    { leadId: lb.id, sourceId: fuenteB.id, token: "sb", fechaEnvio: fecha("2026-11-05T10:00:00-05:00"), utmSource: "instagram", utmMedium: "cpc" },
  ]).returning();
  const [d1, d2, d3, d4, d5, db1] = await db.insert(deals).values([
    { programId: programaA, leadId: l1.id, submissionOrigenId: s1.id, cohortId: cohorte.id, ownerUserId: closerId, etapa: "ganado_parcial", valorVendidoUsd: "797" },
    { programId: programaA, leadId: l2.id, submissionOrigenId: s3.id, cohortId: cohorte.id, ownerUserId: closerId, etapa: "ganado_completo", cortesia: true, valorVendidoUsd: "0" },
    { programId: programaA, leadId: l3.id, submissionOrigenId: s4.id, cohortId: cohorte.id, ownerUserId: closerId, etapa: "cierre_perdido" },
    { programId: programaA, leadId: l4.id, ownerUserId: closerId, etapa: "ganado_parcial", valorVendidoUsd: "797", anuladoEn: new Date(), anuladoPor: gerenteId, motivoAnulacion: "prueba" },
    { programId: programaA, leadId: l5.id, etapa: "agendado" },
    { programId: programaB, leadId: lb.id, submissionOrigenId: sb.id, ownerUserId: closerId, etapa: "ganado_parcial", valorVendidoUsd: "1500" },
  ]).returning();
  Object.assign(ids, { d1: d1.id, d2: d2.id, d3: d3.id, d4: d4.id, d5: d5.id, db1: db1.id, s5: s5.id, s1: s1.id, s2: s2.id, s3: s3.id, s4: s4.id, l1: l1.id, anuncio: anuncio.id });
  // d1: vendido el 6, reversado el 7 (se anuló su abono) y vendido otra vez el 8: la venta cuenta el 8.
  await db.insert(dealEtapaHistorial).values([
    { dealId: d1.id, de: "agendado", a: "ganado_parcial", userId: closerId, fecha: fecha("2026-11-06T12:00:00-05:00") },
    { dealId: d1.id, de: "ganado_parcial", a: "agendado", userId: closerId, fecha: fecha("2026-11-07T12:00:00-05:00") },
    { dealId: d1.id, de: "agendado", a: "ganado_parcial", userId: closerId, fecha: fecha("2026-11-08T23:45:00-05:00") },
    { dealId: d2.id, de: "agendado", a: "ganado_completo", userId: closerId, fecha: fecha("2026-11-06T12:00:00-05:00") },
    { dealId: d4.id, de: "agendado", a: "ganado_parcial", userId: closerId, fecha: fecha("2026-11-06T12:00:00-05:00") },
    { dealId: db1.id, de: "agendado", a: "ganado_parcial", userId: closerId, fecha: fecha("2026-11-06T12:00:00-05:00") },
  ]);
  const llamada = (extra: Partial<typeof calls.$inferInsert>) => ({ programId: programaA, origen: "app", resultado: "agendada" as const, ...extra });
  const [c1, c2, c3, c4, c5] = await db.insert(calls).values([
    llamada({ dealId: d1.id, closerUserId: closerId, resultado: "show", fechaAgenda: fecha("2026-11-06T09:00:00-05:00"), fechaLlamada: fecha("2026-11-06T09:00:00-05:00"), createdAt: fecha("2026-11-05T23:50:00-05:00") }),
    llamada({ dealId: d1.id, closerUserId: closerId, anuladoEn: new Date(), anuladoPor: gerenteId, motivoAnulacion: "prueba", fechaAgenda: fecha("2026-11-06T10:00:00-05:00") }),
    llamada({ dealId: d4.id, closerUserId: closerId, fechaAgenda: fecha("2026-11-07T10:00:00-05:00") }),
    llamada({ dealId: d5.id, fechaAgenda: fecha("2026-11-10T10:00:00-05:00"), createdAt: fecha("2026-11-09T12:00:00-05:00") }),
    llamada({ fechaAgenda: fecha("2026-11-11T10:00:00-05:00"), createdAt: fecha("2026-11-10T12:00:00-05:00") }),
  ]).returning();
  Object.assign(ids, { c1: c1.id, c2: c2.id, c3: c3.id, c4: c4.id, c5: c5.id });
  const [a1, a2, a3, a4] = await abonoDePrueba(db, [
    { programId: programaA, dealId: d1.id, fecha: "2026-11-08", monto: "100.50", moneda: "USD", registradoPorUserId: closerId },
    { programId: programaA, dealId: d1.id, fecha: "2026-11-08", monto: "200000", moneda: "COP", registradoPorUserId: closerId },
    { programId: programaA, dealId: d1.id, fecha: "2026-11-08", monto: "50", moneda: "USD", registradoPorUserId: closerId, anuladoEn: new Date(), anuladoPor: gerenteId, motivoAnulacion: "prueba" },
    { programId: programaA, dealId: d4.id, fecha: "2026-11-08", monto: "30", moneda: "USD", registradoPorUserId: closerId },
    // El primer pago de d1 (2 de nov) es anterior a su entrada a Abonado: la venta se fecha por el pago.
    { programId: programaA, dealId: d1.id, fecha: "2026-11-02", monto: "10", moneda: "USD", registradoPorUserId: closerId },
    // Un pago anulado todavía más viejo no fecha nada.
    { programId: programaA, dealId: d1.id, fecha: "2026-10-01", monto: "5", moneda: "USD", registradoPorUserId: closerId, anuladoEn: new Date(), anuladoPor: gerenteId, motivoAnulacion: "prueba" },
  ]);
  Object.assign(ids, { a1: a1.id, a2: a2.id, a3: a3.id, a4: a4.id });
  const [g1, g2, g3] = await db.insert(gastoPauta).values([
    { programId: programaA, fecha: "2026-11-05", monto: "300000", moneda: "COP", origen: "manual", area: "paid" },
    { programId: programaA, fecha: "2026-11-05", monto: "999", moneda: "COP", origen: "manual", area: "organico" },
    { programId: programaA, fecha: "2026-11-06", monto: "12.5", moneda: "USD", origen: "manual", pautaObjetoId: anuncio.id },
    { programId: programaB, fecha: "2026-11-05", monto: "7", moneda: "USD", origen: "manual", area: "paid" },
  ]).returning();
  Object.assign(ids, { g1: g1.id, g2: g2.id, g3: g3.id });
  return { programaA, programaB, gerenteId, paidId, closerId, ids };
}
