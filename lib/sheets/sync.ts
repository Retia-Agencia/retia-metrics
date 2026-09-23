import { and, eq, inArray, lt } from "drizzle-orm";
import { db as dbDeLaApp } from "@/lib/db";
import type { Db } from "@/lib/db/tipos";
import { leads, sources, syncRuns, changeLog, programs } from "@/lib/db/schema";
import { ErrorDeApp } from "@/lib/errors";
import { esViolacionUnica } from "@/lib/db/errores";
import { ejecutarJuntas } from "@/lib/db/ejecutar-juntas";
import { leerPestana } from "./leer";
import {
  resolverColumnas,
  OBLIGATORIOS_FORMULARIO,
  validarZona,
  ZONA_BOGOTA,
  type MapeoColumnas,
} from "./mapeo";
import { combinarMapeo } from "./plantilla-lead";
import { deduplicarPorCorreo, filasDesdeMatriz } from "./dedup";
import { planificarSync } from "./plan-sync";

/**
 * Motor de sincronizacion.
 *
 * Decision de diseno importante: **las personas se sincronizan por PROGRAMA, no por
 * fuente.** Un programa tiene dos formularios (`New form` y `Forms viejo`) y 58 de
 * las 65 personas del viejo no estan en el nuevo. Si cada fuente se sincronizara por
 * separado, `numAplicaciones` dependeria del orden de ejecucion y no habria forma de
 * que correr el sync dos veces diera el mismo resultado. Leyendo todas las fuentes de
 * personas juntas y recalculando desde cero, el resultado es el mismo siempre.
 *
 * La corrida se guarda colgada del PROGRAMA (`syncRuns.programId`), no de una fuente
 * elegida a dedo. Antes se guardaba `sources[0].id`, y en un programa con dos
 * formularios activos eso atribuia cada corrida a UNO de ellos (el viejo, de 65
 * personas) habiendo leido los dos (F-07). Ahora la corrida lista TODAS las fuentes
 * que leyo en `fuentesLeidas`.
 */

/** Una fuente leida por una corrida, con cuantas filas trajo. Lo guarda `syncRuns.fuentesLeidas`. */
export type FuenteLeida = {
  nombre: string;
  tab: string;
  filas: number;
};

/**
 * Una corrida abandonada mas vieja que esto (en minutos) la marca el reaper como
 * `error` antes de arrancar la siguiente. El 10 no es arbitrario: las dos rutas de
 * sync declaran `maxDuration = 300`, o sea 5 minutos, asi que una corrida que lleva
 * mas de eso en Vercel esta muerta con certeza (la funcion ya se cayo). 10 es 2x ese
 * techo, margen de sobra. (`npm run sync` desde la terminal no tiene ese limite, pero
 * el sync completo tarda ~4 segundos, asi que tampoco se acerca.)
 */
const MINUTOS_ANTES_DE_DAR_POR_MUERTA = 10;

/**
 * Cuantas filas van en cada viaje a la base. El numero salio de la carga inicial:
 * insertando de a una tardaba ~161 segundos, por encima del techo de 300s de una
 * funcion de Vercel; por lotes de 200 tarda 4,0 segundos para 1.253 personas.
 * Lo usan las tres escrituras masivas del sync, que responden la misma pregunta.
 */
const TAMANO_DE_LOTE = 200;

/**
 * Ya hay una sincronizacion corriendo para este programa. La lanza el INSERT de la
 * corrida cuando choca con el indice unico parcial `sync_runs_una_corriendo_por_programa_idx`
 * (F-03). La exclusion mutua vive en la base (ADR 0005), no en un lock de sesion: nacio
 * asi porque `neon-http` no tenia sesion, y se conserva con Supabase (ADR 0047) porque
 * un indice no hay que acordarse de soltarlo si la funcion muere a la mitad. Es un
 * 409 porque no es un fallo del servidor: el candado esta funcionando. Vive aca, igual
 * que `MapeoInvalidoError` vive en `lib/sheets/mapeo.ts`.
 */
export class SyncEnCursoError extends ErrorDeApp {
  constructor() {
    super(
      "Ya hay una sincronizacion corriendo para este programa. Espera a que termine " +
        "o revisa si quedo colgada.",
      409,
    );
  }
}

