import { and, eq, inArray } from "drizzle-orm";
import type { Session } from "next-auth";
import { z } from "zod";
import { db as dbDeLaApp } from "@/lib/db";
import { abonos, calls, changeLog, sales } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ejecutarJuntas } from "@/lib/db/ejecutar-juntas";
import { ErrorDeApp } from "@/lib/errors";
import { esAdministrador } from "@/lib/auth/roles";
import { closerDeLaSesion } from "@/lib/auth/closer";
import { cohorteActiva } from "@/lib/queries/cohortes";
import { incluyendoAnulados, vigente } from "@/lib/queries/vigente";
import { usd } from "@/lib/format";

/**
 * Anular una llamada, una venta o un abono (ADR 0026, ticket 029).
 *
 * Un registro anulado deja de contar en TODA metrica y sigue viendose en el historial
 * de la persona, tachado, con quien lo anulo, cuando y por que. No se borra: una
 * venta borrada se lleva consigo la explicacion de por que la caja de ese dia bajo.
 *
 * Es logica pura, sin "use server": una server action la envuelve. El enforcement de
 * ROL de la ruta no va aca (lo hace `requireRole`); lo que si vive aca es de quien es
 * el registro y si su cohorte sigue abierta, que son reglas del dominio y no de la
 * ruta. La base entra por inyeccion para poder testear sobre PGlite sin Neon.
 */

export const esquemaAnulacion = z.object({
  tipo: z.enum(["llamada", "venta", "abono"]),
  id: z.string().uuid("El registro a anular no es valido."),
  /**
   * Sin motivo no hay anulacion (ADR 0026 punto 6): el motivo es la mitad del valor
   * de conservar la fila. El minimo es el mismo que el CHECK de la base
   * (`length(trim(...)) > 0`) y no uno inventado aca: dos reglas distintas para lo
   * mismo se separan con el tiempo.
   */
  motivo: z.string().trim().min(1, "Escribe por que anulas el registro."),
});

export type EntradaAnulacion = z.input<typeof esquemaAnulacion>;

/** Que se anulo, para que la pantalla pueda decirlo sin volver a preguntar. */
export interface ResultadoAnulacion {
  llamadas: number;
  ventas: number;
  abonos: number;
}

/** Anula un registro y lo que colgaba de el, en una sola escritura atomica. */
export async function anularRegistro(
  session: Session,
  input: EntradaAnulacion,
  db: Db = dbDeLaApp,
): Promise<ResultadoAnulacion> {
  const datos = esquemaAnulacion.parse(input);

  // Cada rama arma su propia cascada (ADR 0026 punto 2). El orden importa poco
  // porque todo va en el mismo lote atomico, pero la lectura previa NO: hay que
  // saber que se va a anular antes de escribir, porque `ejecutarJuntas` usa `batch`
  // sobre neon-http y ahi no se puede encadenar el resultado de una consulta.
  const objetivo =
    datos.tipo === "llamada"
      ? await llamadaYSuCascada(datos.id, db)
      : datos.tipo === "venta"
        ? await ventaYSusAbonos(datos.id, db)
        : await soloElAbono(datos.id, db);

  await exigirPermiso(session, objetivo, db);

  const anuladoEn = new Date();
  const anuladoPor = session.user.id;
  const marca = { anuladoEn, anuladoPor, motivoAnulacion: datos.motivo };

  await ejecutarJuntas(db, (tx) => {
    const consultas: Promise<unknown>[] = [];
    const bitacora = (tabla: string, registroId: string, etiqueta: string) =>
      (tx as Db).insert(changeLog).values({
        tabla,
        registroId,
        etiqueta,
        campo: "anulado_en",
        // El valor anterior es "vigente" y el nuevo es el motivo: `change_log` es una
        // bitacora de campos, y sin el motivo aca habria que ir a la fila para saber
        // que paso. La fila sigue siendo la fuente; esto es el rastro.
        valorAnterior: null,
        valorNuevo: datos.motivo,
        origen: "app" as const,
        userId: session.user.id,
      });

    if (objetivo.llamada) {
      consultas.push(
        // `vigente(...)` en el WHERE de la escritura, no solo en las lecturas: sin el,
        // anular una llamada cuya venta ya estaba anulada pisaria el motivo y el autor
        // originales de esa venta con los de ahora. Lo anulado no se re-anula.
        (tx as Db).update(calls).set(marca).where(and(eq(calls.id, objetivo.llamada.id), vigente(calls))),
      );
      consultas.push(bitacora("calls", objetivo.llamada.id, objetivo.llamada.etiqueta));
    }
    if (objetivo.venta) {
      consultas.push(
        (tx as Db).update(sales).set(marca).where(and(eq(sales.id, objetivo.venta.id), vigente(sales))),
      );
      consultas.push(bitacora("sales", objetivo.venta.id, objetivo.venta.etiqueta));
    }
    for (const abono of objetivo.abonos) {
      consultas.push(
        (tx as Db).update(abonos).set(marca).where(and(eq(abonos.id, abono.id), vigente(abonos))),
      );
      consultas.push(bitacora("abonos", abono.id, abono.etiqueta));
    }

    return consultas;
  });

  return {
    llamadas: objetivo.llamada ? 1 : 0,
    ventas: objetivo.venta ? 1 : 0,
    abonos: objetivo.abonos.length,
  };
}

