"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { fechaHoraEnBogota } from "@/lib/format";
import type { FilaLlamada } from "@/lib/queries/inbox";
import {
  marcarFallidaAccion,
  pegarGrainAccion,
} from "@/app/(app)/p/[programa]/deals/[id]/acciones";
import type { OpcionesDeFicha } from "@/lib/queries/ficha-deal";
import { Campo, claseInput, DialogoForm, Vacio } from "@/components/deals/ficha/campos";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAccion } from "@/components/deals/ficha/uso-accion";

/**
 * Sección 1 del Inbox (ticket 071): "Llamadas que ya pasaron sin resultado", el dolor número uno
 * (reunión con closers, 24-sep). Va PRIMERA. Cada fila es una llamada de MI deal cuya cita
 * ya pasó y sigue `agendada`. Las acciones son las MISMAS de la
 * ficha del deal —pegar Grain y "No se dio"— importadas, no duplicadas.
 *
 * Mobile first: los closers la usan en el teléfono a mitad de un bloque de llamadas, así
 * que las filas apilan su info y los botones envuelven. Al resolver una llamada (Grain o
 * "No se dio"), la acción refresca y la fila desaparece de esta sección.
 */
export function InboxLlamadasDeHoy({
  llamadas,
  slug,
  puedeRegistrar,
  motivosReagenda,
}: {
  llamadas: FilaLlamada[];
  slug: string;
  /** Trabaja leads Y el deal es suyo (o administra). Proyección: la reja es el servidor. */
  puedeRegistrar: boolean;
  /** Motivos de re-agenda del programa, para el diálogo "No se dio" desde Atendido. */
  motivosReagenda: OpcionesDeFicha["motivos"];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Llamadas que ya pasaron sin resultado</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {llamadas.length === 0 ? (
          <Vacio>
            Ninguna llamada pendiente de resultado. Cuando pase la hora de una cita sin que la marques, aparece acá para
            que no se te pase.
          </Vacio>
        ) : (
          <ul className="divide-y">
            {llamadas.map((fila) => (
              <FilaDeHoy
                key={fila.callId}
                fila={fila}
                slug={slug}
                puedeRegistrar={puedeRegistrar}
                motivosReagenda={motivosReagenda}
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function FilaDeHoy({
  fila,
  slug,
  puedeRegistrar,
  motivosReagenda,
}: {
  fila: FilaLlamada;
  slug: string;
  puedeRegistrar: boolean;
  motivosReagenda: OpcionesDeFicha["motivos"];
}) {
  const [dialogo, setDialogo] = useState<"grain" | "fallida" | null>(null);
  return (
    <li className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          {fila.dealId ? (
            <Link
              href={`/p/${slug}/deals/${fila.dealId}`}
              className="truncate text-sm font-medium text-marca-texto underline-offset-2 hover:underline"
            >
              {fila.leadNombre ?? fila.leadEmail ?? "Ver deal"}
            </Link>
          ) : (
            <span className="truncate text-sm font-medium">{fila.leadNombre ?? fila.leadEmail}</span>
          )}
          {fila.ownerNombre ? <Badge variant="neutro">{fila.ownerNombre}</Badge> : null}
        </div>
        {fila.leadEmail ? <p className="truncate text-xs text-muted-foreground">{fila.leadEmail}</p> : null}
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

      {puedeRegistrar && fila.callId ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => setDialogo("grain")}>
            Pegar Grain
          </Button>
          <Button size="sm" variant="outline" onClick={() => setDialogo("fallida")}>
            No se dio
          </Button>
        </div>
      ) : null}

      {dialogo === "grain" ? <DialogoGrain callId={fila.callId} onCerrar={() => setDialogo(null)} /> : null}
      {dialogo === "fallida" ? (
        <DialogoFallida callId={fila.callId} motivos={motivosReagenda} onCerrar={() => setDialogo(null)} />
      ) : null}
    </li>
  );
}

/** Pegar el Grain: reusa la server action de la ficha (`pegarGrainAccion`). */
function DialogoGrain({ callId, onCerrar }: { callId: string; onCerrar: () => void }) {
  const { pendiente, correr } = useAccion();
  const [link, setLink] = useState("");
  return (
    <DialogoForm
      titulo="Pegar el link de Grain"
      descripcion="Pegarlo es decir que la llamada sucedió: se marca como show y el deal pasa a Atendido."
      pendiente={pendiente}
      onCerrar={onCerrar}
      deshabilitarConfirmar={link.trim() === ""}
      confirmar={{
        texto: "Guardar",
        enCurso: "Guardando…",
        onClick: () =>
          correr(() => pegarGrainAccion({ callId, linkGrain: link }), {
            exito: (r) => (r.movioAAtendido ? "Grain guardado: el deal pasó a Atendido." : "Grain guardado."),
            alExito: onCerrar,
          }),
      }}
    >
      <div className="min-w-0 space-y-3">
        <Campo etiqueta="Link de la grabación">
          <input
            type="url"
            className={claseInput}
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://grain.com/…"
          />
        </Campo>
      </div>
    </DialogoForm>
  );
}

/**
 * "No se dio": reusa `marcarFallidaAccion` de la ficha. Desde el Inbox no sabemos la etapa
 * del deal, así que se ofrece el motivo de re-agenda siempre que la lista tenga alguno; el
 * servidor lo exige o lo ignora según la transición real. Sin motivos, se marca sin él.
 */
function DialogoFallida({
  callId,
  motivos,
  onCerrar,
}: {
  callId: string;
  motivos: OpcionesDeFicha["motivos"];
  onCerrar: () => void;
}) {
  const { pendiente, correr } = useAccion();
  const [resultado, setResultado] = useState<"no_show" | "cancelada">("no_show");
  const [motivoId, setMotivoId] = useState<string | null>(null);
  const deReagenda = motivos.filter((m) => m.tipo === "reagenda");
  const resultados = [
    { value: "no_show", label: "No apareció (no show)" },
    { value: "cancelada", label: "Avisó y canceló" },
  ];
  return (
    <DialogoForm
      titulo="La llamada no se dio"
      descripcion="El deal queda con Re-agenda pendiente. No aparecer y cancelar avisando son cosas distintas: elige la que fue."
      pendiente={pendiente}
      onCerrar={onCerrar}
      confirmar={{
        texto: "Marcar",
        enCurso: "Guardando…",
        onClick: () =>
          correr(() => marcarFallidaAccion({ callId, resultado, motivoId: motivoId ?? undefined }), {
            exito: "Marcada: el deal quedó con Re-agenda pendiente.",
            alExito: onCerrar,
          }),
      }}
    >
      <div className="min-w-0 space-y-3">
        <Campo etiqueta="¿Qué pasó?">
          <Select
            value={resultado}
            items={resultados}
            onValueChange={(v: string | null) => v && setResultado(v as "no_show" | "cancelada")}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {resultados.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Campo>
        {deReagenda.length > 0 ? (
          <Campo etiqueta="Motivo de la re-agenda (si aplica)">
            <Select
              value={motivoId}
              items={deReagenda.map((m) => ({ value: m.id, label: m.nombre }))}
              onValueChange={(v: string | null) => setMotivoId(v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Elige un motivo" />
              </SelectTrigger>
              <SelectContent>
                {deReagenda.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Campo>
        ) : null}
      </div>
    </DialogoForm>
  );
}
