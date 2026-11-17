import type { Db } from "@/lib/db/tipos";
import { programasGestionablesPorUsuario } from "@/lib/queries/programas";
import { enlacesDePagoVigentes, historialesDeRecursos, recursosVigentes } from "@/lib/queries/recursos";

export async function cargarDatosDeRecursos(db: Db, entrada: { programId: string; userId: string; q?: string; consultarGestionables: boolean }) {
  const gestionables = entrada.consultarGestionables ? await programasGestionablesPorUsuario(entrada.userId, "closer", db) : [];
  const [recursos, enlaces] = await Promise.all([
    recursosVigentes({ programId: entrada.programId, q: entrada.q }, db),
    enlacesDePagoVigentes({ programId: entrada.programId }, db),
  ]);
  const historiales = await historialesDeRecursos(recursos.map((recurso) => recurso.id), db);
  return { gestionables, recursos, enlaces, historiales };
}
