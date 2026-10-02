"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import type { FichaDeDeal, OpcionesDeFicha } from "@/lib/queries/ficha-deal";
import { moverDeal } from "@/app/(app)/p/[programa]/deals/acciones";
import { anularDealAccion, editarDealAccion, type EntradaEditarDeal } from "@/app/(app)/p/[programa]/deals/[id]/acciones";
import { DialogoMover, type DatosDialogo } from "../dialogo-mover";
import { flechaPideDatos, flechasDesde, type FlechaCliente, type MapaTransiciones } from "../transiciones";
import { Campo, claseInput, claseTextarea } from "./campos";
import { useAccion } from "./uso-accion";

/**
 * Las acciones del encabezado de la ficha (ticket 074): mover de etapa, editar y anular.
 *
 * - **Mover** reusa el motor y el dialogo del Kanban (`moverDeal`, `DialogoMover`): la ficha no
 *   tiene otro camino para cambiar la etapa. Las flechas del sistema se muestran apagadas.
 * - **Editar** solo ofrece lo que el servidor va a aceptar; la reja de verdad es de
 *   `editarDeal`. La etapa NO se edita aqui (solo `moverEtapa`).
 * - **Anular** deja la diferencia con Cierre Perdido escrita en el dialogo (decision 6):
 *   anular = "me equivoque al registrar" y deja de contar en todo; Cierre Perdido = "el lead
 *   dijo que no" y cuenta en el embudo. Nunca "anular" y "perder" a secas.
 */

export interface FichaAccionesProps {
  ficha: FichaDeDeal;
  opciones: OpcionesDeFicha;
  mapa: MapaTransiciones;
  nombreDeEtapa: Record<EtapaDeal, string>;
  /** Puede mover, editar y anular ESTE deal: su dueño o quien administra (proyeccion, la reja es el servidor). */
  puedeTrabajar: boolean;
  /** Puede reasignar el dueño: quien administra. */
  administra: boolean;
}

