import "./load-env";
import { eq } from "drizzle-orm";
import { db } from "../lib/db";
import { programs, sources, submissions } from "../lib/db/schema";
import type { Db } from "../lib/db/tipos";
import { leerPestana } from "../lib/sheets/leer";
import { entradasDesdeMatriz } from "../lib/ingesta/adaptador-sheets";
import { ingerirEntradas, type ResultadoIngesta } from "../lib/ingesta/ingerir";
import type { EntradaEnvio } from "../lib/ingesta/envio";
import {
  apartarLasQueYaEntraron,
  fuentesATrasladar,
  resumirEntradas,
  type FuenteDeHoja,
  type FuenteListaParaLeer,
} from "../lib/sheets/traslado";
import { actorDelScript } from "./actor";

/**
 * El TRASLADO unico de leads y envios desde Google Sheets (ticket 111), por la MISMA
 * puerta que el webhook (`ingerirEntradas`). Producción solo tiene lo que entró por el
 * webhook desde el 28-sep; esto trae la historia de las hojas SIN inventar nada.
 *
 * Cierra los tickets 048, 049 (el sync se retiró, 108: el traslado es quien llama a la
 * ingesta) y la parte de datos del 079: las 55 personas exclusivas de `Forms viejo` entran
 * en la misma corrida, porque su fuente `Formulario anterior` (inactiva, ADR 0039) es una
 * `google_sheet` mas y `fuentesATrasladar` la incluye.
 *
 * ── Que se lee y que NO ──────────────────────────────────────────────────────────────
 * Solo las fuentes `google_sheet` registradas de cada programa (la pestana FUENTE de su
 * formulario). Las vistas derivadas y los respaldos del `docs/structure.md` §10 NO son
 * fuentes: no tienen fila en `sources`, asi que es imposible que el traslado las lea. La
 * hoja y la pestana salen de la fila de `sources`, NUNCA escritas en el codigo (ADR 0012).
 *
 * ── Modos ────────────────────────────────────────────────────────────────────────────
 * - **Ensayo (por defecto, sin `--aplicar`):** cuenta y reporta por programa, sin dejar
 *   nada escrito. La ingesta corre DENTRO de `db.transaction` y al final se lanza para
 *   forzar el ROLLBACK: se ejercita el mismo camino de escritura que la corrida real
 *   (indices, upserts, recalculo del resumen) y la base queda intacta. Es lo mas seguro:
 *   el conteo sale de la escritura de verdad, no de una simulacion aparte que podria
 *   divergir. Ademas reporta el conteo PURO de `resumirEntradas` (filas, correos unicos,
 *   sin token, sin correo, fechas centinela) para que Mani lo coteje con la hoja.
 * - **Aplicar (`--aplicar`):** escribe de verdad. Exige `actorDelScript()`: sin
 *   `SCRIPT_ACTOR_EMAIL` no arranca (ADR 0029). Es idempotente porque `ingerirEntradas` lo
 *   es sobre `(fuente, token, es_parcial)`: correrlo dos veces no duplica, y un lead que
 *   luego llega por el webhook tampoco (misma puerta, misma llave).
 *
 * `aplicarReglaDeDeals: false` SIEMPRE: los leads viejos entran con su estado de gestion
 * por el 080, no como ~2.400 deals iguales en Pendiente Setteo (Mani, 24-sep).
 *
 * Uso:
 *   npm run trasladar              # ensayo: cuenta, no escribe
 *   npm run trasladar -- --aplicar # escribe de verdad (pide el ok de Mani y SCRIPT_ACTOR_EMAIL)
 */

/** Marca de rollback del ensayo: se lanza a proposito para deshacer la transaccion. */
const ENSAYO_ROLLBACK = Symbol("ensayo-rollback");

interface ReporteFuente {
  nombre: string;
  tab: string;
  activo: boolean;
  filas: number;
  correosUnicos: number;
  sinToken: number;
  sinCorreo: number;
  fechasCentinela: number;
  /** Filas cuyo token el programa ya tiene (hoy: lo que entro por el webhook). No se reingieren. */
  yaEnElCrm: number;
  /** Solo cuando la ingesta llegó a correr (siempre, salvo error de lectura de la hoja). */
  ingesta?: {
    envios: number;
    leadsNuevos: number;
    leadsActualizados: number;
    contactosNuevos: number;
    enviosSinLead: number;
    /** Uniones por telefono y telefonos de otro lead: explican leads nuevos < correos unicos. */
    posiblesDuplicados: { unidosPorTelefono: number; telefonoDeOtroLead: number };
  };
  error?: string;
}

interface ReportePrograma {
  slug: string;
  nombre: string;
  fuentes: ReporteFuente[];
  descartadas: { nombre: string; motivo: string }[];
}

