import { and, between, desc, eq, inArray, isNull, ne, notInArray, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db as dbDeLaApp } from "@/lib/db";
import { changeLog, dealEtapaHistorial, deals, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { incluyendoAnulados } from "./vigente";

/**
 * La bitacora de Nerd Stats (ticket 076, ADR 0042 punto 3): toda escritura del CRM, filtrable
 * por usuario, tabla y rango, sobre los DOS rastros presentados juntos:
 *
 * - `change_log`: "un campo cambio", una fila por campo (catalogo, deals, calls, abonos,
 *   actividades, y lo que dejaron el sync y la migracion).
 * - `deal_etapa_historial`: el movimiento de etapa, que tiene su propia tabla porque es el hecho
 *   del que salen la conversion y el tiempo en etapa (ADR 0037).
 *
 * **Sin duplicar el movimiento.** El motor mueve la etapa SIN pasar por `change_log`, pero al
 * ABRIR un deal (`abrirDeal`, con `crearConRastro`) escribe todos sus campos, etapa y pendiente
 * incluidos, ademas de la primera fila del historial. Por eso aqui `deals.etapa` y
 * `deals.pendiente` de `change_log` no se leen: el movimiento lo cuenta el historial, una vez.
 *
 * **Ningun dato personal.** Como el resto de Nerd Stats (ver `nerd-stats.ts`), no se proyectan
 * `etiqueta`, `valor_anterior` ni `valor_nuevo`: guardan nombres y correos de leads. De un
 * cambio se ve tabla, campo, registro (id opaco), quien y cuando; de un movimiento, las etapas,
 * que no son personales.
 */

/** La "tabla" con la que se filtran los movimientos de etapa. */
export const TABLA_MOVIMIENTOS = "deal_etapa_historial";

/** El usuario con el que se filtra lo que no hizo nadie (el sync, el sistema, un script sin actor). */
export const USUARIO_SISTEMA = "sistema";

export const POR_PAGINA = 50;

const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((d) => !Number.isNaN(Date.parse(`${d}T00:00:00Z`)));

/** Los filtros, validados en el borde (la URL). Lo que no valida se descarta, no se adivina. */
export const esquemaFiltroBitacora = z.object({
  usuario: z.union([z.literal(USUARIO_SISTEMA), z.uuid()]).optional().catch(undefined),
  tabla: z.string().regex(/^[a-z_]{1,64}$/).optional().catch(undefined),
  desde: dia.optional().catch(undefined),
  hasta: dia.optional().catch(undefined),
  pagina: z.coerce.number().int().min(1).max(10_000).catch(1).default(1),
});

export type FiltroBitacora = z.infer<typeof esquemaFiltroBitacora>;

/** De los parametros crudos de la URL (un valor repetido toma el primero). */
export function filtroDeLaUrl(params: Record<string, string | string[] | undefined>): FiltroBitacora {
  const uno = (v: string | string[] | undefined) => {
    const x = Array.isArray(v) ? v[0] : v;
    return x === undefined || x.trim() === "" ? undefined : x.trim();
  };
  return esquemaFiltroBitacora.parse({
    usuario: uno(params.usuario),
    tabla: uno(params.tabla),
    desde: uno(params.desde),
    hasta: uno(params.hasta),
    pagina: uno(params.pagina),
  });
}

interface Comun {
  id: string;
  cuando: Date;
  /** El correo de quien escribio; `null` = el sistema. */
  quien: string | null;
  registroId: string | null;
  /** El programa del deal, para enlazarlo; `null` si el registro no es un deal. */
  programaSlug: string | null;
}

export type EntradaBitacora =
  | (Comun & { tipo: "cambio"; tabla: string; campo: string; origen: "sync" | "app" | "upload" })
  | (Comun & {
      tipo: "movimiento";
      de: string | null;
      a: string;
      pendienteDe: string | null;
      pendienteA: string | null;
    });

export interface PaginaBitacora {
  entradas: EntradaBitacora[];
  total: number;
  pagina: number;
  paginas: number;
}

/** El dia de Bogota de un instante: el rango son dias en texto, ningun `Date` entra a la plantilla. */
const diaEnBogota = (columna: typeof changeLog.detectadoEn | typeof dealEtapaHistorial.fecha) =>
  sql<string>`(${columna} AT TIME ZONE 'America/Bogota')::date`;

function condicionDeRango(columna: typeof changeLog.detectadoEn | typeof dealEtapaHistorial.fecha, f: FiltroBitacora) {
  if (f.desde && f.hasta) return between(diaEnBogota(columna), f.desde, f.hasta);
  if (f.desde) return sql`${diaEnBogota(columna)} >= ${f.desde}`;
  if (f.hasta) return sql`${diaEnBogota(columna)} <= ${f.hasta}`;
  return undefined;
}

function condicionDeUsuario(columna: typeof changeLog.userId | typeof dealEtapaHistorial.userId, f: FiltroBitacora) {
  if (f.usuario === undefined) return undefined;
  return f.usuario === USUARIO_SISTEMA ? isNull(columna) : eq(columna, f.usuario);
}

/** Los campos de `deals` que cuenta el historial y no `change_log` (ver la nota de arriba). */
const CAMPOS_DEL_MOTOR = ["etapa", "pendiente"];

function condicionesDeCambios(f: FiltroBitacora): SQL | undefined {
  return and(
    or(ne(changeLog.tabla, "deals"), notInArray(changeLog.campo, CAMPOS_DEL_MOTOR)),
    f.tabla ? eq(changeLog.tabla, f.tabla) : undefined,
    condicionDeUsuario(changeLog.userId, f),
    condicionDeRango(changeLog.detectadoEn, f),
  );
}

function condicionesDeMovimientos(f: FiltroBitacora): SQL | undefined {
  return and(condicionDeUsuario(dealEtapaHistorial.userId, f), condicionDeRango(dealEtapaHistorial.fecha, f));
}

/**
 * Una pagina de la bitacora, de lo mas nuevo a lo mas viejo. Los dos rastros se leen por
 * separado (cada uno ordenado y cortado a lo que la pagina puede necesitar) y se mezclan en
 * memoria: a esta escala es gratis y se lee correcto (AGENTS.md).
 */
export async function paginaDeBitacora(filtro: FiltroBitacora, db: Db = dbDeLaApp): Promise<PaginaBitacora> {
  const conCambios = filtro.tabla === undefined || filtro.tabla !== TABLA_MOVIMIENTOS;
  const conMovimientos = filtro.tabla === undefined || filtro.tabla === TABLA_MOVIMIENTOS;
  const hastaFila = filtro.pagina * POR_PAGINA;

  const [cambios, movimientos, [totalCambios], [totalMovimientos]] = await Promise.all([
    conCambios
      ? db
          .select({
            id: changeLog.id,
            cuando: changeLog.detectadoEn,
            tabla: changeLog.tabla,
            campo: changeLog.campo,
            origen: changeLog.origen,
            registroId: changeLog.registroId,
            quien: users.email,
          })
          .from(changeLog)
          .leftJoin(users, eq(users.id, changeLog.userId))
          .where(condicionesDeCambios(filtro))
          .orderBy(desc(changeLog.detectadoEn), desc(changeLog.id))
          .limit(hastaFila)
      : Promise.resolve([]),
    conMovimientos
      ? db
          .select({
            id: dealEtapaHistorial.id,
            cuando: dealEtapaHistorial.fecha,
            registroId: dealEtapaHistorial.dealId,
            de: dealEtapaHistorial.de,
            a: dealEtapaHistorial.a,
            pendienteDe: dealEtapaHistorial.pendienteDe,
            pendienteA: dealEtapaHistorial.pendienteA,
            quien: users.email,
          })
          .from(dealEtapaHistorial)
          .leftJoin(users, eq(users.id, dealEtapaHistorial.userId))
          .where(condicionesDeMovimientos(filtro))
          .orderBy(desc(dealEtapaHistorial.fecha), desc(dealEtapaHistorial.id))
          .limit(hastaFila)
      : Promise.resolve([]),
    conCambios
      ? db.select({ n: sql<number>`count(*)::int` }).from(changeLog).where(condicionesDeCambios(filtro))
      : Promise.resolve([{ n: 0 }]),
    conMovimientos
      ? db.select({ n: sql<number>`count(*)::int` }).from(dealEtapaHistorial).where(condicionesDeMovimientos(filtro))
      : Promise.resolve([{ n: 0 }]),
  ]);

  const mezcladas = [
    ...cambios.map((c) => ({ ...c, tipo: "cambio" as const })),
    ...movimientos.map((m) => ({ ...m, tipo: "movimiento" as const })),
  ]
    .sort((x, y) => y.cuando.getTime() - x.cuando.getTime() || y.id.localeCompare(x.id))
    .slice((filtro.pagina - 1) * POR_PAGINA, hastaFila);

  // El programa de cada deal tocado, para enlazar su ficha. Un deal anulado sigue siendo el
  // registro del que habla la bitacora: se lee con lo anulado, escrito.
  const idsDeDeals = [
    ...new Set(
      mezcladas
        .filter((e) => e.tipo === "movimiento" || e.tabla === "deals")
        .map((e) => e.registroId)
        .filter((id): id is string => id !== null),
    ),
  ];
  const slugDe = new Map(
    idsDeDeals.length === 0
      ? []
      : (
          await db
            .select({ id: deals.id, slug: programs.slug })
            .from(deals)
            .innerJoin(programs, eq(programs.id, deals.programId))
            .where(and(inArray(deals.id, idsDeDeals), incluyendoAnulados(deals)))
        ).map((d) => [d.id, d.slug]),
  );

  const total = (totalCambios?.n ?? 0) + (totalMovimientos?.n ?? 0);
  return {
    entradas: mezcladas.map((e) => ({ ...e, programaSlug: e.registroId ? (slugDe.get(e.registroId) ?? null) : null })),
    total,
    pagina: filtro.pagina,
    paginas: Math.max(1, Math.ceil(total / POR_PAGINA)),
  };
}

/** Lo que ofrecen los selectores: las tablas que tienen rastro y quienes han escrito. */
export async function opcionesDeBitacora(db: Db = dbDeLaApp) {
  const [tablas, autores] = await Promise.all([
    db.selectDistinct({ tabla: changeLog.tabla }).from(changeLog).orderBy(changeLog.tabla),
    db.select({ id: users.id, email: users.email }).from(users).orderBy(users.email),
  ]);
  return { tablas: tablas.map((t) => t.tabla), usuarios: autores };
}
