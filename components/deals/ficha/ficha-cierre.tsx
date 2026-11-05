import { Badge } from "@/components/ui/badge";
import { EnlaceAInfo } from "@/components/hub/info-de-pagina";
import type { GrupoDeCierre } from "@/lib/queries/escalera";

const TONO_DE_CIERRE = {
  cerro_en_la_llamada: "exito",
  cerro_con_seguimiento: "info",
  no_cerro: "peligro",
  ventas_sin_llamada: "alerta",
  no_llegaron_a_la_llamada: "neutro",
} as const;

function textoDeCierre(grupo: GrupoDeCierre, dias: number | null): string {
  if (grupo === "cerro_en_la_llamada") return "Cerró en la llamada";
  if (grupo === "cerro_con_seguimiento") {
    return `Cerró con seguimiento · ${dias} ${dias === 1 ? "día hábil" : "días hábiles"}`;
  }
  if (grupo === "no_cerro") return "No cerró";
  if (grupo === "ventas_sin_llamada") return "Venta sin llamada registrada";
  return "No llegó a la llamada";
}

export function FichaCierre({
  grupo,
  dias,
  nombreDelEscalon,
  hrefInfo,
}: {
  grupo: GrupoDeCierre;
  dias: number | null;
  nombreDelEscalon: string;
  hrefInfo: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3">
      <span className="text-xs font-medium text-muted-foreground">Cómo cerró</span>
      <Badge variant={TONO_DE_CIERRE[grupo]} title={nombreDelEscalon}>
        {textoDeCierre(grupo, dias)}
      </Badge>
      <EnlaceAInfo seccion="escalera" etiqueta="Cómo cerró" href={hrefInfo} />
    </div>
  );
}
