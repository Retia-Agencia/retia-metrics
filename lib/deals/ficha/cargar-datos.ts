import type { Session } from "next-auth";
import type { Rol } from "@/lib/auth/roles";
import type { Db } from "@/lib/db/tipos";
import { alertasDelDeal, opcionesDeFicha } from "@/lib/queries/ficha-deal";
import { cargarHechosDeEscaleraDeDeal } from "@/lib/queries/escalera";
import { fichaDeDealVisible } from "@/lib/queries/operacion";

export async function cargarDatosDeFichaDeDeal(db: Db, entrada: { programId: string; dealId: string; session: Session; rol: Rol }) {
  const resultado = await fichaDeDealVisible(db, entrada.programId, entrada.dealId, entrada.session, entrada.rol);
  if (!resultado) return null;
  const { ficha } = resultado;
  const [opciones, alertas, hechosDeEscalera] = await Promise.all([
    opcionesDeFicha(
      db,
      entrada.programId,
      ficha.owner?.id ?? null,
      ficha.cohorte?.id ?? null,
      ficha.etapa,
      ficha.pendiente === "proxima_cohorte" && ficha.cohorteDestinoTexto != null,
      { cohortesVendiendoHoy: ficha.cohortesVendiendoHoy, enlacesDePago: ficha.enlacesDePago },
    ),
    alertasDelDeal(db, entrada.programId, ficha.dealId),
    cargarHechosDeEscaleraDeDeal(db, { programId: entrada.programId, dealId: ficha.dealId }),
  ]);
  return { resultado, opciones, alertas, hechosDeEscalera };
}
