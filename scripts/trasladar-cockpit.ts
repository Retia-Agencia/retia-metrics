import "./load-env";
import fs from "node:fs";
import path from "node:path";
import { db } from "../lib/db";
import type { Db } from "../lib/db/tipos";
import { deshacerCockpit, type ResultadoReversaCockpit } from "../lib/migracion/cockpit/deshacer";
import { extraerDelCockpit } from "../lib/migracion/cockpit/extraer";
import { importarCockpit, type ReporteCockpit } from "../lib/migracion/cockpit/importar";
import type { ExtraccionCockpit } from "../lib/migracion/cockpit/tipos";
import { actorDelScript } from "./actor";
import { LOCAL_DB_URL, validarUrlLocal } from "./db-local-url";

/**
 * El traslado unico del cockpit de contenido al CRM (ticket 322, ADR 0111), en tres pasos:
 *
 *   npm run cockpit:extraer -- --env <.env.local del cockpit> --cliente <id> --instancia <uuid>
 *     SOLO LECTURA del cockpit (solo `GET`). Escribe `.migracion/cockpit.json` (ignorado por git).
 *     La URL y la llave se leen del archivo de entorno del cockpit y nunca se imprimen.
 *
 *   npm run cockpit:importar -- [archivo] [--aplicar] [--local]
 *     ENSAYO por defecto: escribe todo dentro de una transaccion y la deshace al final, asi los
 *     conteos salen del mismo camino de escritura que la corrida real. `--aplicar` escribe de
 *     verdad (pide el ok de Mani; mira el ref de la conexion antes). `--local` apunta a la base
 *     de Docker. Exige `SCRIPT_ACTOR_EMAIL` (ADR 0029). Idempotente: correrlo dos veces no duplica.
 *
 *   npm run cockpit:deshacer -- [--aplicar] [--local]
 *     Borra lo que trajo el traslado, reconocido por su huella (`traslado_cockpit`), y nada mas.
 *     Se niega, sin borrar nada, si alguien ya trabajo encima. Ensayo por defecto.
 *
 * Solo imprime conteos. El `cliente` y la `instancia` del cockpit son configuracion de esta
 * corrida unica, por eso se pasan por argumento y no viven en `lib/` (ADR 0012).
 */

const CARPETA = path.join(process.cwd(), ".migracion");
const ARCHIVO = path.join(CARPETA, "cockpit.json");
const ENSAYO_ROLLBACK = Symbol("ensayo-rollback");
type ConTx = { transaction: <T>(fn: (tx: Db) => Promise<T>) => Promise<T> };

function argumento(nombre: string): string | undefined {
  const i = process.argv.indexOf(nombre);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function leerEnv(ruta: string): Record<string, string> {
  const salida: Record<string, string> = {};
  for (const linea of fs.readFileSync(ruta, "utf8").split("\n")) {
    if (!linea || linea.startsWith("#") || !linea.includes("=")) continue;
    const i = linea.indexOf("=");
    salida[linea.slice(0, i)] = linea.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
  return salida;
}

async function extraer() {
  const envRuta = argumento("--env");
  const cliente = argumento("--cliente");
  const instanceId = argumento("--instancia");
  if (!envRuta || !cliente || !instanceId) {
    console.error("Faltan --env <archivo>, --cliente <id> y --instancia <uuid>.");
    process.exit(1);
  }
  const env = leerEnv(envRuta);
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const llave = env.SUPABASE_SERVICE_ROLE;
  if (!url || !llave) {
    console.error("El archivo de entorno no trae NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE.");
    process.exit(1);
  }
  const extraccion = await extraerDelCockpit({ url, llave }, { cliente, instanceId });
  fs.mkdirSync(CARPETA, { recursive: true });
  fs.writeFileSync(ARCHIVO, JSON.stringify(extraccion));
  console.log(`\nEXTRAIDO · ${ARCHIVO}`);
  console.log(JSON.stringify(Object.fromEntries(Object.entries(extraccion.tablas).map(([k, v]) => [k, v.length])), null, 2));
}

async function importar() {
  const archivo = process.argv[3] && !process.argv[3].startsWith("--") ? process.argv[3] : ARCHIVO;
  const aplicar = process.argv.includes("--aplicar");
  usarBaseLocalSiSePide();
  const extraccion = JSON.parse(fs.readFileSync(archivo, "utf8")) as ExtraccionCockpit;
  const actorId = await actorDelScript(db);

  let reporte: ReporteCockpit | undefined;
  try {
    await (db as unknown as ConTx).transaction(async (tx) => {
      reporte = await importarCockpit(tx, extraccion, actorId);
      if (!aplicar) throw ENSAYO_ROLLBACK;
    });
  } catch (e) {
    if (e !== ENSAYO_ROLLBACK) throw e;
  }
  console.log(`\n${aplicar ? "IMPORTADO" : "ENSAYO (nada quedo escrito)"} · cliente ${extraccion.cliente}`);
  console.log(JSON.stringify(reporte, null, 2));
  if (!aplicar) console.log("\n  Para escribir de verdad (con el ok de Mani): agrega --aplicar\n");
}

async function deshacer() {
  const aplicar = process.argv.includes("--aplicar");
  usarBaseLocalSiSePide();
  const actorId = await actorDelScript(db);
  let resultado: ResultadoReversaCockpit | undefined;
  try {
    await (db as unknown as ConTx).transaction(async (tx) => {
      resultado = await deshacerCockpit(tx, actorId);
      if (!aplicar || resultado.estado === "negado") throw ENSAYO_ROLLBACK;
    });
  } catch (e) {
    if (e !== ENSAYO_ROLLBACK) throw e;
  }
  if (resultado?.estado === "negado") {
    console.error(`\nNO SE BORRO NADA: ${resultado.motivo}.\n`);
    process.exit(1);
  }
  console.log(`\n${aplicar ? "DESHECHO" : "ENSAYO (nada quedo borrado)"}`);
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
    // Sin parametros de la consulta: drizzle los pone en el mensaje.
    const m = e instanceof Error ? e.message.split(/\n?params:/)[0] : String(e);
    console.error("Fallo el traslado del cockpit:", m);
    process.exit(1);
  });
