import type { Db } from "@/lib/db/tipos";
import {
  chipPedido,
  conteoSinVer,
  conteosDeChips,
  notificacionesDeChip,
} from "@/lib/mi-espacio/notificaciones";

export interface EntradaDeNotificaciones {
  programId: string;
  userId: string;
  chip?: string;
  pagina?: string;
  q?: string;
}

export async function cargarDatosDeNotificaciones(db: Db, entrada: EntradaDeNotificaciones) {
  const chip = chipPedido(entrada.chip);
  const paginaPedida = Number.parseInt(entrada.pagina ?? "", 10);
  const pagina = Number.isFinite(paginaPedida) && paginaPedida > 0 ? paginaPedida : 0;
  const busqueda = (entrada.q ?? "").trim();
  const [conteos, resultado, sinVer] = await Promise.all([
    conteosDeChips(db, { programId: entrada.programId, userId: entrada.userId, q: busqueda }),
    notificacionesDeChip(db, { programId: entrada.programId, userId: entrada.userId, chip, pagina, q: busqueda }),
    conteoSinVer(db, { programId: entrada.programId, userId: entrada.userId }),
  ]);
  return { chip, pagina, busqueda, conteos, resultado, sinVer };
}

export type DatosDeNotificaciones = Awaited<ReturnType<typeof cargarDatosDeNotificaciones>>;
