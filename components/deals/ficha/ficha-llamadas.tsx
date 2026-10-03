"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { ID_DE_SECCION, useAccionPedida } from "./accion-pedida";
import { DetalleDeLlamada } from "@/components/deals/detalle-de-llamada";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardAction } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fechaHoraEnBogota, hoyEnBogota } from "@/lib/format";
import type { EtapaDeal } from "@/lib/deals/etapas";
import { citaActiva, ETIQUETA_DE_RESULTADO, TONO_DE_RESULTADO } from "@/lib/deals/estado-de-llamada";
import type { FichaDeLlamada, OpcionesDeFicha } from "@/lib/queries/ficha-deal";
import {
  agregarLlamadaAccion,
  completarAgendadaAccion,
  marcarFallidaAccion,
  pegarGrainAccion,
} from "@/app/(app)/p/[programa]/deals/[id]/acciones";
import { Campo, claseInput, claseTextarea, DialogoForm, Vacio } from "./campos";
import { useAccion } from "./uso-accion";

/**
 * Las llamadas del deal (ticket 074, ADR 0037, ADR 0015): todas las del deal, con las
 * anuladas tachadas. Aqui se conectan los backends de los tickets 057 a 059:
 *
 * - **Agregar** una llamada con su fecha (mueve a Agendado desde las etapas que la tabla permite).
 * - **Completar** la agendada que el sistema dejo sin fecha (la de Calendly).
 * - **Pegar el Grain** = "la llamada sucedio": un link y el deal pasa a Atendido.
 * - **Marcar fallida** (no_show o cancelada) = Re-agenda pendiente (PR1). Desde Atendido pide motivo de re-agenda.
 *
 * Las fechas se escriben en Bogota: el servidor arma el instante con `-05:00` explicito.
 */

type Dialogo =
  | { tipo: "agregar" }
  | { tipo: "completar"; llamada: FichaDeLlamada }
  | { tipo: "grain"; llamada: FichaDeLlamada }
  | { tipo: "fallida"; llamada: FichaDeLlamada };

