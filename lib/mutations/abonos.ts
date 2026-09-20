import { and, eq, sql } from "drizzle-orm";
import type { Session } from "next-auth";
import { z } from "zod";
import { db as dbDeLaApp } from "@/lib/db";
import { abonos } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import { esquemaAbono } from "@/lib/abonos/esquema";
import { exigirPlataformaActiva } from "@/lib/abonos/plataforma";
import { closerDeLaSesion } from "@/lib/auth/closer";
import { usd } from "@/lib/format";
import { saldoDeVenta } from "@/lib/queries/ventas";
import { sumaAbonos } from "@/lib/queries/saldo";
import { vigente } from "@/lib/queries/vigente";

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

  // La reja definitiva se evalua dentro de la sentencia bloqueada. Esta comprobacion
  // temprana solo conserva el mensaje detallado para el caso no concurrente.
  const sobrepagoInicial =
    venta.saldo === null ? 0 : aCentavos(datos.monto) - aCentavos(venta.saldo);
  if (sobrepagoInicial > 0 && !datos.confirmarSobrepago) {
    throw new ErrorDeApp(
      `Este abono de ${usd(Number(datos.monto))} deja la venta con un sobrepago de ${usd(
        sobrepagoInicial / 100,
      )}: el saldo pendiente es ${usd(Number(venta.saldo))}. Confirma el sobrepago si el pago entro de verdad.`,
      400,
    );
  }

  const abonoId = crypto.randomUUID();
  const comprobante = datos.comprobanteUrl == null ? sql`null` : sql`${datos.comprobanteUrl}`;
  const plataforma = datos.plataformaId == null ? sql`null` : sql`${datos.plataformaId}`;
  const resultado = await db.execute(sql`
    with venta_bloqueada as materialized (
      select id, program_id, moneda, precio_aplicado_usd
      from sales
      where id = ${datos.saleId} and anulado_en is null
      for update
    ),
    saldo_actual as materialized (
      select v.id, v.program_id, v.moneda, v.precio_aplicado_usd,
        ${sumaAbonos(sql`a.monto`)} as abonado,
        case
          when v.precio_aplicado_usd is null then null
          else v.precio_aplicado_usd - ${sumaAbonos(sql`a.monto`)}
        end as saldo_pendiente,
        case
          when v.precio_aplicado_usd is null then 0
          else ${datos.monto} - (v.precio_aplicado_usd - ${sumaAbonos(sql`a.monto`)} )
        end as sobrepago
      from venta_bloqueada v
      left join abonos a on a.sale_id = v.id and a.anulado_en is null
      group by v.id, v.program_id, v.moneda, v.precio_aplicado_usd
    ),
    insertado as (
      insert into abonos (
        id, sale_id, program_id, fecha, monto, moneda, plataforma_id,
        comprobante_url, closer_id, origen
      )
      select
        ${abonoId}, id, program_id, ${datos.fecha}, ${datos.monto}, ${datos.moneda},
        ${plataforma}, ${comprobante}, ${closerId}, 'app'
      from saldo_actual
      where moneda = ${datos.moneda}
        and (
          precio_aplicado_usd is null
          or saldo_pendiente >= ${datos.monto}
          or ${datos.confirmarSobrepago}
        )
      returning id
    ),
    bitacora as (
      insert into change_log (
        tabla, registro_id, etiqueta, campo, valor_anterior, valor_nuevo, origen, user_id
      )
      select
        'abonos',
        insertado.id,
        ${`Abono de ${usd(Number(datos.monto))} del ${datos.fecha}`},
        'sobrepago',
        saldo_pendiente::text,
        ('Sobrepago confirmado de USD ' || to_char(sobrepago, 'FM999999990.00') ||
          ' sobre un saldo pendiente de USD ' ||
          to_char(saldo_pendiente, 'FM999999990.00')),
        'app',
        ${session.user.id}
      from saldo_actual
      inner join insertado on insertado.id = ${abonoId}
      where saldo_actual.sobrepago > 0
      returning registro_id
    )
    select id from insertado
  `);
  const filas = (Array.isArray(resultado) ? resultado : resultado.rows) as { id: string }[];
  if (filas.length === 0) {
    const saldoActual = await saldoDeVenta(datos.saleId, db);
    if (!saldoActual) throw new ErrorDeApp("La venta no existe.", 404);
    if (saldoActual.moneda !== datos.moneda) {
      throw new ErrorDeApp(
        `La venta esta en ${saldoActual.moneda} y el abono en ${datos.moneda}. El sistema no convierte moneda: registra el abono en ${saldoActual.moneda}.`,
        400,
      );
    }
    throw new ErrorDeApp(
      "Este abono deja la venta con un sobrepago. Confirma el sobrepago si el pago entro de verdad.",
      400,
    );
  }

  // Ver la nota de `lib/mutations/registro.ts`: es una relectura por clave primaria
  // de lo que se acaba de escribir, y el predicado va igual porque toda lectura de
  // estas tres tablas tiene que decir que decidio sobre lo anulado.
  const [fila] = await db
    .select()
    .from(abonos)
    .where(and(eq(abonos.id, abonoId), vigente(abonos)))
    .limit(1);
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
