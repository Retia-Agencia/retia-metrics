import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FilaPerdidoEnCalendly } from "@/lib/queries/inbox";

function espera(minutos: number): string {
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  return `hace ${horas} h ${minutos % 60} min`;
}

function origen(fila: FilaPerdidoEnCalendly): string {
  const { utmSource, utmMedium, utmCampaign } = fila.origen;
  if (utmSource === null && utmMedium === null && utmCampaign === null) return "Sin UTM";
  return `${utmSource ?? "—"} / ${utmMedium ?? "—"} · ${utmCampaign ?? "—"}`;
}

/** Parciales de Calendly que llevan cinco minutos sin su envio completo. */
export function InboxPerdidosEnCalendly({
  filas,
  slug,
}: {
  filas: FilaPerdidoEnCalendly[];
  slug: string;
}) {
  if (filas.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Se perdió en el Calendly</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y">
          {filas.map((fila) => (
            <li key={fila.dealId} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-1">
                <Link
                  href={`/p/${slug}/deals/${fila.dealId}`}
                  className="block truncate text-sm font-medium text-marca-texto underline-offset-2 hover:underline"
                >
                  {fila.leadNombre ?? fila.leadEmail}
                </Link>
                <p className="truncate text-xs text-muted-foreground">{fila.leadEmail}</p>
                <p className="cifra text-xs text-muted-foreground">{origen(fila)}</p>
              </div>
              <Badge variant="peligro" className="w-fit">
                <span className="cifra">{espera(fila.minutos)}</span>
              </Badge>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
