import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { people, sources, syncRuns, changeLog, programs } from "@/lib/db/schema";
import { leerPestana } from "./leer";
import { resolverColumnas, MAPEO_FORMULARIO, OBLIGATORIOS_FORMULARIO, type MapeoColumnas } from "./mapeo";
import { deduplicarPorCorreo, filasDesdeMatriz } from "./dedup";
import { planificarSync } from "./plan-sync";

/**
 * Motor de sincronizacion.
 *
 * Decision de diseno importante: **las personas se sincronizan por PROGRAMA, no por
 * fuente.** Comunicarte tiene dos formularios (`New form` y `Forms viejo`) y 58 de las
 * 65 personas del viejo no estan en el nuevo. Si cada fuente se sincronizara por
 * separado, `numAplicaciones` dependeria del orden de ejecucion y no habria forma de
 * que correr el sync dos veces diera el mismo resultado. Leyendo todas las fuentes de
 * personas juntas y recalculando desde cero, el resultado es el mismo siempre.
 */

export type ResultadoSync = {
  programa: string;
  fuentesLeidas: string[];
  filasLeidas: number;
  sinCorreo: number;
  personasEnHoja: number;
  nuevas: number;
  actualizadas: number;
  cambiosRegistrados: number;
  errores: string[];
};

export async function sincronizarPersonas(programId: string): Promise<ResultadoSync> {
  const [programa] = await db.select().from(programs).where(eq(programs.id, programId)).limit(1);
  if (!programa) throw new Error(`No existe el programa ${programId}`);

  const fuentes = await db
    .select()
    .from(sources)
    .where(and(eq(sources.programId, programId), eq(sources.activo, true), eq(sources.destino, "people")));

  if (fuentes.length === 0) {
    throw new Error(`El programa ${programa.slug} no tiene fuentes de personas activas.`);
  }

  const [corrida] = await db
    .insert(syncRuns)
    .values({ sourceId: fuentes[0].id, estado: "corriendo" })
    .returning();

  const errores: string[] = [];
  const resultado: ResultadoSync = {
    programa: programa.slug,
    fuentesLeidas: [],
    filasLeidas: 0,
    sinCorreo: 0,
    personasEnHoja: 0,
    nuevas: 0,
    actualizadas: 0,
    cambiosRegistrados: 0,
    errores,
  };

  try {
    // 1. Leer TODAS las fuentes de personas del programa y juntar sus filas
    const todas: ReturnType<typeof filasDesdeMatriz> = [];

    for (const f of [...fuentes].sort((a, b) => a.orden - b.orden)) {
      if (!f.sheetId || !f.tab) {
        errores.push(`La fuente "${f.nombre}" no tiene sheetId o tab.`);
        continue;
      }
      const matriz = await leerPestana(f.sheetId, f.tab, f.rango);
      if (matriz.length === 0) {
        errores.push(`La pestana "${f.tab}" vino vacia.`);
        continue;
      }

      const encabezados = matriz[0].map((h) => String(h ?? "").trim());
      const mapeo = (Object.keys(f.mapeoColumnas ?? {}).length
        ? (f.mapeoColumnas as MapeoColumnas)
        : MAPEO_FORMULARIO);

      // Si el mapeo no cuadra, esto lanza y detiene el sync. No se adivina.
      const indices = resolverColumnas(encabezados, mapeo, OBLIGATORIOS_FORMULARIO);

      const filas = filasDesdeMatriz(matriz.slice(1), indices);
      todas.push(...filas);
      resultado.fuentesLeidas.push(`${f.tab} (${filas.length})`);
      resultado.filasLeidas += filas.length;

      await db.update(sources).set({ ultimaSync: new Date() }).where(eq(sources.id, f.id));
    }

    // 2. Dedup sobre el conjunto completo
    const { personas, sinCorreo } = deduplicarPorCorreo(todas);
    resultado.sinCorreo = sinCorreo;
    resultado.personasEnHoja = personas.length;

    // 3. Traer lo que ya existe, en lotes para no reventar el limite de parametros
    const correos = personas.map((p) => p.emailNormalizado);
    const existentes = new Map<string, typeof people.$inferSelect>();
    for (let i = 0; i < correos.length; i += 500) {
      const lote = correos.slice(i, i + 500);
      const filas = await db
        .select()
        .from(people)
        .where(and(eq(people.programId, programId), inArray(people.emailNormalizado, lote)));
      for (const f of filas) existentes.set(f.emailNormalizado, f);
    }

    // 4. Decidir (plan-sync.ts, probado sin base) y luego escribir, dejando bitacora
    const { aInsertar, aActualizar, cambios } = planificarSync(personas, existentes, {
      programId,
      syncRunId: corrida.id,
    });
    resultado.nuevas = aInsertar.length;
    resultado.actualizadas = aActualizar.length;

    for (const { id, valores } of aActualizar) {
      await db.update(people).set({ ...valores, updatedAt: new Date() }).where(eq(people.id, id));
    }

    // En lote: una insercion por persona tardaba ~160s en la carga inicial,
    // por encima del limite de una funcion de Vercel.
    for (let i = 0; i < aInsertar.length; i += 200) {
      await db.insert(people).values(aInsertar.slice(i, i + 200));
    }

    for (let i = 0; i < cambios.length; i += 200) {
      await db.insert(changeLog).values(cambios.slice(i, i + 200));
    }
    resultado.cambiosRegistrados = cambios.length;

    await db
      .update(syncRuns)
      .set({
        terminado: new Date(),
        estado: errores.length ? "error" : "ok",
        filasLeidas: resultado.filasLeidas,
        personasNuevas: resultado.nuevas,
        personasActualizadas: resultado.actualizadas,
        errores: errores.length ? errores : null,
      })
      .where(eq(syncRuns.id, corrida.id));

    return resultado;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    await db
      .update(syncRuns)
      .set({ terminado: new Date(), estado: "error", errores: [msg] })
      .where(eq(syncRuns.id, corrida.id));
    throw e;
  }
}
