import "./load-env";
import fs from "node:fs";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { db } from "../lib/db";
import { programs, sources } from "../lib/db/schema";
import type { Db } from "../lib/db/tipos";
import { hoyEnBogota } from "../lib/format";
import { leerPestana } from "../lib/sheets/leer";
import { extraerEstudiantes } from "../lib/migracion/extraer-estudiantes";
import { extraerLlamadas } from "../lib/migracion/extraer-llamadas";
import { extraerSetteo, type AlcanceSetteo } from "../lib/migracion/extraer-setteo";
import { importarGestion, type ReporteImportacion } from "../lib/migracion/importar";
import { juntar, type Extraccion } from "../lib/migracion/template";
import { DESCRIPCION_DE_MOTIVO, deshacerMigracion, type ResultadoReversa } from "../lib/migracion/deshacer";
import { actorConRolDelScript, actorDelScript } from "./actor";
import { LOCAL_DB_URL, validarUrlLocal } from "./db-local-url";

/**
 * La migracion de las pestañas de gestion (tickets 077, 078 y 080; ADR 0059), en dos pasos:
 *
 *   npm run migracion:extraer -- --programa <slug> [--alcance total] [--dias 30]
 *     Lee las pestañas de gestion del programa y escribe el TEMPLATE en `.migracion/`
 *     (ignorado por git: 🩸 lleva correos). No toca la base salvo para leer de que hoja es el
 *     programa. Se revisa y corrige a mano antes de importar.
 *
 *   npm run migracion:importar -- <template.json> [--aplicar] [--local] [--onboarded-desde-mail]
 *     ENSAYO por defecto: escribe todo dentro de una transaccion y la deshace al final, asi el
 *     conteo sale del mismo camino de escritura que la corrida real. `--aplicar` escribe de
 *     verdad (pide el ok de Mani). `--local` apunta a la base de Docker (`npm run db:local`).
 *     Siempre exige `SCRIPT_ACTOR_EMAIL` (ADR 0029): su correo queda en `change_log`.
 *
 *   npm run migracion:deshacer -- --programa <slug> [--aplicar] [--local]
 *     La reversa nivel 3 del corte (`operations.md` §12.3, ticket 127): borra lo que escribio la
 *     migracion en ESE programa, reconocido por su huella, y nada mas. Se niega, sin borrar nada,
 *     si alguien ya trabajo encima. Ensayo por defecto; `--aplicar` con el ok de Mani.
 *
 * Solo imprime conteos, nunca datos personales. Idempotente: correrlo dos veces no duplica.
 *
 * Las pestañas de cada programa son configuracion de esta corrida unica, no del producto: por
 * eso viven aqui (ADR 0012 aplica a `lib/`, `app/` y `components/`). La HOJA sale de la fuente
 * `google_sheet` del programa en la base, nunca escrita aqui.
 */

interface PestanasDelPrograma {
  setteo: string;
  llamadas: string;
  estudiantes: {
    tab: string;
    pestana: string;
    cohorte: string;
    situacionEsAcuerdoDePago?: boolean;
    cohortePasadaDesde?: string;
  }[];
}

const PESTANAS: Record<string, PestanasDelPrograma> = {
  comunicarte: {
    setteo: "📞 Setteo No Calificados",
    llamadas: "Registro de llamadas",
    estudiantes: [
      { tab: "Estudiantes Agosto", pestana: "estudiantes-agosto", cohorte: "C1" },
      // Las filas del bloque "Cohorte pasada" (12 al 30-sep) vienen de agosto (080).
      { tab: "Estudiantes Septiembre", pestana: "estudiantes-septiembre", cohorte: "C2", cohortePasadaDesde: "C1" },
    ],
  },
  "tactical-investor": {
    setteo: "📞 Setteo No Calificados",
    llamadas: "Registro de llamadas",
    estudiantes: [
      { tab: "Estudiantes Cohort Julio", pestana: "estudiantes-julio", cohorte: "C1", situacionEsAcuerdoDePago: true },
      { tab: "Septiembre Estudiantes Cohort", pestana: "estudiantes-septiembre", cohorte: "C2" },
    ],
  },
};

const CARPETA = path.join(process.cwd(), ".migracion");
const ENSAYO_ROLLBACK = Symbol("ensayo-rollback");

interface ArchivoTemplate {
  programa: string;
  generadoEn: string;
  alcance: AlcanceSetteo;
  diasDeCorte: number;
  extraccion: Extraccion;
}

