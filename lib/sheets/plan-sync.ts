import type { changeLog, people } from "@/lib/db/schema";
import type { PersonaDeducida } from "./dedup";

/**
 * La decision del sync, sin base de datos (B-01). Recibe lo que vino de la hoja y lo
 * que ya esta guardado, y dice que insertar, que actualizar y que va a la bitacora.
 * `sync.ts` solo escribe lo que este plan le dice.
 */

/** Campos que se comparan para detectar cambios y escribir en la bitacora. */
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

    if (!previo) {
      plan.aInsertar.push(aRegistro(p, programId));
      continue;
    }

    const diffs = compararCampos(previo, p);
    if (diffs.length === 0) continue;

    plan.aActualizar.push({ id: previo.id, valores: aRegistro(p, programId) });
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
    raw: p.raw as Record<string, unknown>,
  };
}

/** Devuelve solo los campos que realmente cambiaron. Un sync sin novedades no escribe nada. */
function compararCampos(previo: PersonaGuardada, nuevo: PersonaDeducida) {
  const diffs: { campo: string; anterior: string | null; nuevo: string | null }[] = [];
  const antes = previo as Record<string, unknown>;
  const ahora = nuevo as unknown as Record<string, unknown>;
  for (const campo of CAMPOS_COMPARABLES) {
    const a = antes[campo];
    const b = ahora[campo];
    const sa = a === null || a === undefined ? null : String(a);
    const sb = b === null || b === undefined ? null : String(b);
    if (sa !== sb) diffs.push({ campo, anterior: sa, nuevo: sb });
  }
  return diffs;
}
