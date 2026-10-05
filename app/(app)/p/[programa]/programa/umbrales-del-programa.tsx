"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { MetricaConUmbral } from "@/lib/catalogo/umbrales";
import { guardarUmbralAccion } from "./acciones-umbrales";

/** Lo que la página le pasa por métrica: su nombre y su umbral si ya existe. */
export interface UmbralEditable {
  metrica: MetricaConUmbral;
  nombre: string;
  aceptable: number | null;
  diasSeguidos: number | null;
  activo: boolean;
}

const claseInput =
  "h-9 w-24 rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

/**
 * Sección "Alertas por persistencia" de Programa › Ventas (ticket 147): el aceptable y los días
 * hábiles seguidos de cada métrica del semáforo. Quien no administra la ve en lectura; la reja de
 * verdad es la acción del servidor, no esconder el formulario.
 */
export function UmbralesDelPrograma({
  programId,
  umbrales,
  diasPorDefecto,
  editable,
}: {
  programId: string;
  umbrales: UmbralEditable[];
  diasPorDefecto: number;
  editable: boolean;
}) {
  return (
    <div className="space-y-4">
      {umbrales.map((u) => (
        <FilaDeUmbral key={u.metrica} programId={programId} umbral={u} diasPorDefecto={diasPorDefecto} editable={editable} />
      ))}
      <p className="text-xs text-muted-foreground">
        La alerta sale en el Pulso del dashboard cuando el cumplimiento de la meta queda bajo el aceptable esos días
        hábiles seguidos (ya terminados). Solo llevan umbral las métricas del semáforo de la meta.
      </p>
    </div>
  );
}

function FilaDeUmbral({
  programId,
  umbral,
  diasPorDefecto,
  editable,
}: {
  programId: string;
  umbral: UmbralEditable;
  diasPorDefecto: number;
  editable: boolean;
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [aceptable, setAceptable] = useState(umbral.aceptable?.toString() ?? "");
  const [dias, setDias] = useState((umbral.diasSeguidos ?? diasPorDefecto).toString());
  const [activo, setActivo] = useState(umbral.aceptable === null ? true : umbral.activo);
  const idBase = `umbral-${umbral.metrica}`;

  if (!editable) {
    return (
      <div className="text-sm">
        <span className="font-medium">{umbral.nombre}: </span>
        {umbral.aceptable === null
          ? <span className="text-muted-foreground">sin umbral</span>
          : `bajo ${umbral.aceptable}% durante ${umbral.diasSeguidos} días hábiles${umbral.activo ? "" : " (inactivo)"}`}
      </div>
    );
  }

  function guardar(evento: React.FormEvent) {
    evento.preventDefault();
    startTransition(async () => {
      const resultado = await guardarUmbralAccion({ programId, metrica: umbral.metrica, aceptable, diasSeguidos: dias, activo });
      if (resultado.ok) {
        toast.success("Umbral guardado");
        router.refresh();
      } else {
        toast.error("No se pudo guardar", { description: resultado.error });
      }
    });
  }

  return (
    <form onSubmit={guardar} className="flex flex-wrap items-end gap-3">
      <p className="w-full text-sm font-medium sm:w-40">
        {umbral.nombre}
        {umbral.aceptable === null ? (
          <span className="block text-xs font-normal text-muted-foreground">Sin umbral todavía</span>
        ) : !umbral.activo ? (
          <span className="block text-xs font-normal text-muted-foreground">Inactivo</span>
        ) : null}
      </p>
      <label className="space-y-1 text-xs text-muted-foreground" htmlFor={`${idBase}-aceptable`}>
        <span className="block">Aceptable (%)</span>
        <input
          id={`${idBase}-aceptable`}
          className={claseInput}
          inputMode="decimal"
          required
          value={aceptable}
          onChange={(e) => setAceptable(e.target.value)}
          placeholder="80"
        />
      </label>
      <label className="space-y-1 text-xs text-muted-foreground" htmlFor={`${idBase}-dias`}>
        <span className="block">Días hábiles</span>
        <input
          id={`${idBase}-dias`}
          className={claseInput}
          inputMode="numeric"
          required
          value={dias}
          onChange={(e) => setDias(e.target.value)}
        />
      </label>
      <label className="flex h-9 items-center gap-2 text-sm" htmlFor={`${idBase}-activo`}>
        <input id={`${idBase}-activo`} type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
        Activo
      </label>
      <Button type="submit" size="sm" disabled={pendiente}>
        {pendiente ? "Guardando…" : "Guardar"}
      </Button>
    </form>
  );
}
