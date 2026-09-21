import "./load-env";
import { and, eq, lt } from "drizzle-orm";
import { db } from "../lib/db";
import { changeLog, leads, programs, sources } from "../lib/db/schema";
import { leerPestana } from "../lib/sheets/leer";
import {
  MAPEO_FORMULARIO,
  OBLIGATORIOS_FORMULARIO,
  resolverColumnas,
  type MapeoColumnas,
} from "../lib/sheets/mapeo";
import { deduplicarPorCorreo, filasDesdeMatriz } from "../lib/sheets/dedup";

/**
 * Repara las fechas de aplicacion que entraron como el CENTINELA del ano 1.
 *
 * ⚠️ HERRAMIENTA DE UNA SOLA VEZ, YA EJECUTADA. Se deja por si vuelve a aparecer un
 * centinela, pero **el camino normal ya no es este**: desde el 18-sep las fechas de
 * aplicacion SI estan en `CAMPOS_COMPARABLES` (`lib/sheets/plan-sync.ts`), asi que un
 * centinela reparado por `parsearFecha` produce un diff y el propio sync lo corrige
 * solo en la siguiente corrida, con su fila de bitacora.
 *
 * Por que hizo falta cuando se escribio: el sync solo actualiza a quien tenga algun
 * diff, y las fechas no se comparaban, asi que una persona cuyo unico campo malo era
 * la fecha nunca entraba a `aActualizar` y el dano se quedaba escrito para siempre.
 *
 * Por que no se puede reparar desde `leads.raw`: `raw` guarda UNA fila de la hoja,
 * no todas las del correo. Para una persona con varias aplicaciones, la primera
 * fecha real solo se sabe releyendo la hoja completa y volviendo a deduplicar, que
 * es exactamente lo que hace este script: los mismos pasos 1 y 2 del sync, con el
 * `parsearFecha` ya arreglado.
 *
 * Es IDEMPOTENTE: solo toca filas cuya fecha guardada esta por debajo del piso, y
 * cada correccion deja su fila en `change_log` con `origen = "sync"`. Correrlo dos
 * veces no hace nada la segunda.
 *
 *   npm run backfill-fechas             muestra lo que haria, sin escribir
 *   npm run backfill-fechas -- --escribir   escribe
 */

/** Mismo piso que `parsearFecha`: por debajo de esto no hay fechas, hay centinelas. */
const PISO = new Date("2000-01-01T00:00:00Z");

const escribir = process.argv.includes("--escribir");

async function main() {
  const programas = await db.select().from(programs);
  let totalAfectadas = 0;
  let totalReparadas = 0;
  let totalSinFecha = 0;

  for (const programa of programas) {
    // Solo las personas ya guardadas con fecha por debajo del piso. Si no hay
    // ninguna, ni se lee la hoja.
    const danadas = await db
      .select()
      .from(leads)
      .where(and(eq(leads.programId, programa.id), lt(leads.fechaPrimeraAplicacion, PISO)));

    if (danadas.length === 0) {
      console.log(`\n  ${programa.slug}: sin filas afectadas.`);
      continue;
    }
    totalAfectadas += danadas.length;
    console.log(`\n  ${programa.slug}: ${danadas.length} personas con fecha centinela.`);

    // Pasos 1 y 2 del sync: leer TODAS las fuentes activas del programa y deduplicar.
    const fuentes = await db
      .select()
      .from(sources)
      .where(and(eq(sources.programId, programa.id), eq(sources.activo, true)));

    const todas: ReturnType<typeof filasDesdeMatriz> = [];
    for (const f of [...fuentes].sort((a, b) => a.orden - b.orden)) {
      if (!f.sheetId || !f.tab) continue;
      const matriz = await leerPestana(f.sheetId, f.tab, f.rango);
      if (matriz.length === 0) continue;
      const encabezados = matriz[0].map((h) => String(h ?? "").trim());
      const mapeo = Object.keys(f.mapeoColumnas ?? {}).length
        ? (f.mapeoColumnas as MapeoColumnas)
        : MAPEO_FORMULARIO;
      const indices = resolverColumnas(encabezados, mapeo, OBLIGATORIOS_FORMULARIO);
      todas.push(...filasDesdeMatriz(matriz.slice(1), indices));
    }

    const { personas } = deduplicarPorCorreo(todas);
    const porCorreo = new Map(personas.map((p) => [p.emailNormalizado, p]));

    for (const guardada of danadas) {
      const recalculada = porCorreo.get(guardada.emailNormalizado);
      if (!recalculada) {
        console.log(`    ! ${guardada.id}: ya no esta en la hoja, se deja como esta.`);
        continue;
      }

      const primera = recalculada.fechaPrimeraAplicacion;
      const ultima = recalculada.fechaUltimaAplicacion;
      if (primera === null) totalSinFecha += 1;
      else totalReparadas += 1;

      if (!escribir) continue;

      await db
        .update(leads)
        .set({ fechaPrimeraAplicacion: primera, fechaUltimaAplicacion: ultima, updatedAt: new Date() })
        .where(eq(leads.id, guardada.id));

      // Una fila por campo, igual que el sync. El valor anterior se escribe como el
      // centinela que era, para que la bitacora explique por si sola que paso.
      await db.insert(changeLog).values([
        {
          tabla: "leads",
          registroId: guardada.id,
          etiqueta: guardada.nombre ?? guardada.emailNormalizado,
          campo: "fechaPrimeraAplicacion",
          valorAnterior: guardada.fechaPrimeraAplicacion?.toISOString() ?? null,
          valorNuevo: primera?.toISOString() ?? null,
          origen: "sync" as const,
        },
        {
          tabla: "leads",
          registroId: guardada.id,
          etiqueta: guardada.nombre ?? guardada.emailNormalizado,
          campo: "fechaUltimaAplicacion",
          valorAnterior: guardada.fechaUltimaAplicacion?.toISOString() ?? null,
          valorNuevo: ultima?.toISOString() ?? null,
          origen: "sync" as const,
        },
      ]);
    }
  }

  console.log(`\n  ${totalAfectadas} afectadas · ${totalReparadas} con fecha real recuperada · ${totalSinFecha} quedan en null (todas sus filas traian centinela).`);
  console.log(escribir ? "  ESCRITO.\n" : "  Simulacion: no se escribio nada. Agrega --escribir para aplicar.\n");
}

main().catch((e) => {
  console.error("\n  Fallo:", e instanceof Error ? e.message : e, "\n");
  process.exit(1);
});
