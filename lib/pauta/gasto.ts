import { sql } from "drizzle-orm";
import { z } from "zod";
import { gastoPauta } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";

const LOTE = 200;

export const esquemaGastoPauta = z.object({
  programId: z.string().uuid(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  monto: z.string().regex(/^\d+(\.\d{1,2})?$/),
  moneda: z.string().regex(/^[A-Za-z]{3}$/).transform((moneda) => moneda.toUpperCase()),
  agendasMeta: z.number().int().min(0).nullable().optional(),
  origen: z.enum(["meta_api", "manual"]),
  pautaObjetoId: z.string().uuid().nullable().optional(),
  area: z.enum(["paid", "organico", "referidos"]).nullable().optional(),
}).superRefine((fila, ctx) => {
  const tieneObjeto = fila.pautaObjetoId != null;
  const tieneArea = fila.area != null;
  if (tieneObjeto === tieneArea) {
    ctx.addIssue({ code: "custom", message: "El gasto debe tener exactamente un destino." });
  }
  if (fila.origen === "meta_api" && !tieneObjeto) {
    ctx.addIssue({ code: "custom", message: "El gasto de Meta debe pertenecer a un anuncio." });
  }
});

export type EntradaGastoPauta = z.input<typeof esquemaGastoPauta>;

/** Único escritor de gasto_pauta: valida y escribe en lotes idempotentes. */
export async function registrarGasto(db: Db, entradas: EntradaGastoPauta[]): Promise<void> {
  const filas = entradas.map((entrada) => esquemaGastoPauta.parse(entrada));
  const meta = filas.filter((fila) => fila.origen === "meta_api");
  const manuales = filas.filter((fila) => fila.origen === "manual");

  for (let i = 0; i < meta.length; i += LOTE) {
    const lote = meta.slice(i, i + LOTE).map((fila) => ({
      ...fila,
      pautaObjetoId: fila.pautaObjetoId!,
      area: null,
    }));
    await db.insert(gastoPauta).values(lote).onConflictDoUpdate({
      target: [gastoPauta.pautaObjetoId, gastoPauta.fecha],
      targetWhere: sql`${gastoPauta.origen} = 'meta_api'`,
      set: {
        monto: sql`excluded.monto`,
        agendasMeta: sql`excluded.agendas_meta`,
        moneda: sql`excluded.moneda`,
        actualizadoEn: sql`now()`,
      },
    });
  }

  for (let i = 0; i < manuales.length; i += LOTE) {
    await db.insert(gastoPauta).values(manuales.slice(i, i + LOTE).map((fila) => ({
      ...fila,
      pautaObjetoId: fila.pautaObjetoId ?? null,
      area: fila.area ?? null,
    })));
  }
}
