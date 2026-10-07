import { CalendarClock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { fechaHoraEnBogota } from "@/lib/format";
import type { NovedadCalendly, TipoNotificacionCalendly } from "@/lib/notificaciones-calendly/notificaciones";
import {
  abrirNovedadCalendlyAccion,
  marcarNovedadCalendlyVistaAccion,
} from "@/app/(app)/mi-espacio/acciones";
import { cn } from "@/lib/utils";

const TEXTO: Record<TipoNotificacionCalendly, { titulo: string; detalle: string }> = {
  cita_nueva: { titulo: "Cita nueva", detalle: "Calendly registró una cita en este Deal." },
  cita_reagendada: { titulo: "Cita reagendada", detalle: "La cita cambió de fecha u hora." },
  cita_cancelada: { titulo: "Llamada cancelada", detalle: "La persona canceló: necesita seguimiento comercial." },
  cita_no_show: { titulo: "No asistió", detalle: "Calendly marcó la cita como no-show." },
  cita_no_show_corregida: { titulo: "No-show corregido", detalle: "Calendly retiró el no-show y la cita vuelve a agendada." },
};

export function NovedadesCalendly({
  noLeidas,
  leidas,
  programId,
}: {
  noLeidas: NovedadCalendly[];
  leidas: NovedadCalendly[];
  programId: string;
}) {
  if (noLeidas.length === 0 && leidas.length === 0) return null;
  return (
    <section className="space-y-3" aria-labelledby="novedades-calendly-titulo">
      <div className="flex items-center gap-2">
        <CalendarClock className="size-4 text-primary" aria-hidden />
        <h2 id="novedades-calendly-titulo" className="text-sm font-semibold">Novedades de tus llamadas</h2>
        {noLeidas.length > 0 ? <Badge>{noLeidas.length} nuevas</Badge> : null}
      </div>
      <div className="space-y-2">
        {noLeidas.map((n) => <Fila key={n.id} novedad={n} programId={programId} />)}
      </div>
      {leidas.length > 0 ? (
        <div className="space-y-2 border-t pt-3">
          <p className="text-xs font-medium text-muted-foreground">Vistas</p>
          {leidas.map((n) => <Fila key={n.id} novedad={n} programId={programId} />)}
        </div>
      ) : null}
    </section>
  );
}

function Fila({ novedad, programId }: { novedad: NovedadCalendly; programId: string }) {
  const texto = TEXTO[novedad.tipo];
  const leida = novedad.leidaEn != null;
  return (
    <div className={cn("flex items-start gap-2 rounded-lg border bg-card p-3 shadow-tarjeta", leida && "bg-muted/50 text-muted-foreground")}>
      <form action={abrirNovedadCalendlyAccion} className="min-w-0 flex-1">
        <input type="hidden" name="notificationId" value={novedad.id} />
        <button type="submit" className="w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{texto.titulo}</span>
            {novedad.tipo === "cita_cancelada" ? <Badge variant="peligro">Urgente</Badge> : null}
            {!leida ? <Badge>Nuevo</Badge> : null}
          </span>
          <span className="mt-1 block text-sm">{novedad.nombreLead ?? novedad.emailLead}</span>
          <span className="mt-1 block text-xs text-muted-foreground">{texto.detalle} · {fechaHoraEnBogota(novedad.createdAt)}</span>
        </button>
      </form>
      {!leida ? (
        <form action={marcarNovedadCalendlyVistaAccion}>
          <input type="hidden" name="notificationId" value={novedad.id} />
          <input type="hidden" name="programId" value={programId} />
          <button type="submit" className="rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
            Marcar vista
          </button>
        </form>
      ) : null}
    </div>
  );
}

