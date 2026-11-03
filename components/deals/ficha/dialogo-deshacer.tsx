"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { EtapaDeal } from "@/lib/deals/etapas";
import { deshacerEventoAccion } from "@/app/(app)/p/[programa]/deals/[id]/acciones";
import { Campo, claseTextarea } from "./campos";

export type EventoParaDeshacer =
  | { tipo: "cambio"; changeLogId: string }
  | { tipo: "etapa"; id: string | null; a: EtapaDeal };

export interface CambioParaDeshacer {
  etiqueta: string;
  ahora: string | null;
  quedaria: string | null;
}

export function DialogoDeshacer({
  abierto,
  onAbrir,
  dealId,
  evento,
  cambios,
  destinos = [],
  destinoPreferido = null,
  titulo = "Deshacer",
  onExito,
}: {
  abierto: boolean;
  onAbrir: (abierto: boolean) => void;
  dealId: string;
  evento: EventoParaDeshacer;
  cambios: CambioParaDeshacer[];
  destinos?: { etapa: EtapaDeal; nombre: string }[];
  destinoPreferido?: EtapaDeal | null;
  titulo?: "Deshacer" | "Corregir etapa";
  onExito?: () => void;
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const primerDestino = destinos.some((destino) => destino.etapa === destinoPreferido)
    ? destinoPreferido
    : (destinos[0]?.etapa ?? null);
  // Lo elegido se guarda aparte del destino propuesto: el mismo diálogo sirve a eventos distintos,
  // y al cerrarse vuelve a proponer el del evento que lo abra.
  const [destinoElegido, setDestino] = useState<EtapaDeal | null>(null);
  const destino = destinoElegido ?? primerDestino;

  function cambiarApertura(abrir: boolean) {
    if (!abrir) {
      setMotivo("");
      setError(null);
      setDestino(null);
    }
    onAbrir(abrir);
  }

  const cambiosVisibles = destinos.length > 0 && destino
    ? cambios.map((cambio, indice) => indice === 0
      ? { ...cambio, quedaria: destinos.find((opcion) => opcion.etapa === destino)?.nombre ?? cambio.quedaria }
      : cambio)
    : cambios;

  function confirmar() {
    const entrada = evento.tipo === "etapa"
      ? { dealId, evento: { ...evento, a: destino ?? evento.a }, motivo }
      : { dealId, evento, motivo };
    iniciar(async () => {
      setError(null);
      const resultado = await deshacerEventoAccion(entrada);
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }
      cambiarApertura(false);
      onExito?.();
      router.refresh();
    });
  }

  return (
    <Dialog open={abierto} onOpenChange={cambiarApertura}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>Revisa cómo quedará el deal antes de confirmar.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {destinos.length > 0 ? (
            <Campo etiqueta="Etapa de destino">
              <Select
                value={destino}
                items={destinos.map((opcion) => ({ value: opcion.etapa, label: opcion.nombre }))}
                onValueChange={(valor: EtapaDeal | null) => setDestino(valor)}
              >
                <SelectTrigger className="w-full"><SelectValue placeholder="Elige la etapa" /></SelectTrigger>
                <SelectContent>
                  {destinos.map((opcion) => <SelectItem key={opcion.etapa} value={opcion.etapa}>{opcion.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </Campo>
          ) : null}

          <ul className="space-y-1 text-sm">
            {cambiosVisibles.map((cambio, indice) => (
              <li key={`${cambio.etiqueta}-${indice}`} className="break-words">
                <span className="font-medium">{cambio.etiqueta}:</span>{" "}
                <span>{cambio.ahora ?? "—"}</span>{" "}
                <span aria-hidden className="text-muted-foreground">→</span>{" "}
                <span>{cambio.quedaria ?? "—"}</span>
              </li>
            ))}
          </ul>

          <Campo etiqueta="Motivo (opcional)">
            <textarea
              className={claseTextarea}
              value={motivo}
              maxLength={500}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </Campo>
          {error ? <p className="text-sm text-tono-peligro">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => cambiarApertura(false)} disabled={pendiente}>Cancelar</Button>
          <Button type="button" variant="destructive" onClick={confirmar} disabled={pendiente || (destinos.length > 0 && !destino)}>
            {pendiente ? "Deshaciendo…" : "Deshacer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
