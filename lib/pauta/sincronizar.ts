import { and, desc, eq, gte, inArray, lt, lte, sql } from "drizzle-orm";
import { cuentasPublicitarias, gastoPauta, pautaObjetos, pautaSincronizaciones } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { esViolacionUnica } from "@/lib/db/errores";
import { ErrorDeApp } from "@/lib/errors";
import { sumarDias } from "@/lib/rangos";
import { arbolDeCuenta, insightsPorAnuncioYDia } from "./meta-api";
import { registrarGasto } from "./gasto";

type FetchMeta = typeof globalThis.fetch;
const LOTE = 200;

/** Una corrida 'corriendo' más vieja que esto murió a mitad y libera el candado. */
export const MINUTOS_PARA_CORRIDA_CORTADA = 15;

/** Meta reporta el gasto como texto; lo pasamos tal cual y solo redondeamos si trae más de 2 decimales. */
function montoEnDosDecimales(monto: string): string {
  return /^\d+(\.\d{1,2})?$/.test(monto) ? monto : Number(monto).toFixed(2);
}

export interface ResumenSincronizacionPauta {
  estado: "ok" | "error";
  filas: number;
  omitidas: number;
  error?: string;
}

function mensajeSeguro(error: unknown, token: string): string {
  const mensaje = error instanceof Error ? error.message : "Error interno.";
  return mensaje.replaceAll(token, "(oculto)");
}

export async function sincronizarPauta(
  db: Db,
  args: { token: string; hoy: string; disparadaPor: "cron" | "manual"; f?: FetchMeta },
): Promise<ResumenSincronizacionPauta> {
  const desde = sumarDias(args.hoy, -6);
  const limite = new Date(Date.now() - MINUTOS_PARA_CORRIDA_CORTADA * 60_000);
  await db.update(pautaSincronizaciones).set({
    estado: "error",
    fin: new Date(),
    error: "La corrida se cortó sin terminar.",
  }).where(and(
    eq(pautaSincronizaciones.estado, "corriendo"),
    lt(pautaSincronizaciones.inicio, limite),
  ));

  let corrida: { id: string };
  try {
    [corrida] = await db.insert(pautaSincronizaciones).values({
      disparadaPor: args.disparadaPor,
      desde,
      hasta: args.hoy,
    }).returning();
  } catch (error) {
    if (esViolacionUnica(error)) {
      throw new ErrorDeApp("Ya hay una sincronización corriendo.", 409);
    }
    throw error;
  }

  let filas = 0;
  let omitidas = 0;
  try {
    const cuentas = await db.select().from(cuentasPublicitarias)
      .where(eq(cuentasPublicitarias.activo, true));
    for (const cuenta of cuentas) {
      const arbol = await arbolDeCuenta(cuenta.idMeta, args.token, args.f);
      for (let i = 0; i < arbol.length; i += LOTE) {
        await db.insert(pautaObjetos).values(arbol.slice(i, i + LOTE).map((objeto) => ({
          ...objeto,
          cuentaId: cuenta.id,
          programId: cuenta.programId,
        }))).onConflictDoUpdate({
          target: pautaObjetos.idMeta,
          set: {
            cuentaId: cuenta.id,
            programId: cuenta.programId,
            nivel: sql`excluded.nivel`,
            padreIdMeta: sql`excluded.padre_id_meta`,
            nombre: sql`excluded.nombre`,
            estado: sql`excluded.estado`,
            objetivo: sql`excluded.objetivo`,
            formato: sql`excluded.formato`,
            urlTags: sql`excluded.url_tags`,
            actualizadoEn: sql`now()`,
          },
        });
      }
      const objetos = await db.select({ id: pautaObjetos.id, idMeta: pautaObjetos.idMeta })
        .from(pautaObjetos)
        .where(eq(pautaObjetos.cuentaId, cuenta.id));
      const ids = new Map(objetos.map((objeto) => [objeto.idMeta, objeto.id]));
      const insights = await insightsPorAnuncioYDia(
        cuenta.idMeta, desde, args.hoy, args.token, args.f,
      );
      const aceptados = insights.flatMap((insight) => {
        const pautaObjetoId = ids.get(insight.adId);
        if (!pautaObjetoId) {
          omitidas += 1;
          return [];
        }
        return [{
          programId: cuenta.programId,
          fecha: insight.fecha,
          monto: montoEnDosDecimales(insight.monto),
          moneda: cuenta.moneda,
          agendasMeta: insight.agendas,
          origen: "meta_api" as const,
          pautaObjetoId,
          area: null,
        }];
      });
      // Meta omite los anuncios sin entrega, asi que un dia corregido a cero no vuelve en
      // los insights: la ventana de la cuenta se pone en cero y se reescribe con lo que
      // trajo esta corrida, en la misma transaccion para que nadie lea el cero a medias.
      await db.transaction(async (tx) => {
        await (tx as Db).update(gastoPauta)
          .set({ monto: "0", agendasMeta: null, actualizadoEn: sql`now()` })
          .where(and(
            eq(gastoPauta.origen, "meta_api"),
            gte(gastoPauta.fecha, desde),
            lte(gastoPauta.fecha, args.hoy),
            inArray(
              gastoPauta.pautaObjetoId,
              (tx as Db).select({ id: pautaObjetos.id }).from(pautaObjetos)
                .where(eq(pautaObjetos.cuentaId, cuenta.id)),
            ),
          ));
        await registrarGasto(tx as Db, aceptados);
      });
      filas += aceptados.length;
    }
    await db.update(pautaSincronizaciones).set({
      estado: "ok", fin: new Date(), filas,
    }).where(eq(pautaSincronizaciones.id, corrida.id));
    return { estado: "ok", filas, omitidas };
  } catch (error) {
    const mensaje = mensajeSeguro(error, args.token);
    await db.update(pautaSincronizaciones).set({
      estado: "error", fin: new Date(), filas, error: mensaje,
    }).where(eq(pautaSincronizaciones.id, corrida.id));
    return { estado: "error", filas, omitidas, error: mensaje };
  }
}

export type UltimaSincronizacionPauta = {
  fin: Date | null;
  inicio: Date;
  estado: "corriendo" | "ok" | "error";
  error: string | null;
};

export async function ultimaSincronizacionPauta(db: Db): Promise<UltimaSincronizacionPauta | null> {
  const [ultima] = await db.select({
    fin: pautaSincronizaciones.fin,
    inicio: pautaSincronizaciones.inicio,
    estado: pautaSincronizaciones.estado,
    error: pautaSincronizaciones.error,
  }).from(pautaSincronizaciones).orderBy(desc(pautaSincronizaciones.inicio)).limit(1);
  return ultima ?? null;
}
