import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { num, pct } from "@/lib/format";
import type { FilaPorCanal, RegistrosYAgendasPorCanal } from "@/lib/queries/registros-agendas-canal";

/**
 * Registros contra agendas por canal (ticket 088). Pinta lo que calculó
 * `registrosYAgendasPorCanal`; no calcula métricas. La tasa es agendas ÷ registros de la misma
 * fila: un canal que trae registros y no agenda se ve en 0%, no se esconde.
 */

const HUERFANO: Record<Exclude<FilaPorCanal["origen"], "canal">, { texto: string; variante: "neutro" | "alerta" }> = {
  sin_clasificar: { texto: "Sin clasificar", variante: "alerta" },
  sin_utm: { texto: "Sin UTM", variante: "neutro" },
  sin_envio_origen: { texto: "Sin envío de origen", variante: "neutro" },
};

function tasa(agendas: number, registros: number): string {
  return registros === 0 ? "—" : pct(agendas / registros);
}

export function RegistrosAgendasCanal({ vista }: { vista: RegistrosYAgendasPorCanal }) {
  const { filas, total } = vista;
  return (
    <Card aria-labelledby="registros-agendas-canal">
      <CardHeader className="space-y-1">
        <CardTitle id="registros-agendas-canal" className="text-base">
          Registros contra agendas por canal
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Un registro es un envío completo; una agenda, una llamada creada en el rango, del canal del envío que abrió su
          deal. La tasa es agendas ÷ registros. No aplica el filtro de closer.
        </p>
      </CardHeader>
      <CardContent className="text-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 font-medium">Canal</th>
                <th className="py-2 pl-3 font-medium">Área</th>
                <th className="py-2 pl-3 text-right font-medium">Registros</th>
                <th className="py-2 pl-3 text-right font-medium">Agendas</th>
                <th className="py-2 pl-3 text-right font-medium">Tasa</th>
              </tr>
            </thead>
            <tbody className="divide-y [&_tr]:transition-colors [&_tr:hover]:bg-muted/40">
              {filas.map((f) => (
                <tr key={f.canalId ?? f.origen}>
                  <td className="py-2 pr-3">
                    {f.origen === "canal" ? (
                      f.canal
                    ) : (
                      <Badge variant={HUERFANO[f.origen].variante}>{HUERFANO[f.origen].texto}</Badge>
                    )}
                  </td>
                  <td className="py-2 pl-3 text-muted-foreground">{f.area ?? "—"}</td>
                  <td className="cifra py-2 pl-3 text-right">{num(f.registros)}</td>
                  <td className="cifra py-2 pl-3 text-right">{num(f.agendas)}</td>
                  <td className="cifra py-2 pl-3 text-right text-muted-foreground">{tasa(f.agendas, f.registros)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t font-medium">
                <td className="py-2 pr-3">Total</td>
                <td />
                <td className="cifra py-2 pl-3 text-right">{num(total.registros)}</td>
                <td className="cifra py-2 pl-3 text-right">{num(total.agendas)}</td>
                <td className="cifra py-2 pl-3 text-right text-muted-foreground">{tasa(total.agendas, total.registros)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
