"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetalleDeLlamada } from "@/components/deals/detalle-de-llamada";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fechaHoraEnBogota } from "@/lib/format";
import { ETIQUETA_DE_RESULTADO, TONO_DE_RESULTADO } from "@/lib/deals/estado-de-llamada";
import type { FilaLlamadaPrograma } from "@/lib/queries/llamadas";
import type { EtapaDeal } from "@/lib/deals/etapas";
import type { OpcionesDeFicha } from "@/lib/queries/ficha-deal";
import { pegarGrainAccion } from "@/app/(app)/p/[programa]/deals/[id]/acciones";
import { Campo, claseInput, DialogoForm, Vacio } from "@/components/deals/ficha/campos";
import { PREGUNTA_DE_ETAPA, respuestasDe } from "@/components/deals/pregunta-de-etapa";
import { BotonesDeRespuesta, useResponder, type DealQueResponde } from "@/components/deals/responder-pregunta";
import type { MapaTransiciones } from "@/components/deals/transiciones";
import { useAccion } from "@/components/deals/ficha/uso-accion";

export function LlamadasPrograma({
  llamadas,
  programaSlug,
  opciones,
  mapa,
  nombreDeEtapa,
  puedeTrabajar,
}: {
  llamadas: FilaLlamadaPrograma[];
  programaSlug: string;
  opciones: OpcionesDeFicha;
  mapa: MapaTransiciones;
  nombreDeEtapa: Record<EtapaDeal, string>;
  puedeTrabajar: boolean;
}) {
  return (
    <Card>
      <CardHeader><CardTitle>Llamadas</CardTitle></CardHeader>
      <CardContent className="p-0">
        {llamadas.length === 0 ? (
          <Vacio>No hay llamadas que coincidan con los filtros.</Vacio>
        ) : (
          <ul className="divide-y">
            {llamadas.map((llamada) => (
              <FilaLlamada
                key={llamada.callId}
                llamada={llamada}
                programaSlug={programaSlug}
                opciones={opciones}
                mapa={mapa}
                nombreDeEtapa={nombreDeEtapa}
                puedeTrabajar={puedeTrabajar}
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function FilaLlamada({
  llamada,
  programaSlug,
  opciones,
  mapa,
  nombreDeEtapa,
  puedeTrabajar,
}: {
  llamada: FilaLlamadaPrograma;
  programaSlug: string;
  opciones: OpcionesDeFicha;
  mapa: MapaTransiciones;
  nombreDeEtapa: Record<EtapaDeal, string>;
  puedeTrabajar: boolean;
}) {
  const router = useRouter();
  const [dialogo, setDialogo] = useState<"grain" | "resultado" | null>(null);
  const [verDetalle, setVerDetalle] = useState(false);
  const nombre = llamada.leadNombre ?? llamada.leadEmail ?? "Llamada sin lead";
  // "¿Cómo terminó?" es la pregunta de Atendido (ADR 0071 punto 5, ADR 0072): las mismas
  // respuestas que en la ficha, por el mismo `useResponder`.
  const deal: DealQueResponde | null =
    llamada.dealId && llamada.etapa
      ? {
          dealId: llamada.dealId,
          etapa: llamada.etapa,
          pendiente: llamada.pendiente,
          nombreLead: nombre,
          rutaDeLaFicha: `/p/${programaSlug}/deals/${llamada.dealId}`,
        }
      : null;
  const { elegir, dialogo: dialogoDeRespuesta } = useResponder(mapa, opciones, nombreDeEtapa, () => {
    setDialogo(null);
    router.refresh();
  });
  const respuestas = llamada.etapa === "atendido" ? respuestasDe("atendido", llamada.pendiente) : [];
  return (
    <li className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1">
        <button type="button" className="block w-full min-w-0 space-y-1 text-left" onClick={() => setVerDetalle(true)}>
          <span className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-medium text-marca-texto">{nombre}</span>
            <Badge variant={TONO_DE_RESULTADO[llamada.resultado]}>{ETIQUETA_DE_RESULTADO[llamada.resultado]}</Badge>
            {llamada.closerNombre ? <Badge variant="neutro">{llamada.closerNombre}</Badge> : null}
          </span>
          {llamada.leadEmail ? <span className="block truncate text-xs text-muted-foreground">{llamada.leadEmail}</span> : null}
          <span className="cifra block text-xs text-muted-foreground">
            {llamada.fechaAgenda ? `Cita ${fechaHoraEnBogota(llamada.fechaAgenda)}` : llamada.fechaLlamada ? `Ocurrió ${fechaHoraEnBogota(llamada.fechaLlamada)}` : "Sin fecha"}
          </span>
        </button>
        <div className="flex flex-wrap gap-x-4 text-xs">
          {llamada.linkCalendly ? <a className="text-marca-texto underline-offset-2 hover:underline" href={llamada.linkCalendly} target="_blank" rel="noreferrer">Cita en Calendly</a> : null}
          {llamada.linkGrain ? <a className="text-marca-texto underline-offset-2 hover:underline" href={llamada.linkGrain} target="_blank" rel="noreferrer">Grabación</a> : null}
        </div>
        {llamada.notas ? <p className="whitespace-pre-wrap text-sm text-muted-foreground">{llamada.notas}</p> : null}
      </div>
      {puedeTrabajar && llamada.dealId ? (
        <div className="flex flex-wrap gap-2">
          {!llamada.linkGrain ? <Button size="sm" variant="secondary" onClick={() => setDialogo("grain")}>Pegar Grain</Button> : null}
          {llamada.resultado === "show" && respuestas.length > 0 ? (
            <Button size="sm" variant="outline" onClick={() => setDialogo("resultado")}>Elegir resultado</Button>
          ) : null}
        </div>
      ) : null}
      {dialogo === "grain" ? <DialogoGrain callId={llamada.callId} onCerrar={() => setDialogo(null)} /> : null}
      {dialogo === "resultado" ? (
        <DialogoForm
          titulo={PREGUNTA_DE_ETAPA.atendido.pregunta ?? "¿Cómo terminó?"}
          descripcion="Elige una salida; el motor valida los datos y mueve el deal."
          pendiente={false}
          onCerrar={() => setDialogo(null)}
          deshabilitarConfirmar
          confirmar={{ texto: "Elige una opción", enCurso: "Elige una opción", onClick: () => undefined }}
        >
          <BotonesDeRespuesta
            respuestas={respuestas}
            onElegir={(r) => {
              setDialogo(null);
              if (deal) elegir(deal, r);
            }}
          />
        </DialogoForm>
      ) : null}
      {dialogoDeRespuesta}
      {verDetalle ? (
        <DetalleDeLlamada programaSlug={programaSlug} callId={llamada.callId} conIrAlDeal onCerrar={() => setVerDetalle(false)} />
      ) : null}
    </li>
  );
}

function DialogoGrain({ callId, onCerrar }: { callId: string; onCerrar: () => void }) {
  const { pendiente, correr } = useAccion();
  const [link, setLink] = useState("");
  return (
    <DialogoForm
      titulo="Pegar el link de Grain"
      descripcion="Pegarlo confirma que la llamada sucedió y mueve el deal a Atendido cuando corresponde."
      pendiente={pendiente}
      onCerrar={onCerrar}
      deshabilitarConfirmar={!link.trim()}
      confirmar={{ texto: "Guardar", enCurso: "Guardando…", onClick: () => correr(() => pegarGrainAccion({ callId, linkGrain: link }), { exito: "Grain guardado.", alExito: onCerrar }) }}
    >
      <Campo etiqueta="Link de la grabación"><input type="url" className={claseInput} value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://grain.com/…" /></Campo>
    </DialogoForm>
  );
}
