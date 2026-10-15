import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { esAdministrador, type Rol } from "@/lib/auth/roles";
import { cohorts, objetivos } from "@/lib/db/schema";
import { esViolacionCheck } from "@/lib/db/errores";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import { normalizando } from "@/lib/errors-zod";
import {
  DEFINICION_METRICAS_OBJETIVO,
  METRICAS_OBJETIVO,
  type MetricaObjetivo,
} from "@/lib/objetivos/metricas";
import { moldeDeCatalogo } from "./molde";

export const AREAS_DE_OBJETIVO = ["paid", "organico", "referidos"] as const;
export type AreaDeObjetivo = (typeof AREAS_DE_OBJETIVO)[number];
export type MonedaDeObjetivo = "COP" | "USD";

const numeroDecimal = (nombre: string) =>
  z.coerce
    .number({ message: `${nombre} debe ser un número.` })
    .min(0, `${nombre} no puede ser negativo.`)
    .transform((valor) => valor.toFixed(2));

/** El único esquema de la entidad; altas y ediciones pasan por la misma validación. */
export const esquemaObjetivo = z
  .object({
    cohortId: z.string().uuid("Cohorte inválida."),
    area: z.enum(AREAS_DE_OBJETIVO).nullable(),
    metrica: z.enum(METRICAS_OBJETIVO),
    meta: numeroDecimal("La meta"),
    aceptable: z
      .union([z.literal(""), z.null(), z.undefined(), numeroDecimal("El aceptable")])
      .transform((valor) => (valor === "" || valor === null || valor === undefined ? null : valor)),
    moneda: z
      .union([z.enum(["COP", "USD"]), z.literal(""), z.null(), z.undefined()])
      .transform((valor) => (valor === "" || valor === undefined ? null : valor)),
  })
  .superRefine((datos, ctx) => {
    const definicion = DEFINICION_METRICAS_OBJETIVO[datos.metrica];
    if (definicion.esCosto && datos.moneda === null) {
      ctx.addIssue({ code: "custom", path: ["moneda"], message: "Una métrica de costo necesita moneda." });
    }
    if (!definicion.esCosto && datos.moneda !== null) {
      ctx.addIssue({ code: "custom", path: ["moneda"], message: "Esta métrica no lleva moneda." });
    }
    if (datos.metrica === "cupos" && datos.area === null) {
      ctx.addIssue({
        code: "custom",
        path: ["area"],
        message: "Los cupos totales se definen en la meta de la cohorte; elige un área.",
      });
    }
    if (datos.aceptable !== null) {
      const meta = Number(datos.meta);
      const aceptable = Number(datos.aceptable);
      const ladoIncorrecto = definicion.sentido === "menor_es_mejor" ? aceptable < meta : aceptable > meta;
      if (ladoIncorrecto) {
        ctx.addIssue({
          code: "custom",
          path: ["aceptable"],
          message:
            definicion.sentido === "menor_es_mejor"
              ? "En una métrica de costo, el aceptable debe ser mayor o igual que la meta."
              : "El aceptable debe ser menor o igual que la meta.",
        });
      }
    }
  });

export type EntradaObjetivo = z.input<typeof esquemaObjetivo>;
type ObjetivoValidado = z.output<typeof esquemaObjetivo>;

export interface ObjetivoDeCohorte {
  id: string;
  cohortId: string;
  area: AreaDeObjetivo | null;
  metrica: MetricaObjetivo;
  meta: number;
  aceptable: number | null;
  moneda: MonedaDeObjetivo | null;
  activo: boolean;
}

type ActorObjetivos = { id: string; rol: Rol };
type BaseConTransaccion = { transaction: <T>(fn: (tx: Db) => Promise<T>) => Promise<T> };

