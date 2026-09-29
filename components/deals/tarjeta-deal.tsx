"use client";

import Link from "next/link";
import { GripVertical, MoreVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { usd } from "@/lib/format";
import type { EtapaDeal } from "@/lib/deals/etapas";
import type { TarjetaDeal } from "@/lib/queries/kanban";
import type { FlechaCliente, MapaTransiciones } from "./transiciones";
import { flechasDesde } from "./transiciones";

/**
 * Una tarjeta de deal en el Kanban (ticket 069). Muestra el lead, el dueño, el
 * producto, el saldo (USD con dos decimales y su moneda, `lib/format.ts`), los días en
 * la etapa y los avisos como `<Badge variant>` (nada de colores a mano, §9).
 *
 * Arrastrable con HTML5 nativo (sin dependencia nueva). Además, un menú "Mover a…" para
 * celular y teclado, que lista SOLO las flechas que una persona puede tomar; las del
 * sistema se muestran deshabilitadas con su razón (no se mueven a mano).
 */

export interface TarjetaDealProps {
  tarjeta: TarjetaDeal;
  mapa: MapaTransiciones;
  nombreDeEtapa: Record<EtapaDeal, string>;
  programaSlug: string;
  arrastrando: boolean;
  /**
   * Si esta sesion puede mover ESTE deal (dueño o administrador). Es proyeccion, no
   * reja: la reja es `moverEtapa`, que rechaza igual una peticion forjada. Sirve para
   * no ofrecer un arrastre que el servidor va a rechazar.
   */
  puedeMover: boolean;
  onArrastrarInicio: () => void;
  onArrastrarFin: () => void;
  onElegirDestino: (flecha: FlechaCliente) => void;
}

export function TarjetaDealCard({
  tarjeta,
  mapa,
  nombreDeEtapa,
  programaSlug,
  arrastrando,
  puedeMover,
  onArrastrarInicio,
  onArrastrarFin,
  onElegirDestino,
}: TarjetaDealProps) {
  const flechas = flechasDesde(mapa, tarjeta.etapa);
  const dePersona = flechas.filter((f) => f.quien !== "sistema");
  const deSistema = flechas.filter((f) => f.quien === "sistema");

  const avisos = tarjeta.avisos;
  const saldoTexto = tarjeta.saldo != null ? usd(tarjeta.saldo) : null;

  return (
    <div
      draggable={puedeMover}
      title={puedeMover ? undefined : "Solo su dueño o un administrador lo mueven."}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", tarjeta.dealId);
        onArrastrarInicio();
      }}
      onDragEnd={onArrastrarFin}
      data-deal-id={tarjeta.dealId}
      className={cn(
        "group rounded-lg bg-card p-3 shadow-tarjeta transition-[transform,opacity] duration-150 motion-reduce:transition-none",
        arrastrando ? "scale-95 opacity-60" : "opacity-100",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-1.5">
          {puedeMover ? (
            <GripVertical className="mt-0.5 size-4 shrink-0 cursor-grab text-muted-foreground" aria-hidden />
          ) : null}
          <div className="min-w-0">
            <Link
              href={`/p/${programaSlug}/deals/${tarjeta.dealId}`}
              className="block truncate text-sm font-medium outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            >
              {tarjeta.nombreLead ?? tarjeta.emailLead}
            </Link>
            <p className="truncate text-xs text-muted-foreground">
              {tarjeta.ownerNombre ?? "Sin dueño"}
            </p>
          </div>
        </div>

        {puedeMover ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Mover a…"
            className="grid size-7 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors duration-150 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
          >
            <MoreVertical className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Mover a…</DropdownMenuLabel>
              {dePersona.length > 0 ? (
                dePersona.map((f) => (
                  <DropdownMenuItem key={f.a} onClick={() => onElegirDestino(f)}>
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
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {tarjeta.leadQuality ? <Badge variant="info">Calidad: {tarjeta.leadQuality}</Badge> : null}
        {tarjeta.leadValue ? <Badge variant="neutro">Valor: {tarjeta.leadValue}</Badge> : null}
        {tarjeta.productoNombre ? (
          <span className="truncate text-xs text-muted-foreground">{tarjeta.productoNombre}</span>
        ) : null}
        {saldoTexto ? (
          <span className="cifra text-xs text-muted-foreground">
            {saldoTexto}
          </span>
        ) : null}
        <span className="cifra text-xs text-muted-foreground">
          {tarjeta.diasEnEtapa} {tarjeta.diasEnEtapa === 1 ? "día" : "días"}
        </span>
      </div>

      {tieneAvisos(avisos) ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {avisos.compromisoVencido ? <Badge variant="peligro">Compromiso vencido</Badge> : null}
          {avisos.carteraVencida ? <Badge variant="peligro">Cartera vencida</Badge> : null}
          {avisos.seguimientoVencido ? <Badge variant="alerta">Seguimiento vencido</Badge> : null}
          {avisos.leadUnidoPorTelefono ? <Badge variant="info">Unido por teléfono</Badge> : null}
        </div>
      ) : null}
    </div>
  );
}

function tieneAvisos(a: TarjetaDeal["avisos"]): boolean {
  return a.compromisoVencido || a.carteraVencida || a.seguimientoVencido || a.leadUnidoPorTelefono;
}