/** Un registro que se va a anular, con la etiqueta legible que ira a `change_log`. */
interface Marcado {
  id: string;
  etiqueta: string;
}

/**
 * Todo lo que una anulacion va a tocar, mas de quien es y en que cohorte vive (que
 * es lo que deciden el permiso). Se arma ANTES de escribir.
 */
interface Objetivo {
  llamada: Marcado | null;
  venta: Marcado | null;
  abonos: Marcado[];
  /** Closer dueño del registro que el usuario pidio anular (no el de la cascada). */
  closerId: string | null;
  programId: string;
  cohortId: string | null;
  queEs: string;
}

async function soloElAbono(id: string, db: Db): Promise<Objetivo> {
  const [abono] = await db
    .select()
    .from(abonos)
    .where(and(eq(abonos.id, id), incluyendoAnulados(abonos)))
    .limit(1);
  if (!abono) throw new ErrorDeApp("El abono no existe.", 404);
  exigirVigente(abono, "Este abono");

  // Un abono no lleva cohorte: la hereda de su venta, que es donde vive la ventana.
  const [venta] = await db
    .select({ cohortId: sales.cohortId })
    .from(sales)
    .where(and(eq(sales.id, abono.saleId), incluyendoAnulados(sales)))
    .limit(1);

  return {
    llamada: null,
    // Anular un abono NO anula la venta (ADR 0026 punto 2): una venta puede tener un
    // abono devuelto y seguir viva. El saldo se recalcula solo porque sale de
    // `lib/queries/saldo.ts`.
    venta: null,
    abonos: [{ id: abono.id, etiqueta: etiquetaDeAbono(abono) }],
    closerId: abono.closerId,
    programId: abono.programId,
    cohortId: venta?.cohortId ?? null,
    queEs: "el abono",
  };
}

async function ventaYSusAbonos(id: string, db: Db): Promise<Objetivo> {
  const [venta] = await db
    .select()
    .from(sales)
    .where(and(eq(sales.id, id), incluyendoAnulados(sales)))
    .limit(1);
  if (!venta) throw new ErrorDeApp("La venta no existe.", 404);
  exigirVigente(venta, "Esta venta");

  return {
    llamada: null,
    venta: { id: venta.id, etiqueta: etiquetaDeVenta(venta) },
    abonos: await abonosVigentesDe([venta.id], db),
    closerId: venta.closerId,
    programId: venta.programId,
    cohortId: venta.cohortId,
    queEs: "la venta",
  };
}

async function llamadaYSuCascada(id: string, db: Db): Promise<Objetivo> {
  const [llamada] = await db
    .select()
    .from(calls)
    .where(and(eq(calls.id, id), incluyendoAnulados(calls)))
    .limit(1);
  if (!llamada) throw new ErrorDeApp("La llamada no existe.", 404);
  exigirVigente(llamada, "Esta llamada");

  const base: Objetivo = {
    llamada: { id: llamada.id, etiqueta: etiquetaDeLlamada(llamada) },
    venta: null,
    abonos: [],
    closerId: llamada.closerId,
    programId: llamada.programId,
    cohortId: llamada.cohortId,
    queEs: "la llamada",
  };

  // Solo una llamada CERRADA tiene venta que arrastrar. Una agendada o una perdida
  // no creo nada, asi que no hay cascada que buscar.
  if (llamada.resultado !== "cerrada") return base;

  const [venta] = await db
    .select()
    .from(sales)
    .where(and(eq(sales.callId, llamada.id), vigente(sales)))
    .limit(1);

  if (venta) {
    return {
      ...base,
      venta: { id: venta.id, etiqueta: etiquetaDeVenta(venta) },
      abonos: await abonosVigentesDe([venta.id], db),
    };
  }

  await exigirQueNoQuedeVentaHuerfana(llamada, db);
  return base;
}