function catalogo(db: Db) {
  return moldeDeCatalogo(
    {
      tabla: objetivos,
      nombreTabla: "objetivos",
      esquema: esquemaObjetivo,
      etiqueta: (fila) => {
        const metrica = fila.metrica as MetricaObjetivo;
        const area = fila.area === null ? "total" : String(fila.area);
        return `${DEFINICION_METRICAS_OBJETIVO[metrica]?.nombre ?? metrica} · ${area}`;
      },
      nombreEntidad: "un objetivo",
      mensajeDuplicado: "Ya hay un objetivo de esa métrica para esa área en esta cohorte.",
    },
    db,
  );
}

function exigirAdministrador(actor: ActorObjetivos) {
  if (!esAdministrador(actor.rol)) {
    throw new ErrorDeApp("Solo quien administra cambia los objetivos.", 403);
  }
}

function aObjetivo(fila: typeof objetivos.$inferSelect): ObjetivoDeCohorte {
  return {
    id: fila.id,
    cohortId: fila.cohortId,
    area: fila.area as AreaDeObjetivo | null,
    metrica: fila.metrica,
    meta: Number(fila.meta),
    aceptable: fila.aceptable === null ? null : Number(fila.aceptable),
    moneda: fila.moneda as MonedaDeObjetivo | null,
    activo: fila.activo,
  };
}

export async function objetivosDeCohortes(db: Db, cohortIds: string[]): Promise<ObjetivoDeCohorte[]> {
  if (cohortIds.length === 0) return [];
  const filas = await db.select().from(objetivos).where(inArray(objetivos.cohortId, cohortIds));
  return filas.map(aObjetivo);
}

async function datosDeCupos(db: Db, cohortId: string, excluirId?: string, bloquear = false) {
  // Las escrituras bloquean la cohorte: dos repartos concurrentes no pueden leer ambos el mismo
  // saldo y exceder juntos la meta. La lectura para pantalla no necesita ese bloqueo.
  const filasCohorte = bloquear
    ? await db
        .select({ metaCupos: cohorts.metaCupos })
        .from(cohorts)
        .where(eq(cohorts.id, cohortId))
        .for("update")
    : await db
        .select({ metaCupos: cohorts.metaCupos })
        .from(cohorts)
        .where(eq(cohorts.id, cohortId));
  const [cohorte] = filasCohorte;
  if (!cohorte) throw new ErrorDeApp("No existe la cohorte.", 404);

  const condiciones = [
    eq(objetivos.cohortId, cohortId),
    eq(objetivos.metrica, "cupos"),
    eq(objetivos.activo, true),
    sql`${objetivos.area} is not null`,
  ];
  if (excluirId) condiciones.push(ne(objetivos.id, excluirId));
  const [fila] = await db
    .select({ suma: sql<number>`coalesce(sum(${objetivos.meta}), 0)` })
    .from(objetivos)
    .where(and(...condiciones));
  return { metaCupos: cohorte.metaCupos, asignados: Number(fila?.suma ?? 0) };
}

async function validarReparto(
  db: Db,
  datos: ObjetivoValidado,
  opciones?: { excluirId?: string; incluir?: boolean },
) {
  if (datos.metrica !== "cupos" || datos.area === null || opciones?.incluir === false) return;
  const { metaCupos, asignados } = await datosDeCupos(db, datos.cohortId, opciones?.excluirId, true);
  const total = asignados + Number(datos.meta);
  if (total > metaCupos) {
    throw new ErrorDeApp(
      `Los cupos por área sumarían ${total} y la meta de la cohorte es ${metaCupos}.`,
      400,
    );
  }
}

async function normalizarEscritura<T>(fn: () => Promise<T>): Promise<T> {
  return normalizando(async () => {
    try {
      return await fn();
    } catch (error) {
      if (
        error instanceof ErrorDeApp &&
        error.message === "Ya hay un objetivo de esa métrica para esa área en esta cohorte."
      ) {
        throw new ErrorDeApp(error.message, 400);
      }
      if (error instanceof ErrorDeApp) throw error;
      if (esViolacionCheck(error)) {
        throw new ErrorDeApp("La moneda no corresponde a la métrica del objetivo.", 400);
      }
      throw error;
    }
  });
}