export type ResultadoSync = {
  programa: string;
  fuentesLeidas: FuenteLeida[];
  filasLeidas: number;
  sinCorreo: number;
  personasEnHoja: number;
  nuevas: number;
  actualizadas: number;
  cambiosRegistrados: number;
  errores: string[];
};

export async function sincronizarPersonas(
  programId: string,
  db: Db = dbDeLaApp,
): Promise<ResultadoSync> {
  const [programa] = await db.select().from(programs).where(eq(programs.id, programId)).limit(1);
  if (!programa) throw new Error(`No existe el programa ${programId}`);

  // Toda fuente activa es un intake de leads desde el ADR 0039, asi que ya no hay
  // que filtrar por destino: la columna desaparecio con las 7 filas que la usaban.
  // Y el indice `sources_una_activa_por_programa_idx` garantiza que sea UNA sola,
  // de modo que `fuentes` tiene como mucho un elemento en el caso normal.
  const fuentes = await db
    .select()
    .from(sources)
    .where(and(eq(sources.programId, programId), eq(sources.activo, true)));

  if (fuentes.length === 0) {
    throw new Error(`El programa ${programa.slug} no tiene una fuente de leads activa.`);
  }

  // Reaper: antes de tomar el candado, libera las corridas de ESTE programa que se
  // quedaron `corriendo` mas de MINUTOS_ANTES_DE_DAR_POR_MUERTA (una funcion de Vercel
  // que se cayo sin cerrar su corrida). Va FUERA del try grande y ANTES del insert: si
  // no, la corrida viva de otro proceso bloquea el candado para siempre. Marcarlas como
  // `error` con su motivo las saca de en medio y libera el indice unico parcial.
  const limite = new Date(Date.now() - MINUTOS_ANTES_DE_DAR_POR_MUERTA * 60_000);
  await db
    .update(syncRuns)
    .set({
      estado: "error",
      terminado: new Date(),
      errores: [
        `Corrida abandonada: supero los ${MINUTOS_ANTES_DE_DAR_POR_MUERTA} minutos sin terminar; ` +
          "lo normal es que la funcion se haya caido.",
      ],
    })
    .where(
      and(
        eq(syncRuns.programId, programId),
        eq(syncRuns.estado, "corriendo"),
        lt(syncRuns.iniciado, limite),
      ),
    );

  // El INSERT es el candado (F-03). Si otra corrida del mismo programa sigue viva, el
  // indice unico parcial `sync_runs_una_corriendo_por_programa_idx` lo rechaza con 23505,
  // que traducimos al 409 de `SyncEnCursoError`. Va FUERA del try grande a proposito: ese
  // try termina marcando `corrida.id` como `error`, y si el 409 se lanzara desde adentro
  // marcaria como error la corrida VIVA de otro proceso, que es lo contrario de lo que el
  // candado existe para hacer. Aqui `corrida` todavia no existe, asi que no hay nada que
  // marcar.
  let corrida: typeof syncRuns.$inferSelect;
  try {
    [corrida] = await db
      .insert(syncRuns)
      .values({ programId, estado: "corriendo" })
      .returning();
  } catch (e: unknown) {
    if (esViolacionUnica(e)) throw new SyncEnCursoError();
    throw e;
  }

  const errores: string[] = [];
  const fuentesLeidas: FuenteLeida[] = [];
  const resultado: ResultadoSync = {
    programa: programa.slug,
    fuentesLeidas,
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
    // La zona en que escribe cada fuente (ticket 053), para fechar cada fila con la suya.
    const zonaDeFila = new WeakMap<object, string>();

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

      // Una zona que no existe detiene el sync antes de escribir nada, igual que un mapeo roto.
      validarZona(f.tzFechas);

      const encabezados = matriz[0].map((h) => String(h ?? "").trim());
      // Mapeo efectivo campo por campo (ADR 0019): la fuente gana sobre la plantilla
      // del programa, y la plantilla sobre el defecto del codigo. Antes era un
      // ternario de todo-o-nada; ver `lib/sheets/plantilla-lead.ts`.
      const { mapeo } = combinarMapeo(
        f.mapeoColumnas as MapeoColumnas | null,
        programa.plantillaLead as MapeoColumnas | null,
      );

      // Si el mapeo no cuadra, esto lanza y detiene el sync. No se adivina.
      const indices = resolverColumnas(encabezados, mapeo, OBLIGATORIOS_FORMULARIO);

      const filas = filasDesdeMatriz(matriz.slice(1), indices);
      for (const fila of filas) zonaDeFila.set(fila, f.tzFechas);
      todas.push(...filas);
      // El resultado guarda datos, no formato: el `nombre (filas)` lo arma quien
      // presenta (la consola de scripts, la pantalla de /nerd-stats), nunca aca.
      fuentesLeidas.push({ nombre: f.nombre, tab: f.tab, filas: filas.length });
      resultado.filasLeidas += filas.length;

      await db.update(sources).set({ ultimaSync: new Date() }).where(eq(sources.id, f.id));
    }

    // 2. Dedup sobre el conjunto completo
    const { personas, sinCorreo } = deduplicarPorCorreo(
      todas,
      (fila) => zonaDeFila.get(fila) ?? ZONA_BOGOTA,
    );
    resultado.sinCorreo = sinCorreo;
    resultado.personasEnHoja = personas.length;

    // 3. Traer lo que ya existe, en lotes para no reventar el limite de parametros
    const correos = personas.map((p) => p.emailNormalizado);
    const existentes = new Map<string, typeof leads.$inferSelect>();
    for (let i = 0; i < correos.length; i += 500) {
      const lote = correos.slice(i, i + 500);
      const filas = await db
        .select()
        .from(leads)
        .where(and(eq(leads.programId, programId), inArray(leads.emailNormalizado, lote)));
      for (const f of filas) existentes.set(f.emailNormalizado, f);
    }

    // 4. Decidir (plan-sync.ts, probado sin base) y luego escribir, dejando bitacora
    const { aInsertar, aActualizar, cambios } = planificarSync(personas, existentes, {
      programId,
      syncRunId: corrida.id,
    });
    resultado.nuevas = aInsertar.length;
    resultado.actualizadas = aActualizar.length;

    // Por lotes, no fila por fila (F-04). Un UPDATE por persona es un viaje a la base
    // por persona: hoy no se nota —una corrida
    // normal actualiza ~6 filas— pero el dia que un ajuste de mapeo toque a las 4.700
    // son 4.700 viajes, y ahi se roza el techo de 300s y la corrida muere a la mitad.
    // No era un bug activo: era una bomba de tiempo, y la misma que ya se desactivo
    // del lado de los inserts.
    //
    // `ejecutarJuntas` corre el lote en UNA transaccion (ADR 0047), asi que no hace falta una plantilla `sql` con un UPDATE ... FROM (VALUES ...) —
    // que ademas caeria justo en el footgun de las columnas sin calificar. Cada lote
    // es atomico, que es mejor que antes: ya no puede quedar media actualizacion.
    // `ahora` se calcula UNA vez por lote a proposito: las filas de un mismo lote se
    // escriben juntas, asi que comparten `updated_at`.
    for (let i = 0; i < aActualizar.length; i += TAMANO_DE_LOTE) {
      const lote = aActualizar.slice(i, i + TAMANO_DE_LOTE);
      const ahora = new Date();
      await ejecutarJuntas(db, (tx) =>
        lote.map(({ id, valores }) =>
          tx.update(leads).set({ ...valores, updatedAt: ahora }).where(eq(leads.id, id)),
        ),
      );
    }

    for (let i = 0; i < aInsertar.length; i += TAMANO_DE_LOTE) {
      await db.insert(leads).values(aInsertar.slice(i, i + TAMANO_DE_LOTE));
    }

    for (let i = 0; i < cambios.length; i += TAMANO_DE_LOTE) {
      await db.insert(changeLog).values(cambios.slice(i, i + TAMANO_DE_LOTE));
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
        fuentesLeidas,
        errores: errores.length ? errores : null,
      })
      .where(eq(syncRuns.id, corrida.id));

    return resultado;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    await db
      .update(syncRuns)
      .set({ terminado: new Date(), estado: "error", fuentesLeidas, errores: [msg] })
      .where(eq(syncRuns.id, corrida.id));
    throw e;
  }
}
