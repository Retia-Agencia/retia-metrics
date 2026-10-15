import { eq } from "drizzle-orm";
import { z } from "zod";
import { esAdministrador, type Rol } from "@/lib/auth/roles";
import { reportesWhatsapp } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import { normalizando } from "@/lib/errors-zod";
import {
  DEFINICION_METRICAS_OBJETIVO,
  METRICAS_OFRECIDAS,
  type MetricaObjetivo,
} from "@/lib/objetivos/metricas";
import { cohorteActiva } from "@/lib/queries/cohortes";
import { objetivosDeCohortes } from "./objetivos";
import { moldeDeCatalogo } from "./molde";

export const METRICAS_DEL_REPORTE = ["costo_por_agenda"] as const satisfies readonly MetricaObjetivo[];
export type MetricaDelReporte = (typeof METRICAS_DEL_REPORTE)[number];

const destino = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((valor) => valor?.trim() || null)
  .refine(
    (valor) => valor === null || valor.endsWith("@g.us"),
    "Pega el id del grupo tal como lo da /grupos de Juanito (termina en @g.us).",
  );

/** El unico esquema de la configuracion; crear y editar validan exactamente lo mismo. */
export const esquemaReporteWhatsapp = z.object({
  programId: z.string().uuid("Programa inválido."),
  activo: z.boolean(),
  destino,
  horas: z
    .array(z.coerce.number().int().min(6).max(19))
    .refine((horas) => new Set(horas).size === horas.length, "Las horas no se pueden repetir.")
    .transform((horas) => [...horas].sort((a, b) => a - b)),
  horaCierre: z.union([z.null(), z.coerce.number().int().min(6).max(19)]),
  metricas: z
    .array(z.enum(METRICAS_DEL_REPORTE))
    .transform((metricas) => [...new Set(metricas)]),
});

export interface EntradaReporteWhatsapp {
  activo: boolean;
  destino?: string | null;
  horas: number[];
  horaCierre: number | null;
  metricas: MetricaDelReporte[];
}
export type ReporteWhatsapp = typeof reportesWhatsapp.$inferSelect;
type ActorReporte = { id: string; rol: Rol };

function catalogo(db: Db) {
  return moldeDeCatalogo(
    {
      tabla: reportesWhatsapp,
      nombreTabla: "reportes_whatsapp",
      esquema: esquemaReporteWhatsapp,
      etiqueta: (fila) => `Reporte de WhatsApp · ${String(fila.programId)}`,
      nombreEntidad: "un reporte de WhatsApp",
      mensajeDuplicado: "Ese programa ya tiene un reporte de WhatsApp.",
    },
    db,
  );
}

export async function reporteDelPrograma(db: Db, programId: string): Promise<ReporteWhatsapp | null> {
  const [fila] = await db
    .select()
    .from(reportesWhatsapp)
    .where(eq(reportesWhatsapp.programId, programId));
  return fila ?? null;
}

function exigirAdministrador(actor: ActorReporte) {
  if (!esAdministrador(actor.rol)) {
    throw new ErrorDeApp("Solo quien administra configura el reporte.", 403);
  }
}

function validarConfiguracionActiva(datos: z.output<typeof esquemaReporteWhatsapp>) {
  if (!datos.activo) return;
  if (!datos.destino) throw new ErrorDeApp("El reporte encendido necesita el id del grupo.", 422);
  if (datos.horas.length === 0 && datos.horaCierre === null) {
    throw new ErrorDeApp("El reporte encendido necesita al menos una hora o un resumen de cierre.", 422);
  }
  if (datos.metricas.length === 0) {
    throw new ErrorDeApp("El reporte encendido necesita al menos una métrica.", 422);
  }
}

async function validarUmbrales(
  db: Db,
  programId: string,
  metricas: readonly MetricaDelReporte[],
) {
  if (metricas.length === 0) return;
  const cohorte = await cohorteActiva(programId, db);
  const objetivos = cohorte ? await objetivosDeCohortes(db, [cohorte.id]) : [];
  for (const metrica of metricas) {
    const tieneUmbral = objetivos.some(
      (objetivo) => objetivo.activo && objetivo.area === null && objetivo.metrica === metrica,
    );
    if (!tieneUmbral) {
      const nombre = DEFINICION_METRICAS_OBJETIVO[metrica].nombre;
      throw new ErrorDeApp(
        `No hay umbral de ${nombre} en la cohorte activa: cárgalo en Programa › Ventas.`,
        422,
      );
    }
  }
}

export async function guardarReporte(
  db: Db,
  actor: ActorReporte,
  programId: string,
  input: EntradaReporteWhatsapp,
): Promise<ReporteWhatsapp> {
  exigirAdministrador(actor);
  return normalizando(async () => {
    const datos = esquemaReporteWhatsapp.parse({ programId, ...input });
    if (!datos.metricas.every((metrica) => METRICAS_OFRECIDAS.includes(metrica))) {
      throw new ErrorDeApp("Esa métrica todavía no está disponible para el reporte.", 400);
    }
    validarConfiguracionActiva(datos);
    await validarUmbrales(db, programId, datos.metricas);

    const actual = await reporteDelPrograma(db, programId);
    const guardada = actual
      ? await catalogo(db).editar(actor.id, actual.id, datos)
      : await catalogo(db).crear(actor.id, datos);
    return guardada as ReporteWhatsapp;
  });
}
