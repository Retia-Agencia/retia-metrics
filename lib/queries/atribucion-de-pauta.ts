import { and, eq } from "drizzle-orm";
import { emparejar, type ArbolDePauta } from "@/lib/atribucion/emparejar";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { utmsDelEnvio } from "@/lib/atribucion/utm-del-envio";
import { fechaDeInstanteEnBogota } from "@/lib/format";
import type { Rango } from "@/lib/queries/dashboard";

/** Los ids de campaña, conjunto y anuncio son los del árbol de Meta; cuentaId es la FK de la cuenta. */
export interface AtribucionDePauta {
  envioId: string;
  leadId: string;
  nombre: string | null;
  fechaEnvio: Date;
  diaEnvio: string;
  cuentaComoRegistro: boolean;
  canal: string;
  /** La clave estable del canal (`resolverCanal`), para agrupar y profundizar por canal. */
  canalClave: string;
  campanaId: string | null;
  campanaNombre: string | null;
  /** La cuenta de Meta de su campaña (`pauta_objetos.cuenta_id`, 416); nula sin campaña de Meta. */
  cuentaId: string | null;
  conjuntoId: string | null;
  conjuntoNombre: string | null;
  anuncioId: string | null;
  anuncioNombre: string | null;
}

/** Usa las identidades resueltas del árbol. La URL futura deberá resolver su UUID en el servidor. */
export type CortePauta = { nivel: "cuenta_meta" | "campana" | "conjunto" | "anuncio"; id: string };

/** Solo pertenencia exacta y ancestros identificados; nunca reparte residuales. Aún no filtra ninguna vista. */
export function perteneceAlCorte(atribucion: AtribucionDePauta, corte: CortePauta): boolean {
  const ids = { cuenta_meta: atribucion.cuentaId, campana: atribucion.campanaId,
    conjunto: atribucion.conjuntoId, anuncio: atribucion.anuncioId };
  return ids[corte.nivel] === corte.id;
}

export type EnvioParaAtribucion = Parameters<typeof utmsDelEnvio>[0] & {
  id: string; esParcial: boolean; leadId: string | null; nombre: string | null;
  fechaEnvio: Date | null; createdAt: Date;
};
export interface ObjetoParaAtribucion {
  idMeta: string; nombre: string; nivel: "campana" | "conjunto" | "anuncio";
  cuentaId: string; padreIdMeta: string | null;
}

/**
 * El completo que corresponde a un parcial: mismo formulario y mismo token. ÚNICA definición del emparejamiento
 * canónico; la usan el ROAS (por rango) y las agendas de «Ver solo» (por ids), cada una con sus alias.
 */
type ColumnasDePareja = { sourceId: AnyPgColumn; token: AnyPgColumn; esParcial: AnyPgColumn };
export function completoDelParcial(parcial: ColumnasDePareja, completo: ColumnasDePareja) {
  return and(eq(completo.sourceId, parcial.sourceId), eq(completo.token, parcial.token), eq(completo.esParcial, false));
}

/** El día de negocio de un envío: el parcial no trae `fechaEnvio`, así que usa su creación. */
export function diaDelEnvio(envio: { fechaEnvio: Date | null; createdAt: Date }): string {
  return fechaDeInstanteEnBogota(envio.fechaEnvio ?? envio.createdAt);
}

const enRango = (dia: string, rango: Rango) => dia >= rango.desde && dia <= rango.hasta;

/** Recibe exclusivamente lo ya leído por el ROAS: conserva orden, alias y canónico sin consultas. */
export function atribuirEnviosDePauta(
  enviosCrudos: readonly EnvioParaAtribucion[],
  parejas: readonly { parcialId: string; completoId: string }[],
  objetos: readonly ObjetoParaAtribucion[],
  arbol: ArbolDePauta,
  rango: Rango,
) {
  const envioPorId = new Map(enviosCrudos.map((e) => [e.id, e]));
  const completoPorParcial = new Map(parejas.map((p) => [p.parcialId, p.completoId]));
  const nombres = new Map(objetos.map((o) => [o.idMeta, o.nombre]));
  const cuentaDeCampana = new Map(objetos.filter((o) => o.nivel === "campana").map((o) => [o.idMeta, o.cuentaId]));
  const pagados = enviosCrudos.flatMap((e) => {
    const completoId = e.esParcial ? completoPorParcial.get(e.id) : undefined;
    const base = completoId ? envioPorId.get(completoId) : e;
    if (!base || !enRango(diaDelEnvio(base), rango)) return [];
    const traza = emparejar(utmsDelEnvio(base), arbol);
    if (traza.origen.area !== "paid") return [];
    return [{ envio: e, base, traza }];
  });
  const canonicos = new Map<string, AtribucionDePauta>();
  const filaPorEnvioId = new Map<string, AtribucionDePauta>();
  for (const { envio: e, base, traza } of pagados) {
    const idCanonico = base.id;
    let fila = canonicos.get(idCanonico);
    if (!fila) {
      const anuncio = traza.anuncio;
      const conjunto = traza.conjunto;
      const campanaId = traza.campana?.tipo === "meta" ? traza.campana.campanaId : null;
      const instante = base.fechaEnvio ?? base.createdAt;
      fila = { envioId: idCanonico, leadId: base.leadId!, nombre: base.nombre,
        fechaEnvio: instante, diaEnvio: diaDelEnvio(base),
        cuentaComoRegistro: !base.esParcial,
        canal: traza.origen.canal?.nombre ?? "Paid",
        canalClave: traza.origen.canal?.clave ?? "paid",
        campanaId, campanaNombre: campanaId ? nombres.get(campanaId) ?? campanaId : null,
        cuentaId: campanaId ? cuentaDeCampana.get(campanaId) ?? null : null,
        conjuntoId: conjunto?.conjuntoId ?? null,
        conjuntoNombre: conjunto ? nombres.get(conjunto.conjuntoId) ?? conjunto.conjuntoId : null,
        anuncioId: anuncio?.anuncioId ?? null,
        anuncioNombre: anuncio ? nombres.get(anuncio.anuncioId) ?? anuncio.anuncioId : null,
      };
      canonicos.set(idCanonico, fila);
    }
    filaPorEnvioId.set(e.id, fila);
  }
  return { canonicos, filaPorEnvioId };
}

/** Un deal, sus citas y su venta heredan el envío de origen, incluidos los alias parciales. */
export function atribucionPorDeal<T extends AtribucionDePauta>(
  porEnvio: ReadonlyMap<string, T>,
  deals: readonly { id: string; submissionOrigenId: string | null }[],
): Map<string, T> {
  const porDeal = new Map<string, T>();
  for (const deal of deals) {
    const envio = deal.submissionOrigenId === null ? undefined : porEnvio.get(deal.submissionOrigenId);
    if (envio !== undefined) porDeal.set(deal.id, envio);
  }
  return porDeal;
}
