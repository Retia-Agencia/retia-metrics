"use client";

import { useEffect, useState } from "react";
import { horasDisponiblesAccion } from "@/app/(app)/p/[programa]/deals/[id]/acciones";
import { Button } from "@/components/ui/button";
import { hoyEnBogota } from "@/lib/format";
import type { HorarioDeEvento } from "@/lib/calendly/escritura";

const DIA = 24 * 60 * 60 * 1000;

export type HoraElegida =
  | { tipo: "calendly"; fecha: Date }
  | { tipo: "manual"; dia: string; hora: string; link: string };

export function horaElegidaCompleta(valor: HoraElegida | null): valor is HoraElegida {
  return valor?.tipo === "calendly" || Boolean(valor?.dia && valor.hora && valor.link);
}

const NOMBRE_DIA: Record<string, string> = {
  monday: "lun", tuesday: "mar", wednesday: "mié", thursday: "jue",
  friday: "vie", saturday: "sáb", sunday: "dom",
};

function mostrarHora(hora: string): string {
  return new Date(`2026-01-05T${hora}:00-05:00`).toLocaleTimeString("es-CO", {
    timeZone: "America/Bogota", hour: "numeric", minute: "2-digit",
  });
}

function lineaDeHorario(horario: HorarioDeEvento | null): string {
  if (!horario) return "Horario en Calendly: no se pudo leer en este momento.";
  if (horario.esRoundRobin) return "Calendly reparte entre los closers del evento según el horario de cada uno.";
  if (horario.dias.length === 0) return "Horario en Calendly: no hay un horario semanal publicado.";
  const grupos: { desde: string; hasta: string; intervalos: HorarioDeEvento["dias"][number]["intervalos"] }[] = [];
  for (const dia of horario.dias) {
    const anterior = grupos.at(-1);
    if (anterior && JSON.stringify(anterior.intervalos) === JSON.stringify(dia.intervalos)) anterior.hasta = dia.wday;
    else grupos.push({ desde: dia.wday, hasta: dia.wday, intervalos: dia.intervalos });
  }
  return `Horario en Calendly: ${grupos.map((grupo) => {
    const dias = grupo.desde === grupo.hasta
      ? NOMBRE_DIA[grupo.desde] ?? grupo.desde
      : `${NOMBRE_DIA[grupo.desde] ?? grupo.desde} a ${NOMBRE_DIA[grupo.hasta] ?? grupo.hasta}`;
    const intervalos = grupo.intervalos.map((i) => `${mostrarHora(i.desde)} a ${mostrarHora(i.hasta)}`).join(" y ");
    return `${dias} ${intervalos}`;
  }).join(" · ")}`;
}

export function SelectorDeHora({ dealId, valor, onChange }: {
  dealId: string;
  valor: HoraElegida | null;
  onChange: (fecha: HoraElegida | null) => void;
}) {
  const [hoy] = useState(() => Date.now());
  const [desde, setDesde] = useState(() => new Date(hoy));
  const [manual, setManual] = useState(false);
  const [respuesta, setRespuesta] = useState<
    | { desde: number; horas: Date[]; etiqueta: string; horario: HorarioDeEvento | null; error: null }
    | { desde: number; horas: Date[]; etiqueta: null; horario: null; error: string }
    | null
  >(null);

  useEffect(() => {
    let vigente = true;
    const hasta = new Date(desde.getTime() + 7 * DIA);
    horasDisponiblesAccion({ dealId, desde, hasta }).then((resultado) => {
      if (!vigente) return;
      setRespuesta(resultado.ok
        ? { desde: desde.getTime(), horas: resultado.horas.map((hora) => new Date(hora)), etiqueta: resultado.etiqueta, horario: resultado.horario, error: null }
        : { desde: desde.getTime(), horas: [], etiqueta: null, horario: null, error: resultado.error });
    });
    return () => { vigente = false; };
  }, [dealId, desde]);

  const cargando = respuesta?.desde !== desde.getTime();
  const horas = cargando ? [] : respuesta.horas;
  const error = cargando ? null : respuesta.error;
  const etiqueta = respuesta?.etiqueta ?? "Calendly";
  const horario = cargando ? null : respuesta.horario;
  const porDia = new Map<string, Date[]>();
  for (const hora of horas) {
    const dia = hora.toLocaleDateString("es-CO", { timeZone: "America/Bogota", weekday: "long", day: "numeric", month: "short" });
    porDia.set(dia, [...(porDia.get(dia) ?? []), hora]);
  }
  const manualElegida = valor?.tipo === "manual" ? valor : { tipo: "manual" as const, dia: hoyEnBogota(), hora: "", link: "" };

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">{etiqueta}</p>
      {!cargando ? <p className="text-xs text-muted-foreground">{lineaDeHorario(horario)}</p> : null}
      <p className="text-xs text-muted-foreground">Calendly además esconde horas por aviso mínimo, buffers, límites diarios y choques con tu calendario. Eso se cambia en Calendly.</p>
      {cargando ? <p className="text-sm text-muted-foreground">Leyendo horas disponibles…</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {!cargando && !error && horas.length === 0 ? <p className="text-sm text-muted-foreground">No hay horas disponibles en estos 7 días.</p> : null}
      {[...porDia].map(([dia, disponibles]) => (
        <section key={dia} className="space-y-2">
          <h4 className="text-xs font-medium capitalize text-muted-foreground">{dia}</h4>
          <div className="flex flex-wrap gap-2">
            {disponibles.map((hora) => (
              <Button key={hora.toISOString()} type="button" size="xs"
                variant={valor?.tipo === "calendly" && valor.fecha.getTime() === hora.getTime() ? "default" : "outline"}
                onClick={() => { setManual(false); onChange({ tipo: "calendly", fecha: hora }); }}
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
      <Button type="button" size="xs" variant="link" className="h-auto px-0" onClick={() => {
        const siguiente = !manual;
        setManual(siguiente);
        onChange(siguiente ? manualElegida : null);
      }}>
        {manual ? "Volver a las horas de Calendly" : "Poner una hora fuera de Calendly"}
      </Button>
      {manual ? (
        <div className="space-y-3 rounded-lg border border-border p-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1 text-xs font-medium text-muted-foreground">Fecha
              <input type="date" min={hoyEnBogota()} required className="h-8 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground" value={manualElegida.dia} onChange={(e) => onChange({ ...manualElegida, dia: e.currentTarget.value })} />
            </label>
            <label className="space-y-1 text-xs font-medium text-muted-foreground">Hora de Bogotá
              <input type="time" required className="h-8 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground" value={manualElegida.hora} onChange={(e) => onChange({ ...manualElegida, hora: e.currentTarget.value })} />
            </label>
          </div>
          <label className="space-y-1 text-xs font-medium text-muted-foreground">Link de la reunión
            <input type="url" required placeholder="https://…" className="h-8 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground" value={manualElegida.link} onChange={(e) => onChange({ ...manualElegida, link: e.currentTarget.value })} />
          </label>
          <p className="text-xs text-muted-foreground">Esta hora no queda bloqueada en Calendly: otro lead puede reservarla.</p>
        </div>
      ) : null}
    </div>
  );
}
