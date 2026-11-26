import { Enlace } from "@/components/enlace";
import { Pestanas, type GrupoDePestanas } from "@/components/layout/pestanas";
import { Button } from "@/components/ui/button";
import { fechaCorta, fechaHoraEnBogota } from "@/lib/format";
import { enlaceConVuelta } from "@/lib/navegacion/volver";
import {
  TIPOS_DE_PENDIENTE,
  type GrupoDePendiente,
  type PendienteDelCloser,
  type TipoDePendiente,
} from "@/lib/mi-espacio/pendientes";

const GRUPOS: readonly { id: GrupoDePendiente; etiqueta: string }[] = [
  { id: "vencido", etiqueta: "Vencido" },
  { id: "hoy", etiqueta: "Hoy" },
  { id: "proximo", etiqueta: "Próximos" },
];

function textoDeFecha(valor: Date | string | null): string {
  if (valor == null) return "Sin fecha";
  return valor instanceof Date ? fechaHoraEnBogota(valor) : fechaCorta(valor);
}

export function PendientesDeMiDia({
  filas,
  tipoActivo,
  programaSlug,
  origen,
  hrefDeTipo,
}: {
  filas: PendienteDelCloser[];
  tipoActivo: TipoDePendiente | null;
  programaSlug: string;
  origen: string;
  hrefDeTipo: (tipo: TipoDePendiente | null) => string;
}) {
  const conteos = new Map<TipoDePendiente, number>();
  for (const fila of filas) conteos.set(fila.tipo, (conteos.get(fila.tipo) ?? 0) + 1);
  const gruposPestanas: GrupoDePestanas[] = [{
    pestanas: [
      {
        id: "todos",
        etiqueta: "Todos",
        total: filas.length,
        descripcion: "Todos tus pendientes.",
        href: hrefDeTipo(null),
      },
      ...TIPOS_DE_PENDIENTE.map((tipo) => ({
        id: tipo.tipo,
        etiqueta: tipo.etiqueta,
        total: conteos.get(tipo.tipo) ?? 0,
        descripcion: `Pendientes de tipo ${tipo.etiqueta.toLocaleLowerCase("es-CO")}.`,
        href: hrefDeTipo(tipo.tipo),
      })),
    ],
  }];
  const visibles = tipoActivo ? filas.filter((fila) => fila.tipo === tipoActivo) : filas;

  return (
    <section className="space-y-4" aria-labelledby="pendientes-titulo">
      <h2 id="pendientes-titulo" className="font-heading text-lg font-semibold">Pendientes</h2>
      <Pestanas grupos={gruposPestanas} activa={tipoActivo ?? "todos"} etiqueta="Tipo de pendiente" />
      {visibles.length === 0 ? (
        <p className="text-sm text-muted-foreground">Estás al día: no tienes pendientes.</p>
      ) : GRUPOS.map((grupo) => {
        const delGrupo = visibles.filter((fila) => fila.grupo === grupo.id);
        if (delGrupo.length === 0) return null;
        return (
          <div key={grupo.id} className="space-y-2">
            <h3 className="text-sm font-semibold">{grupo.etiqueta}</h3>
            <div className="divide-y rounded-xl bg-card shadow-tarjeta">
              {delGrupo.map((fila) => {
                const tipo = TIPOS_DE_PENDIENTE.find((registro) => registro.tipo === fila.tipo)!;
                return (
                  <div key={`${fila.dealId}:${fila.tipo}`} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium">{tipo.etiqueta}</span>
                    <div className="min-w-44 flex-1">
                      <p className="truncate text-sm font-medium">{fila.leadNombre ?? fila.leadEmail}</p>
                      <p className="text-xs text-muted-foreground">{textoDeFecha(fila.fechaClave)}</p>
                    </div>
                    <Button
                      nativeButton={false}
                      size="sm"
                      variant="outline"
                      render={<Enlace precarga="navegacion" href={enlaceConVuelta(`/p/${programaSlug}/deals/${fila.dealId}`, origen)} />}
                    >
                      {tipo.accion}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </section>
  );
}
