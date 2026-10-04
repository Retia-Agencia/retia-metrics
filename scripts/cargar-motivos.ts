import "./load-env";
import { db } from "../lib/db";
import { motivos, type EntradaMotivo } from "../lib/catalogo/motivos";
import { actorDelScript } from "./actor";

/**
 * Carga las cinco listas de motivos (ticket 104, ADR 0056; la de correccion, ticket 182) y retira las 8 semillas de
 * arranque del 16-sep (migracion 0004), que se pusieron sin leer las hojas.
 *
 * Las listas salen de la taxonomia que el equipo ya usa en las dos hojas
 * (`_ListasDropdown`: FIN, FIT, FU, RD, PRA), estandarizada (frases completas, una sola
 * ortografia, una sola lista para los dos programas) y reducida (Mani, 27-sep). El codigo
 * de la hoja de cada una queda en el comentario para poder migrar lo historico.
 *
 * Todo pasa por el molde de catalogo (ADR 0029): validacion y `change_log` con el actor de
 * `SCRIPT_ACTOR_EMAIL`. Las semillas viejas se retiran con `borrarSiNoSeUso`: si alguna ya
 * se uso, no se borra, se desactiva y se dice cuantas veces (ADR 0026). Idempotente.
 *
 * Correrlo en cada base nueva despues de las migraciones: `npm run cargar-motivos`.
 */
const LISTAS: readonly Required<EntradaMotivo>[] = [
  // perdida (P, a Cierre Perdido)
  { tipo: "perdida", nombre: "Sin dinero para invertir ahora" }, // FIN-1
  { tipo: "perdida", nombre: "El precio supera lo que esperaba pagar" }, // FIN-2
  { tipo: "perdida", nombre: "El programa no se ajusta a su nivel o necesidad" }, // FIT-1 + FIT-2
  { tipo: "perdida", nombre: "El horario del programa no le funciona" }, // FIT-3
  { tipo: "perdida", nombre: "No le interesa el programa" }, // RD-1
  { tipo: "perdida", nombre: "Dejó de responder" }, // FU-5
  // reagenda (T29, la llamada ocurrio y hace falta otra) — la hoja solo tenia "PRA"
  { tipo: "reagenda", nombre: "Faltó tiempo para terminar la llamada" },
  { tipo: "reagenda", nombre: "Tiene que estar quien toma la decisión" },
  // retroceso (T15, dijo que si y se echo para atras pero sigue interesado)
  { tipo: "retroceso", nombre: "Depende de otra persona para decidir" }, // FU-2
  { tipo: "retroceso", nombre: "Necesita más tiempo para pensarlo" }, // FU-3
  { tipo: "retroceso", nombre: "No pagó en la fecha límite acordada" }, // FU-1 + Cartera
  // recuperacion (R, un perdido que vuelve) — sin equivalente en la hoja
  { tipo: "recuperacion", nombre: "Volvió a mostrar interés" },
  { tipo: "recuperacion", nombre: "Ya tiene cómo pagar" },
  // correccion (corregir el último movimiento, ticket 182, ADR 0078; Mani, 3-oct)
  { tipo: "correccion", nombre: "Me equivoqué de etapa" },
  { tipo: "correccion", nombre: "Lo movió otra persona por error" },
];

const SEMILLAS_VIEJAS = [
  "Dinero", "Horario", "Sin fit", "Viaje", "Otro programa",
  "Decisión de un tercero", "Sin respuesta", "Sin motivo",
];

const clave = (tipo: string, nombre: string) => `${tipo}|${nombre.toLowerCase()}`;

async function main() {
  const actor = await actorDelScript(db);
  const cat = motivos(db);
  const existentes = await cat.listar();
  const hay = new Set(existentes.map((f) => clave(String(f.tipo), String(f.nombre))));

  for (const m of LISTAS) {
    if (hay.has(clave(m.tipo, m.nombre))) { console.log(`  = ${m.tipo}: ${m.nombre}`); continue; }
    await cat.crear(actor, m);
    console.log(`  + ${m.tipo}: ${m.nombre}`);
  }

  for (const f of existentes.filter((f) => SEMILLAS_VIEJAS.includes(String(f.nombre)))) {
    const r = await cat.borrarSiNoSeUso(actor, f.id);
    if (r.borrado) console.log(`  - borrado: ${f.nombre}`);
    else {
      if (f.activo) await cat.desactivar(actor, f.id);
      console.log(`  ~ desactivado (usado ${r.referencias} veces): ${f.nombre}`);
    }
  }
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
