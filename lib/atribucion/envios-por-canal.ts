import { eq } from "drizzle-orm";
import { submissions } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { resolverCanal, type Area } from "./canal";

export interface ResumenDeEnviosPorCanal {
  canales: { clave: string; nombre: string; area: Area; envios: number }[];
  sinUtm: number;
}

/** Pasa cada envío completo por la regla una sola vez y agrupa los canales derivados. */
export async function enviosPorCanal(db: Db): Promise<ResumenDeEnviosPorCanal> {
  const envios = await db
    .select({
      source: submissions.utmSource,
      medium: submissions.utmMedium,
    })
    .from(submissions)
    .where(eq(submissions.esParcial, false));

  const agrupados = new Map<string, ResumenDeEnviosPorCanal["canales"][number]>();
  let sinUtm = 0;
  for (const envio of envios) {
    const resultado = resolverCanal(envio);
    if (resultado.regla === "sin_utm") {
      sinUtm += 1;
      continue;
    }
    const clave = resultado.canal?.clave ?? "";
    const claveDeGrupo = `${resultado.area}\u0000${clave}`;
    const actual = agrupados.get(claveDeGrupo);
    if (actual) actual.envios += 1;
    else agrupados.set(claveDeGrupo, {
      clave,
      nombre: resultado.canal?.nombre ?? "(sin utm_source)",
      area: resultado.area,
      envios: 1,
    });
  }

  return {
    canales: [...agrupados.values()].sort(
      (a, b) => b.envios - a.envios || a.nombre.localeCompare(b.nombre, "es") || a.area.localeCompare(b.area),
    ),
    sinUtm,
  };
}
