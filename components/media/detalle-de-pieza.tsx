"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { descartarPiezaAccion, marcarPublicadaAccion } from "@/app/(app)/media/acciones";
import { BadgeDeEstado, fechaLegible } from "./estado-de-pieza";
import { BloqueDeLink, DialogoDeMedia, useAccionDeMedia } from "./dialogo-de-media";
import type { PiezaVista } from "./tipos";

/** El pop-up de una pieza: sus datos, su link con el UTM desglosado y las dos acciones (publicar, descartar). */
export function DetalleDePieza({ pieza, onCerrar }: { pieza: PiezaVista; onCerrar: () => void }) {
  const { pendiente, correr } = useAccionDeMedia();
  const [descartando, setDescartando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const publicada = pieza.estado === "publicada";

  return (
    <DialogoDeMedia titulo={pieza.nombre} descripcion={`${pieza.creador} · ${pieza.tipo} · ${pieza.red} · ${pieza.programa ?? "sin programa"}`} onCerrar={onCerrar}>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Estado</dt>
          <dd><BadgeDeEstado estado={pieza.estado} /></dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Publicación</dt>
          <dd>{pieza.permanente ? "Siempre visible" : fechaLegible(pieza.fecha)}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-xs text-muted-foreground">Llamado a la acción</dt>
          <dd>{pieza.cta ?? "—"}</dd>
        </div>
      </dl>

      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">Link de la pieza</p>
        {pieza.link.ok ? <BloqueDeLink url={pieza.link.url} desglose={pieza.link.desglose} /> : <p className="text-sm text-muted-foreground">{pieza.link.motivo}</p>}
      </div>

      {descartando ? (
        <div className="space-y-2">
          <label className="block space-y-1">
            <span className="block text-xs font-medium text-muted-foreground">¿Por qué se descarta?</span>
            <textarea
              className="min-h-20 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </label>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setDescartando(false)}>Volver</Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pendiente || motivo.trim() === ""}
              onClick={() => correr(() => descartarPiezaAccion(pieza.id, motivo.trim()), "Pieza descartada", onCerrar)}
            >
              Descartar pieza
            </Button>
          </DialogFooter>
        </div>
      ) : (
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setDescartando(true)}>Descartar</Button>
          {publicada ? null : (
            <Button type="button" disabled={pendiente} onClick={() => correr(() => marcarPublicadaAccion(pieza.id), "Marcada como publicada", onCerrar)}>
              Ya publiqué
            </Button>
          )}
        </DialogFooter>
      )}
    </DialogoDeMedia>
  );
}
