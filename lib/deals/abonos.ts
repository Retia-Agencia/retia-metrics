import { and, eq, ne, notInArray } from "drizzle-orm";
import { z } from "zod";
import { abonos, cohorts, deals, leads, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import { normalizando } from "@/lib/errors-zod";
import { esAdministrador, trabajaLeads, type Rol } from "@/lib/auth/roles";
import { esquemaAbono } from "@/lib/abonos/esquema";
import { exigirPlataformaActiva } from "@/lib/abonos/plataforma";
import { mismoCloser } from "@/lib/closers/identidad";
import { crearConRastro, editarConRastro } from "@/lib/crm/rastro";
import { saldosDeDeals } from "@/lib/queries/saldo";
import { incluyendoAnulados, vigente } from "@/lib/queries/vigente";
import { etapaALaQueVuelve, moverEtapa } from "./mover-etapa";
import { puedeTrabajarDeal } from "./permiso";
import { NOMBRE_DE_ETAPA, transicion, type EtapaDeal } from "./etapas";
import { congelarValorVendido } from "./valor-vendido";

/**
 * Registrar y anular un abono, y los movimientos que el SISTEMA hace por el dinero
 * (ticket 060, ADR 0013, ADR 0024, ADR 0026, ADR 0037).
 *
 * - **Primer abono con saldo > 0** → Abonado. **Saldo en cero** → Completo (T5, T13, T14,
 *   T16, T17, T26 y T18). El closer nunca mueve el deal a mano por dinero.
 * - **Anular** el abono que cerro el deal lo saca de Completo (A2); si era el unico abono,
 *   el deal vuelve a donde estaba antes de pagar (A1). Un Student que no pago es la cifra
 *   inflada de esta familia.
 *
 * Decisiones de Mani, 28-sep: todo en USD, el monto es lo que pago el cliente (bruto, las
 * comisiones de la plataforma no se modelan). El primer abono congela el ticket de la
 * cohorte sin descuento cuando el closer todavía no lo hizo.
 *
 * ## El saldo es de `lib/queries/saldo.ts`
 *
 * La reja del sobrepago y el movimiento de etapa leen la MISMA cifra que ve el closer
 * (ADR 0024). Este modulo no suma abonos: le pregunta a `saldosDeDeals`.
 *
 * ## Toda escritura es una transaccion con el deal bloqueado
 *
 * Dos abonos simultaneos sobre el mismo deal pasarian los dos la reja del saldo si cada
 * uno lo leyera antes de escribir; `for update` sobre el deal los pone en fila (ADR 0005:
 * la garantia vive en la base, no en un `select` previo). El abono, su rastro y el
 * movimiento de etapa van juntos o no va ninguno.
 */

/** Quien registra o anula: siempre una persona, con su rol de vista (sale de la sesion). */
export interface ActorDeAbono {
  userId: string;
  rol: Rol;
}

type Transaccion = { transaction: <T>(fn: (tx: Db) => Promise<T>) => Promise<T> };

export const esquemaRegistrarAbono = esquemaAbono
  .omit({ programId: true })
  .extend({ areaDeclaradaId: z.string().uuid("El área no es válida.").nullable().optional() });
export type DatosRegistrarAbono = z.input<typeof esquemaRegistrarAbono>;

export interface AbonoRegistrado {
  abonoId: string;
  /** La etapa del deal DESPUES del abono. */
  etapa: EtapaDeal;
  /** `true` si el abono movio el deal (a Abonado o a Completo). */
  movioElDeal: boolean;
  /** Lo que queda por pagar; nunca `null` aqui porque se rechaza antes un deal sin precio. */
  saldo: number;
  /**
   * La cohorte que quedo asignada al deal en ESTE abono (la activa del programa, spec §4), o
   * `null` si no se asignó nada porque ya tenía una.
   */
  cohorteAsignada: string | null;
}

type FilaDeal = typeof deals.$inferSelect;

/**
 * Lee el deal BLOQUEADO (`for update`) con el correo de su lead para la etiqueta del
 * rastro. Es "dame la fila que voy a tocar" por clave primaria, no una metrica:
 * `incluyendoAnulados` porque si un deal anulado se toca o no es una regla de quien
 * llama (no se toca), y dicha con su nombre queda en el grep.
 */
async function dealBloqueado(tx: Db, dealId: string): Promise<{ deal: FilaDeal; emailLead: string }> {
  const [fila] = await tx
    .select({ deal: deals, emailLead: leads.emailNormalizado })
    .from(deals)
    .innerJoin(leads, eq(leads.id, deals.leadId))
    .where(and(eq(deals.id, dealId), incluyendoAnulados(deals)))
    .for("update", { of: deals });
  if (!fila) throw new ErrorDeApp("No existe el deal.", 404);
  return fila;
}

/** El closer (texto copiado de su cuenta, ADR 0011) de quien actua, para el rastro y la reja de anular. */
async function closerDeLaCuenta(tx: Db, userId: string): Promise<string | null> {
  const [u] = await tx.select({ closerId: users.closerId }).from(users).where(eq(users.id, userId));
  return u?.closerId ?? null;
}

const usd = (n: number) => `${n.toFixed(2)} USD`;

export async function registrarAbono(
  db: Db,
  actor: ActorDeAbono,
  datos: DatosRegistrarAbono,
): Promise<AbonoRegistrado> {
  return normalizando(async () => {
    const entrada = esquemaRegistrarAbono.parse(datos);

    // Registrar plata es trabajar el lead, igual que una llamada (ADR 0003, ADR 0025).
    if (!trabajaLeads(actor.rol)) {
      throw new ErrorDeApp("Solo un closer registra abonos de un deal.", 403);
    }

    return (db as unknown as Transaccion).transaction(async (tx) => {
      const { deal, emailLead } = await dealBloqueado(tx, entrada.dealId);

      if (deal.anuladoEn) {
        throw new ErrorDeApp("El deal está anulado: no cuenta en ninguna métrica y no recibe abonos.", 409);
      }
      if (deal.etapa === "completo" || deal.etapa === "cierre_perdido") {
        throw new ErrorDeApp("El deal está cerrado: no recibe abonos nuevos.", 409);
      }
      if (!puedeTrabajarDeal(actor, deal)) {
        if (deal.ownerUserId == null) {
          throw new ErrorDeApp("Este deal no tiene dueño: reclámalo antes de registrar un abono.", 409);
        }
        throw new ErrorDeApp("Solo el dueño del deal puede registrar sus abonos.", 403);
      }
      let cohorteAsignada: string | null = null;
      // El primer abono congela el ticket completo. El helper también asigna la cohorte
      // activa si falta; sin cohorte no se puede aceptar dinero contra un total inventado.
      if (deal.valorVendidoUsd == null || Number(deal.valorVendidoUsd) === 0) {
        const congelado = await congelarValorVendido(tx, {
          deal,
          descuentoUsd: 0,
          actorId: actor.userId,
          etiqueta: emailLead,
        });
        if (deal.cohortId == null) cohorteAsignada = congelado.cohortId;
      }
      await exigirPlataformaActiva(entrada.plataformaId, tx);

      // La reja del sobrepago: el abono no puede pasar de lo que queda. Es la MISMA cifra
      // que ve el closer (`saldosDeDeals`), y el deal bloqueado impide que otro abono la
      // cambie entre esta lectura y la escritura.
      const antes = (await saldosDeDeals(tx, [deal.id])).get(deal.id);
      if (antes?.moneda != null && antes.moneda !== entrada.moneda) {
        throw new ErrorDeApp(
          `El valor vendido del deal está en ${antes.moneda} y los abonos se registran en ${entrada.moneda}: no se convierte moneda.`,
          422,
        );
      }
      if (!antes || antes.saldo === null) {
        throw new ErrorDeApp(
          antes?.sinSaldoPorque === "moneda_distinta"
            ? "El deal tiene abonos en otra moneda: no se puede calcular el saldo."
            : "El deal no tiene valor vendido: escríbelo antes de registrar un abono.",
          409,
        );
      }
      const monto = Number(entrada.monto);
      if (monto > antes.saldo) {
        throw new ErrorDeApp(
          `El abono (${usd(monto)}) supera el saldo del deal (${usd(antes.saldo)}). Un sobrepago no se registra.`,
          422,
        );
      }

      const abonoId = await crearConRastro(
        { db: tx, tabla: abonos, nombreTabla: "abonos", actorId: actor.userId, etiqueta: emailLead },
        {
          dealId: deal.id,
          // El programa sale del deal, nunca del input (frontera, ADR 0043).
          programId: deal.programId,
          fecha: entrada.fecha,
          monto: entrada.monto,
          moneda: entrada.moneda,
          plataformaId: entrada.plataformaId ?? null,
          comprobanteUrl: entrada.comprobanteUrl ?? null,
          closerId: await closerDeLaCuenta(tx, actor.userId),
          origen: "app",
        },
      );

      // El movimiento lo decide el saldo que dejo el abono, leido de nuevo del modulo.
      const despues = (await saldosDeDeals(tx, [deal.id])).get(deal.id);
      if (!despues || despues.saldo === null) {
        throw new ErrorDeApp("No se puede calcular el saldo del deal después del abono: se deshace el registro.", 409);
      }
      const saldo = despues.saldo;
      const destino: EtapaDeal = saldo <= 0 ? "completo" : "abonado";

      if (deal.etapa === destino) return { abonoId, etapa: deal.etapa, movioElDeal: false, saldo, cohorteAsignada };
      if (!transicion(deal.etapa, destino)) {
        // Desde Pendiente Setteo, Agendado, Re-agenda o Proxima Cohorte no hay flecha a
        // pagar. Se rechaza (y el abono se deshace con la transaccion) en vez de inventar
        // una transicion que la tabla no tiene.
        throw new ErrorDeApp(
          `Desde ${NOMBRE_DE_ETAPA[deal.etapa]} no se registra un abono: mueve primero el deal a una etapa donde el lead ya hable de pagar.`,
          409,
        );
      }
      // El sistema toma la flecha; el motor exige el comprobante del abono y la etapa que
      // corresponde, y si algo falta la transaccion entera se deshace con su mensaje.
      await moverEtapa(tx, {
        dealId: deal.id,
        a: destino,
        actor: { tipo: "sistema" },
        datos: { areaDeclaradaId: entrada.areaDeclaradaId },
      });
      return { abonoId, etapa: destino, movioElDeal: true, saldo, cohorteAsignada };
    });
  });
}

export const esquemaAnularAbono = z.object({
  abonoId: z.string().uuid("El abono no es válido."),
  motivo: z.string().trim().min(1, "El motivo es obligatorio."),
});
export type DatosAnularAbono = z.input<typeof esquemaAnularAbono>;

export interface AbonoAnulado {
  /** La etapa del deal DESPUES de anular. */
  etapa: EtapaDeal;
  movioElDeal: boolean;
}

/**
 * Anula un abono (ADR 0026: se anula, no se borra; el motivo es obligatorio) y recalcula
 * la etapa del deal. Quien anula (ADR 0026 punto 5): quien administra, cualquier abono;
 * el closer, solo los que registro el mismo y mientras la cohorte del deal siga activa.
 *
 * Anular un abono NO anula el deal: un pago mal tecleado no vuelve falsa la oportunidad.
 * Lo que cambia es la etapa, por el motor:
 *  - Completo con saldo otra vez > 0 → Abonado (A2);
 *  - sin abonos vigentes → a donde estaba antes de pagar (A1, `etapaALaQueVuelve`).
 * Si el deal estaba en Completo por UN solo abono, hace las dos: A2 y luego A1.
 */
export async function anularAbono(
  db: Db,
  actor: ActorDeAbono,
  datos: DatosAnularAbono,
): Promise<AbonoAnulado> {
  return normalizando(async () => {
    const { abonoId, motivo } = esquemaAnularAbono.parse(datos);

    return (db as unknown as Transaccion).transaction(async (tx) => {
      // "Dame la fila que voy a anular" por clave primaria: `incluyendoAnulados` para poder
      // decir "ya esta anulado" en vez de un 404 que confunde.
      const [referencia] = await tx
        .select()
        .from(abonos)
        .where(and(eq(abonos.id, abonoId), incluyendoAnulados(abonos)));
      if (!referencia) throw new ErrorDeApp("No existe el abono.", 404);

      // El deal se bloquea ANTES de decidir nada: una anulacion y un abono simultaneos
      // sobre el mismo deal no pueden dejarlo en una etapa que el saldo no respalda.
      const { deal, emailLead } = await dealBloqueado(tx, referencia.dealId);
      // La primera lectura pudo esperar detras de otra anulacion: la decision usa la
      // fila fresca, con el deal ya bloqueado, para no pisar quien anulo ni su motivo.
      const [abono] = await tx
        .select()
        .from(abonos)
        .where(and(eq(abonos.id, abonoId), incluyendoAnulados(abonos)));
      if (!abono) throw new ErrorDeApp("No existe el abono.", 404);
      if (abono.anuladoEn) throw new ErrorDeApp("El abono ya está anulado.", 409);

      if (!esAdministrador(actor.rol)) {
        if (!trabajaLeads(actor.rol)) throw new ErrorDeApp("No puedes anular este abono.", 403);
        const miCloser = await closerDeLaCuenta(tx, actor.userId);
        if (!mismoCloser(abono.closerId, miCloser)) {
          throw new ErrorDeApp("Solo puedes anular los abonos que registraste tú.", 403);
        }
        if (deal.cohortId != null) {
          const [c] = await tx.select({ estado: cohorts.estado }).from(cohorts).where(eq(cohorts.id, deal.cohortId));
          if (c && c.estado !== "activo") {
            throw new ErrorDeApp("La cohorte ya no está activa: pídele a un administrador que anule el abono.", 403);
          }
        }
      }

      // D3 (Mani, 28-sep): Abonado ocupa el cupo del lead. Si el deal esta en Completo y el lead
      // ya abrio OTRO deal en el programa, anular este abono lo devolveria a Abonado (A2) y los
      // dos quedarian abiertos: la base lo rechaza con un error crudo. Se ataja antes, con el
      // mensaje que dice que hacer, y no se escribe nada (`deals_uno_abierto_por_lead_y_programa_idx`).
      if (deal.etapa === "completo" && !deal.anuladoEn) {
        const [otroAbierto] = await tx
          .select({ id: deals.id })
          .from(deals)
          .where(
            and(
              eq(deals.leadId, deal.leadId),
              eq(deals.programId, deal.programId),
              ne(deals.id, deal.id),
              notInArray(deals.etapa, ["completo", "cierre_perdido"]),
              vigente(deals),
            ),
          )
          .limit(1);
        if (otroAbierto) {
          throw new ErrorDeApp(
            "Este lead ya tiene otro deal abierto en el programa: anular este abono devolvería el deal a Abonado y quedarían dos abiertos. Cierra o anula el otro deal primero.",
            409,
          );
        }
      }

      await editarConRastro(
        { db: tx, tabla: abonos, nombreTabla: "abonos", actorId: actor.userId, etiqueta: emailLead },
        abono.id,
        { anuladoEn: new Date(), anuladoPor: actor.userId, motivoAnulacion: motivo },
      );

      // Un deal anulado o perdido no se mueve por dinero: la anulacion queda escrita y ya.
      if (deal.anuladoEn || deal.etapa === "cierre_perdido") return { etapa: deal.etapa, movioElDeal: false };
      let etapa: EtapaDeal = deal.etapa;
      const saldo = (await saldosDeDeals(tx, [deal.id])).get(deal.id)!;
      const sistema = { tipo: "sistema" } as const;

      if (etapa === "completo" && saldo.saldo !== null && saldo.saldo > 0) {
        await moverEtapa(tx, { dealId: deal.id, a: "abonado", actor: sistema });
        etapa = "abonado";
      }
      if (etapa === "abonado" && saldo.abonosVigentes === 0) {
        const previa = await etapaALaQueVuelve(tx, deal.id);
        await moverEtapa(tx, { dealId: deal.id, a: previa, actor: sistema });
        etapa = previa;
      }
      return { etapa, movioElDeal: etapa !== deal.etapa };
    });
  });
}