/** Lee la pestana de una fuente y la convierte en entradas de la ingesta. */
async function leerFuente(fuente: FuenteListaParaLeer): Promise<EntradaEnvio[]> {
  const matriz = await leerPestana(fuente.sheetId, fuente.tab, fuente.rango);
  return entradasDesdeMatriz(matriz, {
    sourceId: fuente.id,
    zona: fuente.zona,
    // El mapeo YA viene traducido a `CampoEnvio` (`mapeoEnvioDesdeHoja`); ajusta campos
    // sobre `MAPEO_ENVIO`. Si la fuente no customiza nada, es `{}` y manda el defecto.
    mapeo: fuente.mapeo,
  });
}

function reporteDesdeIngesta(r: ResultadoIngesta): NonNullable<ReporteFuente["ingesta"]> {
  return {
    envios: r.envios,
    leadsNuevos: r.leadsNuevos,
    leadsActualizados: r.leadsActualizados,
    contactosNuevos: r.contactosNuevos,
    enviosSinLead: r.enviosSinLead,
    posiblesDuplicados: {
      unidosPorTelefono: r.posiblesDuplicados.filter((d) => d.motivo === "unido_por_telefono").length,
      telefonoDeOtroLead: r.posiblesDuplicados.filter((d) => d.motivo === "telefono_de_otro_lead").length,
    },
  };
}

/**
 * Traslada un programa. En ensayo, la ingesta de TODAS sus fuentes corre dentro de una
 * sola transaccion que al final se revierte; en aplicar, cada fuente se ingiere y queda.
 */
async function trasladarPrograma(
  base: Db,
  programa: { id: string; slug: string; nombre: string },
  aplicar: boolean,
  syncRunId: string | null,
): Promise<ReportePrograma> {
  const filas = await base
    .select({
      id: sources.id,
      nombre: sources.nombre,
      tipo: sources.tipo,
      sheetId: sources.sheetId,
      tab: sources.tab,
      rango: sources.rango,
      tzFechas: sources.tzFechas,
      mapeoColumnas: sources.mapeoColumnas,
      activo: sources.activo,
    })
    .from(sources)
    .where(eq(sources.programId, programa.id));

  const { listas, descartadas } = fuentesATrasladar(filas as FuenteDeHoja[]);

  // Se leen todas las hojas ANTES de abrir la transaccion del ensayo: una lectura HTTP
  // dentro de una transaccion retiene una conexion del pooler (misma leccion que la cita
  // de Calendly en `ingerirEntradas`).
  const cargadas: { fuente: FuenteListaParaLeer; entradas?: EntradaEnvio[]; error?: string }[] = [];
  for (const fuente of listas) {
    try {
      cargadas.push({ fuente, entradas: await leerFuente(fuente) });
    } catch (e) {
      cargadas.push({ fuente, error: (e as Error).message });
    }
  }

  // Los tokens que el programa YA tiene, de cualquier fuente (el webhook incluido): la
  // hoja trae el mismo token de Typeform y la ingesta solo es idempotente por fuente.
  const existentes = await base
    .select({ token: submissions.token })
    .from(submissions)
    .innerJoin(sources, eq(sources.id, submissions.sourceId))
    .where(eq(sources.programId, programa.id));
  const tokensDelPrograma = new Set(existentes.map((f) => f.token));

  const fuentesReporte: ReporteFuente[] = [];

  const ingerirTodas = async (tx: Db) => {
    for (const c of cargadas) {
      const vacio: ReporteFuente = {
        nombre: c.fuente.nombre,
        tab: c.fuente.tab,
        activo: c.fuente.activo,
        filas: 0,
        correosUnicos: 0,
        sinToken: 0,
        sinCorreo: 0,
        fechasCentinela: 0,
        yaEnElCrm: 0,
      };
      if (c.error !== undefined || c.entradas === undefined) {
        fuentesReporte.push({ ...vacio, error: c.error ?? "no se pudo leer la hoja" });
        continue;
      }
      const resumen = resumirEntradas(c.entradas);
      const { nuevas, yaEnElCrm } = apartarLasQueYaEntraron(c.entradas, tokensDelPrograma);
      // Avance por fuente: un traslado largo no puede quedar mudo (ticket 111).
      console.log(`  … ${programa.slug} / ${c.fuente.nombre}: ingiriendo ${nuevas.length} filas`);
      const inicio = Date.now();
      try {
        const r = await ingerirEntradas(tx, programa.id, nuevas, {
          aplicarReglaDeDeals: false,
          syncRunId,
        });
        console.log(`  ✓ ${c.fuente.nombre}: ${((Date.now() - inicio) / 1000).toFixed(1)} s`);
        fuentesReporte.push({ ...vacio, ...resumen, yaEnElCrm, ingesta: reporteDesdeIngesta(r) });
      } catch (e) {
        fuentesReporte.push({ ...vacio, ...resumen, yaEnElCrm, error: (e as Error).message });
      }
    }
  };

  if (aplicar) {
    // Real: cada fuente queda escrita. `ingerirEntradas` ya abre su propia transaccion
    // por lote; aca se llama sin envolver para que un fallo de una fuente no revierta lo
    // ya escrito de otra (cada una es independiente e idempotente).
    await ingerirTodas(base);
  } else {
    // Ensayo: todo dentro de una transaccion que se revierte SIEMPRE. El conteo se
    // captura en `fuentesReporte` antes de lanzar, asi que sobrevive al rollback.
    try {
      await (base as { transaction: <T>(fn: (tx: Db) => Promise<T>) => Promise<T> }).transaction(
        async (tx) => {
          await ingerirTodas(tx);
          throw ENSAYO_ROLLBACK;
        },
      );
    } catch (e) {
      if (e !== ENSAYO_ROLLBACK) throw e;
    }
  }

  return {
    slug: programa.slug,
    nombre: programa.nombre,
    fuentes: fuentesReporte,
    descartadas: descartadas.map((d) => ({ nombre: d.fuente.nombre, motivo: d.motivo })),
  };
}

