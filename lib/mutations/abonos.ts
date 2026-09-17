import { eq } from "drizzle-orm";
import type { Session } from "next-auth";
import { z } from "zod";
import { db as dbDeLaApp } from "@/lib/db";
import { abonos, changeLog } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ejecutarJuntas } from "@/lib/db/ejecutar-juntas";
import { ErrorDeApp } from "@/lib/errors";
import { esquemaAbono } from "@/lib/abonos/esquema";
import { exigirPlataformaActiva } from "@/lib/abonos/plataforma";
import { closerDeLaSesion } from "@/lib/auth/closer";
import { usd } from "@/lib/format";
import { saldoDeVenta } from "@/lib/queries/ventas";

/**
 * Registro de un abono sobre una venta que YA existe (ticket 019, ADR 0013). El
 * primer abono de una venta lo escribe `registrarLlamada` (ticket 002) en la misma
 * transaccion que la venta; este es el pago que llega despues y que suma a la caja
 * del dia en que entra, sin crear un cupo nuevo.
 *
 * Es logica pura, sin "use server": una server action la envuelve. El enforcement
 * de rol NO va aca (lo hace quien la invoque con `requireRole`). La base entra por
 * inyeccion para poder testear sobre PGlite sin Neon.
 */

/**
 * El esquema del abono sin `programId`: el programa se hereda de la venta, no lo
 * manda el llamador. Es la misma regla que el `closerId` (ADR 0011): lo que se
 * puede derivar del servidor no se le pide al cliente.
 */
export const esquemaRegistroAbono = esquemaAbono.omit({ programId: true }).extend({
  /**
   * Un abono que deja la venta con saldo negativo se rechaza, salvo que el closer
   * confirme que el sobrepago es real (ticket 019). La confirmacion es explicita
   * para que un monto tecleado de mas no entre a la caja sin que nadie lo vea.
   */
  confirmarSobrepago: z.boolean().optional().default(false),
});

/** Entrada de un abono posterior (lo que el llamador escribe). */
export type EntradaRegistroAbono = z.input<typeof esquemaRegistroAbono>;

/** Guarda un abono sobre una venta existente y devuelve la fila escrita. */
export async function registrarAbono(
  session: Session,
  input: EntradaRegistroAbono,
  db: Db = dbDeLaApp,
): Promise<typeof abonos.$inferSelect> {
  // El closerId se COPIA de la cuenta, el closer nunca lo escribe (ADR 0011). Puede
  // ser distinto al closer de la venta: se guarda quien REGISTRA el abono.
  const closerId = closerDeLaSesion(session, "registrar abonos");
  const datos = esquemaRegistroAbono.parse(input);

  const venta = await saldoDeVenta(datos.saleId, db);
  if (!venta) throw new ErrorDeApp("La venta no existe.", 404);

  // Nunca se convierte moneda en silencio (restriccion dura de AGENTS.md). Hoy todo
  // abono es en USD (Michael, 16-sep) y si el pago entro en COP el closer lo convierte
  // ANTES de registrarlo (Mani, 16-sep); el sistema recibe el monto ya convertido. Una
  // venta vieja en otra moneda se rechaza en vez de mezclarse con una TRM inventada.
  if (venta.moneda !== datos.moneda) {
    throw new ErrorDeApp(
      `La venta esta en ${venta.moneda} y el abono en ${datos.moneda}. El sistema no convierte moneda: registra el abono en ${venta.moneda}.`,
      400,
    );
  }

  await exigirPlataformaActiva(datos.plataformaId, db);

  // El sobrepago se mide contra el saldo pendiente. Si la venta no tiene precio del
  // contrato (filas viejas de Sheets) no hay contra que comparar y no se inventa un
  // limite: se registra el abono.
  const sobrepago = venta.saldo === null ? 0 : aCentavos(datos.monto) - aCentavos(venta.saldo);
  if (sobrepago > 0 && !datos.confirmarSobrepago) {
    throw new ErrorDeApp(
      `Este abono de ${usd(Number(datos.monto))} deja la venta con un sobrepago de ${usd(
        sobrepago / 100,
      )}: el saldo pendiente es ${usd(Number(venta.saldo))}. Confirma el sobrepago si el pago entro de verdad.`,
      400,
    );
  }

  const abonoId = crypto.randomUUID();
  await ejecutarJuntas(db, (tx) => {
    const consultas: Promise<unknown>[] = [
      (tx as Db).insert(abonos).values({
        id: abonoId,
        saleId: datos.saleId,
        // El programa y el closer no los manda el cliente: salen de la venta y de la
        // sesion (ADR 0011).
        programId: venta.programId,
        fecha: datos.fecha,
        monto: datos.monto,
        moneda: datos.moneda,
        plataformaId: datos.plataformaId,
        comprobanteUrl: datos.comprobanteUrl,
        closerId,
        origen: "app",
      }),
    ];

    // Un sobrepago confirmado deja nota en `change_log`, la bitacora que ya usa toda
    // la app: sin ella, una venta con saldo negativo aparece en la caja sin que nadie
    // pueda decir quien la confirmo ni por que. La nota va en el mismo lote atomico
    // que el abono para que no exista uno sin la otra.
    if (sobrepago > 0) {
      consultas.push(
        (tx as Db).insert(changeLog).values({
          tabla: "abonos",
          registroId: abonoId,
          etiqueta: `Abono de ${usd(Number(datos.monto))} del ${datos.fecha}`,
          campo: "sobrepago",
          valorAnterior: venta.saldo,
          valorNuevo: `Sobrepago confirmado de ${usd(sobrepago / 100)} sobre un saldo pendiente de ${usd(
            Number(venta.saldo),
          )}.`,
          origen: "app" as const,
          userId: session.user.id,
        }),
      );
    }

    return consultas;
  });

  const [fila] = await db.select().from(abonos).where(eq(abonos.id, abonoId)).limit(1);
  return fila!;
}

/**
 * Pasa un monto decimal a centavos enteros. El dinero se compara en enteros porque
 * `0.1 + 0.2 !== 0.3` en punto flotante; los montos de un abono tienen dos
 * decimales, asi que multiplicar por 100 y redondear es exacto en este rango.
 */
function aCentavos(monto: string): number {
  return Math.round(Number(monto) * 100);
}
