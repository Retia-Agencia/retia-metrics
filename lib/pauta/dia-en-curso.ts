import { and, desc, eq, lt, lte } from "drizzle-orm";
import { fotosPauta, gastoPauta, pautaObjetos } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import { fechaDeInstanteEnBogota, instanteDeBogota } from "@/lib/format";
import {
  mensajeSeguroDePauta,
  sincronizarPautaEnVentana,
  type FetchMeta,
} from "./sincronizar";
import type { TokensMeta } from "@/lib/integraciones";

export const MINUTOS_ENTRE_FOTOS = 20;
const DIAS_DE_FOTOS = 30;
const LOTE = 200;

export type ResultadoSincronizacionDiaEnCurso =
  | { estado: "reciente"; ultimaFoto: Date }
  | { estado: "corriendo" }
  | { estado: "ok"; fotos: number; omitidas: number }
  | { estado: "error"; error: string };

const UNA_HORA_MS = 60 * 60_000;

/** El Hub refresca en segundo plano cuando nunca ha corrido o la ultima corrida ya envejecio. */
export function debeSincronizarDesdeElHub(ultimoInicio: Date | null, ahora: Date): boolean {
  return ultimoInicio === null || ahora.getTime() - ultimoInicio.getTime() > UNA_HORA_MS;
}

type AcumuladoCampana = {
  programId: string;
  campanaId: string;
  gastoCentavos: number;
  moneda: string;
  agendasMeta: number;
  tieneAgendas: boolean;
};

function centavos(monto: string): number {
  return Math.round(Number(monto) * 100);
}

export async function sincronizarDiaEnCurso(
  db: Db,
  args: { tokens: TokensMeta; ahora: Date; disparadaPor: "endpoint" | "hub"; f?: FetchMeta },
): Promise<ResultadoSincronizacionDiaEnCurso> {
  try {
    const [ultima] = await db.select({ tomadaEn: fotosPauta.tomadaEn })
      .from(fotosPauta)
      .orderBy(desc(fotosPauta.tomadaEn))
      .limit(1);
    const limiteReciente = new Date(
      args.ahora.getTime() - MINUTOS_ENTRE_FOTOS * 60_000,
    );
    if (ultima && ultima.tomadaEn > limiteReciente) {
      return { estado: "reciente", ultimaFoto: ultima.tomadaEn };
    }

    const hoy = fechaDeInstanteEnBogota(args.ahora);
    let sincronizacion;
    try {
      sincronizacion = await sincronizarPautaEnVentana(db, {
        tokens: args.tokens,
        desde: hoy,
        hasta: hoy,
        disparadaPor: args.disparadaPor,
        refrescarArbol: false,
        ahora: args.ahora,
        f: args.f,
      });
    } catch (error) {
      if (error instanceof ErrorDeApp && error.status === 409) {
        return { estado: "corriendo" };
      }
      throw error;
    }
    if (sincronizacion.estado === "error") {
      return { estado: "error", error: sincronizacion.error ?? "Error interno." };
    }

    const resultado = await db.transaction(async (tx) => {
      const transaccion = tx as Db;
      const [gastos, objetos] = await Promise.all([
        transaccion.select({
          programId: gastoPauta.programId,
          pautaObjetoId: gastoPauta.pautaObjetoId,
          monto: gastoPauta.monto,
          moneda: gastoPauta.moneda,
          agendasMeta: gastoPauta.agendasMeta,
        }).from(gastoPauta).where(and(
          eq(gastoPauta.fecha, hoy),
          eq(gastoPauta.origen, "meta_api"),
        )),
        transaccion.select({
          id: pautaObjetos.id,
          idMeta: pautaObjetos.idMeta,
          nivel: pautaObjetos.nivel,
          padreIdMeta: pautaObjetos.padreIdMeta,
          programId: pautaObjetos.programId,
        }).from(pautaObjetos),
      ]);
      const objetosPorId = new Map(objetos.map((objeto) => [objeto.id, objeto]));
      const objetosPorIdMeta = new Map(objetos.map((objeto) => [objeto.idMeta, objeto]));
      const acumulados = new Map<string, AcumuladoCampana>();
      let omitidas = sincronizacion.omitidas;

      for (const gasto of gastos) {
        const anuncio = gasto.pautaObjetoId ? objetosPorId.get(gasto.pautaObjetoId) : undefined;
        const conjunto = anuncio?.nivel === "anuncio" && anuncio.padreIdMeta
          ? objetosPorIdMeta.get(anuncio.padreIdMeta)
          : undefined;
        const campana = conjunto?.nivel === "conjunto" && conjunto.padreIdMeta
          ? objetosPorIdMeta.get(conjunto.padreIdMeta)
          : undefined;
        if (campana?.nivel !== "campana") {
          omitidas += 1;
          continue;
        }
        const acumulado = acumulados.get(campana.id) ?? {
          programId: campana.programId,
          campanaId: campana.id,
          gastoCentavos: 0,
          moneda: gasto.moneda,
          agendasMeta: 0,
          tieneAgendas: false,
        };
        acumulado.gastoCentavos += centavos(gasto.monto);
        if (gasto.agendasMeta !== null) {
          acumulado.agendasMeta += gasto.agendasMeta;
          acumulado.tieneAgendas = true;
        }
        acumulados.set(campana.id, acumulado);
      }

      const fotos = [...acumulados.values()].map((acumulado) => ({
        tomadaEn: args.ahora,
        fecha: hoy,
        programId: acumulado.programId,
        campanaId: acumulado.campanaId,
        gasto: (acumulado.gastoCentavos / 100).toFixed(2),
        moneda: acumulado.moneda,
        agendasMeta: acumulado.tieneAgendas ? acumulado.agendasMeta : null,
      }));
      for (let i = 0; i < fotos.length; i += LOTE) {
        await transaccion.insert(fotosPauta).values(fotos.slice(i, i + LOTE));
      }
      await transaccion.delete(fotosPauta).where(lt(
        fotosPauta.tomadaEn,
        new Date(args.ahora.getTime() - DIAS_DE_FOTOS * 24 * 60 * 60_000),
      ));
      return { fotos: fotos.length, omitidas };
    });
    return { estado: "ok", ...resultado };
  } catch (error) {
    return { estado: "error", error: mensajeSeguroDePauta(error, args.tokens) };
  }
}

export async function gastoAEstaHora(
  db: Db,
  args: { campanaId: string; fecha: string; hora: `${number}${number}:${number}${number}` },
): Promise<{ gasto: string; moneda: string; agendasMeta: number | null; tomadaEn: Date } | null> {
  const instante = instanteDeBogota(args.fecha, args.hora);
  if (!instante) return null;
  const [foto] = await db.select({
    gasto: fotosPauta.gasto,
    moneda: fotosPauta.moneda,
    agendasMeta: fotosPauta.agendasMeta,
    tomadaEn: fotosPauta.tomadaEn,
  }).from(fotosPauta).where(and(
    eq(fotosPauta.campanaId, args.campanaId),
    eq(fotosPauta.fecha, args.fecha),
    lte(fotosPauta.tomadaEn, instante),
  )).orderBy(desc(fotosPauta.tomadaEn)).limit(1);
  return foto ?? null;
}
