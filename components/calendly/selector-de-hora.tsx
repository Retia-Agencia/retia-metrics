"use client";

import { useEffect, useState } from "react";
import { horasDisponiblesAccion } from "@/app/(app)/p/[programa]/deals/[id]/acciones";
import { Button } from "@/components/ui/button";

const DIA = 24 * 60 * 60 * 1000;

export function SelectorDeHora({
  dealId,
  valor,
  onChange,
}: {
  dealId: string;
  valor: Date | null;
  onChange: (fecha: Date | null) => void;
}) {
  const [hoy] = useState(() => Date.now());
  const [desde, setDesde] = useState(() => new Date(hoy));
  // La respuesta guarda para qué semana es: mientras no coincida con `desde`, se está cargando.
  const [respuesta, setRespuesta] = useState<
    { desde: number; horas: Date[]; etiqueta: string; error: null } | { desde: number; horas: Date[]; etiqueta: null; error: string } | null
  >(null);

  useEffect(() => {
    let vigente = true;
    const hasta = new Date(desde.getTime() + 7 * DIA);
    horasDisponiblesAccion({ dealId, desde, hasta }).then((resultado) => {
      if (!vigente) return;
      setRespuesta(resultado.ok
        ? { desde: desde.getTime(), horas: resultado.horas.map((hora) => new Date(hora)), etiqueta: resultado.etiqueta, error: null }
        : { desde: desde.getTime(), horas: [], etiqueta: null, error: resultado.error });
    });
    return () => { vigente = false; };
  }, [dealId, desde]);

  const cargando = respuesta?.desde !== desde.getTime();
  const horas = cargando ? [] : respuesta.horas;
  const error = cargando ? null : respuesta.error;
  const etiqueta = respuesta?.etiqueta ?? "Calendly";

  const porDia = new Map<string, Date[]>();
  for (const hora of horas) {
    const dia = hora.toLocaleDateString("es-CO", { timeZone: "America/Bogota", weekday: "long", day: "numeric", month: "short" });
    porDia.set(dia, [...(porDia.get(dia) ?? []), hora]);
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">{etiqueta}</p>
      {cargando ? <p className="text-sm text-muted-foreground">Leyendo horas disponibles…</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {!cargando && !error && horas.length === 0 ? <p className="text-sm text-muted-foreground">No hay horas disponibles en estos 7 días.</p> : null}
      {[...porDia].map(([dia, disponibles]) => (
        <section key={dia} className="space-y-2">
          <h4 className="text-xs font-medium capitalize text-muted-foreground">{dia}</h4>
          <div className="flex flex-wrap gap-2">
            {disponibles.map((hora) => (
              <Button
                key={hora.toISOString()}
                type="button"
                size="xs"
                variant={valor?.getTime() === hora.getTime() ? "default" : "outline"}
                onClick={() => onChange(hora)}
              >
                {hora.toLocaleTimeString("es-CO", { timeZone: "America/Bogota", hour: "numeric", minute: "2-digit" })}
              </Button>
            ))}
          </div>
        </section>
      ))}
      <div className="flex justify-between gap-2">
        <Button type="button" size="xs" variant="ghost" disabled={desde.getTime() <= hoy} onClick={() => setDesde(new Date(Math.max(hoy, desde.getTime() - 7 * DIA)))}>Semana anterior</Button>
        <Button type="button" size="xs" variant="ghost" onClick={() => setDesde(new Date(desde.getTime() + 7 * DIA))}>Semana siguiente</Button>
      </div>
    </div>
  );
}
