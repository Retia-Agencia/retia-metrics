import type { RazonConCobertura } from "@/lib/cobertura";
import { estadoDeCobertura, UMBRAL_COBERTURA_POR_DEFECTO } from "@/lib/cobertura";
import { num } from "@/lib/format";

export function CifraDeRazon({ razon, formato, umbral }: {
  razon: RazonConCobertura;
  formato: (n: number) => string;
  umbral?: number;
}) {
  const estado = estadoDeCobertura(razon, umbral);
  if (estado === "no_calculable") return <><span>—</span>{razon.motivo ? <span className="block text-xs text-muted-foreground">{razon.motivo}</span> : null}</>;
  const pendientes = razon.agendasPendientes ?? 0;
  const baseCubre = razon.faltan === 0 || razon.base / (razon.base + razon.faltan) >= (umbral ?? UMBRAL_COBERTURA_POR_DEFECTO);
  if (estado === "parcial") return <><span className="block">{formato(razon.valor!)}</span>
    {baseCubre ? null : <span className="block text-xs text-muted-foreground">parcial · {num(razon.base)} de {num(razon.base + razon.faltan)}</span>}
    {pendientes > 0 ? <span className="block text-xs text-muted-foreground">parcial: {num(pendientes)} {pendientes === 1 ? "agenda pendiente" : "agendas pendientes"}</span> : null}
    {razon.motivo ? <span className="block text-xs text-muted-foreground">{razon.motivo}</span> : null}</>;
  return <>{formato(razon.valor!)}</>;
}
