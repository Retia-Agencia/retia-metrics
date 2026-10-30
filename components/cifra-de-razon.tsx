import type { RazonConCobertura } from "@/lib/cobertura";
import { estadoDeCobertura } from "@/lib/cobertura";
import { num } from "@/lib/format";

export function CifraDeRazon({ razon, formato, umbral }: {
  razon: RazonConCobertura;
  formato: (n: number) => string;
  umbral?: number;
}) {
  const estado = estadoDeCobertura(razon, umbral);
  if (estado === "no_calculable") return <><span>—</span>{razon.motivo ? <span className="block text-xs text-muted-foreground">{razon.motivo}</span> : null}</>;
  if (estado === "parcial") return <><span className="block">{formato(razon.valor!)}</span>
    <span className="block text-xs text-muted-foreground">parcial · {num(razon.base)} de {num(razon.base + razon.faltan)}</span>
    {razon.motivo ? <span className="block text-xs text-muted-foreground">{razon.motivo}</span> : null}</>;
  return <>{formato(razon.valor!)}</>;
}
