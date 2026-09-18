import type { changeLog, people } from "@/lib/db/schema";
import type { PersonaDeducida } from "./dedup";

/**
 * La decision del sync, sin base de datos (B-01). Recibe lo que vino de la hoja y lo
 * que ya esta guardado, y dice que insertar, que actualizar y que va a la bitacora.
 * `sync.ts` solo escribe lo que este plan le dice.
 *
 * El sync NUNCA lee ni escribe `responsableCloserId` (ADR 0021): el registro que se
 * arma para la hoja no lo incluye, asi que el update de `sync.ts` no lo pisa. Y toda
 * fila de la hoja entra como `entrada = "formulario"`: si una persona estaba en
 * "crm" (creada a mano en el CRM) y reaparece en el formulario, el diff la pasa a
 * "formulario" dejando rastro en la bitacora.
 */

/** Campos que se comparan para detectar cambios y escribir en la bitacora. */
/**
 * Que campos se comparan para decidir si una persona se actualiza. Lo que no esta
 * aca se escribe igual cuando la fila entra a `aActualizar` por otro motivo, pero
 * **por si solo nunca dispara una escritura**.
 *
 * Las FECHAS DE APLICACION entran desde el 18-sep (decision de Mani). Antes no, y esa
 * exclusion era la razon de que arreglar `parsearFecha` no reparara lo ya escrito: una
 * persona cuyo unico campo malo era la fecha no tenia ningun diff, no entraba a
 * `aActualizar`, y el centinela del ano 1 se quedaba en la base para siempre. De ahi
 * salio `npm run backfill-fechas`. Con las fechas dentro, el sync se auto-repara y ese
 * script pasa a ser una herramienta de una sola vez, no una pieza del diseno.
 *
 * `fechaUltimaAplicacion` va junto a la primera a proposito: son el mismo concepto,
 * las escribe el mismo dedup y las corrompio el mismo centinela. Dejar una fuera seria
 * la clase de asimetria que se ve bien y falla sola.
 *
 * `estado` sigue fuera (F-01 abierto). El riesgo de meter una fecha esta cubierto por
 * `tests/plan-sync.test.ts`: si una fecha leida de la base y la misma recien parseada
 * dejaran de dar la misma cadena, el sync reescribiria la base entera cada dia sin que
 * nada fallara.
 */
const CAMPOS_COMPARABLES = [
  "nombre",
  "telefono",
  "cargo",
  "ingresoDeclarado",
  "urgencia",
  "porQueAplico",
  "utmSource",
  "utmMedium",
  "utmCampaign",
  "numAplicaciones",
  "entrada",
  "fechaPrimeraAplicacion",
  "fechaUltimaAplicacion",
] as const;

type PersonaGuardada = typeof people.$inferSelect;
type PersonaNueva = typeof people.$inferInsert;

export type PlanSync = {
  aInsertar: PersonaNueva[];
  aActualizar: { id: string; valores: PersonaNueva }[];
  cambios: (typeof changeLog.$inferInsert)[];
};

export function planificarSync(
  personas: PersonaDeducida[],
  existentes: Map<string, PersonaGuardada>,
  { programId, syncRunId }: { programId: string; syncRunId: string },
): PlanSync {
  const plan: PlanSync = { aInsertar: [], aActualizar: [], cambios: [] };

  for (const p of personas) {
    const previo = existentes.get(p.emailNormalizado);
    const registro = aRegistro(p, programId);

    if (!previo) {
      plan.aInsertar.push(registro);
      continue;
    }

    const diffs = compararCampos(previo, registro);
    if (diffs.length === 0) continue;

    plan.aActualizar.push({ id: previo.id, valores: registro });
    for (const d of diffs) {
      plan.cambios.push({
        tabla: "people",
        registroId: previo.id,
        etiqueta: previo.nombre ?? p.emailNormalizado,
        campo: d.campo,
        valorAnterior: d.anterior,
        valorNuevo: d.nuevo,
        origen: "sync",
        syncRunId,
      });
    }
  }

  return plan;
}

function aRegistro(p: PersonaDeducida, programId: string): PersonaNueva {
  return {
    programId,
    emailNormalizado: p.emailNormalizado,
    nombre: p.nombre,
    telefono: p.telefono,
    cargo: p.cargo,
    ingresoDeclarado: p.ingresoDeclarado,
    urgencia: p.urgencia,
    porQueAplico: p.porQueAplico,
    utmSource: p.utmSource,
    utmMedium: p.utmMedium,
    utmCampaign: p.utmCampaign,
    fechaPrimeraAplicacion: p.fechaPrimeraAplicacion,
    fechaUltimaAplicacion: p.fechaUltimaAplicacion,
    numAplicaciones: p.numAplicaciones,
    // La hoja siempre es formulario (ADR 0021). No se incluye responsableCloserId:
    // ese campo lo escribe solo la app y el update de sync.ts no debe pisarlo.
    entrada: "formulario" as const,
    raw: p.raw as Record<string, unknown>,
  };
}

/** Devuelve solo los campos que realmente cambiaron. Un sync sin novedades no escribe nada. */
function compararCampos(previo: PersonaGuardada, registro: PersonaNueva) {
  const diffs: { campo: string; anterior: string | null; nuevo: string | null }[] = [];
  const antes = previo as Record<string, unknown>;
  const ahora = registro as Record<string, unknown>;
  for (const campo of CAMPOS_COMPARABLES) {
    // `entrada` es NOT NULL con default "formulario" en la base: una fila guardada
    // sin ese valor cuenta como "formulario", no como un cambio.
    const a = campo === "entrada" ? (antes[campo] ?? "formulario") : antes[campo];
    const b = ahora[campo];
    const sa = a === null || a === undefined ? null : String(a);
    const sb = b === null || b === undefined ? null : String(b);
    if (sa !== sb) diffs.push({ campo, anterior: sa, nuevo: sb });
  }
  return diffs;
}