function imprimirReporte(reportes: ReportePrograma[], aplicar: boolean): void {
  const titulo = aplicar ? "TRASLADO (aplicado)" : "ENSAYO (no se escribió nada)";
  console.log(`\n${"═".repeat(72)}\n  ${titulo}\n${"═".repeat(72)}`);

  for (const p of reportes) {
    console.log(`\n▸ ${p.nombre} (${p.slug})`);
    if (p.descartadas.length > 0) {
      for (const d of p.descartadas) console.log(`    ⨯ descartada: ${d.nombre} — ${d.motivo}`);
    }
    if (p.fuentes.length === 0) {
      console.log("    (sin fuentes google_sheet)");
      continue;
    }
    for (const f of p.fuentes) {
      const marca = f.activo ? "" : "  (fuente inactiva)";
      console.log(`\n  · ${f.nombre} / "${f.tab}"${marca}`);
      if (f.error) {
        console.log(`      ⚠️  ${f.error}`);
        continue;
      }
      console.log(`      filas leídas        : ${f.filas}`);
      console.log(`      correos únicos      : ${f.correosUnicos}   (dedup por (programa, correo))`);
      console.log(`      sin token           : ${f.sinToken}`);
      console.log(`      ya en el CRM        : ${f.yaEnElCrm}`);
      console.log(`      sin correo          : ${f.sinCorreo}`);
      console.log(`      fechas centinela    : ${f.fechasCentinela}   (descartadas: entran como parcial)`);
      if (f.ingesta) {
        const g = f.ingesta;
        console.log(`      → envíos            : ${g.envios}`);
        console.log(`      → leads nuevos      : ${g.leadsNuevos}`);
        console.log(`      → leads actualizados: ${g.leadsActualizados}`);
        console.log(`      → contactos nuevos  : ${g.contactosNuevos}`);
        console.log(`      → posibles duplicados : ${g.posiblesDuplicados.unidosPorTelefono} unidos por teléfono, ${g.posiblesDuplicados.telefonoDeOtroLead} teléfono de otro lead`);
        if (g.enviosSinLead > 0) console.log(`      → envíos sin lead   : ${g.enviosSinLead}`);
      }
    }
  }
  console.log("");
}

async function main() {
  const aplicar = process.argv.includes("--aplicar");

  // Con `--aplicar` se exige el actor ANTES de tocar nada (ADR 0029): un traslado a una
  // base viva es una decision de una persona, y su correo queda en `change_log`.
  if (aplicar) {
    await actorDelScript(db);
  }

  const progs = await db
    .select({ id: programs.id, slug: programs.slug, nombre: programs.nombre })
    .from(programs)
    .orderBy(programs.slug);

  if (progs.length === 0) {
    console.error("No hay programas en esta base. ¿Apuntas a la base correcta?");
    process.exit(1);
  }

  const reportes: ReportePrograma[] = [];
  for (const p of progs) {
    // `syncRunId` es null: el sync se retiro (108) y `sync_runs` es historial de solo
    // lectura. El rastro del lead lo dejan `ingerirEntradas`/`recalcularResumen` igual.
    reportes.push(await trasladarPrograma(db, p, aplicar, null));
  }

  imprimirReporte(reportes, aplicar);

  if (!aplicar) {
    console.log("  Este fue un ENSAYO. Para escribir de verdad:");
    console.log("    npm run trasladar -- --aplicar\n");
  }

  process.exit(0);
}

main().catch((e) => {
  console.error("Falló el traslado:", e?.message ?? e);
  process.exit(1);
});