export function FichaAcciones({ ficha, opciones, mapa, nombreDeEtapa, puedeTrabajar, administra }: FichaAccionesProps) {
  const router = useRouter();
  const [moviendo, setMoviendo] = useState(false);
  const [dialogoMover, setDialogoMover] = useState<FlechaCliente | null>(null);
  const [editando, setEditando] = useState(false);
  const [anulando, setAnulando] = useState(false);

  // Un deal anulado no se mueve, ni se edita, ni se vuelve a anular.
  if (!puedeTrabajar || ficha.anulado) return null;

  const flechas = flechasDesde(mapa, ficha.etapa);
  const dePersona = flechas.filter((f) => f.quien !== "sistema");
  const deSistema = flechas.filter((f) => f.quien === "sistema");

  async function mover(flecha: FlechaCliente, datos: DatosDialogo) {
    setMoviendo(true);
    const r = await moverDeal({
      dealId: ficha.dealId,
      a: flecha.a,
      motivoId: datos.motivoId ?? null,
      datos: {
        descuentoUsd: datos.descuentoUsd,
        areaDeclaradaId: datos.areaDeclaradaId,
        fechaLimitePago: datos.fechaLimitePago,
        cohorteDestinoId: datos.cohorteDestinoId,
        fechaSeguimiento: datos.fechaSeguimiento,
      },
    });
    setMoviendo(false);
    if (r.ok) {
      toast.success(`Movido a ${nombreDeEtapa[flecha.a]}.`);
      setDialogoMover(null);
      router.refresh();
    } else {
      // Se dice QUE falta, no un generico (ticket 044).
      toast.error(r.faltantes.length > 0 ? r.faltantes.map((f) => f.mensaje).join(" ") : r.error, { duration: 6000 });
    }
  }

  function elegir(flecha: FlechaCliente) {
    if (flechaPideDatos(flecha)) setDialogoMover(flecha);
    else void mover(flecha, {});
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="default" size="default" disabled={moviendo} />}
        >
          {moviendo ? "Moviendo…" : "Mover de etapa"}
          <ChevronDown data-icon="inline-end" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Mover a…</DropdownMenuLabel>
            {dePersona.length > 0 ? (
              dePersona.map((f) => (
                <DropdownMenuItem key={f.a} onClick={() => elegir(f)}>
                  {nombreDeEtapa[f.a]}
                </DropdownMenuItem>
              ))
            ) : (
              <DropdownMenuItem disabled>No hay movimientos a mano</DropdownMenuItem>
            )}
          </DropdownMenuGroup>
          {deSistema.length > 0 ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel>Los pone el sistema</DropdownMenuLabel>
                {deSistema.map((f) => (
                  <DropdownMenuItem key={f.a} disabled>
                    {nombreDeEtapa[f.a]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <Button variant="outline" onClick={() => setEditando(true)}>
        Editar
      </Button>
      <Button variant="destructive" onClick={() => setAnulando(true)}>
        Anular deal
      </Button>

      {dialogoMover ? (
        <DialogoMover
          abierto
          onAbrir={(v) => {
            if (!v) setDialogoMover(null);
          }}
          flecha={dialogoMover}
          etapaDestinoNombre={nombreDeEtapa[dialogoMover.a]}
          nombreLead={ficha.lead.nombre ?? ficha.lead.email}
          areas={opciones.areas}
          cohortes={opciones.cohortes}
          motivos={opciones.motivos}
          fechaLimiteSugerida={ficha.fechaLimiteSugerida}
          pendiente={moviendo}
          onConfirmar={(datos) => void mover(dialogoMover, datos)}
        />
      ) : null}

      {editando ? (
        <DialogoEditar ficha={ficha} opciones={opciones} administra={administra} onCerrar={() => setEditando(false)} />
      ) : null}
      {anulando ? <DialogoAnular ficha={ficha} onCerrar={() => setAnulando(false)} /> : null}
    </div>
  );
}

// ───────────────────────────────────────────── editar

function DialogoEditar({
  ficha,
  opciones,
  administra,
  onCerrar,
}: {
  ficha: FichaDeDeal;
  opciones: OpcionesDeFicha;
  administra: boolean;
  onCerrar: () => void;
}) {
  const { pendiente, correr } = useAccion();
  const [descuentoUsd, setDescuentoUsd] = useState(String(ficha.descuento?.usd ?? 0));
  const [motivoCambioVenta, setMotivoCambioVenta] = useState("");
  const [areaDeclaradaId, setAreaDeclaradaId] = useState<string | null>(ficha.areaDeclarada?.id ?? null);
  const [ownerId, setOwnerId] = useState<string | null>(ficha.owner?.id ?? null);
  const [seguimiento, setSeguimiento] = useState<string>(ficha.fechaSeguimiento ?? "");
  const [motivoId, setMotivoId] = useState<string | null>(ficha.motivo?.id ?? null);

  const cerrado = ficha.etapa === "completo" || ficha.etapa === "cierre_perdido";
  const muestraMotivo = ficha.etapa === "cierre_perdido";
  const motivosDePerdida = opciones.motivos.filter((m) => m.tipo === "perdida");

  // Solo viaja lo que cambio: el servidor escribe un renglon de bitacora por campo tocado.
  const entrada: EntradaEditarDeal = { dealId: ficha.dealId };
  const descuentoNormalizado = Number(descuentoUsd);
  const cambioDescuento = Number.isFinite(descuentoNormalizado) && descuentoNormalizado !== (ficha.descuento?.usd ?? 0);
  if (cambioDescuento) {
    entrada.descuentoUsd = descuentoNormalizado;
    if (ficha.vendido && motivoCambioVenta.trim()) entrada.motivoCambioVenta = motivoCambioVenta;
  }
  if (areaDeclaradaId && areaDeclaradaId !== ficha.areaDeclarada?.id) entrada.areaDeclaradaId = areaDeclaradaId;
  if (administra && ownerId && ownerId !== ficha.owner?.id) entrada.ownerUserId = ownerId;
  if (!cerrado && seguimiento !== (ficha.fechaSeguimiento ?? "")) entrada.fechaSeguimiento = seguimiento || null;
  if (muestraMotivo && motivoId && motivoId !== ficha.motivo?.id) entrada.motivoId = motivoId;
  const hayCambios = Object.keys(entrada).length > 1;

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar deal</DialogTitle>
          <DialogDescription>
            Corrige un dato mal puesto. Cada cambio queda en el historial con quién lo hizo. El acuerdo de pago y la
            cohorte se editan en su tarjeta; la etapa solo se cambia con “Mover de etapa”.
          </DialogDescription>
        </DialogHeader>

        <div className="min-w-0 space-y-3">
          <Campo etiqueta="Descuento (USD)">
            <Input
              type="number"
              min="0"
              max="99999999.99"
              step="0.01"
              value={descuentoUsd}
              onChange={(e) => setDescuentoUsd(e.currentTarget.value)}
            />
          </Campo>

          {ficha.vendido ? (
            <Campo etiqueta="Motivo del cambio" ayuda="Obligatorio si cambias el descuento de una venta.">
              <textarea
                className={claseTextarea}
                value={motivoCambioVenta}
                onChange={(e) => setMotivoCambioVenta(e.target.value)}
              />
            </Campo>
          ) : null}

          <Campo etiqueta="Área de origen (según el closer)">
            <Select
              value={areaDeclaradaId}
              items={opciones.areas.map((a) => ({ value: a.id, label: a.nombre }))}
              onValueChange={(v: string | null) => setAreaDeclaradaId(v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Elige un área" />
              </SelectTrigger>
              <SelectContent>
                {opciones.areas.map((a) => <SelectItem key={a.id} value={a.id}>{a.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
          </Campo>

          {administra ? (
            <Campo etiqueta="Dueño del deal" ayuda="Reasignar el trabajo de otro es de quien administra.">
              <Select
                value={ownerId}
                items={opciones.owners.map((o) => ({ value: o.id, label: o.nombre }))}
                onValueChange={(v: string | null) => setOwnerId(v)}
              >
                <SelectTrigger className="w-full min-w-0">
                  <SelectValue className="min-w-0 truncate" placeholder="Elige un closer" />
                </SelectTrigger>
                <SelectContent>
                  {opciones.owners.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>
          ) : null}

          {!cerrado ? (
            <Campo etiqueta="Fecha de seguimiento">
              <input type="date" className={claseInput} value={seguimiento} onChange={(e) => setSeguimiento(e.target.value)} />
            </Campo>
          ) : null}

          {muestraMotivo ? (
            <Campo etiqueta="Motivo del Cierre Perdido">
              <Select
                value={motivoId}
                items={motivosDePerdida.map((m) => ({ value: m.id, label: m.nombre }))}
                onValueChange={(v: string | null) => setMotivoId(v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Elige un motivo" />
                </SelectTrigger>
                <SelectContent>
                  {motivosDePerdida.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>
          ) : null}

        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onCerrar} disabled={pendiente}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={pendiente || !hayCambios || (ficha.vendido && cambioDescuento && motivoCambioVenta.trim() === "")}
            onClick={() => correr(() => editarDealAccion(entrada), { exito: "Deal actualizado.", alExito: onCerrar })}
          >
            {pendiente ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ───────────────────────────────────────────── anular

function DialogoAnular({ ficha, onCerrar }: { ficha: FichaDeDeal; onCerrar: () => void }) {
  const { pendiente, correr } = useAccion();
  const [motivo, setMotivo] = useState("");
  const abonos = ficha.saldo.abonosVigentes;
  const bloqueado = abonos > 0;

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Anular este deal</DialogTitle>
          <DialogDescription>
            Anular es para cuando <strong>te equivocaste al registrar este deal</strong>: deja de contar en todas las
            métricas.
          </DialogDescription>
        </DialogHeader>

        <div className="min-w-0 space-y-3">
          <p className="rounded-lg bg-tono-info-suave p-3 text-sm text-tono-info">
            ¿El lead dijo que no? No lo anules: muévelo a <strong>Cierre Perdido</strong>. Ese sí cuenta en el embudo.
          </p>

          {bloqueado ? (
            <p className="rounded-lg bg-tono-alerta-suave p-3 text-sm text-tono-alerta">
              Este deal tiene {abonos} {abonos === 1 ? "abono vigente" : "abonos vigentes"}. Anula primero los abonos
              (el dinero no desaparece en silencio) y luego el deal.
            </p>
          ) : (
            <Campo etiqueta="¿Por qué se anula?" ayuda="Obligatorio. Queda escrito con tu nombre.">
              <textarea
                className={claseTextarea}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ej.: lo registré sobre el lead equivocado"
              />
            </Campo>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onCerrar} disabled={pendiente}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={pendiente || bloqueado || motivo.trim().length < 5}
            onClick={() =>
              correr(() => anularDealAccion({ dealId: ficha.dealId, motivo }), {
                exito: "Deal anulado: ya no cuenta en ninguna métrica.",
                alExito: onCerrar,
              })
            }
          >
            {pendiente ? "Anulando…" : "Anular deal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
