"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { fechaHoraEnBogota } from "@/lib/format";
import type { EtapaDeal } from "@/lib/deals/etapas";
import type { FichaDeEvento } from "@/lib/queries/ficha-deal";
import type { TonoEtapa } from "../etapa-tono";
import { Vacio } from "./campos";
import { DialogoDeshacer, type EventoParaDeshacer } from "./dialogo-deshacer";

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
  dealId,
  log,
  destinosDeCorreccion,
  nombreDeEtapa,
  tonoDeEtapa,
}: {
  dealId: string;
  log: FichaDeEvento[];
  destinosDeCorreccion: { etapa: EtapaDeal; nombre: string }[];
  nombreDeEtapa: Record<EtapaDeal, string>;
  tonoDeEtapa: Record<EtapaDeal, TonoEtapa>;
}) {
  const [seleccion, setSeleccion] = useState<{
    evento: EventoParaDeshacer;
    cambios: { etiqueta: string; ahora: string | null; quedaria: string | null }[];
    destinoPreferido: EtapaDeal | null;
  } | null>(null);
  return (
    <>
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
                <div className="flex min-w-0 flex-1 flex-wrap items-start gap-2">
                {evento.tipo === "etapa" ? (
                  <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                    {evento.esDeshacer ? <span className="font-medium">Deshacer:</span> : null}
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
                      {evento.esDeshacer ? "Deshacer: " : null}
                      {evento.titulo ?? (
                        <>
                          {ACCION_DE_OBJETO[evento.tabla]?.[evento.accion] ?? `${evento.tabla} ${evento.accion}`}
                          {evento.accion === "editado" ? ` · ${evento.campos.map((campo) => campo.etiqueta ?? campo.campo).join(", ")}` : null}
                        </>
                      )}
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
                              <span className="font-medium text-foreground">{campo.etiqueta ?? campo.campo}:</span>{" "}
                              <span title={anterior}>{recortar(anterior)}</span> → <span title={nuevo}>{recortar(nuevo)}</span>
                            </li>
                          );
                        })}
                      </ul>
                    </details>
                  </div>
                )}
                {evento.deshecho ? (
                  <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <Badge variant="neutro">Deshecho</Badge>
                    por {evento.deshecho.porNombre ?? "Sistema"}, {fechaHoraEnBogota(evento.deshecho.fecha)}
                    {evento.deshecho.motivo ? ` · ${evento.deshecho.motivo}` : null}
                  </span>
                ) : null}
                {evento.deshacer?.puede && !evento.esDeshacer ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSeleccion({
                      evento: evento.tipo === "etapa"
                        ? { tipo: "etapa", id: evento.id, a: evento.de ?? evento.a }
                        : { tipo: "cambio", changeLogId: evento.id },
                      cambios: evento.deshacer!.cambios,
                      destinoPreferido: evento.tipo === "etapa" ? evento.de : null,
                    })}
                  >
                    Deshacer
                  </Button>
                ) : null}
                </div>
                <span className="text-xs text-muted-foreground">
                  {evento.porNombre ?? "Sistema"} · {fechaHoraEnBogota(evento.fecha)}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
    {seleccion ? (
      <DialogoDeshacer
        abierto
        onAbrir={(abierto) => !abierto && setSeleccion(null)}
        dealId={dealId}
        evento={seleccion.evento}
        cambios={seleccion.cambios}
        destinos={seleccion.evento.tipo === "etapa" ? destinosDeCorreccion : []}
        destinoPreferido={seleccion.destinoPreferido}
      />
    ) : null}
    </>
  );
}
