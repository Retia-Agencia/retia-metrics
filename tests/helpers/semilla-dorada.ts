import { abonos, cohorts, dealEtapaHistorial, deals, leads, miembrosPrograma, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import type { EtapaDeal } from "@/lib/deals/etapas";
import { FECHA_LEAD_DE_PRUEBA } from "./crear-lead-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./programa-de-prueba";

/**
 * Semilla de los NUMEROS DORADOS (ticket 385, contrato de metricas y datos §4).
 *
 * Una base fabricada a mano, determinista y versionada con el codigo: fechas absolutas, sin `now()`, sin
 * azar. **Nunca toca produccion**: se carga solo en la base PGlite en memoria de un test. Existe porque
 * produccion NO tiene siete de los casos que hacen divergir dos implementaciones correctas (F2 §3).
 *
 * El mapa de abajo es la fuente de lo esperado: cada deal lleva un `clave` y el test habla de claves, no de
 * ids opacos, asi un fallo dice QUE deal sobra o falta. Cambiar una formula o esta semilla obliga a editar
 * los esperados a mano en el mismo commit (N8): nunca se regeneran.
 *
 * HOY = 2026-11-06. Programa A (ticket USD 1000) tiene tres cohortes; B (ticket USD 1500) una.
 *   C1  cerrada, SIN `fechaInicioVentas` (el CHECK solo lo exige a la activa) ........ A
 *   C2  cerrada, ventas 12-oct a 31-oct ............................................. A
 *   C3  activa, ventas 1-nov a 20-nov (el rango de 14 dias cruza C2 y C3) ........... A
 *   B1  activa, ventas 1-oct a 30-nov ............................................... B
 */
export const HOY_DORADO = "2026-11-06";

export const PERIODOS_DORADOS = {
  /** El mes cerrado. */
  mesCerrado: { desde: "2026-10-01", hasta: "2026-10-31" },
  /** El mes en curso al dia de hoy. */
  mesEnCurso: { desde: "2026-11-01", hasta: HOY_DORADO },
  /** 14 dias que cruzan el cambio de mes y el cambio de cohorte C2 a C3. */
  custom14: { desde: "2026-10-24", hasta: HOY_DORADO },
} as const;

export type ClaveDeal =
  | "a1_parcial" | "a2_completo" | "a3_perdida" | "a4_noche" | "a5_cohorte3" | "a6_sin_cohorte"
  | "a7_sin_valor" | "a8_cortesia" | "a9_anulado" | "a10_cohorte1"
  | "b1_cop" | "b2_usd" | "b3_mismo_correo";

export interface SemillaDorada {
  programaA: string;
  programaB: string;
  slugA: string;
  slugB: string;
  cohorteC1: string;
  cohorteC2: string;
  cohorteC3: string;
  gerenteId: string;
  closerId: string;
  deal: Record<ClaveDeal, string>;
  /** De id a clave, para que un fallo de paridad nombre las filas que sobran o faltan. */
  claveDe: (dealId: string) => string;
}

const bogota = (dia: string, hora = "11:00") => new Date(`${dia}T${hora}:00-05:00`);

export async function sembrarDorada(db: Db): Promise<SemillaDorada> {
  const [pa, pb] = await db.insert(programs).values([
    { ...PROGRAMA_DE_PRUEBA, slug: "dorado-a", nombre: "Dorado A", ticketUsd: "1000" },
    { ...PROGRAMA_DE_PRUEBA, slug: "dorado-b", nombre: "Dorado B", ticketUsd: "1500" },
  ]).returning();

  const [gerente, closer] = await db.insert(users).values([
    { email: "gerente-dorado@retia.test", rol: "gerente" },
    { email: "closer-dorado@retia.test", rol: "closer", closerId: "Ana" },
  ]).returning();
  await db.insert(miembrosPrograma).values([
    { userId: closer.id, programId: pa.id },
    { userId: closer.id, programId: pb.id },
  ]);

  const [c1, c2, c3, cb] = await db.insert(cohorts).values([
    { programId: pa.id, codigo: "C1", metaCupos: 10, precioUsd: "1000", fechaInicioClases: "2026-09-01", fechaCierreVentas: "2026-10-10", estado: "cerrado" },
    { programId: pa.id, codigo: "C2", metaCupos: 20, precioUsd: "1000", fechaInicioClases: "2026-11-15", fechaInicioVentas: "2026-10-12", fechaCierreVentas: "2026-10-31", estado: "cerrado" },
    { programId: pa.id, codigo: "C3", metaCupos: 20, precioUsd: "1000", fechaInicioClases: "2026-12-15", fechaInicioVentas: "2026-11-01", fechaCierreVentas: "2026-11-20", estado: "activo" },
    { programId: pb.id, codigo: "B1", metaCupos: 20, precioUsd: "1500", fechaInicioClases: "2026-12-15", fechaInicioVentas: "2026-10-01", fechaCierreVentas: "2026-11-30", estado: "activo" },
  ]).returning();

  const ids = {} as Record<ClaveDeal, string>;
  let n = 0;

  interface Venta {
    clave: ClaveDeal;
    programId: string;
    cohortId: string | null;
    etapa: EtapaDeal;
    /** Primera entrada a Abonado o Completo, instante de Bogota. */
    entrada: Date;
    valor: string | null;
    owner?: string | null;
    /** Venta historica migrada de la hoja: unica forma de una venta vigente sin dueño (ADR 0122). */
    huellaMigracion?: string;
    cortesia?: boolean;
    anulado?: boolean;
    /** Movimientos posteriores del historial (reversas). */
    despues?: Array<{ de: EtapaDeal; a: EtapaDeal; cuando: Date }>;
    correo?: string;
  }

  async function deal(v: Venta) {
    const [lead] = await db.insert(leads).values({ fechaPrimeraAplicacion: FECHA_LEAD_DE_PRUEBA, programId: v.programId, emailNormalizado: v.correo ?? `lead${++n}@dorado.test` }).returning();
    const [d] = await db.insert(deals).values({
      programId: v.programId,
      leadId: lead.id,
      cohortId: v.cohortId,
      ownerUserId: v.owner === undefined ? closer.id : v.owner,
      huellaMigracion: v.huellaMigracion ?? null,
      etapa: v.etapa,
      valorVendidoUsd: v.valor,
      comisionPorcentaje: "10.00",
      cortesia: v.cortesia ?? false,
      anuladoEn: v.anulado ? bogota("2026-10-23", "09:00") : null,
      anuladoPor: v.anulado ? gerente.id : null,
      motivoAnulacion: v.anulado ? "Correccion de la semilla" : null,
    }).returning();
    await db.insert(dealEtapaHistorial).values([
      { dealId: d.id, a: "ganado_parcial" as EtapaDeal, fecha: v.entrada },
      ...(v.despues ?? []).map((m) => ({ dealId: d.id, de: m.de, a: m.a, fecha: m.cuando })),
    ]);
    ids[v.clave] = d.id;
    return d.id;
  }

  async function abono(clave: ClaveDeal, programId: string, fecha: string, monto: string, extra: { moneda?: string; concepto?: "ticket" | "adicional"; anulado?: boolean } = {}) {
    await db.insert(abonos).values({
      dealId: ids[clave],
      programId,
      fecha,
      monto,
      moneda: extra.moneda ?? "USD",
      concepto: extra.concepto ?? "ticket",
      registradoPorUserId: closer.id,
      anuladoEn: extra.anulado ? bogota("2026-11-01", "10:00") : null,
      anuladoPor: extra.anulado ? gerente.id : null,
      motivoAnulacion: extra.anulado ? "Correccion de la semilla" : null,
    });
  }

  // ───────────── programa A
  await deal({ clave: "a1_parcial", programId: pa.id, cohortId: c2.id, etapa: "ganado_parcial", entrada: bogota("2026-10-14"), valor: "1000" });
  await deal({ clave: "a2_completo", programId: pa.id, cohortId: c2.id, etapa: "ganado_completo", entrada: bogota("2026-10-20"), valor: "1000" });
  // Abonado que despues pasa a Cierre Perdido: deja de ser venta, su abono SIGUE siendo caja.
  await deal({
    clave: "a3_perdida", programId: pa.id, cohortId: c2.id, etapa: "cierre_perdido", entrada: bogota("2026-10-15"), valor: "1000",
    despues: [{ de: "ganado_parcial", a: "cierre_perdido", cuando: bogota("2026-10-18", "12:00") }],
  });
  // 9:30 p. m. de Bogota del 31-oct = 2026-11-01T02:30Z: en UTC ya es noviembre, en Bogota sigue siendo octubre.
  await deal({ clave: "a4_noche", programId: pa.id, cohortId: c2.id, etapa: "ganado_parcial", entrada: bogota("2026-10-31", "21:30"), valor: "1000" });
  await deal({ clave: "a5_cohorte3", programId: pa.id, cohortId: c3.id, etapa: "ganado_parcial", entrada: bogota("2026-11-02"), valor: "1000" });
  await deal({ clave: "a6_sin_cohorte", programId: pa.id, cohortId: null, etapa: "ganado_parcial", entrada: bogota("2026-11-03"), valor: "1000", owner: null, huellaMigracion: "hoja:dorado-a6" });
  await deal({ clave: "a7_sin_valor", programId: pa.id, cohortId: c3.id, etapa: "ganado_parcial", entrada: bogota("2026-11-04"), valor: null });
  await deal({ clave: "a8_cortesia", programId: pa.id, cohortId: c3.id, etapa: "ganado_completo", entrada: bogota("2026-11-04", "15:00"), valor: "0", cortesia: true });
  await deal({ clave: "a9_anulado", programId: pa.id, cohortId: c2.id, etapa: "ganado_parcial", entrada: bogota("2026-10-22"), valor: "1000", anulado: true });
  // Cohorte cerrada sin `fechaInicioVentas`: la venta cuenta para ella igual.
  await deal({ clave: "a10_cohorte1", programId: pa.id, cohortId: c1.id, etapa: "ganado_completo", entrada: bogota("2026-10-05"), valor: "1000" });

  await abono("a1_parcial", pa.id, "2026-10-14", "500");
  await abono("a1_parcial", pa.id, "2026-10-14", "77", { anulado: true });
  await abono("a2_completo", pa.id, "2026-10-20", "600");
  await abono("a2_completo", pa.id, "2026-10-28", "400");
  await abono("a2_completo", pa.id, "2026-11-01", "120", { concepto: "adicional" });
  await abono("a3_perdida", pa.id, "2026-10-15", "200");
  await abono("a4_noche", pa.id, "2026-10-31", "300");
  await abono("a5_cohorte3", pa.id, "2026-11-02", "700");
  await abono("a6_sin_cohorte", pa.id, "2026-11-03", "100");
  await abono("a7_sin_valor", pa.id, "2026-11-04", "150");
  // Un deal con abonos vigentes no se anula (lib/deals/anular): primero se anula el abono, despues el deal.
  await abono("a9_anulado", pa.id, "2026-10-22", "999", { anulado: true });
  await abono("a10_cohorte1", pa.id, "2026-10-05", "1000");

  // ───────────── programa B: otra moneda y el mismo correo que a1 (dos leads, nunca se cruzan)
  await deal({ clave: "b1_cop", programId: pb.id, cohortId: cb.id, etapa: "ganado_parcial", entrada: bogota("2026-10-20"), valor: "1500" });
  await deal({ clave: "b2_usd", programId: pb.id, cohortId: cb.id, etapa: "ganado_parcial", entrada: bogota("2026-11-03"), valor: "1500" });
  const correoA1 = "lead1@dorado.test";
  await deal({ clave: "b3_mismo_correo", programId: pb.id, cohortId: cb.id, etapa: "ganado_parcial", entrada: bogota("2026-11-05"), valor: "1500", correo: correoA1 });

  await abono("b1_cop", pb.id, "2026-10-20", "2000000", { moneda: "COP" });
  await abono("b2_usd", pb.id, "2026-11-03", "300");
  await abono("b3_mismo_correo", pb.id, "2026-11-05", "1500");

  const inverso = new Map(Object.entries(ids).map(([clave, id]) => [id, clave]));
  return {
    programaA: pa.id, programaB: pb.id, slugA: "dorado-a", slugB: "dorado-b",
    cohorteC1: c1.id, cohorteC2: c2.id, cohorteC3: c3.id,
    gerenteId: gerente.id, closerId: closer.id,
    deal: ids,
    claveDe: (dealId) => inverso.get(dealId) ?? `desconocido:${dealId.slice(0, 8)}`,
  };
}
