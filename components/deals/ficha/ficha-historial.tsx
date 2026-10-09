import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { fechaHoraEnBogota } from "@/lib/format";
import type { EtapaDeal } from "@/lib/deals/etapas";
import type { FichaDeEvento } from "@/lib/queries/ficha-deal";
import type { TonoEtapa } from "../etapa-tono";
import { Vacio } from "./campos";

/** El objeto y su accion con la concordancia del espanol ("Llamada creada", no "Llamada creado"). */
const ACCION_DE_OBJETO: Record<string, Record<"creado" | "editado", string>> = {
  deals: { creado: "Deal creado", editado: "Deal editado" },
  calls: { creado: "Llamada creada", editado: "Llamada editada" },
  abonos: { creado: "Abono creado", editado: "Abono editado" },
  deal_actividades: { creado: "Actividad creada", editado: "Actividad editada" },
};

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
            const recortar = (valor: string) => (valor.length > 80 ? `${valor.slice(0, 77)}…` : valor);
            return (
              <li key={`${evento.tipo}-${evento.id}`} className="flex min-w-0 flex-wrap justify-between gap-2 px-4 py-3 text-sm">
                {evento.tipo === "etapa" ? (
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
                  <div className="min-w-0">
                    <p className="break-words font-medium">
                      {ACCION_DE_OBJETO[evento.tabla]?.[evento.accion] ?? `${evento.tabla} ${evento.accion}`}
                      {evento.accion === "editado" ? ` · ${evento.campos.map((campo) => campo.campo).join(", ")}` : null}
                    </p>
                    <details className="mt-1 text-xs text-muted-foreground">
                      <summary className="w-fit cursor-pointer rounded-sm transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                        Ver campos
                      </summary>
                      <ul className="mt-1 space-y-1">
                        {evento.campos.map((campo, indice) => {
                          const anterior = campo.valorAnterior ?? "—";
                          const nuevo = campo.valorNuevo ?? "—";
                          return (
                            <li key={`${campo.campo}-${indice}`} className="break-words">
                              <span className="font-medium text-foreground">{campo.campo}:</span>{" "}
                              <span title={anterior}>{recortar(anterior)}</span> → <span title={nuevo}>{recortar(nuevo)}</span>
                            </li>
                          );
                        })}
                      </ul>
                    </details>
                  </div>
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
