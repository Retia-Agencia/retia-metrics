import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { abonos, cohorts } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import { normalizando } from "@/lib/errors-zod";
import { exigirPlataformaActiva } from "@/lib/abonos/plataforma";
import { crearConRastro } from "@/lib/crm/rastro";
import { saldosDeDeals } from "@/lib/queries/saldo";
import { incluyendoAnulados } from "@/lib/queries/vigente";
import { moverEtapa } from "./mover-etapa";
import {
  dealBloqueado,
  destinoDespuesDelAbono,
  exigirSaldoParaAbono,
} from "./abonos";
import { congelarValorVendido } from "./valor-vendido";
import { lineaConCupoVigente, recalcularDealPorLineas } from "./lineas";
import { aceptaAbono, NOMBRE_DE_ETAPA, transicion, transicionDeVentaDirecta, type EtapaDeal } from "./etapas";

export type OrigenDePasarela = "hotmart";

export const esquemaVentaDeLaPasarela = z.object({
  dealId: z.string().uuid("El deal no es válido."),
  monto: z.union([z.string(), z.number()])
    .transform((monto) => Number(monto))
    .pipe(z.number().positive("El monto debe ser mayor que cero.")),
  moneda: z.enum(["USD", "COP"]),
  plataformaId: z.string().uuid("Plataforma inválida."),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe tener formato YYYY-MM-DD."),
  origen: z.literal("hotmart"),
  referenciaExterna: z.string().trim().min(1, "La referencia externa es obligatoria."),
});
export type DatosVentaDeLaPasarela = z.input<typeof esquemaVentaDeLaPasarela>;

export interface VentaDeLaPasarelaRegistrada {
  abonoId: string;
  repetida: boolean;
  etapa: EtapaDeal;
  movioElDeal: boolean;
  saldo: number | null;
  ventaDirecta: boolean;
}

type Transaccion = { transaction: <T>(fn: (tx: Db) => Promise<T>) => Promise<T> };
type CohorteParaVentaDirecta = Pick<typeof cohorts.$inferSelect, "fechaCierreVentas">;

/** ADR 0133 D2: un pago parcial confirmado vence al cierre comercial de su cohorte. */
export function fechaLimiteDeVentaDirecta(cohorte: CohorteParaVentaDirecta): string | null {
  return cohorte.fechaCierreVentas;
}

export async function registrarVentaDeLaPasarela(
  db: Db,
  datos: DatosVentaDeLaPasarela,
): Promise<VentaDeLaPasarelaRegistrada> {
  return normalizando(async () => {
    const entrada = esquemaVentaDeLaPasarela.parse(datos);
    return (db as unknown as Transaccion).transaction(async (tx) => {
      const { deal, emailLead } = await dealBloqueado(tx, entrada.dealId);
      const ventaDirecta = deal.ownerUserId == null;

      const [existente] = await tx
        .select({ id: abonos.id })
        .from(abonos)
        // Idempotencia contra el índice único, que incluye anulados (vigente.ts, cuarto uso).
        .where(and(
          eq(abonos.origen, entrada.origen),
          eq(abonos.referenciaExterna, entrada.referenciaExterna),
          incluyendoAnulados(abonos),
        ))
        .limit(1);
      if (existente) {
        const saldo = (await saldosDeDeals(tx, [deal.id])).get(deal.id)?.saldo ?? null;
        return {
          abonoId: existente.id,
          repetida: true,
          etapa: deal.etapa,
          movioElDeal: false,
          saldo,
          ventaDirecta,
        };
      }

      if (deal.anuladoEn) {
        throw new ErrorDeApp("El deal está anulado: no cuenta en ninguna métrica y no recibe abonos.", 409);
      }
      if (deal.etapa === "ganado_completo" || deal.etapa === "cierre_perdido") {
        throw new ErrorDeApp("El deal está cerrado: no recibe abonos nuevos.", 409);
      }

      let cohortId = deal.cohortId;
      if (deal.valorVendidoUsd == null || Number(deal.valorVendidoUsd) === 0) {
        const congelado = await congelarValorVendido(tx, {
          deal,
          descuentoUsd: 0,
          actorId: null,
          etiqueta: emailLead,
          origen: entrada.origen,
        });
        cohortId = congelado.cohortId;
      }
      const linea = await lineaConCupoVigente(tx, deal.id);
      if (!linea) throw new ErrorDeApp("El deal no tiene una línea vigente que cuente como cupo.", 409);

      await exigirPlataformaActiva(entrada.plataformaId, tx);
      await exigirSaldoParaAbono(tx, {
        dealId: deal.id,
        lineaId: linea.id,
        moneda: entrada.moneda,
        monto: entrada.monto,
      });

      const abonoId = await crearConRastro(
        {
          db: tx,
          tabla: abonos,
          nombreTabla: "abonos",
          actorId: null,
          etiqueta: emailLead,
          origen: entrada.origen,
        },
        {
          dealId: deal.id,
          lineaId: linea.id,
          programId: deal.programId,
          fecha: entrada.fecha,
          monto: String(entrada.monto),
          moneda: entrada.moneda,
          concepto: "ticket",
          nota: null,
          plataformaId: entrada.plataformaId,
          enlacePagoId: null,
          comprobanteUrl: null,
          comprobanteArchivoId: null,
          registradoPorUserId: null,
          closerId: null,
          origen: entrada.origen,
          referenciaExterna: entrada.referenciaExterna,
        },
      );

      await recalcularDealPorLineas(tx, deal.id, { actorId: null, etiqueta: emailLead, origen: entrada.origen });

      const { saldo, destino } = await destinoDespuesDelAbono(tx, deal.id);
      if (deal.etapa === destino) {
        return { abonoId, repetida: false, etapa: deal.etapa, movioElDeal: false, saldo, ventaDirecta };
      }
      const flechaVentaDirecta = ventaDirecta ? transicionDeVentaDirecta(deal.etapa, destino) : null;
      const flecha = flechaVentaDirecta ?? transicion(deal.etapa, destino);
      if ((!flechaVentaDirecta && !aceptaAbono(deal.etapa)) || !flecha) {
        throw new ErrorDeApp(
          `Desde ${NOMBRE_DE_ETAPA[deal.etapa]} no se registra un abono: mueve primero el deal a una etapa donde el lead ya hable de pagar.`,
          409,
        );
      }

      let datosMovimiento: { fechaLimitePago: string | null } | undefined;
      if (destino === "ganado_parcial" && deal.fechaLimitePago == null && cohortId != null) {
        const [cohorte] = await tx
          .select({ fechaCierreVentas: cohorts.fechaCierreVentas })
          .from(cohorts)
          .where(eq(cohorts.id, cohortId));
        const fechaLimitePago = cohorte ? fechaLimiteDeVentaDirecta(cohorte) : null;
        if (fechaLimitePago != null) datosMovimiento = { fechaLimitePago };
      }

      await moverEtapa(tx, {
        dealId: deal.id,
        a: destino,
        actor: { tipo: "sistema" },
        origen: entrada.origen,
        datos: datosMovimiento,
        ...(flechaVentaDirecta ? { ventaDirecta: true as const } : {}),
      });

      return { abonoId, repetida: false, etapa: destino, movioElDeal: true, saldo, ventaDirecta };
    });
  });
}