/**
 * Una llamada cerrada SIN venta enlazada es anterior al ticket 029 o vino de la hoja
 * (`sales.callId` nacio ahi). Anularla a secas dejaria viva una venta que afirma un
 * cierre cuya llamada ya no cuenta, que es justo lo que el ADR 0026 punto 2 prohibe.
 *
 * Asi que se mira si la persona tiene alguna venta viva en la misma cohorte. Si la
 * tiene, se rechaza y se dice el camino: anular primero la venta, que siempre se
 * puede desde el historial. Si no la tiene —porque ya se anulo, o porque el cierre
 * nunca produjo venta— anular la llamada es seguro y sigue.
 *
 * Es conservador a proposito: rechazar de mas obliga a un paso extra, y anular de
 * menos deja una cifra inflada que nadie va a notar.
 */
async function exigirQueNoQuedeVentaHuerfana(
  llamada: typeof calls.$inferSelect,
  db: Db,
): Promise<void> {
  // Sin persona o sin cohorte no hay forma de emparejar la venta, y tampoco hay
  // nada que se pueda afirmar: no se bloquea por una fila que la hoja dejo a medias.
  if (!llamada.personId || !llamada.cohortId) return;

  const vivas = await db
    .select({ id: sales.id })
    .from(sales)
    .where(
      and(
        eq(sales.personId, llamada.personId),
        eq(sales.cohortId, llamada.cohortId),
        vigente(sales),
      ),
    )
    .limit(1);

  if (vivas.length > 0) {
    throw new ErrorDeApp(
      "Esta llamada cerrada no tiene su venta enlazada (es anterior al enlace o vino de la hoja), " +
        "y la persona todavía tiene una venta activa en esta cohorte. Anula primero la venta desde " +
        "el historial de la persona y vuelve a intentarlo.",
      409,
    );
  }
}

/** Los abonos que todavia cuentan de esas ventas. Un abono ya anulado no se re-anula. */
async function abonosVigentesDe(saleIds: string[], db: Db): Promise<Marcado[]> {
  if (saleIds.length === 0) return [];
  const filas = await db
    .select()
    .from(abonos)
    .where(and(inArray(abonos.saleId, saleIds), vigente(abonos)));
  return filas.map((a) => ({ id: a.id, etiqueta: etiquetaDeAbono(a) }));
}

/**
 * Quien puede anular (ADR 0026 punto 6).
 *
 * - Gerente (y developer, que es quien ADMINISTRA la app segun `esAdministrador`):
 *   cualquier registro, sin limite de cohorte.
 * - Closer: solo lo suyo, y solo mientras la cohorte siga activa. Es el caso real —
 *   se equivoco y lo ve en el momento—, no reescribir un trimestre cerrado.
 *
 * El rol sale de la sesion. Cuando entre el ticket 028 ("ver como" del developer)
 * esto pasa a leer `rolDeVista(session)` y un developer en vista closer queda sujeto
 * a las mismas dos reglas que un closer, que es justo lo que ese ticket busca.
 */
async function exigirPermiso(session: Session, objetivo: Objetivo, db: Db): Promise<void> {
  if (esAdministrador(session.user.rol)) return;

  const closerId = closerDeLaSesion(session, "anular registros");
  if (objetivo.closerId !== closerId) {
    throw new ErrorDeApp(
      `No puedes anular ${objetivo.queEs}: la registró otro closer. Pídeselo a un gerente.`,
      403,
    );
  }

  const activa = await cohorteActiva(objetivo.programId, db);
  if (!activa || activa.id !== objetivo.cohortId) {
    throw new ErrorDeApp(
      `No puedes anular ${objetivo.queEs}: su cohorte ya no está activa. Pídeselo a un gerente.`,
      403,
    );
  }
}

/** Lo ya anulado no se vuelve a anular: pisaria el motivo y el autor originales. */
function exigirVigente(
  registro: { anuladoEn: Date | null },
  queEs: string,
): void {
  if (registro.anuladoEn !== null) {
    throw new ErrorDeApp(`${queEs} ya estaba anulado.`, 409);
  }
}

// ── Etiquetas legibles para `change_log`. Ningun dato personal: la bitacora se
//    muestra en `/nerd-stats`, que no proyecta datos de leads a proposito.

function etiquetaDeLlamada(llamada: typeof calls.$inferSelect): string {
  const fecha = llamada.fechaLlamada ?? llamada.fechaAgenda;
  return `Llamada ${llamada.resultado}${fecha ? ` del ${fecha.toISOString().slice(0, 10)}` : ""}`;
}

function etiquetaDeVenta(venta: typeof sales.$inferSelect): string {
  const precio = venta.precioAplicadoUsd ? ` por ${usd(Number(venta.precioAplicadoUsd))}` : "";
  return `Venta${venta.fecha ? ` del ${venta.fecha}` : ""}${precio}`;
}

function etiquetaDeAbono(abono: typeof abonos.$inferSelect): string {
  return `Abono de ${usd(Number(abono.monto))} del ${abono.fecha}`;
}
