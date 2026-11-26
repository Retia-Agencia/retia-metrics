"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { marcarConfirmacionMasivaAccion } from "@/app/(app)/p/[programa]/calls/acciones";
import { marcarConfirmacionAccion } from "@/app/(app)/p/[programa]/deals/[id]/acciones";
import { DetalleDeLlamada } from "@/components/deals/detalle-de-llamada";
import { useAccion } from "@/components/deals/ficha/uso-accion";
import { Enlace } from "@/components/enlace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { estaAgendada } from "@/lib/deals/resultados-de-llamada";
import { horaEnBogota } from "@/lib/format";
import type { LlamadaDelDia } from "@/lib/mi-espacio/llamadas-del-dia";
import type { OpcionesDeFicha } from "@/lib/queries/ficha-deal";

type Orden = "hora" | "lead" | "estado";

export function TablaLlamadasDelDia({
  llamadas,
  programaSlug,
  motivosReagenda,
  ahora,
  hrefOrden,
  orden,
  dir,
  origen,
}: {
  llamadas: LlamadaDelDia[];
  programaSlug: string;
  motivosReagenda: OpcionesDeFicha["motivos"];
  ahora: Date;
  hrefOrden: Record<Orden, string>;
  orden: Orden;
  dir: "asc" | "desc";
  origen: string;
}) {
  const router = useRouter();
  const [detalleId, setDetalleId] = useState<string | null>(null);
  const [seleccionadas, setSeleccionadas] = useState<Set<string>>(() => new Set());
  const { pendiente, correr } = useAccion();

  const alternar = (callId: string) => setSeleccionadas((actuales) => {
    const siguientes = new Set(actuales);
    if (siguientes.has(callId)) siguientes.delete(callId);
    else siguientes.add(callId);
    return siguientes;
  });
  const confirmarSeleccionadas = () => correr(
    () => marcarConfirmacionMasivaAccion({ programaSlug, callIds: [...seleccionadas] }),
    {
      exito: ({ marcadas, omitidas }) => `${marcadas} confirmadas${omitidas ? ` · ${omitidas} omitidas` : ""}.`,
      alExito: () => {
        setSeleccionadas(new Set());
        router.refresh();
      },
    },
  );

  return (
    <Card>
      {seleccionadas.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2 text-xs">
          <span>{seleccionadas.size} seleccionadas</span>
          <Button disabled={pendiente} size="xs" onClick={confirmarSeleccionadas}>Confirmar seleccionadas</Button>
          <Button disabled={pendiente} size="xs" variant="ghost" onClick={() => setSeleccionadas(new Set())}>Limpiar</Button>
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[42rem] text-sm">
          <thead className="border-b text-left text-xs text-muted-foreground">
            <tr>
              <th className="w-10 px-3 py-2"><span className="sr-only">Seleccionar</span></th>
              <Cabecera titulo="Hora" clave="hora" {...{ hrefOrden, orden, dir }} />
              <Cabecera titulo="Lead" clave="lead" {...{ hrefOrden, orden, dir }} />
              <Cabecera titulo="Asistencia" clave="estado" {...{ hrefOrden, orden, dir }} />
              <th className="px-3 py-2 font-medium">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {llamadas.map((llamada) => {
              const confirmable = estaAgendada(llamada.resultado)
                && llamada.confirmacion !== "confirmada"
                && noHaPasado(llamada.hora, ahora);
              return (
                <tr key={llamada.callId}>
                  <td className="px-3 py-3 align-top">
                    {confirmable ? (
                      <input
                        type="checkbox"
                        checked={seleccionadas.has(llamada.callId)}
                        onChange={() => alternar(llamada.callId)}
                        aria-label="Seleccionar llamada"
                        className="size-4 rounded border-input accent-primary"
                      />
                    ) : null}
                  </td>
                  <td className="cifra whitespace-nowrap px-3 py-3 align-top">{horaEnBogota(llamada.hora) ?? "—"}</td>
                  <td className="px-3 py-3 align-top">
                    <button
                      type="button"
                      className="text-left font-medium text-marca-texto underline-offset-2 hover:underline"
                      onClick={() => setDetalleId(llamada.callId)}
                    >
                      {llamada.leadNombre ?? llamada.leadEmail}
                    </button>
                    <p className="text-xs text-muted-foreground">{llamada.leadEmail}</p>
                  </td>
                  <td className="px-3 py-3 align-top"><Estado llamada={llamada} ahora={ahora} /></td>
                  <td className="px-3 py-3 align-top">
                    <AccionConfirmacion
                      llamada={llamada}
                      ahora={ahora}
                      onAbrir={() => setDetalleId(llamada.callId)}
                      onCambio={() => router.refresh()}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {llamadas.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">No tienes llamadas con estos filtros.</p>
      ) : null}
      {detalleId ? (
        <DetalleDeLlamada
          programaSlug={programaSlug}
          callId={detalleId}
          conIrAlDeal
          puedeRegistrar
          motivosReagenda={motivosReagenda}
          origen={origen}
          onCerrar={() => setDetalleId(null)}
        />
      ) : null}
    </Card>
  );
}

function Cabecera({ titulo, clave, hrefOrden, orden, dir }: {
  titulo: string;
  clave: Orden;
  hrefOrden: Record<Orden, string>;
  orden: Orden;
  dir: "asc" | "desc";
}) {
  return (
    <th className="px-3 py-2 font-medium">
      <Enlace precarga="navegacion" href={hrefOrden[clave]} className="hover:text-foreground">
        {titulo}{orden === clave ? ` ${dir === "asc" ? "↑" : "↓"}` : ""}
      </Enlace>
    </th>
  );
}

function Estado({ llamada, ahora }: { llamada: LlamadaDelDia; ahora: Date }) {
  const yaPaso = !estaAgendada(llamada.resultado) || !noHaPasado(llamada.hora, ahora);
  const etiqueta = llamada.confirmacion === "confirmada" ? "Confirmó" : yaPaso ? "Ya pasó" : "Sin confirmar";
  return <Badge variant="neutro">{etiqueta}</Badge>;
}

function noHaPasado(hora: Date, ahora: Date): boolean {
  return new Date(hora).getTime() >= new Date(ahora).getTime();
}

function AccionConfirmacion({ llamada, ahora, onAbrir, onCambio }: {
  llamada: LlamadaDelDia;
  ahora: Date;
  onAbrir: () => void;
  onCambio: () => void;
}) {
  const { pendiente, correr } = useAccion();
  const confirmada = llamada.confirmacion === "confirmada";
  const futura = noHaPasado(llamada.hora, ahora);
  const guardar = (confirmacion: "confirmada" | null) => correr(
    () => marcarConfirmacionAccion({ callId: llamada.callId, confirmacion }),
    {
      exito: confirmacion ? "Confirmación guardada." : "Confirmación quitada.",
      alExito: onCambio,
    },
  );
  if (confirmada) {
    return futura
      ? <Button size="xs" variant="ghost" disabled={pendiente} onClick={() => guardar(null)}>Quitar</Button>
      : null;
  }
  if (!estaAgendada(llamada.resultado)) return null;
  return futura
    ? <Button size="xs" disabled={pendiente} onClick={() => guardar("confirmada")}>Confirmar asistencia</Button>
    : <Button size="xs" variant="outline" onClick={onAbrir}>Marcar resultado</Button>;
}
