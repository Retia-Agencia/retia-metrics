import type { Session } from "next-auth";
import type { Db } from "@/lib/db/tipos";
import { alcanceDeDeals } from "@/lib/auth/alcance-deals";
import { listarCohortes } from "@/lib/catalogo/cohortes";
import { opcionesDeFicha } from "@/lib/queries/ficha-deal";
import { filtroDeLlamadasDesdeUrl, llamadasDelPrograma, opcionesDeLlamadas } from "@/lib/queries/llamadas";

type Busqueda = Record<string, string | string[] | undefined>;

export async function cargarDatosDeCalls(db: Db, entrada: { session: Session; programId: string; busqueda: Busqueda }) {
  const alcance = await alcanceDeDeals(entrada.session);
  const filtro = await filtroDeLlamadasDesdeUrl(db, entrada.programId, alcance, entrada.busqueda);
  const [llamadas, opciones, opcionesFicha, cohortesSinOrdenar] = await Promise.all([
    llamadasDelPrograma(db, entrada.programId, alcance, filtro),
    opcionesDeLlamadas(db, entrada.programId),
    opcionesDeFicha(db, entrada.programId, null, null),
    listarCohortes(db, entrada.programId),
  ]);
  const cohortes = cohortesSinOrdenar.sort((a, b) => (b.fechaInicioVentas ?? "").localeCompare(a.fechaInicioVentas ?? ""));
  return { alcance, filtro, llamadas, opciones, opcionesFicha, cohortes };
}
