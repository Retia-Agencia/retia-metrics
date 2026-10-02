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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { usd } from "@/lib/format";
import type { PendienteDeal } from "@/lib/deals/etapas";
import { TONO_DE_PENDIENTE } from "./etapa-tono";
import type { TarjetaDeal } from "@/lib/queries/kanban";
import { PREGUNTA_DE_ETAPA, respuestasDe, type Respuesta } from "./pregunta-de-etapa";

/**
 * Una tarjeta de deal en el Kanban (ticket 069). Muestra el lead, el dueño, el
 * saldo (USD con dos decimales y su moneda, `lib/format.ts`), los días en
 * la etapa y los avisos como `<Badge variant>` (nada de colores a mano, §9).
 *
 * Arrastrable con HTML5 nativo (sin dependencia nueva). Además, para celular y teclado,
 * un menú con la pregunta de su etapa y sus respuestas (ADR 0072), las mismas de la ficha.
 */

export interface TarjetaDealProps {
  tarjeta: TarjetaDeal;
  /** Los nombres de los pendientes, del servidor: `lib/deals/etapas.ts` no entra al bundle. */
  nombreDePendiente: Record<PendienteDeal, string>;
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
  onElegirRespuesta: (r: Respuesta) => void;
}

export function TarjetaDealCard({
  tarjeta,
  nombreDePendiente,
  programaSlug,
  arrastrando,
  puedeMover,
  onArrastrarInicio,
  onArrastrarFin,
  onElegirRespuesta,
}: TarjetaDealProps) {
  const respuestas = respuestasDe(tarjeta.etapa, tarjeta.pendiente);

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

        {puedeMover && respuestas.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Siguiente paso"
              className="grid size-7 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors duration-150 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
            >
              <MoreVertical className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuLabel>{PREGUNTA_DE_ETAPA[tarjeta.etapa].pregunta ?? "Siguiente paso"}</DropdownMenuLabel>
                {respuestas.map((r) => (
                  <DropdownMenuItem key={r.id} onClick={() => onElegirRespuesta(r)}>
                    {r.etiqueta}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {tarjeta.pendiente ? (
          <Badge variant={TONO_DE_PENDIENTE[tarjeta.pendiente]}>{nombreDePendiente[tarjeta.pendiente]}</Badge>
        ) : null}
        {tarjeta.leadQuality ? <Badge variant="info">Calidad: {tarjeta.leadQuality}</Badge> : null}
        {tarjeta.leadValue ? <Badge variant="neutro">Valor: {tarjeta.leadValue}</Badge> : null}
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