export function FichaLlamadas({
  llamadas,
  dealId,
  etapa,
  opciones,
  puedeRegistrar,
}: {
  llamadas: FichaDeLlamada[];
  dealId: string;
  etapa: EtapaDeal;
  opciones: OpcionesDeFicha;
  /** Trabaja leads Y es el dueño (o administra) Y el deal esta abierto. Proyeccion: la reja es el servidor. */
  puedeRegistrar: boolean;
}) {
  const { programa: programaSlug } = useParams<{ programa: string }>();
  const [dialogo, setDialogo] = useState<Dialogo | null>(null);
  const [detalleId, setDetalleId] = useState<string | null>(null);
  const cerrar = () => setDialogo(null);
  const activaId = citaActiva(llamadas);
  const activa = llamadas.find((llamada) => llamada.id === activaId) ?? null;
  const anteriores = llamadas.filter((llamada) => llamada.id !== activaId);
  // La pregunta de la etapa llega aquí con el formulario ya elegido (ADR 0072): "Agendó" y
  // "Se movió" agregan una llamada con fecha (el motor mueve a Agendado: E4, E7 o E9);
  // "No asistió o canceló" marca fallida la cita vigente más reciente (PR1).
  useAccionPedida(["agendar", "reprogramar", "fallida"], (accion) => {
    if (accion !== "fallida") return setDialogo({ tipo: "agregar" });
    const vigenteId = citaActiva(llamadas);
    const vigente = llamadas.find((llamada) => llamada.id === vigenteId);
    if (vigente) setDialogo({ tipo: "fallida", llamada: vigente });
  });

  const filaDe = (c: FichaDeLlamada, esActiva: boolean) => {
    const anulada = c.anuladoEn != null;
    const sinCompletar = c.resultado === "agendada" && !c.closerNombre;
    return (
      <li key={c.id} className={anulada ? "space-y-1 px-4 py-3 text-sm opacity-60" : "space-y-1 px-4 py-3 text-sm"}>
        <button type="button" className="-mx-2 flex w-[calc(100%+1rem)] cursor-pointer flex-wrap items-center gap-2 rounded-lg px-2 py-2 text-left outline-none transition-colors duration-150 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setDetalleId(c.id)}>
          {esActiva
            ? <Badge variant="default">Cita activa</Badge>
            : <Badge variant={TONO_DE_RESULTADO[c.resultado]}>{ETIQUETA_DE_RESULTADO[c.resultado]}</Badge>}
          {c.sinGrain ? <Badge variant="peligro">Sin Grain</Badge> : null}
          <span className={anulada ? "cifra line-through" : "cifra"}>
            {c.fechaAgenda ? `Cita ${fechaHoraEnBogota(c.fechaAgenda)}` : "Sin fecha de cita"}
          </span>
          {c.fechaLlamada ? <span className="cifra text-xs text-muted-foreground">Ocurrió {fechaHoraEnBogota(c.fechaLlamada)}</span> : null}
          <span className="ml-auto text-xs text-muted-foreground">{c.closerNombre ?? "Sin closer"}</span>
        </button>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {c.linkCalendly ? <a className="text-marca-texto underline-offset-2 hover:underline" href={c.linkCalendly} target="_blank" rel="noreferrer">Link de la cita</a> : null}
          {c.linkGrain ? <a className="text-marca-texto underline-offset-2 hover:underline" href={c.linkGrain} target="_blank" rel="noreferrer">Grain</a> : null}
        </div>
        {c.notas ? <p className="whitespace-pre-wrap text-muted-foreground">{c.notas}</p> : null}
        {anulada ? <p className="text-xs text-muted-foreground"><Badge variant="neutro">Anulada</Badge> {c.anuladoPorNombre ?? ""} · {c.motivoAnulacion}</p> : null}
        {puedeRegistrar && !anulada ? (
          <div className="space-y-2 pt-1">
            {sinCompletar ? <div className="flex flex-wrap items-center gap-2"><Button size="xs" variant="secondary" onClick={() => setDialogo({ tipo: "completar", llamada: c })}>Poner fecha de la cita</Button><span className="text-xs text-muted-foreground">La cita llegó sin fecha; queda a tu nombre.</span></div> : null}
            {!c.linkGrain ? <div className="flex flex-wrap items-center gap-2"><Button size="xs" variant="secondary" onClick={() => setDialogo({ tipo: "grain", llamada: c })}>Link de Grain</Button><span className="text-xs text-muted-foreground">La llamada sucedió; el deal pasa a Atendido.</span></div> : null}
            {c.resultado === "agendada" || c.resultado === "show" ? <div className="flex flex-wrap items-center gap-2"><Button size="xs" variant="outline" onClick={() => setDialogo({ tipo: "fallida", llamada: c })}>No se dio</Button><span className="text-xs text-muted-foreground">No show o cancelada; queda para re-agendar.</span></div> : null}
          </div>
        ) : null}
      </li>
    );
  };

  return (
    <Card id={ID_DE_SECCION.llamadas} className="scroll-mt-24">
      <CardHeader>
        <CardTitle>Llamadas</CardTitle>
        {puedeRegistrar ? (
          <CardAction>
            <Button size="sm" variant="outline" onClick={() => setDialogo({ tipo: "agregar" })}>
              Agregar llamada
            </Button>
          </CardAction>
        ) : null}
      </CardHeader>

      {llamadas.length === 0 ? (
        <Vacio>Este deal aún no tiene llamadas.{puedeRegistrar ? " Agrega la primera con su fecha." : ""}</Vacio>
      ) : (
        <>
          {activa ? <ul className="divide-y">{filaDe(activa, true)}</ul> : null}
          {anteriores.length > 0 ? (
            <details className="border-t">
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
                Llamadas anteriores ({anteriores.length})
              </summary>
              <ul className="divide-y opacity-60">
                {anteriores.map((c) => filaDe(c, false))}
              </ul>
            </details>
          ) : null}
        </>
      )}

      {dialogo?.tipo === "agregar" ? <DialogoAgregar dealId={dealId} onCerrar={cerrar} /> : null}
      {dialogo?.tipo === "completar" ? <DialogoCompletar llamada={dialogo.llamada} onCerrar={cerrar} /> : null}
      {dialogo?.tipo === "grain" ? <DialogoGrain llamada={dialogo.llamada} onCerrar={cerrar} /> : null}
      {dialogo?.tipo === "fallida" ? (
        <DialogoFallida llamada={dialogo.llamada} etapa={etapa} opciones={opciones} onCerrar={cerrar} />
      ) : null}
      {detalleId ? (
        <DetalleDeLlamada
          programaSlug={programaSlug}
          callId={detalleId}
          esActiva={detalleId === activaId}
          conIrAlDeal={false}
          onCerrar={() => setDetalleId(null)}
        />
      ) : null}
    </Card>
  );
}

function CamposDeCita({
  dia,
  setDia,
  hora,
  setHora,
  link,
  setLink,
}: {
  dia: string;
  setDia: (v: string) => void;
  hora: string;
  setHora: (v: string) => void;
  link: string;
  setLink: (v: string) => void;
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Día de la cita" ayuda="Hora de Bogotá.">
          <input type="date" className={claseInput} value={dia} onChange={(e) => setDia(e.target.value)} />
        </Campo>
        <Campo etiqueta="Hora">
          <input type="time" className={claseInput} value={hora} onChange={(e) => setHora(e.target.value)} />
        </Campo>
      </div>
      <Campo etiqueta="Link de la reunión (opcional)" ayuda="Calendly, Meet, Zoom o el que acordaron">
        <input type="url" className={claseInput} value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://calendly.com/…" />
      </Campo>
    </>
  );
}

