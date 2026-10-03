import { db } from "@/lib/db";
import type { Rol } from "@/lib/auth/roles";
import { esAdministrador, trabajaLeads } from "@/lib/auth/roles";
import { opcionesDeFicha } from "@/lib/queries/ficha-deal";
import { llamadasDelPrograma } from "@/lib/queries/llamadas";
import { LlamadasPrograma } from "@/components/deals/llamadas-programa";

/**
 * Tab "Mis llamadas" de Mi espacio (ticket 172): las llamadas del programa acotadas al
 * usuario (ADR 0075). Reusa `llamadasDelPrograma` con alcance `dueno` y el componente
 * `LlamadasPrograma` de la tab Calls, sin el filtro por closer (ya está acotado).
 */
export async function TabMisLlamadas({
  programId,
  slug,
  userId,
  rol,
}: {
  programId: string;
  slug: string;
  userId: string;
  rol: Rol;
}) {
  const [llamadas, opcionesFicha] = await Promise.all([
    llamadasDelPrograma(db, programId, { tipo: "dueno", userId }),
    opcionesDeFicha(db, programId, null, null),
  ]);

  return (
    <LlamadasPrograma
      llamadas={llamadas}
      programaSlug={slug}
      motivosReagenda={opcionesFicha.motivos}
      puedeTrabajar={trabajaLeads(rol) || esAdministrador(rol)}
    />
  );
}