function argumento(nombre: string): string | undefined {
  const i = process.argv.indexOf(nombre);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function contar<T>(xs: T[], llave: (x: T) => string): Record<string, number> {
  const c: Record<string, number> = {};
  for (const x of xs) c[llave(x)] = (c[llave(x)] ?? 0) + 1;
  return c;
}

async function extraer() {
  const slug = argumento("--programa");
  const config = slug ? PESTANAS[slug] : undefined;
  if (!slug || !config) {
    console.error(`Falta --programa (uno de: ${Object.keys(PESTANAS).join(", ")}).`);
    process.exit(1);
  }
  const alcance = (argumento("--alcance") ?? "trabajado-y-reciente") as AlcanceSetteo;
  if (alcance !== "trabajado-y-reciente" && alcance !== "total") {
    console.error("--alcance es trabajado-y-reciente o total.");
    process.exit(1);
  }
  const diasDeCorte = Number(argumento("--dias") ?? 30);

  const [fuente] = await db
    .select({ sheetId: sources.sheetId })
    .from(sources)
    .innerJoin(programs, eq(programs.id, sources.programId))
    .where(and(eq(programs.slug, slug), eq(sources.tipo, "google_sheet"), eq(sources.activo, true)));
  const hojaDeRespaldo = fuente?.sheetId
    ? undefined
    : (
        await db
          .select({ sheetId: sources.sheetId })
          .from(sources)
          .innerJoin(programs, eq(programs.id, sources.programId))
          .where(and(eq(programs.slug, slug), eq(sources.tipo, "google_sheet")))
      )[0]?.sheetId;
  const sheetId = fuente?.sheetId ?? hojaDeRespaldo;
  if (!sheetId) {
    console.error(`El programa ${slug} no tiene una fuente google_sheet con hoja en esta base.`);
    process.exit(1);
  }

  const hoy = hoyEnBogota();
  const partes: Extraccion[] = [
    extraerSetteo(await leerPestana(sheetId, config.setteo), { programa: slug, hoy, alcance, diasDeCorte }),
    extraerLlamadas(await leerPestana(sheetId, config.llamadas), { programa: slug }),
  ];
  for (const e of config.estudiantes) {
    partes.push(extraerEstudiantes(await leerPestana(sheetId, e.tab), { programa: slug, ...e }));
  }
  const extraccion = juntar(...partes);

  fs.mkdirSync(CARPETA, { recursive: true });
  const archivo = path.join(CARPETA, `${slug}-${hoy}.json`);
  const contenido: ArchivoTemplate = { programa: slug, generadoEn: new Date().toISOString(), alcance, diasDeCorte, extraccion };
  fs.writeFileSync(archivo, JSON.stringify(contenido, null, 2));

  console.log(`\nTemplate de ${slug} (${alcance}, ${diasDeCorte} días) → ${path.relative(process.cwd(), archivo)}`);
  console.log("  deals por etapa:", contar(extraccion.deals, (d) => d.etapa));
  console.log("  sin deal:", contar(extraccion.sinDeal, (s) => s.razon));
  console.log("  llamadas por resultado:", contar(extraccion.llamadas, (l) => l.resultado));
  console.log("  abonos:", extraccion.abonos.length);
  console.log("  rarezas:", contar(extraccion.rarezas, (r) => r.tipo));
  console.log("\n  Revísalo y después: npm run migracion:importar --", path.relative(process.cwd(), archivo), "\n");
}

async function importar() {
  const archivo = process.argv.slice(3).find((a) => a.endsWith(".json"));
  if (!archivo) {
    console.error("Falta el template: npm run migracion:importar -- .migracion/<programa>-<fecha>.json");
    process.exit(1);
  }
  const aplicar = process.argv.includes("--aplicar");
  usarBaseLocalSiSePide();
  const t = JSON.parse(fs.readFileSync(archivo, "utf8")) as ArchivoTemplate;
  // El programa es frontera (ADR 0043): el template se importa en SU programa. `--programa`
  // solo existe para el ensayo local, donde los slugs sembrados son otros.
  const otro = argumento("--programa");
  if (otro && !process.argv.includes("--local")) {
    console.error("--programa solo vale con --local: un template se importa en el programa del que salió.");
    process.exit(1);
  }
  const slug = otro ?? t.programa;

  const actor = await actorConRolDelScript(db);
  const [programa] = await db.select({ id: programs.id }).from(programs).where(eq(programs.slug, slug));
  if (!programa) {
    console.error(`No existe el programa ${slug} en esta base. Con --local, pasa --programa <slug local>.`);
    process.exit(1);
  }
  const op = { programId: programa.id, actor, onboardedDesdeMail: process.argv.includes("--onboarded-desde-mail") };

  let reporte: ReporteImportacion | undefined;
  type ConTx = { transaction: <T>(fn: (tx: Db) => Promise<T>) => Promise<T> };
  try {
    await (db as unknown as ConTx).transaction(async (tx) => {
      reporte = await importarGestion(tx, t.extraccion, op);
      if (!aplicar) throw ENSAYO_ROLLBACK;
    });
  } catch (e) {
    if (e !== ENSAYO_ROLLBACK) throw e;
  }

  console.log(`\n${aplicar ? "APLICADO" : "ENSAYO (nada quedó escrito)"} · ${slug} · template del ${t.generadoEn.slice(0, 10)}`);
  console.log(JSON.stringify(reporte, null, 2));
  if (!aplicar) console.log("\n  Para escribir de verdad (con el ok de Mani): agrega --aplicar\n");
}

async function deshacer() {
  const slug = argumento("--programa");
  if (!slug) {
    console.error("Falta --programa <slug>: la reversa es de UN programa.");
    process.exit(1);
  }
  const aplicar = process.argv.includes("--aplicar");
  usarBaseLocalSiSePide();

  const actorId = await actorDelScript(db);
  const [programa] = await db.select({ id: programs.id }).from(programs).where(eq(programs.slug, slug));
  if (!programa) {
    console.error(`No existe el programa ${slug} en esta base.`);
    process.exit(1);
  }

  let resultado: ResultadoReversa | undefined;
  type ConTx = { transaction: <T>(fn: (tx: Db) => Promise<T>) => Promise<T> };
  try {
    await (db as unknown as ConTx).transaction(async (tx) => {
      resultado = await deshacerMigracion(tx, { programId: programa.id, actorId });
      if (!aplicar || resultado.estado === "negado") throw ENSAYO_ROLLBACK;
    });
  } catch (e) {
    if (e !== ENSAYO_ROLLBACK) throw e;
  }

  if (resultado?.estado === "negado") {
    console.error(`\nNO SE BORRÓ NADA · ${slug}: alguien ya trabajó sobre lo migrado.`);
    for (const [motivo, n] of Object.entries(resultado.motivos)) {
      console.error(`  ${n} ${DESCRIPCION_DE_MOTIVO[motivo as keyof typeof DESCRIPCION_DE_MOTIVO]}`);
    }
    console.error("\n  Es el nivel 4 de la reversa (operations.md §12.3): se anula fila por fila (ADR 0038).\n");
    process.exit(1);
  }
  console.log(`\n${aplicar ? "DESHECHO" : "ENSAYO (nada quedó borrado)"} · ${slug}`);
  console.log(JSON.stringify(resultado?.borrado, null, 2));
  if (!aplicar) console.log("\n  Para borrar de verdad (con el ok de Mani): agrega --aplicar\n");
}

function usarBaseLocalSiSePide() {
  if (!process.argv.includes("--local")) return;
  validarUrlLocal(LOCAL_DB_URL);
  // El cliente de `lib/db` es perezoso: esto vale mientras nadie lo haya usado todavia.
  process.env.DATABASE_URL = LOCAL_DB_URL;
  process.env.DATABASE_URL_DIRECTA = LOCAL_DB_URL;
}

const COMANDOS: Record<string, () => Promise<void>> = { extraer, importar, deshacer };
const comando = COMANDOS[process.argv[2]];
(comando ? comando() : Promise.reject(new Error("Comando: extraer | importar | deshacer")))
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Falló la migración:", mensajeSinDatos(e));
    process.exit(1);
  });

/**
 * El error sin datos personales: drizzle pone los PARAMETROS de la consulta en el mensaje
 * (`Failed query: ... params: <correos, notas>`) y el driver pone la fila en el detalle. Se
 * imprime la consulta sin parametros y el codigo y la restriccion del driver.
 */
function mensajeSinDatos(e: unknown): string {
  if (!(e instanceof Error)) return String(e);
  const consulta = e.message.split(/\n?params:/)[0];
  const causa = (e as { cause?: { code?: string; constraint_name?: string } }).cause;
  return [consulta, causa?.code && `codigo ${causa.code}`, causa?.constraint_name && `restriccion ${causa.constraint_name}`]
    .filter(Boolean)
    .join(" · ");
}
