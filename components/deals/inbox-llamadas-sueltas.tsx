"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fechaHoraEnBogota } from "@/lib/format";
import type { DealAbiertoBuscado, FilaLlamada } from "@/lib/queries/inbox";
import {
  asignarLlamadaSueltaAccion,
  buscarDealsAbiertosAccion,
} from "@/app/(app)/p/[programa]/inbox/acciones";
import { Campo, claseInput, DialogoForm, Vacio } from "@/components/deals/ficha/campos";

/**
 * Sección 3 del Inbox (ticket 071, ADR 0049, decisión K2): "Llamadas sueltas" del programa
 * —las que entraron por Calendly sin deal—. Un closer las cuelga de un deal abierto que
 * busca por nombre o correo del lead. La reja de permisos vive en el servidor
 * (`asignarLlamadaSuelta`): esconder un botón no es seguridad.
 *
 * Mobile first: la fila apila su info y el botón envuelve; el selector de deal es un
 * diálogo con búsqueda.
 */
export function InboxLlamadasSueltas({
  llamadas,
  programId,
}: {
  llamadas: FilaLlamada[];
  programId: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Llamadas sueltas</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {llamadas.length === 0 ? (
          <Vacio>
            No hay llamadas sin deal. Cuando entre una cita de Calendly que el sistema no pudo colgar sola, aparece acá
            para que la asignes.
          </Vacio>
        ) : (
          <ul className="divide-y">
            {llamadas.map((fila) => (
              <FilaSuelta key={fila.callId} fila={fila} programId={programId} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function FilaSuelta({
  fila,
  programId,
}: {
  fila: FilaLlamada;
  programId: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [asignando, setAsignando] = useState<string | null>(null);
  const router = useRouter();

  async function colgar(dealId: string) {
    setAsignando(dealId);
    try {
      const r = await asignarLlamadaSueltaAccion({ callId: fila.callId, dealId });
      if (r.ok) {
        toast.success(r.movioAAgendado ? "Llamada asignada: el deal pasó a Agendado." : "Llamada asignada.");
        router.refresh();
      } else toast.error(r.error, { duration: 6000 });
    } finally {
      setAsignando(null);
    }
  }
  return (
    <li className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1">
        <span className="truncate text-sm font-medium">{fila.leadEmail ?? "Sin correo"}</span>
        <p className="cifra text-xs text-muted-foreground">
          {fila.fechaAgenda ? `Cita ${fechaHoraEnBogota(fila.fechaAgenda)}` : "Sin fecha de cita"}
        </p>
        {fila.linkCalendly ? (
          <a
            className="text-xs text-marca-texto underline-offset-2 hover:underline"
            href={fila.linkCalendly}
            target="_blank"
            rel="noreferrer"
          >
            Cita en Calendly
          </a>
        ) : null}
      </div>
      {fila.puedeColgar ? (
        <div className="flex flex-wrap items-center gap-2">
          {fila.sugerencias?.map((deal) => (
            <Button key={deal.dealId} size="sm" variant="secondary" disabled={asignando !== null} onClick={() => void colgar(deal.dealId)}>
              {asignando === deal.dealId ? "Colgando…" : `Colgar aquí · ${deal.leadNombre ?? deal.leadEmail}`}
            </Button>
          ))}
          <Button size="sm" variant="default" onClick={() => setAbierto(true)}>
            Asignar a un deal
          </Button>
        </div>
      ) : null}
      {abierto ? (
        <DialogoAsignar callId={fila.callId} programId={programId} onCerrar={() => setAbierto(false)} />
      ) : null}
    </li>
  );
}

/**
 * El diálogo para colgar la suelta de un deal: busca deals abiertos del programa por nombre
 * o correo del lead (server action de solo lectura) y asigna el elegido. El
 * `DialogContent` lleva su envoltorio con `min-w-0` (regla del ticket) para que el texto
 * largo no reviente el ancho en el teléfono.
 */
function DialogoAsignar({
  callId,
  programId,
  onCerrar,
}: {
  callId: string;
  programId: string;
  onCerrar: () => void;
}) {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [resultados, setResultados] = useState<DealAbiertoBuscado[]>([]);
  const [elegido, setElegido] = useState<DealAbiertoBuscado | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [asignando, setAsignando] = useState(false);

  async function buscar() {
    setBuscando(true);
    try {
      const r = await buscarDealsAbiertosAccion({ programId, texto });
      if (r.ok) setResultados(r.deals);
      else toast.error(r.error, { duration: 6000 });
    } finally {
      setBuscando(false);
    }
  }

  async function asignar() {
    if (!elegido) return;
    setAsignando(true);
    try {
      const r = await asignarLlamadaSueltaAccion({ callId, dealId: elegido.dealId });
      if (r.ok) {
        toast.success(r.movioAAgendado ? "Llamada asignada: el deal pasó a Agendado." : "Llamada asignada.");
        onCerrar();
        router.refresh();
      } else {
        toast.error(r.error, { duration: 6000 });
      }
    } finally {
      setAsignando(false);
    }
  }

  return (
    <DialogoForm
      titulo="Asignar la llamada a un deal"
      descripcion="Busca el deal abierto del lead por su nombre o correo y cuélgale esta llamada."
      pendiente={asignando}
      onCerrar={onCerrar}
      deshabilitarConfirmar={!elegido}
      confirmar={{ texto: "Asignar", enCurso: "Asignando…", onClick: asignar }}
    >
      <div className="min-w-0 space-y-3">
        <Campo etiqueta="Buscar el deal">
          <input
            className={claseInput}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void buscar();
              }
            }}
            placeholder="Nombre o correo del lead"
          />
        </Campo>
        <Button type="button" size="sm" variant="outline" onClick={() => void buscar()} disabled={buscando}>
          {buscando ? "Buscando…" : "Buscar"}
        </Button>

        {resultados.length === 0 ? (
          <p className="text-xs text-muted-foreground">Escribe y busca: te muestro los deals abiertos que casan.</p>
        ) : (
          <ul className="max-h-64 divide-y overflow-auto rounded-lg border border-border">
            {resultados.map((d) => (
              <li key={d.dealId}>
                <button
                  type="button"
                  onClick={() => setElegido(d)}
                  className={
                    elegido?.dealId === d.dealId
                      ? "flex w-full flex-col gap-0.5 bg-muted px-3 py-2 text-left"
                      : "flex w-full flex-col gap-0.5 px-3 py-2 text-left hover:bg-muted"
                  }
                >
                  <span className="truncate text-sm font-medium">{d.leadNombre ?? d.leadEmail}</span>
                  <span className="truncate text-xs text-muted-foreground">{d.leadEmail}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {elegido ? (
          <p className="text-xs text-muted-foreground">
            Elegido: <span className="font-medium">{elegido.leadNombre ?? elegido.leadEmail}</span>
          </p>
        ) : null}
      </div>
    </DialogoForm>
  );
}
