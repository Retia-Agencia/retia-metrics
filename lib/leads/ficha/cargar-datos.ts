import type { Rol } from "@/lib/auth/roles";
import { idsDeProgramasVisibles } from "@/lib/auth/alcance";
import type { Db } from "@/lib/db/tipos";
import { abonosDelLead } from "@/lib/queries/abonos-del-lead";
import { fichaDeLeadParaActor } from "@/lib/queries/operacion";
import { otrosProgramasDelCorreo } from "@/lib/queries/otros-programas-del-correo";

export async function cargarDatosDeFichaDeLead(db: Db, entrada: { programId: string; leadId: string; userId: string; rol: Rol; operaComoCloser: boolean }) {
  const resultado = await fichaDeLeadParaActor(db, entrada.programId, entrada.leadId, { rol: entrada.rol, operaComoCloser: entrada.operaComoCloser });
  if (!resultado) return null;
  const [otros, visibles, abonos] = await Promise.all([
    otrosProgramasDelCorreo(db, resultado.ficha.email, entrada.programId),
    idsDeProgramasVisibles(entrada.userId, entrada.rol, db),
    abonosDelLead(db, entrada.programId, resultado.ficha.id),
  ]);
  return { resultado, otros, visibles, abonos };
}
