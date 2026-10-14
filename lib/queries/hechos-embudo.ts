import type { Area } from "@/lib/atribucion/canal";
import type { Db } from "@/lib/db/tipos";
import { agrupar as agruparCitas } from "@/lib/queries/hechos/cita";
import { agrupar as agruparEnvios } from "@/lib/queries/hechos/envio";
import { agrupar as agruparVentas } from "@/lib/queries/hechos/venta";
import type { AlcanceDeSerie, Serie } from "@/lib/queries/serie";

export type OrigenDelHecho = "canal" | "sin_utm" | "sin_envio_origen";

export interface DimensionesDelEmbudo {
  dia: string;
  area: Area | null;
  canalClave: string | null;
  origen: OrigenDelHecho;
  duenoUserId: string | null;
  cohorteId: string | null;
}

export interface MedidasDelEmbudo {
  envios: number;
  agendas: number;
  shows: number;
  ventas: number;
}

export type FilaHechosDelEmbudo = Serie<DimensionesDelEmbudo, MedidasDelEmbudo>[number];

function origenDe(area: string, canal: string | null) {
  if (area === "sin_envio_origen") {
    return { area: null, canalClave: null, origen: "sin_envio_origen" as const };
  }
  if (area === "sin_utm") {
    return { area: "sin_utm" as const, canalClave: null, origen: "sin_utm" as const };
  }
  return { area: area as Area, canalClave: canal, origen: "canal" as const };
}

/** Compatibilidad del embudo construida solo con agregaciones de la capa de hechos. */
export async function hechosDelEmbudo(
  db: Db,
  { programId, rango }: AlcanceDeSerie,
): Promise<Serie<DimensionesDelEmbudo, MedidasDelEmbudo>> {
  const [envios, citas, ventas] = await Promise.all([
    agruparEnvios(db, { programId, rango, agruparPor: ["dia", "area", "canal"] }),
    agruparCitas(db, {
      programId,
      rango,
      agruparPor: ["dia", "area", "canal", "dueno", "cohorte"],
    }),
    agruparVentas(db, {
      programId,
      rango,
      agruparPor: ["dia", "area", "canal", "dueno", "cohorte"],
    }),
  ]);

  const serie = new Map<string, FilaHechosDelEmbudo>();
  const sumar = (
    dimensiones: DimensionesDelEmbudo,
    medidas: Partial<MedidasDelEmbudo>,
  ) => {
    const llave = JSON.stringify([
      programId,
      dimensiones.dia,
      dimensiones.area,
      dimensiones.canalClave,
      dimensiones.origen,
      dimensiones.duenoUserId,
      dimensiones.cohorteId,
    ]);
    const fila = serie.get(llave) ?? {
      programId,
      ...dimensiones,
      envios: 0,
      agendas: 0,
      shows: 0,
      ventas: 0,
    };
    fila.envios += medidas.envios ?? 0;
    fila.agendas += medidas.agendas ?? 0;
    fila.shows += medidas.shows ?? 0;
    fila.ventas += medidas.ventas ?? 0;
    serie.set(llave, fila);
  };

  for (const envio of envios) {
    sumar({
      dia: envio.dia!,
      ...origenDe(envio.area!, envio.canal),
      duenoUserId: null,
      cohorteId: null,
    }, { envios: envio.envios });
  }
  for (const cita of citas) {
    sumar({
      dia: cita.dia!,
      ...origenDe(cita.area!, cita.canal),
      duenoUserId: cita.dueno,
      cohorteId: cita.cohorte,
    }, { agendas: cita.citas, shows: cita.shows });
  }
  for (const venta of ventas) {
    sumar({
      dia: venta.dia!,
      ...origenDe(venta.area!, venta.canal),
      duenoUserId: venta.dueno,
      cohorteId: venta.cohorte,
    }, { ventas: venta.ventas });
  }

  return [...serie.values()];
}