function DialogoAgregar({ dealId, onCerrar }: { dealId: string; onCerrar: () => void }) {
  const { pendiente, correr } = useAccion();
  const [dia, setDia] = useState(hoyEnBogota());
  const [hora, setHora] = useState("");
  const [link, setLink] = useState("");
  const [notas, setNotas] = useState("");
  return (
    <DialogoForm
      titulo="Agregar llamada"
      descripcion="Una llamada con su fecha. Si el deal está en una etapa previa, pasa a Agendado."
      pendiente={pendiente}
      onCerrar={onCerrar}
      deshabilitarConfirmar={!dia || !hora}
      confirmar={{
        texto: "Agregar",
        enCurso: "Agregando…",
        onClick: () =>
          correr(() => agregarLlamadaAccion({ dealId, dia, hora, linkCalendly: link, notas }), {
            exito: (r) => (r.movioAAgendado ? "Llamada agregada: el deal pasó a Agendado." : "Llamada agregada."),
            alExito: onCerrar,
          }),
      }}
    >
      <CamposDeCita dia={dia} setDia={setDia} hora={hora} setHora={setHora} link={link} setLink={setLink} />
      <Campo etiqueta="Notas (opcional)">
        <textarea className={claseTextarea} value={notas} onChange={(e) => setNotas(e.target.value)} />
      </Campo>
    </DialogoForm>
  );
}

function DialogoCompletar({ llamada, onCerrar }: { llamada: FichaDeLlamada; onCerrar: () => void }) {
  const { pendiente, correr } = useAccion();
  const [dia, setDia] = useState(hoyEnBogota());
  const [hora, setHora] = useState("");
  const [link, setLink] = useState(llamada.linkCalendly ?? "");
  return (
    <DialogoForm
      titulo="Poner fecha de la cita"
      descripcion="La cita llegó sin fecha; al completarla, queda a tu nombre."
      pendiente={pendiente}
      onCerrar={onCerrar}
      deshabilitarConfirmar={!dia || !hora}
      confirmar={{
        texto: "Completar",
        enCurso: "Guardando…",
        onClick: () =>
          correr(() => completarAgendadaAccion({ callId: llamada.id, dia, hora, linkCalendly: link }), {
            exito: "Llamada completada.",
            alExito: onCerrar,
          }),
      }}
    >
      <CamposDeCita dia={dia} setDia={setDia} hora={hora} setHora={setHora} link={link} setLink={setLink} />
    </DialogoForm>
  );
}

function DialogoGrain({ llamada, onCerrar }: { llamada: FichaDeLlamada; onCerrar: () => void }) {
  const { pendiente, correr } = useAccion();
  const [link, setLink] = useState("");
  return (
    <DialogoForm
      titulo="Link de Grain"
      descripcion="La llamada sucedió; el deal pasa a Atendido."
      pendiente={pendiente}
      onCerrar={onCerrar}
      deshabilitarConfirmar={link.trim() === ""}
      confirmar={{
        texto: "Guardar",
        enCurso: "Guardando…",
        onClick: () =>
          correr(() => pegarGrainAccion({ callId: llamada.id, linkGrain: link }), {
            exito: (r) => (r.movioAAtendido ? "Grain guardado: el deal pasó a Atendido." : "Grain guardado."),
            alExito: onCerrar,
          }),
      }}
    >
      {llamada.fechaLlamada == null && llamada.fechaAgenda != null && llamada.fechaAgenda <= new Date() ? (
        <p className="text-sm text-muted-foreground">Se anota que ocurrió el {fechaHoraEnBogota(llamada.fechaAgenda)}.</p>
      ) : null}
      <Campo etiqueta="Link de la grabación">
        <input type="url" className={claseInput} value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://grain.com/…" />
      </Campo>
    </DialogoForm>
  );
}

function DialogoFallida({
  llamada,
  etapa,
  opciones,
  onCerrar,
}: {
  llamada: FichaDeLlamada;
  etapa: EtapaDeal;
  opciones: OpcionesDeFicha;
  onCerrar: () => void;
}) {
  const { pendiente, correr } = useAccion();
  const [resultado, setResultado] = useState<"no_show" | "cancelada">("no_show");
  const [motivoId, setMotivoId] = useState<string | null>(null);
  // Desde Atendido la flecha a Re-agenda exige un motivo de la lista de re-agenda (PR2).
  const pideMotivo = etapa === "atendido";
  const motivos = opciones.motivos.filter((m) => m.tipo === "reagenda");
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
      deshabilitarConfirmar={pideMotivo && !motivoId}
      confirmar={{
        texto: "Marcar",
        enCurso: "Guardando…",
        onClick: () =>
          correr(() => marcarFallidaAccion({ callId: llamada.id, resultado, motivoId: pideMotivo ? (motivoId ?? undefined) : undefined }), {
            exito: "Marcada: el deal quedó con Re-agenda pendiente.",
            alExito: onCerrar,
          }),
      }}
    >
      <Campo etiqueta="¿Qué pasó?">
        <Select value={resultado} items={resultados} onValueChange={(v: string | null) => v && setResultado(v as "no_show" | "cancelada")}>
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
      {pideMotivo ? (
        <Campo etiqueta="Motivo de la re-agenda">
          <Select value={motivoId} items={motivos.map((m) => ({ value: m.id, label: m.nombre }))} onValueChange={(v: string | null) => setMotivoId(v)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Elige un motivo" />
            </SelectTrigger>
            <SelectContent>
              {motivos.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Campo>
      ) : null}
    </DialogoForm>
  );
}
