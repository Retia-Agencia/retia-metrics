import { and, desc, eq, gte, inArray, lt, lte, sql } from "drizzle-orm";
import { cuentasPublicitarias, gastoPauta, pautaObjetos, pautaSincronizaciones } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { esViolacionUnica } from "@/lib/db/errores";
import { ErrorDeApp } from "@/lib/errors";
import { sumarDias } from "@/lib/rangos";
import { arbolDeCuenta, insightsPorAnuncioYDia, type AnuncioConocido } from "./meta-api";
import { registrarGasto } from "./gasto";
import type { TokensMeta } from "@/lib/integraciones";

export type FetchMeta = typeof globalThis.fetch;
const LOTE = 200;
const HORAS_ENTRE_ARBOLES = 24;

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

export function mensajeSeguroDePauta(error: unknown, tokens: TokensMeta): string {
  let mensaje = error instanceof Error ? error.message : "Error interno.";
  for (const token of tokens.values()) mensaje = mensaje.replaceAll(token, "(oculto)");
  return mensaje;
}

type ArgsSincronizacionPauta = {
  tokens: TokensMeta;
  desde: string;
  hasta: string;
  disparadaPor: "cron" | "manual" | "endpoint" | "hub";
  refrescarArbol: boolean;
  ahora?: Date;
  f?: FetchMeta;
  programId?: string;
};

/** Escritor compartido por el cron y las fotos del día; `refrescarArbol` conserva el refresco total del cron. */
export async function sincronizarPautaEnVentana(
  db: Db,
  args: ArgsSincronizacionPauta,
): Promise<ResumenSincronizacionPauta> {
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
      desde: args.desde,
      hasta: args.hasta,
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
      .where(and(
        eq(cuentasPublicitarias.activo, true),
        args.programId ? eq(cuentasPublicitarias.programId, args.programId) : undefined,
      ));
    const resultados = await Promise.allSettled(cuentas.map(async (cuenta) => {
      const token = args.tokens.get(cuenta.programId);
      if (!token) throw new Error("el programa no tiene Meta conectado en Integraciones.");
      let omitidasDeCuenta = 0;
      let debeRefrescarArbol = args.refrescarArbol;
      if (!debeRefrescarArbol) {
        const [objetoMasNuevo] = await db.select({ actualizadoEn: pautaObjetos.actualizadoEn })
          .from(pautaObjetos)
          .where(eq(pautaObjetos.cuentaId, cuenta.id))
          .orderBy(desc(pautaObjetos.actualizadoEn))
          .limit(1);
        const referencia = args.ahora ?? new Date();
        debeRefrescarArbol = !objetoMasNuevo
          || objetoMasNuevo.actualizadoEn < new Date(
            referencia.getTime() - HORAS_ENTRE_ARBOLES * 60 * 60_000,
          );
      }
      if (debeRefrescarArbol) {
        const anunciosGuardados = await db.select({
          idMeta: pautaObjetos.idMeta,
          actualizadoEn: pautaObjetos.actualizadoEn,
          formato: pautaObjetos.formato,
          urlTags: pautaObjetos.urlTags,
        }).from(pautaObjetos).where(and(
          eq(pautaObjetos.cuentaId, cuenta.id),
          eq(pautaObjetos.nivel, "anuncio"),
        ));
        const conocidos = new Map(anunciosGuardados.map((anuncio) => [anuncio.idMeta, {
          actualizadoEn: anuncio.actualizadoEn,
          formato: anuncio.formato as AnuncioConocido["formato"],
          urlTags: anuncio.urlTags,
        }]));
        const arbol = await arbolDeCuenta(cuenta.idMeta, token, conocidos, args.f);
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
      }
      const objetos = await db.select({ id: pautaObjetos.id, idMeta: pautaObjetos.idMeta })
        .from(pautaObjetos)
        .where(eq(pautaObjetos.cuentaId, cuenta.id));
      const ids = new Map(objetos.map((objeto) => [objeto.idMeta, objeto.id]));
      const insights = await insightsPorAnuncioYDia(
        cuenta.idMeta, args.desde, args.hasta, token, args.f,
      );
      const aceptados = insights.flatMap((insight) => {
        const pautaObjetoId = ids.get(insight.adId);
        if (!pautaObjetoId) {
          omitidasDeCuenta += 1;
          return [];
        }
        return [{
          programId: cuenta.programId,
          fecha: insight.fecha,
          monto: montoEnDosDecimales(insight.monto),
          moneda: cuenta.moneda,
          agendasMeta: insight.agendas,
          registrosMeta: insight.registros,
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
          .set({ monto: "0", agendasMeta: null, registrosMeta: null, actualizadoEn: sql`now()` })
          .where(and(
            eq(gastoPauta.origen, "meta_api"),
            gte(gastoPauta.fecha, args.desde),
            lte(gastoPauta.fecha, args.hasta),
            inArray(
              gastoPauta.pautaObjetoId,
              (tx as Db).select({ id: pautaObjetos.id }).from(pautaObjetos)
                .where(eq(pautaObjetos.cuentaId, cuenta.id)),
            ),
          ));
        await registrarGasto(tx as Db, aceptados);
      });
      return { filas: aceptados.length, omitidas: omitidasDeCuenta };
    }));
    const errores: string[] = [];
    resultados.forEach((resultado, indice) => {
      if (resultado.status === "fulfilled") {
        filas += resultado.value.filas;
        omitidas += resultado.value.omitidas;
      } else {
        errores.push(`${cuentas[indice].nombre}: ${mensajeSeguroDePauta(resultado.reason, args.tokens)}`);
      }
    });
    if (errores.length > 0) {
      const error = errores.join(" · ");
      await db.update(pautaSincronizaciones).set({
        estado: "error", fin: new Date(), filas, error,
      }).where(eq(pautaSincronizaciones.id, corrida.id));
      return { estado: "error", filas, omitidas, error };
    }
    await db.update(pautaSincronizaciones).set({
      estado: "ok", fin: new Date(), filas,
    }).where(eq(pautaSincronizaciones.id, corrida.id));
    return { estado: "ok", filas, omitidas };
  } catch (error) {
    const mensaje = mensajeSeguroDePauta(error, args.tokens);
    await db.update(pautaSincronizaciones).set({
      estado: "error", fin: new Date(), filas, error: mensaje,
    }).where(eq(pautaSincronizaciones.id, corrida.id));
    return { estado: "error", filas, omitidas, error: mensaje };
  }
}

export async function sincronizarPauta(
  db: Db,
  args: { tokens: TokensMeta; hoy: string; disparadaPor: "cron" | "manual"; programId?: string; f?: FetchMeta },
): Promise<ResumenSincronizacionPauta> {
  return sincronizarPautaEnVentana(db, {
    ...args,
    desde: sumarDias(args.hoy, -6),
    hasta: args.hoy,
    refrescarArbol: true,
  });
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
