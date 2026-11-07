import type { Session } from "next-auth";
import type { Db } from "@/lib/db/tipos";
import type { Rol } from "@/lib/auth/roles";
import { veDetalleTecnico, veSoloLoBasicoDelLead } from "@/lib/auth/roles";
import { actorOperativo, alcanceDeInbox } from "@/lib/auth/contexto-operativo";
import { alcanceDeDeals, dealVisiblePara } from "@/lib/auth/alcance-deals";
import { fichaDeLead, fichaSinDetalleDeCitas } from "@/lib/queries/ficha-lead";
import { fichaDeDeal } from "@/lib/queries/ficha-deal";
import { cohorteActiva } from "@/lib/queries/cohortes";
import { opcionesDeTablero, parsearFiltros, tableroKanban, vistaDelTablero } from "@/lib/queries/kanban";
import { inboxDelPrograma, perdidosEnCalendly } from "@/lib/queries/inbox";
import { seccionesSinDueno } from "@/lib/queries/inbox-sin-dueno";

export async function fichaDeLeadParaActor(
  db: Db,
  programId: string,
  leadId: string,
  sujeto: { rol: Rol | null; operaComoCloser: boolean },
) {
  const completa = await fichaDeLead(db, programId, leadId);
  if (!completa) return null;
  const basico = veSoloLoBasicoDelLead(sujeto);
  return { ficha: basico ? fichaSinDetalleDeCitas(completa) : completa, basico };
}

export async function fichaDeDealVisible(
  db: Db,
  programId: string,
  dealId: string,
  session: Session,
  rol: Rol | null,
) {
  const actor = actorOperativo(session, rol);
  if (!actor) return null;
  const ficha = await fichaDeDeal(db, programId, dealId, veDetalleTecnico(rol), actor);
  if (!ficha) return null;
  const alcance = await alcanceDeDeals(session);
  return dealVisiblePara(alcance, ficha.owner?.id ?? null) ? { ficha, actor } : null;
}

export async function tableroDeDealsParaActor(
  db: Db,
  programId: string,
  session: Session,
  busqueda: Record<string, string | string[] | undefined>,
  vistaRecordada: string | null = null,
) {
  const [alcance, activa] = await Promise.all([alcanceDeDeals(session), cohorteActiva(programId, db)]);
  const vista = vistaDelTablero(busqueda, vistaRecordada);
  const filtros = { ...parsearFiltros(busqueda, undefined, activa?.id ?? null), vista };
  const [tablero, opciones] = await Promise.all([
    tableroKanban(db, programId, alcance, filtros),
    opcionesDeTablero(db, programId),
  ]);
  return { alcance, activa, vista, filtros, tablero, opciones };
}

export async function bandejaParaActor(
  db: Db,
  programId: string,
  session: Session,
  rol: Rol | null,
) {
  const actor = actorOperativo(session, rol);
  if (!actor) return null;
  const alcance = alcanceDeInbox(session, rol);
  const [inbox, perdidos, secciones] = await Promise.all([
    inboxDelPrograma(db, programId, alcance, undefined, undefined, actor),
    perdidosEnCalendly(db, programId),
    seccionesSinDueno(db, programId),
  ]);
  return { actor, alcance, inbox, perdidos, secciones };
}
