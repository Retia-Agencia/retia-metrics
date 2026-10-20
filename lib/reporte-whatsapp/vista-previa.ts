import { reporteDelPrograma } from "@/lib/catalogo/reportes-whatsapp";
import type { Db } from "@/lib/db/tipos";
import { horaEnBogota } from "@/lib/format";
import { saludDeFuentes } from "@/lib/queries/salud-fuentes";
import { semaforoDelPrograma } from "@/lib/semaforo/semaforo";
import { armarMensajeDeLaHora, enlaceAlHub } from "./mensaje";

interface ArgsVistaPrevia {
  programId: string;
  programa: string;
  slug: string;
  origen: string;
  ahora: Date;
}

export interface VistaPreviaDelReporte {
  dia: string | null;
  cierre: string | null;
  aviso: string | null;
}

export async function vistaPreviaDelReporte(
  db: Db,
  args: ArgsVistaPrevia,
): Promise<VistaPreviaDelReporte> {
  const reporte = await reporteDelPrograma(db, args.programId);
  if (!reporte) return { dia: null, cierre: null, aviso: "Todavía no hay reporte configurado." };

  const metricasEncendidas = reporte.metricas.filter(
    (metrica) => metrica === "costo_por_agenda",
  );
  if (metricasEncendidas.length === 0) {
    return { dia: null, cierre: null, aviso: "No hay métricas encendidas." };
  }

  const enlaceHub = enlaceAlHub(args.origen, args.slug);
  const trazaRota = (await saludDeFuentes(db, args.ahora))
    .filter((fuente) => fuente.programId === args.programId && fuente.trazaRota)
    .map((fuente) => ({ fuente: fuente.nombre, pagos: fuente.pagos, pagosSinId: fuente.pagosSinId }));
  const mensaje = async (tipo: "dia" | "cierre", hora: string) => {
    const metricas = await Promise.all(metricasEncendidas.map((metrica) => {
      switch (metrica) {
        case "costo_por_agenda":
          return semaforoDelPrograma(db, {
            programId: args.programId,
            ahora: args.ahora,
            tipo,
            horas: [...reporte.horas, ...(reporte.horaCierre === null ? [] : [reporte.horaCierre])],
          });
      }
    }));
    return armarMensajeDeLaHora([{
      programa: args.programa,
      tipo,
      enlaceHub,
      metricas,
      cuentasMeta: [],
      trazaRota,
      error: null,
    }], hora, null, args.origen);
  };

  try {
    const dia = await mensaje("dia", horaEnBogota(args.ahora)!);
    const cierre = reporte.horaCierre === null
      ? null
      : await mensaje("cierre", `${String(reporte.horaCierre).padStart(2, "0")}:00`);
    return { dia, cierre, aviso: null };
  } catch {
    return { dia: null, cierre: null, aviso: "No se pudo calcular la vista previa." };
  }
}
