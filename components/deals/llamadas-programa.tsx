"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fechaHoraEnBogota } from "@/lib/format";
import type { FilaLlamadaPrograma } from "@/lib/queries/llamadas";
import type { EtapaDeal } from "@/lib/deals/etapas";
import type { OpcionesDeFicha } from "@/lib/queries/ficha-deal";
import { pegarGrainAccion } from "@/app/(app)/p/[programa]/deals/[id]/acciones";
import { moverDeal } from "@/app/(app)/p/[programa]/deals/acciones";
import { DialogoMover, type DatosDialogo } from "@/components/deals/dialogo-mover";
import { Campo, claseInput, DialogoForm, Vacio } from "@/components/deals/ficha/campos";
import { flechaPideDatos, flechasDesde, type FlechaCliente, type MapaTransiciones } from "@/components/deals/transiciones";
import { useAccion } from "@/components/deals/ficha/uso-accion";

const ETIQUETA: Record<FilaLlamadaPrograma["resultado"], string> = {
  agendada: "Agendada",
  show: "Show",
  no_show: "No show",
  cancelada: "Cancelada",
  reagendada: "Reagendada",
  compromiso_pago: "Compromiso de pago",
  cerrada: "Cerrada",
  perdida: "Perdida",
};
const TONO: Record<FilaLlamadaPrograma["resultado"], "neutro" | "info" | "alerta" | "exito" | "peligro"> = {
  agendada: "info",
  show: "exito",
  no_show: "peligro",
  cancelada: "alerta",
  reagendada: "alerta",
  compromiso_pago: "alerta",
  cerrada: "exito",
  perdida: "peligro",
};

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
  const [dialogo, setDialogo] = useState<"grain" | "resultado" | null>(null);
  const flechas = llamada.etapa ? flechasDesde(mapa, llamada.etapa).filter((f) => f.quien !== "sistema") : [];
  const nombre = llamada.leadNombre ?? llamada.leadEmail ?? "Llamada sin lead";
  return (
    <li className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          {llamada.dealId ? (
            <Link href={`/p/${programaSlug}/deals/${llamada.dealId}`} className="truncate text-sm font-medium text-marca-texto underline-offset-2 hover:underline">
              {nombre}
            </Link>
          ) : <span className="truncate text-sm font-medium">{nombre}</span>}
          <Badge variant={TONO[llamada.resultado]}>{ETIQUETA[llamada.resultado]}</Badge>
          {llamada.closerNombre ? <Badge variant="neutro">{llamada.closerNombre}</Badge> : null}
        </div>
        {llamada.leadEmail ? <p className="truncate text-xs text-muted-foreground">{llamada.leadEmail}</p> : null}
        <p className="cifra text-xs text-muted-foreground">
          {llamada.fechaAgenda ? `Cita ${fechaHoraEnBogota(llamada.fechaAgenda)}` : llamada.fechaLlamada ? `Ocurrió ${fechaHoraEnBogota(llamada.fechaLlamada)}` : "Sin fecha"}
        </p>
        <div className="flex flex-wrap gap-x-4 text-xs">
          {llamada.linkCalendly ? <a className="text-marca-texto underline-offset-2 hover:underline" href={llamada.linkCalendly} target="_blank" rel="noreferrer">Cita en Calendly</a> : null}
          {llamada.linkGrain ? <a className="text-marca-texto underline-offset-2 hover:underline" href={llamada.linkGrain} target="_blank" rel="noreferrer">Grabación</a> : null}
        </div>
        {llamada.notas ? <p className="whitespace-pre-wrap text-sm text-muted-foreground">{llamada.notas}</p> : null}
      </div>
      {puedeTrabajar && llamada.dealId ? (
        <div className="flex flex-wrap gap-2">
          {!llamada.linkGrain ? <Button size="sm" variant="secondary" onClick={() => setDialogo("grain")}>Pegar Grain</Button> : null}
          {llamada.resultado === "show" && flechas.length > 0 ? (
            <Button size="sm" variant="outline" onClick={() => setDialogo("resultado")}>Elegir resultado</Button>
          ) : null}
        </div>
      ) : null}
      {dialogo === "grain" ? <DialogoGrain callId={llamada.callId} onCerrar={() => setDialogo(null)} /> : null}
      {dialogo === "resultado" && llamada.etapa && llamada.dealId ? (
        <DialogoResultado
          dealId={llamada.dealId}
          flechas={flechas}
          opciones={opciones}
          nombreDeEtapa={nombreDeEtapa}
          onCerrar={() => setDialogo(null)}
        />
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

function DialogoResultado({
  dealId, flechas, opciones, nombreDeEtapa, onCerrar,
}: {
  dealId: string;
  flechas: FlechaCliente[];
  opciones: OpcionesDeFicha;
  nombreDeEtapa: Record<EtapaDeal, string>;
  onCerrar: () => void;
}) {
  const [flecha, setFlecha] = useState<FlechaCliente | null>(null);
  const [pendiente, setPendiente] = useState(false);
  async function mover(f: FlechaCliente, datos: DatosDialogo) {
    setPendiente(true);
    const r = await moverDeal({ dealId, a: f.a, datos: { productoId: datos.productoId, valorVendidoUsd: datos.valorVendidoUsd, areaDeclaradaId: datos.areaDeclaradaId, fechaLimitePago: datos.fechaLimitePago, cohorteDestinoId: datos.cohorteDestinoId, fechaSeguimiento: datos.fechaSeguimiento }, motivoId: datos.motivoId ?? null });
    setPendiente(false);
    if (r.ok) { toast.success(`Deal movido a ${nombreDeEtapa[f.a]}.`); onCerrar(); }
    else toast.error(r.faltantes.length ? r.faltantes.map((x) => x.mensaje).join(" ") : r.error, { duration: 6000 });
  }
  if (flecha) {
    return <DialogoMover abierto onAbrir={(abierto) => !abierto && onCerrar()} flecha={flecha} etapaDestinoNombre={nombreDeEtapa[flecha.a]} nombreLead="el lead" productos={opciones.productos} areas={opciones.areas} cohortes={opciones.cohortes} motivos={opciones.motivos} pendiente={pendiente} onConfirmar={(datos) => void mover(flecha, datos)} />;
  }
  return (
    <DialogoForm
      titulo="¿Cómo terminó la llamada?"
      descripcion="Elige una salida; el motor valida los datos y mueve el deal."
      pendiente={false}
      onCerrar={onCerrar}
      deshabilitarConfirmar
      confirmar={{ texto: "Elige una opción", enCurso: "Elige una opción", onClick: () => undefined }}
    >
      <div className="grid gap-2">
        {flechas.map((f) => <Button key={f.a} type="button" variant="outline" onClick={() => setFlecha(f)}>{nombreDeEtapa[f.a]}{flechaPideDatos(f) ? "…" : ""}</Button>)}
      </div>
    </DialogoForm>
  );
}
