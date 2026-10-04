import { and, desc, eq, sql } from "drizzle-orm";
import { db as dbDeLaApp } from "@/lib/db";
import { abonos, calls, changeLog, deals, leads, programs, sources, submissions, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { num } from "@/lib/format";
import type { FuenteLeida } from "./fuentes";
import { posiblesDuplicadosDelPrograma } from "./leads";
import { saludDeFuentes, type EstadoDeFuente } from "./salud-fuentes";
import { vigente } from "./vigente";

/**
 * Lecturas de `/nerd-stats` (ticket 025, reescrito sobre el modelo nuevo en el 068): la
 * salud de la herramienta, no del negocio. Solo SELECT y solo CONTEOS.
 *
 * Los leads entran por webhook desde el 28-sep (ticket 108): no hay sync ni cron. Lo que el
 * modelo nuevo hace visible y se mira aca: los envios por programa, las fuentes marcadas
 * (`saludDeFuentes`, ticket 107, que reemplazo al 055) y los leads "unidos por telefono" sin
 * resolver (ticket 050). Las dos ultimas preguntas ya tienen su modulo y se importan, no se
 * reescriben (ADR 0024).
 *
 * Las corridas de sync NO se leen aca: viven en `lib/queries/fuentes.ts`, porque
 * la tab Programa hace exactamente la misma pregunta (ADR 0024). Desde el 108 son
 * historial de solo lectura.
 *
 * **Ningun dato personal sale de aca, y no es por cuidado al escribir sino por
 * construccion.** La bitacora de cambios devuelve `tabla`, `campo`, quien y cuando,
 * y deliberadamente NO devuelve `etiqueta` ni los valores: `lib/mutations/personas.ts`
 * escribe filas de `change_log` con el nombre o el correo de un lead en `etiqueta` y
 * con sus datos en `valorNuevo`. Proyectar esas dos columnas habria filtrado leads a
 * una pantalla cuyo criterio de aceptacion dice justo lo contrario, y ningun filtro
 * por tabla lo evitaria de forma duradera: una tabla operativa nueva se colaria sola.
 * No pedirlas nunca falla abierto. El ticket pide "quien y cuando", que es lo que hay.
 */

/** Cuantas personas, llamadas, ventas y abonos hay por programa. */
export async function conteosPorPrograma(db: Db = dbDeLaApp) {
  // Cinco consultas agrupadas y una union en memoria, en vez de joins o subconsultas
  // correlacionadas. Las dos razones:
  //
  // 1. Cuatro `left join` sobre el mismo programa multiplican las filas entre si y
  //    los `count` salen inflados (llamadas x ventas x abonos).
  // 2. Una subconsulta correlacionada escrita con la plantilla `sql` de drizzle NO
  //    califica las columnas: `${programs.id}` sale como `"id"` a secas, que dentro
  //    del subselect resuelve a la columna `id` de la tabla interna. Compara una
  //    fila consigo misma, devuelve 0 y NO lanza ningun error. Un conteo mudo en
  //    cero es peor que uno que revienta.
  //
  // A esta escala (dos programas, ~3.000 filas por hoja — AGENTS.md) cinco consultas
  // por indice son gratis, y el resultado es obviamente correcto al leerlo.
  const porPrograma = (
    columna:
      | typeof leads.programId
      | typeof calls.programId
      | typeof deals.programId
      | typeof abonos.programId,
    tabla: typeof leads | typeof calls | typeof deals | typeof abonos,
  ) =>
    db
      .select({ programId: columna, total: sql<number>`count(*)::int` })
      .from(tabla)
      // `vigente` acepta tambien las tablas que no se anulan (`leads`), donde no
      // filtra nada. Por eso el helper generico puede aplicarlo sin preguntar cual
      // de las cuatro tablas le toco: si es anulable, excluye; si no, todas cuentan.
      .where(vigente(tabla))
      .groupBy(columna);

  // Los envios son del programa de su FUENTE (el envio no lleva `program_id`): uno por
  // `(fuente, token, es_parcial)`, asi que un parcial y su completo son dos filas y se
  // cuentan aparte.
  const enviosPorPrograma = db
    .select({ programId: sources.programId, esParcial: submissions.esParcial, total: sql<number>`count(*)::int` })
    .from(submissions)
    .innerJoin(sources, eq(sources.id, submissions.sourceId))
    .groupBy(sources.programId, submissions.esParcial);

  const [lista, personas, llamadas, dealsPorPrograma, pagos, envios] = await Promise.all([
    db
      .select({ id: programs.id, slug: programs.slug, nombre: programs.nombre, activo: programs.activo })
      .from(programs)
      .orderBy(programs.nombre),
    porPrograma(leads.programId, leads),
    porPrograma(calls.programId, calls),
    porPrograma(deals.programId, deals),
    porPrograma(abonos.programId, abonos),
    enviosPorPrograma,
  ]);
  // "Unido por telefono sin resolver" lo define la lista de posibles duplicados de Leads
  // (ticket 072): se cuenta sobre ESA respuesta, por programa, y no se reescribe el predicado.
  const unidos = new Map(
    await Promise.all(
      lista.map(async (p) => {
        const { filas } = await posiblesDuplicadosDelPrograma(db, p.id, { porPagina: Number.MAX_SAFE_INTEGER });
        return [p.id, new Set(filas.map((f) => f.leadId)).size] as const;
      }),
    ),
  );

  const mapa = (filas: readonly { programId: string; total: number }[]) =>
    new Map(filas.map((f) => [f.programId, f.total]));
  const dePersonas = mapa(personas);
  const deLlamadas = mapa(llamadas);
  const deDeals = mapa(dealsPorPrograma);
  const deAbonos = mapa(pagos);
  const deEnvios = (parcial: boolean) =>
    mapa(envios.filter((e) => e.esParcial === parcial).map((e) => ({ programId: e.programId, total: e.total })));
  const completos = deEnvios(false);
  const parciales = deEnvios(true);

  // Un programa sin movimiento sale en cero, no se omite: un programa que desaparece
  // de la tabla se lee como "no existe", que es otra cosa.
  return lista.map((p) => ({
    slug: p.slug,
    nombre: p.nombre,
    activo: p.activo,
    personas: dePersonas.get(p.id) ?? 0,
    llamadas: deLlamadas.get(p.id) ?? 0,
    // Son DEALS, no ventas: una venta es un deal en Ganado Pago Parcial o Ganado Pagado Completo (ADR 0037) y
    // llamar "ventas" a todos los deals inflaria la cifra sin lanzar un error. El
    // desglose por etapa es de E5-2; aqui el conteo dice lo que cuenta.
    deals: deDeals.get(p.id) ?? 0,
    abonos: deAbonos.get(p.id) ?? 0,
    envios: completos.get(p.id) ?? 0,
    parciales: parciales.get(p.id) ?? 0,
    unidosPorTelefono: unidos.get(p.id) ?? 0,
  }));
}

/**
 * Cuantas llamadas entraron por la hoja y cuantas se registraron en la app
 * (ADR 0010: los registros nativos reusan las mismas tablas con `origen = "app"`).
 * Es el canario de si el equipo esta usando el CRM o sigue viviendo en la hoja.
 *
 * ⚠️ El desglose de las VENTAS se fue con `sales` (ticket 038) y no se reemplaza
 * por uno sobre deals: `sales` delataba su origen por `huellaFila` (nula = la
 * escribio la app), y un deal no nace de una fila de hoja, asi que no hay nada
 * equivalente que leer. Inventarlo seria afirmar un origen que la base no sabe.
 */
export async function conteosPorOrigen(db: Db = dbDeLaApp) {
  const [llamadas] = await Promise.all([
    db
      .select({ origen: calls.origen, total: sql<number>`count(*)::int` })
      .from(calls)
      .where(vigente(calls))
      .groupBy(calls.origen),
  ]);
  return { llamadas };
}

/**
 * Los ultimos cambios hechos DESDE LA APP (`origen = "app"`), como metadatos.
 * Ver la nota de arriba sobre por que no salen ni la etiqueta ni los valores.
 */
export async function ultimosCambiosDesdeLaApp(limite = 15, db: Db = dbDeLaApp) {
  return db
    .select({
      id: changeLog.id,
      tabla: changeLog.tabla,
      campo: changeLog.campo,
      detectadoEn: changeLog.detectadoEn,
      // El correo de quien administra, no de un lead. Null en un cambio sin usuario.
      quien: users.email,
    })
    .from(changeLog)
    .leftJoin(users, eq(users.id, changeLog.userId))
    .where(eq(changeLog.origen, "app"))
    .orderBy(desc(changeLog.detectadoEn))
    .limit(limite);
}

/** Cuantos usuarios ACTIVOS hay de cada rol. Un rol sin usuarios no aparece. */
export async function usuariosActivosPorRol(db: Db = dbDeLaApp) {
  return db
    .select({ rol: users.rol, total: sql<number>`count(*)::int` })
    .from(users)
    .where(eq(users.activo, true))
    .groupBy(users.rol)
    .orderBy(users.rol);
}

export interface FuenteEnNerdStats {
  sourceId: string;
  nombre: string;
  programaNombre: string;
  estado: EstadoDeFuente;
  /** Si la app la marca: silenciosa, con sobres sin procesar o con completos sin calidad (107, ADR 0069). */
  marcada: boolean;
  /** `sources.estado = 'rota'` (039/055). Nadie la escribe desde que el sync se retiro; se muestra si aparece. */
  rota: boolean;
  ultimo: Date | null;
  sobresPendientes: number;
  sinCalidad: number;
}

/**
 * Las fuentes ACTIVAS con su salud (ticket 107) y la marca `rota` de la columna. La salud no
 * se recalcula aca: es la misma respuesta que da la tab Programa.
 */
export async function fuentesConSalud(db: Db = dbDeLaApp, ahora: Date = new Date()): Promise<FuenteEnNerdStats[]> {
  const [salud, rotas] = await Promise.all([
    saludDeFuentes(db, ahora),
    db
      .select({ id: sources.id })
      .from(sources)
      .where(and(eq(sources.activo, true), eq(sources.estado, "rota"))),
  ]);
  const esRota = new Set(rotas.map((r) => r.id));
  return salud.map((f) => ({
    sourceId: f.sourceId,
    nombre: f.nombre,
    programaNombre: f.programaNombre,
    estado: f.estado,
    marcada: f.marcada || esRota.has(f.sourceId),
    rota: esRota.has(f.sourceId),
    ultimo: f.ultimo,
    sobresPendientes: f.sobresPendientes,
    sinCalidad: f.sinCalidad,
  }));
}

/**
 * Las fuentes que leyo una corrida del sync, escritas para leer: "Hoja (1.234) + Forms (55)".
 * `null` es una corrida anterior a la migracion que no guardo el dato (ADR 0031, F-07): sale
 * "—", nunca un nombre inventado.
 */
export function textoDeFuentesLeidas(fuentes: readonly FuenteLeida[] | null): string {
  if (fuentes === null) return "—";
  return fuentes.map((f) => `${f.nombre} (${num(f.filas)})`).join(" + ");
}