async function crearEnTransaccion(db: Db, actor: ActorObjetivos, input: EntradaObjetivo) {
  const datos = esquemaObjetivo.parse(input);
  await validarReparto(db, datos);
  return aObjetivo((await catalogo(db).crear(actor.id, datos)) as typeof objetivos.$inferSelect);
}

export async function crearObjetivo(db: Db, actor: ActorObjetivos, input: EntradaObjetivo) {
  exigirAdministrador(actor);
  return normalizarEscritura(() =>
    (db as unknown as BaseConTransaccion).transaction((tx) => crearEnTransaccion(tx, actor, input)),
  );
}

export async function editarObjetivo(db: Db, actor: ActorObjetivos, id: string, input: EntradaObjetivo) {
  exigirAdministrador(actor);
  return normalizarEscritura(() =>
    (db as unknown as BaseConTransaccion).transaction(async (tx) => {
      const [actual] = await tx.select().from(objetivos).where(eq(objetivos.id, id));
      if (!actual) throw new ErrorDeApp("No existe un objetivo con ese id.", 404);
      const datos = esquemaObjetivo.parse(input);
      await validarReparto(tx, datos, { excluirId: id, incluir: actual.activo });
      return aObjetivo((await catalogo(tx).editar(actor.id, id, datos)) as typeof objetivos.$inferSelect);
    }),
  );
}

export async function borrarObjetivo(db: Db, actor: ActorObjetivos, id: string) {
  exigirAdministrador(actor);
  return normalizarEscritura(() => catalogo(db).borrarSiNoSeUso(actor.id, id));
}

export async function cuposSinAsignar(db: Db, cohortId: string): Promise<number> {
  const { metaCupos, asignados } = await datosDeCupos(db, cohortId);
  return metaCupos - asignados;
}

export async function copiarObjetivos(
  db: Db,
  actor: ActorObjetivos,
  ids: { desdeCohorteId: string; haciaCohorteId: string },
): Promise<ObjetivoDeCohorte[]> {
  exigirAdministrador(actor);
  return normalizarEscritura(() =>
    (db as unknown as BaseConTransaccion).transaction(async (tx) => {
      const filasCohorte = await tx
        .select({ id: cohorts.id, programId: cohorts.programId })
        .from(cohorts)
        .where(inArray(cohorts.id, [ids.desdeCohorteId, ids.haciaCohorteId]));
      const desde = filasCohorte.find((fila) => fila.id === ids.desdeCohorteId);
      const hacia = filasCohorte.find((fila) => fila.id === ids.haciaCohorteId);
      if (!desde || !hacia) throw new ErrorDeApp("No existe una de las cohortes.", 404);
      if (desde.programId !== hacia.programId) {
        throw new ErrorDeApp("Solo se pueden copiar objetivos entre cohortes del mismo programa.", 400);
      }
      const [conteo] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(objetivos)
        .where(eq(objetivos.cohortId, ids.haciaCohorteId));
      if (Number(conteo?.n ?? 0) > 0) {
        throw new ErrorDeApp("La cohorte de destino ya tiene objetivos.", 400);
      }
      const origen = await tx
        .select()
        .from(objetivos)
        .where(and(eq(objetivos.cohortId, ids.desdeCohorteId), eq(objetivos.activo, true)));
      const copiados: ObjetivoDeCohorte[] = [];
      for (const fila of origen) {
        copiados.push(
          await crearEnTransaccion(tx, actor, {
            cohortId: ids.haciaCohorteId,
            area: fila.area as AreaDeObjetivo | null,
            metrica: fila.metrica,
            meta: fila.meta,
            aceptable: fila.aceptable,
            moneda: fila.moneda as MonedaDeObjetivo | null,
          }),
        );
      }
      return copiados;
    }),
  );
}
