import { desc, eq, sql } from "drizzle-orm";
import { db as dbDeLaApp } from "@/lib/db";
import { abonos, calls, changeLog, deals, leads, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { vigente } from "./vigente";

/**
 * Lecturas de `/nerd-stats` (ticket 025): la salud de la herramienta, no del negocio.
 * Solo SELECT y solo CONTEOS.
 *
 * Las corridas de sync NO se leen aca: viven en `lib/queries/fuentes.ts`, porque
 * `/ajustes/fuentes` hace exactamente la misma pregunta (ADR 0024). La pantalla
 * importa de los dos modulos.
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

  const [lista, personas, llamadas, dealsPorPrograma, pagos] = await Promise.all([
    db
      .select({ id: programs.id, slug: programs.slug, nombre: programs.nombre, activo: programs.activo })
      .from(programs)
      .orderBy(programs.nombre),
    porPrograma(leads.programId, leads),
    porPrograma(calls.programId, calls),
    porPrograma(deals.programId, deals),
    porPrograma(abonos.programId, abonos),
  ]);

  const mapa = (filas: readonly { programId: string; total: number }[]) =>
    new Map(filas.map((f) => [f.programId, f.total]));
  const dePersonas = mapa(personas);
  const deLlamadas = mapa(llamadas);
  const deDeals = mapa(dealsPorPrograma);
  const deAbonos = mapa(pagos);

  // Un programa sin movimiento sale en cero, no se omite: un programa que desaparece
  // de la tabla se lee como "no existe", que es otra cosa.
  return lista.map((p) => ({
    slug: p.slug,
    nombre: p.nombre,
    activo: p.activo,
    personas: dePersonas.get(p.id) ?? 0,
    llamadas: deLlamadas.get(p.id) ?? 0,
    // Son DEALS, no ventas: una venta es un deal en Abonado o Completo (ADR 0037) y
    // llamar "ventas" a todos los deals inflaria la cifra sin lanzar un error. El
    // desglose por etapa es de E5-2; aqui el conteo dice lo que cuenta.
    deals: deDeals.get(p.id) ?? 0,
    abonos: deAbonos.get(p.id) ?? 0,
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
