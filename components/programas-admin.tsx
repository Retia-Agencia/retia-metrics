"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * El formulario de un programa (ticket 014; desde el 171 vive en el pop-up "Editar" de
 * la tab Programa). El slug no se puede cambiar despues de creado, asi que al editar el
 * campo queda bloqueado. Las mutaciones son server actions que ya enforzan
 * `requireRole("gerente")` en el servidor.
 */

export interface ProgramaVista {
  id: string;
  slug: string;
  nombre: string;
  ticketUsd: string;
  /** Porcentaje vigente; se congela en el deal al vender. */
  comisionPorcentaje: string | null;
  webUrl: string | null;
  calendlyUrl: string | null;
  diasSinActividad: number;
  /** Corte de la escalera de conversion, en dias habiles; nulo = sin definir. */
  cortePagoRapidoDias: number | null;
  activo: boolean;
}

export interface Borrador {
  nombre: string;
  slug: string;
  ticketUsd: string;
  comisionPorcentaje: string;
  webUrl: string;
  calendlyUrl: string;
  diasSinActividad: string;
  cortePagoRapidoDias: string;
}

export function aBorrador(p: ProgramaVista): Borrador {
  return {
    nombre: p.nombre,
    slug: p.slug,
    ticketUsd: p.ticketUsd,
    comisionPorcentaje: p.comisionPorcentaje ?? "",
    webUrl: p.webUrl ?? "",
    calendlyUrl: p.calendlyUrl ?? "",
    diasSinActividad: String(p.diasSinActividad),
    cortePagoRapidoDias: p.cortePagoRapidoDias == null ? "" : String(p.cortePagoRapidoDias),
  };
}

/** Convierte el borrador del formulario a la entrada que espera la server action. */
export function aEntrada(b: Borrador) {
  return {
    nombre: b.nombre,
    slug: b.slug,
    ticketUsd: b.ticketUsd,
    comisionPorcentaje: b.comisionPorcentaje,
    webUrl: b.webUrl,
    calendlyUrl: b.calendlyUrl,
    diasSinActividad: b.diasSinActividad || undefined,
    cortePagoRapidoDias: b.cortePagoRapidoDias,
  };
}

export function FormularioPrograma({
  inicial,
  pendiente,
  slugBloqueado,
  onCancelar,
  onGuardar,
}: {
  inicial: Borrador;
  pendiente: boolean;
  slugBloqueado?: boolean;
  onCancelar: () => void;
  onGuardar: (borrador: Borrador) => void;
}) {
  const [borrador, setBorrador] = useState<Borrador>(inicial);

  const claseInput =
    "h-8 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        onGuardar(borrador);
      }}
    >
      <label className="block space-y-1 text-sm">
        <span className="text-muted-foreground">Nombre</span>
        <input
          value={borrador.nombre}
          onChange={(e) => setBorrador({ ...borrador, nombre: e.target.value })}
          maxLength={120}
          required
          className={claseInput}
          aria-label="Nombre"
        />
      </label>

      <label className="block space-y-1 text-sm">
        <span className="text-muted-foreground">
          Slug {slugBloqueado ? "(El slug no se cambia: está en los enlaces)" : "(minúsculas, números y guiones)"}
        </span>
        <input
          value={borrador.slug}
          onChange={(e) => setBorrador({ ...borrador, slug: e.target.value })}
          disabled={slugBloqueado}
          maxLength={60}
          required
          className={claseInput}
          aria-label="Slug"
        />
      </label>

      <label className="block space-y-1 text-sm">
        <span className="text-muted-foreground">Ticket (USD)</span>
        <input
          value={borrador.ticketUsd}
          onChange={(e) => setBorrador({ ...borrador, ticketUsd: e.target.value })}
          inputMode="decimal"
          required
          className={claseInput}
          aria-label="Ticket en USD"
        />
      </label>

      <label className="block space-y-1 text-sm">
        <span className="text-muted-foreground">Estancado tras N días</span>
        <input
          type="number"
          min="1"
          step="1"
          value={borrador.diasSinActividad}
          onChange={(e) => setBorrador({ ...borrador, diasSinActividad: e.target.value })}
          required
          className={claseInput}
          aria-label="Días sin actividad"
        />
      </label>

      <label className="block space-y-1 text-sm">
        <span className="text-muted-foreground">Pago rápido: hasta N días hábiles tras la cita</span>
        <input
          type="number"
          min="1"
          step="1"
          value={borrador.cortePagoRapidoDias}
          onChange={(e) => setBorrador({ ...borrador, cortePagoRapidoDias: e.target.value })}
          placeholder="Sin definir"
          className={claseInput}
          aria-label="Corte de pago rápido en días hábiles"
        />
      </label>

      <label className="block space-y-1 text-sm">
        <span className="text-muted-foreground">Comisión (% del valor vendido)</span>
        <input
          type="number"
          min="0"
          max="100"
          step="0.01"
          value={borrador.comisionPorcentaje}
          onChange={(e) => setBorrador({ ...borrador, comisionPorcentaje: e.target.value })}
          inputMode="decimal"
          placeholder="Por ejemplo 10,04"
          className={claseInput}
          aria-label="Comisión en porcentaje del valor vendido"
        />
      </label>

      {/* `webUrl` y `calendlyUrl` ya no se muestran (vacias en produccion y sin
          lector, 28-sep): el borrador las pasa tal cual para no pisar nada. */}
      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button type="button" size="sm" variant="ghost" onClick={onCancelar}>
          Cancelar
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={pendiente || !borrador.nombre.trim() || !borrador.slug.trim()}
        >
          Guardar
        </Button>
      </div>
    </form>
  );
}
