import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { fechaHoraEnBogota } from "@/lib/format";
import type { EtapaDeal } from "@/lib/deals/etapas";
import type { FichaDeEvento } from "@/lib/queries/ficha-deal";
import type { TonoEtapa } from "../etapa-tono";
import { Vacio } from "./campos";

/**
 * El log del deal une los movimientos de etapa y su bitacora operativa, del mas reciente
 * al mas antiguo. Los valores largos conservan el contenido completo en `title`.
 */
export function FichaHistorial({
  log,
  nombreDeEtapa,
  tonoDeEtapa,
}: {
  log: FichaDeEvento[];
  nombreDeEtapa: Record<EtapaDeal, string>;
  tonoDeEtapa: Record<EtapaDeal, TonoEtapa>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Log de eventos</CardTitle>
      </CardHeader>
      {log.length === 0 ? (
        <Vacio>Este deal todavía no tiene eventos registrados.</Vacio>
      ) : (
        <ol className="divide-y">
          {log.map((evento) => {
            const anterior = evento.valorAnterior ?? "—";
            const nuevo = evento.valorNuevo ?? "—";
            const recortar = (valor: string) => (valor.length > 80 ? `${valor.slice(0, 77)}…` : valor);
            return (
              <li key={`${evento.tipo}-${evento.id}`} className="flex min-w-0 flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                {evento.tipo === "etapa" && evento.a ? (
                  <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                    {evento.de ? (
                      <>
                        <Badge variant={tonoDeEtapa[evento.de]}>{nombreDeEtapa[evento.de]}</Badge>
                        <span aria-hidden className="text-muted-foreground">→</span>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">Alta en</span>
                    )}
                    <Badge variant={tonoDeEtapa[evento.a]}>{nombreDeEtapa[evento.a]}</Badge>
                    {evento.motivoNombre ? <span className="text-muted-foreground">· {evento.motivoNombre}</span> : null}
                  </span>
                ) : (
                  <span className="min-w-0 break-words" title={`${evento.tabla}.${evento.campo}: ${anterior} → ${nuevo}`}>
                    <span className="font-medium">{evento.tabla}.{evento.campo}:</span> {recortar(anterior)} → {recortar(nuevo)}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  {evento.porNombre ?? "Sistema"} · {fechaHoraEnBogota(evento.fecha)}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
