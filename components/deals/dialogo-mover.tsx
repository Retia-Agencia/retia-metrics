"use client";

import { useState } from "react";
import { monto } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CodigoRequisito } from "@/lib/deals/requisitos";
import type { FlechaCliente } from "./transiciones";
import { camposDeDialogo } from "./transiciones";
import type { OpcionCatalogo } from "@/lib/queries/kanban";

/**
 * El dialogo que recoge lo que una flecha PIDE antes de mover (ticket 069, como en
 * HubSpot): producto, fecha limite de pago, cohorte destino, fecha de seguimiento y/o
 * motivo. Lo recogido se manda en `datos`/`motivoId` en la MISMA server action, asi que
 * el motor lo escribe en una sola transaccion (`moverEtapa`).
 *
 * El motivo se filtra por el TIPO que la flecha pide (`tipoDeMotivo`): un motivo de
 * perdida no sirve para una re-agenda. La reja real la vuelve a aplicar el motor.
 */

export interface DatosDialogo {
  productoId?: string | null;
  fechaLimitePago?: string | null;
  cohorteDestinoId?: string | null;
  fechaSeguimiento?: string | null;
  motivoId?: string | null;
}

export interface DialogoMoverProps {
  abierto: boolean;
  onAbrir: (abierto: boolean) => void;
  flecha: FlechaCliente;
  etapaDestinoNombre: string;
  nombreLead: string;
  productos: (OpcionCatalogo & { moneda: string; precio: string })[];
  cohortes: OpcionCatalogo[];
  /** Motivos activos con su tipo; el dialogo filtra por el tipo de la flecha. */
  motivos: { id: string; nombre: string; tipo: string }[];
  pendiente: boolean;
  onConfirmar: (datos: DatosDialogo) => void;
}

const ETIQUETA: Record<CodigoRequisito, string> = {
  producto: "Producto",
  fecha_limite_pago: "Fecha límite de pago",
  cohorte_destino: "Cohorte a la que quiere entrar",
  fecha_seguimiento: "Fecha de seguimiento",
  motivo: "Motivo",
  transicion_no_permitida: "",
  dueno: "",
  contacto: "",
  llamada_con_fecha: "",
  llamada_sucedio: "",
  llamada_fallida: "",
  abono: "",
  comprobante: "",
  saldo_pendiente: "",
  saldo_en_cero: "",
  sin_abonos: "",
};

const claseInput =
  "h-8 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function DialogoMover({
  abierto,
  onAbrir,
  flecha,
  etapaDestinoNombre,
  nombreLead,
  productos,
  cohortes,
  motivos,
  pendiente,
  onConfirmar,
}: DialogoMoverProps) {
  const campos = camposDeDialogo(flecha);
  const [datos, setDatos] = useState<DatosDialogo>({});

  const motivosDeLaFlecha = flecha.tipoDeMotivo
    ? motivos.filter((m) => m.tipo === flecha.tipoDeMotivo)
    : motivos;

  // Todo campo pedido tiene que estar lleno para confirmar.
  const completo = campos.every((c) => {
    if (c === "producto") return Boolean(datos.productoId);
    if (c === "fecha_limite_pago") return Boolean(datos.fechaLimitePago);
    if (c === "cohorte_destino") return Boolean(datos.cohorteDestinoId);
    if (c === "fecha_seguimiento") return Boolean(datos.fechaSeguimiento);
    if (c === "motivo") return Boolean(datos.motivoId);
    return true;
  });

  return (
    <Dialog
      open={abierto}
      onOpenChange={(v) => {
        onAbrir(v);
        if (!v) setDatos({});
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mover a {etapaDestinoNombre}</DialogTitle>
          <DialogDescription>
            {nombreLead}. Completa lo que pide esta etapa.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {campos.map((campo) => (
            <div key={campo} className="space-y-1">
              <label className="block text-xs font-medium text-muted-foreground">{ETIQUETA[campo]}</label>

              {campo === "producto" ? (
                <Select
                  value={datos.productoId ?? null}
                  items={productos.map((p) => ({ value: p.id, label: `${p.nombre} · ${monto(Number(p.precio), p.moneda)}` }))}
                  onValueChange={(v: string | null) => setDatos((d) => ({ ...d, productoId: v }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Elige un producto" />
                  </SelectTrigger>
                  <SelectContent>
                    {productos.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nombre} · {monto(Number(p.precio), p.moneda)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}

              {campo === "cohorte_destino" ? (
                <Select
                  value={datos.cohorteDestinoId ?? null}
                  items={cohortes.map((c) => ({ value: c.id, label: c.nombre }))}
                  onValueChange={(v: string | null) => setDatos((d) => ({ ...d, cohorteDestinoId: v }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Elige la cohorte" />
                  </SelectTrigger>
                  <SelectContent>
                    {cohortes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}

              {campo === "motivo" ? (
                <Select
                  value={datos.motivoId ?? null}
                  items={motivosDeLaFlecha.map((m) => ({ value: m.id, label: m.nombre }))}
                  onValueChange={(v: string | null) => setDatos((d) => ({ ...d, motivoId: v }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Elige un motivo" />
                  </SelectTrigger>
                  <SelectContent>
                    {motivosDeLaFlecha.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}

              {campo === "fecha_limite_pago" ? (
                <input
                  type="date"
                  className={claseInput}
                  value={datos.fechaLimitePago ?? ""}
                  onChange={(e) => setDatos((d) => ({ ...d, fechaLimitePago: e.target.value || null }))}
                />
              ) : null}

              {campo === "fecha_seguimiento" ? (
                <input
                  type="date"
                  className={claseInput}
                  value={datos.fechaSeguimiento ?? ""}
                  onChange={(e) => setDatos((d) => ({ ...d, fechaSeguimiento: e.target.value || null }))}
                />
              ) : null}
            </div>
          ))}

          {campos.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Esta etapa no pide datos: confirma para mover.
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onAbrir(false)} disabled={pendiente}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => onConfirmar(datos)} disabled={pendiente || !completo}>
            {pendiente ? "Moviendo…" : "Mover"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
