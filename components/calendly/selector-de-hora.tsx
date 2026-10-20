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
  const [desde, setDesde] = useState(() => new Date());
  const [horas, setHoras] = useState<Date[]>([]);
  const [etiqueta, setEtiqueta] = useState("Calendly");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError(null);
    const hasta = new Date(desde.getTime() + 7 * DIA);
    horasDisponiblesAccion({ dealId, desde, hasta }).then((resultado) => {
      if (!vigente) return;
      setCargando(false);
      if (!resultado.ok) {
        setError(resultado.error);
        setHoras([]);
        return;
      }
      setEtiqueta(resultado.etiqueta);
      setHoras(resultado.horas.map((hora) => new Date(hora)));
    });
    return () => { vigente = false; };
  }, [dealId, desde]);

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
        <Button type="button" size="xs" variant="ghost" disabled={desde.getTime() <= Date.now()} onClick={() => setDesde(new Date(Math.max(Date.now(), desde.getTime() - 7 * DIA)))}>Semana anterior</Button>
        <Button type="button" size="xs" variant="ghost" onClick={() => setDesde(new Date(desde.getTime() + 7 * DIA))}>Semana siguiente</Button>
      </div>
    </div>
  );
}
