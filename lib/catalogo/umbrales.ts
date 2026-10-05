import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { metricaConUmbralEnum, umbralesAlerta } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { esAdministrador, type Rol } from "@/lib/auth/roles";
import { ErrorDeApp } from "@/lib/errors";
import { normalizando } from "@/lib/errors-zod";
import { moldeDeCatalogo } from "./molde";

/**
 * Los umbrales de las alertas por persistencia (ticket 147, DP-23), sobre el molde de catálogo:
 * cada cambio deja su fila en `change_log`. Uno por programa y métrica (el índice lo garantiza);
 * los edita quien administra, desde la pestaña Programa (ADR 0077).
 */

export const METRICAS_CON_UMBRAL = metricaConUmbralEnum.enumValues;
export type MetricaConUmbral = (typeof METRICAS_CON_UMBRAL)[number];

export const NOMBRE_DE_METRICA_CON_UMBRAL: Record<MetricaConUmbral, string> = {
  meta_mes: "Meta del mes",
  meta_cohorte: "Meta de la cohorte",
};

/** Los días seguidos que dispara la alerta si nadie dice otra cosa (QD-6, Mani, 1-oct). */
export const DIAS_SEGUIDOS_POR_DEFECTO = 5;

/** El único esquema de la entidad. `aceptable` es un porcentaje de cumplimiento: 80 = 80 %. */
export const esquemaUmbral = z.object({
  programId: z.string().uuid("Programa inválido."),
  metrica: z.enum(METRICAS_CON_UMBRAL),
  aceptable: z.coerce
    .number({ message: "El aceptable es un número." })
    .min(1, "El aceptable va de 1 a 100 %.")
    .max(100, "El aceptable va de 1 a 100 %.")
    .transform((n) => n.toFixed(2)),
  diasSeguidos: z.coerce
    .number({ message: "Los días son un número." })
    .int("Los días son un número entero.")
    .min(1, "Entre 1 y 30 días hábiles.")
    .max(30, "Entre 1 y 30 días hábiles."),
});
export type EntradaUmbral = z.input<typeof esquemaUmbral>;

function catalogo(db: Db) {
  return moldeDeCatalogo(
    {
      tabla: umbralesAlerta,
      nombreTabla: "umbrales_alerta",
      esquema: esquemaUmbral,
      etiqueta: (fila) => NOMBRE_DE_METRICA_CON_UMBRAL[fila.metrica as MetricaConUmbral] ?? String(fila.metrica),
      nombreEntidad: "un umbral",
      mensajeDuplicado: "Esa métrica ya tiene umbral en este programa.",
    },
    db,
  );
}

export interface UmbralDeAlerta {
  id: string;
  programId: string;
  metrica: MetricaConUmbral;
  /** Porcentaje de cumplimiento: 80 = 80 %. */
  aceptable: number;
  diasSeguidos: number;
  activo: boolean;
}

/** Los umbrales de UN programa: el programa es frontera, nunca se leen los de todos. */
export async function umbralesDelPrograma(db: Db, programId: string): Promise<UmbralDeAlerta[]> {
  const filas = await db.select().from(umbralesAlerta).where(eq(umbralesAlerta.programId, programId));
  return filas.map((f) => ({
    id: f.id,
    programId: f.programId,
    metrica: f.metrica,
    aceptable: Number(f.aceptable),
    diasSeguidos: f.diasSeguidos,
    activo: f.activo,
  }));
}

/**
 * Guarda el umbral de una métrica en un programa: lo crea si no existe y si existe lo edita, y lo
 * activa o desactiva según `activo`. Todo por el molde, así que todo queda en `change_log`.
 * Solo quien administra (gerente o developer, ADR 0025); el programa y la métrica de una fila
 * existente nunca cambian, porque se buscan por ellos.
 */
export async function guardarUmbral(
  db: Db,
  actor: { id: string; rol: Rol },
  input: EntradaUmbral & { activo: boolean },
): Promise<UmbralDeAlerta> {
  return normalizando(() => guardar(db, actor, input));
}

async function guardar(
  db: Db,
  actor: { id: string; rol: Rol },
  input: EntradaUmbral & { activo: boolean },
): Promise<UmbralDeAlerta> {
  if (!esAdministrador(actor.rol)) throw new ErrorDeApp("Solo quien administra cambia los umbrales.", 403);
  const datos = esquemaUmbral.parse(input);
  const molde = catalogo(db);
  const [existente] = await db
    .select({ id: umbralesAlerta.id, activo: umbralesAlerta.activo })
    .from(umbralesAlerta)
    .where(and(eq(umbralesAlerta.programId, datos.programId), eq(umbralesAlerta.metrica, datos.metrica)));

  let id: string;
  if (existente) {
    await molde.editar(actor.id, existente.id, datos);
    id = existente.id;
    if (existente.activo !== input.activo) {
      await (input.activo ? molde.reactivar(actor.id, id) : molde.desactivar(actor.id, id));
    }
  } else {
    id = (await molde.crear(actor.id, datos)).id;
    if (!input.activo) await molde.desactivar(actor.id, id);
  }
  return (await umbralesDelPrograma(db, datos.programId)).find((u) => u.id === id)!;
}
