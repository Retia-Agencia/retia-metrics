import { and, desc, eq, inArray } from "drizzle-orm";
import { abonos, cohorts, deals, enlacesPago, plataformasPago, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import {
  descuentoDeDeal,
  saldosDeDeals,
  type DescuentoDeDeal,
  type SaldoDeDeal,
} from "@/lib/queries/saldo";
import { incluyendoAnulados, vigente } from "@/lib/queries/vigente";

export interface AbonoDeStudent {
  id: string;
  fecha: string;
  monto: string;
  moneda: string;
  concepto: "ticket" | "adicional";
  nota: string | null;
  plataformaNombre: string | null;
  enlacePagoNombre: string | null;
  comprobanteUrl: string | null;
  comprobanteArchivoId: string | null;
  registradoPorNombre: string | null;
  anuladoEn: Date | null;
  motivoAnulacion: string | null;
  anuladoPorNombre: string | null;
}

export interface PagosDeStudent {
  valorVendidoUsd: number | null;
  descuento: DescuentoDeDeal | null;
  saldo: SaldoDeDeal;
  acuerdoPago: string | null;
  fechaLimitePago: string | null;
  abonos: AbonoDeStudent[];
}

/**
 * Toda la información de pagos de varios students. El programa es frontera tanto para
 * los deals como para sus abonos; las tablas auxiliares se resuelven en memoria.
 */
export async function pagosDeStudents(
  db: Db,
  programId: string,
  dealIds: readonly string[],
): Promise<Map<string, PagosDeStudent>> {
  if (dealIds.length === 0) return new Map();

  const dealsFilas = await db
    .select({
      id: deals.id,
      valorVendidoUsd: deals.valorVendidoUsd,
      acuerdoPago: deals.acuerdoPago,
      fechaLimitePago: deals.fechaLimitePago,
      ticketUsd: cohorts.precioUsd,
    })
    .from(deals)
    .leftJoin(cohorts, eq(cohorts.id, deals.cohortId))
    .where(and(eq(deals.programId, programId), inArray(deals.id, [...dealIds]), vigente(deals)));

  const idsValidos = dealsFilas.map((fila) => fila.id);
  if (idsValidos.length === 0) return new Map();

  const [saldos, abonosFilas] = await Promise.all([
    saldosDeDeals(db, idsValidos),
    db
      .select({
        id: abonos.id,
        dealId: abonos.dealId,
        fecha: abonos.fecha,
        monto: abonos.monto,
        moneda: abonos.moneda,
        concepto: abonos.concepto,
        nota: abonos.nota,
        plataformaId: abonos.plataformaId,
        enlacePagoId: abonos.enlacePagoId,
        comprobanteUrl: abonos.comprobanteUrl,
        comprobanteArchivoId: abonos.comprobanteArchivoId,
        registradoPorUserId: abonos.registradoPorUserId,
        closerId: abonos.closerId,
        anuladoEn: abonos.anuladoEn,
        motivoAnulacion: abonos.motivoAnulacion,
        anuladoPorUserId: abonos.anuladoPor,
      })
      .from(abonos)
      .where(
        and(
          eq(abonos.programId, programId),
          inArray(abonos.dealId, idsValidos),
          incluyendoAnulados(abonos),
        ),
      )
      .orderBy(desc(abonos.fecha), desc(abonos.createdAt)),
  ]);

  const idsDePlataformas = abonosFilas.flatMap((a) => (a.plataformaId ? [a.plataformaId] : []));
  const idsDeEnlaces = abonosFilas.flatMap((a) => (a.enlacePagoId ? [a.enlacePagoId] : []));
  const idsDeUsuarios = abonosFilas.flatMap((a) =>
    [a.registradoPorUserId, a.anuladoPorUserId].filter((id): id is string => id != null),
  );
  const [plataformasFilas, enlacesFilas, usuariosFilas] = await Promise.all([
    idsDePlataformas.length > 0
      ? db.select({ id: plataformasPago.id, nombre: plataformasPago.nombre }).from(plataformasPago).where(inArray(plataformasPago.id, idsDePlataformas))
      : [],
    idsDeEnlaces.length > 0
      ? db.select({ id: enlacesPago.id, nombre: enlacesPago.nombre }).from(enlacesPago).where(inArray(enlacesPago.id, idsDeEnlaces))
      : [],
    idsDeUsuarios.length > 0
      ? db.select({ id: users.id, nombre: users.nombre }).from(users).where(inArray(users.id, idsDeUsuarios))
      : [],
  ]);

  const plataformasPorId = new Map(plataformasFilas.map((fila) => [fila.id, fila.nombre]));
  const enlacesPorId = new Map(enlacesFilas.map((fila) => [fila.id, fila.nombre]));
  const usuariosPorId = new Map(usuariosFilas.map((fila) => [fila.id, fila.nombre]));

  return new Map(
    dealsFilas.flatMap((deal) => {
      const saldo = saldos.get(deal.id);
      if (!saldo) return [];
      const valorVendidoUsd = deal.valorVendidoUsd == null ? null : Number(deal.valorVendidoUsd);
      return [[deal.id, {
        valorVendidoUsd,
        descuento: descuentoDeDeal(deal.ticketUsd, deal.valorVendidoUsd),
        saldo,
        acuerdoPago: deal.acuerdoPago,
        fechaLimitePago: deal.fechaLimitePago,
        abonos: abonosFilas
          .filter((abono) => abono.dealId === deal.id)
          .map((abono) => ({
            id: abono.id,
            fecha: abono.fecha,
            monto: abono.monto,
            moneda: abono.moneda,
            concepto: abono.concepto,
            nota: abono.nota,
            plataformaNombre: abono.plataformaId ? plataformasPorId.get(abono.plataformaId) ?? null : null,
            enlacePagoNombre: abono.enlacePagoId ? enlacesPorId.get(abono.enlacePagoId) ?? null : null,
            comprobanteUrl: abono.comprobanteUrl,
            comprobanteArchivoId: abono.comprobanteArchivoId,
            registradoPorNombre: abono.registradoPorUserId
              ? usuariosPorId.get(abono.registradoPorUserId) ?? abono.closerId
              : abono.closerId,
            anuladoEn: abono.anuladoEn,
            motivoAnulacion: abono.motivoAnulacion,
            anuladoPorNombre: abono.anuladoPorUserId
              ? usuariosPorId.get(abono.anuladoPorUserId) ?? null
              : null,
          })),
      } satisfies PagosDeStudent] as const];
    }),
  );
}
