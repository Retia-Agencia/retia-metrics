import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { fechaHoraEnBogota } from "@/lib/format";
import type { EtapaDeal } from "@/lib/deals/etapas";
import type { FichaDeMovimiento } from "@/lib/queries/ficha-deal";
import type { TonoEtapa } from "../etapa-tono";
import { Vacio } from "./campos";

/**
 * El historial de etapas del deal (ticket 074, ADR 0037): cada movimiento con quien lo hizo
 * ("Sistema" si nadie: un abono, el Grain) y su motivo. Del mas viejo al mas nuevo, como se vivio.
 */
export function FichaHistorial({
  historial,
  nombreDeEtapa,
  tonoDeEtapa,
}: {
  historial: FichaDeMovimiento[];
  nombreDeEtapa: Record<EtapaDeal, string>;
  tonoDeEtapa: Record<EtapaDeal, TonoEtapa>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Historial de etapas</CardTitle>
      </CardHeader>
      {historial.length === 0 ? (
        <Vacio>Este deal todavía no tiene movimientos de etapa.</Vacio>
      ) : (
        <ol className="divide-y">
          {historial.map((h) => (
            <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
              <span className="flex flex-wrap items-center gap-1.5">
                {h.de ? (
                  <>
                    <Badge variant={tonoDeEtapa[h.de]}>{nombreDeEtapa[h.de]}</Badge>
                    <span aria-hidden className="text-muted-foreground">
                      →
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground">Alta en</span>
                )}
                <Badge variant={tonoDeEtapa[h.a]}>{nombreDeEtapa[h.a]}</Badge>
                {h.motivoNombre ? <span className="text-muted-foreground">· {h.motivoNombre}</span> : null}
              </span>
              <span className="text-xs text-muted-foreground">
                {h.porNombre ?? "Sistema"} · {fechaHoraEnBogota(h.fecha)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
