import { and, asc, count, eq } from "drizzle-orm";
import { db as dbDeLaApp } from "@/lib/db";
import { rarezasMigracion } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import type { TipoRareza } from "./template";

/**
 * La lista VISIBLE de lo que la migracion no pudo clasificar (ticket 080: "lo que no se pueda
 * clasificar queda visible con su rareza"). Solo lectura: una rareza no se anula, porque de la
 * hoja si paso (ADR 0038); se corrige en el template o a mano en el deal.
 *
 * Por programa, siempre: el programa es frontera (ADR 0043) y esta consulta no admite dos.
 */

/** Cuantas filas trae la lista como maximo; el conteo por tipo siempre es el total. */
export const LIMITE_DE_RAREZAS = 500;

/** Como se nombra cada tipo en la pantalla. Un tipo que no este aqui se muestra tal cual. */
export const NOMBRE_DE_RAREZA: Record<TipoRareza, string> = {
  sin_correo: "Sin correo",
  correo_repetido: "Correo repetido en la pestaña",
  estado_desconocido: "Estado de gestión desconocido",
  pendiente_con_notas: "Pendiente con actividad",
  agendado_por_decidir: "Agendado sin llamada",
  sin_resultado: "Llamada sin resultado",
  valor_desconocido: "Show o Cierre ilegible",
  sin_fecha: "Sin fecha",
  monto_cobrado_desconocido: "Monto cobrado desconocido",
  precio_desconocido: "Precio ilegible",
  fecha_aproximada: "Fecha de pago aproximada",
  en_dos_cohortes: "En dos cohortes",
  perdida_por_decidir: "Posible pérdida por decidir",
  cerrada_sin_estudiante: "Cierre sin estudiante",
  lead_no_encontrado: "Lead no encontrado",
  ya_tiene_deal_vivo: "Ya tenía deal vivo",
  plataforma_fuera_de_catalogo: "Plataforma fuera de catálogo",
  llamada_sin_deal: "Llamada sin deal",
  abono_sin_deal: "Abono sin deal",
  producto_no_encontrado: "Producto no encontrado",
  sin_cohorte: "Cohorte no encontrada",
};

export function nombreDeRareza(tipo: string): string {
  return (NOMBRE_DE_RAREZA as Record<string, string>)[tipo] ?? tipo;
}

export interface RarezasDelPrograma {
  porTipo: { tipo: string; total: number }[];
  total: number;
  /** El tipo pedido, solo si existe en ESTE programa; si no, nulo y la lista trae todos. */
  tipo: string | null;
  filas: {
    id: string;
    tipo: string;
    huella: string;
    detalle: string;
    leadId: string | null;
    dealId: string | null;
    createdAt: Date;
  }[];
}

export async function rarezasDelPrograma(
  programId: string,
  tipo: string | null = null,
  db: Db = dbDeLaApp,
): Promise<RarezasDelPrograma> {
  const delPrograma = eq(rarezasMigracion.programId, programId);
  const porTipo = await db
    .select({ tipo: rarezasMigracion.tipo, total: count() })
    .from(rarezasMigracion)
    .where(delPrograma)
    .groupBy(rarezasMigracion.tipo)
    .orderBy(asc(rarezasMigracion.tipo));
  // Un tipo de otro programa (se cambio el selector) no deja la lista vacia: se ignora.
  const elegido = tipo && porTipo.some((t) => t.tipo === tipo) ? tipo : null;
  const filas = await db
    .select({
      id: rarezasMigracion.id,
      tipo: rarezasMigracion.tipo,
      huella: rarezasMigracion.huella,
      detalle: rarezasMigracion.detalle,
      leadId: rarezasMigracion.leadId,
      dealId: rarezasMigracion.dealId,
      createdAt: rarezasMigracion.createdAt,
    })
    .from(rarezasMigracion)
    .where(elegido ? and(delPrograma, eq(rarezasMigracion.tipo, elegido)) : delPrograma)
    .orderBy(asc(rarezasMigracion.tipo), asc(rarezasMigracion.huella))
    .limit(LIMITE_DE_RAREZAS);
  return { porTipo, total: porTipo.reduce((s, t) => s + t.total, 0), tipo: elegido, filas };
}
