"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { ID_DE_SECCION, useAccionPedida } from "./accion-pedida";
import { DetalleDeLlamada } from "@/components/deals/detalle-de-llamada";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardAction } from "@/components/ui/card";
import { fechaHoraEnBogota, hoyEnBogota } from "@/lib/format";
import { citaActiva, ETIQUETA_DE_RESULTADO, TONO_DE_RESULTADO } from "@/lib/deals/estado-de-llamada";
import type { FichaDeLlamada, OpcionesDeFicha } from "@/lib/queries/ficha-deal";
import {
  agregarLlamadaAccion,
  completarAgendadaAccion,
} from "@/app/(app)/p/[programa]/deals/[id]/acciones";
import { Campo, claseInput, claseTextarea, DialogoForm, Vacio } from "./campos";
import { CampoGrain } from "./campo-grain";
import { AccionesDeLlamada } from "./acciones-de-llamada";
import { useAccion } from "./uso-accion";

/**
 * Las llamadas del deal (ticket 074, ADR 0037, ADR 0015; segunda pasada, ticket 176):
 * todas las del deal, con las anuladas tachadas. En la cita activa (y en su detalle) el
 * **Link de Grain** es un campo siempre visible que guarda al pegar o al salir del campo, y
 * hay **un solo botón "Resultado"** (Show, No show, Cancelada, Reagendada), todo en el
 * componente compartido `AccionesDeLlamada`. "Poner fecha de la cita" dejó de ser un botón:
 * es un campo de fecha (`completarAgendadaAccion`) cuando el sistema creó la cita sin fecha.
 *
 * Las fechas se escriben en Bogota: el servidor arma el instante con `-05:00` explicito.
 */

export function FichaLlamadas({
  llamadas,
  dealId,
  opciones,
  puedeRegistrar,
}: {
  llamadas: FichaDeLlamada[];
  dealId: string;
  opciones: OpcionesDeFicha;
  /** Trabaja leads Y es el dueño (o administra) Y el deal esta abierto. Proyeccion: la reja es el servidor. */
  puedeRegistrar: boolean;
}) {
  const { programa: programaSlug } = useParams<{ programa: string }>();
  const [agregando, setAgregando] = useState(false);
  const [detalleId, setDetalleId] = useState<string | null>(null);
  // La pregunta de la etapa de Agendado abre "Resultado" sobre la cita activa (ADR 0072):
  // "Se movió" y "No asistió o canceló" se eligen ahí. "Agendar" agrega una cita nueva. Se
  // remonta el bloque de acciones con una llave para abrir el diálogo sin un efecto.
  const [pedirResultado, setPedirResultado] = useState(0);
  const activaId = citaActiva(llamadas);
  const activa = llamadas.find((llamada) => llamada.id === activaId) ?? null;
  const sinActiva = llamadas.filter((llamada) => llamada.id !== activaId);
  // Tras marcar Show la cita deja de ser activa y cae al colapsable: la última con Show y
  // sin Grain se queda a la vista con su campo, porque es justo cuando se tiene el link (180).
  const pendienteDeGrain =
    puedeRegistrar
      ? sinActiva
          .filter((llamada) => llamada.sinGrain && llamada.anuladoEn == null)
          .sort((a, b) => instanteDe(b) - instanteDe(a))[0] ?? null
      : null;
  const anteriores = sinActiva.filter((llamada) => llamada.id !== pendienteDeGrain?.id);
  useAccionPedida(["agendar", "reprogramar", "fallida"], (accion) => {
    if (accion === "agendar") return setAgregando(true);
    if (activa) setPedirResultado((n) => n + 1);
  });

  const filaDe = (c: FichaDeLlamada, esActiva: boolean) => {
    const anulada = c.anuladoEn != null;
    const sinCompletar = c.resultado === "agendada" && !c.closerNombre;
    const puedeRegistrarEnEsta = puedeRegistrar && !anulada;
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
        {puedeRegistrarEnEsta && esActiva ? (
          <div className="space-y-2 pt-1">
            {sinCompletar ? <CompletarFecha llamada={c} /> : null}
            <AccionesDeLlamada
              key={pedirResultado}
              callId={c.id}
              dealId={dealId}
              linkGrain={c.linkGrain}
              motivosReagenda={opciones.motivos}
              abrirInicial={pedirResultado > 0 ? "resultado" : null}
            />
          </div>
        ) : null}
        {puedeRegistrarEnEsta && !esActiva && !c.linkGrain ? (
          <div className="pt-1"><CampoGrain callId={c.id} valor={c.linkGrain} /></div>
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
            <Button size="sm" variant="outline" onClick={() => setAgregando(true)}>
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
          {pendienteDeGrain ? <ul className="divide-y border-t">{filaDe(pendienteDeGrain, false)}</ul> : null}
          {!activa && sinActiva.length > 0 ? (
            <p className="px-4 pt-3 text-sm text-muted-foreground">Sin cita activa.</p>
          ) : null}
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

      {agregando ? <DialogoAgregar dealId={dealId} onCerrar={() => setAgregando(false)} /> : null}
      {detalleId ? (
        <DetalleDeLlamada
          programaSlug={programaSlug}
          callId={detalleId}
          esActiva={detalleId === activaId}
          conIrAlDeal={false}
          puedeRegistrar={puedeRegistrar}
          motivosReagenda={opciones.motivos}
          onCerrar={() => setDetalleId(null)}
        />
      ) : null}
    </Card>
  );
}

function instanteDe(c: FichaDeLlamada): number {
  return new Date(c.fechaLlamada ?? c.fechaAgenda ?? 0).getTime();
}

/** El campo de fecha de la cita que el sistema creó sin ella (`completarAgendadaAccion`). */
function CompletarFecha({ llamada }: { llamada: FichaDeLlamada }) {
  const { pendiente, correr } = useAccion();
  const [dia, setDia] = useState(hoyEnBogota());
  const [hora, setHora] = useState("");
  const [link, setLink] = useState(llamada.linkCalendly ?? "");
  return (
    <div className="space-y-2 rounded-lg bg-muted/50 p-3">
      <p className="text-xs text-muted-foreground">La cita llegó sin fecha; al ponerla, queda a tu nombre.</p>
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
      <Button
        size="xs"
        variant="secondary"
        disabled={pendiente || !dia || !hora}
        onClick={() =>
          correr(() => completarAgendadaAccion({ callId: llamada.id, dia, hora, linkCalendly: link }), {
            exito: "Llamada completada.",
          })
        }
      >
        {pendiente ? "Guardando…" : "Poner fecha de la cita"}
      </Button>
    </div>
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
      <Campo etiqueta="Notas (opcional)">
        <textarea className={claseTextarea} value={notas} onChange={(e) => setNotas(e.target.value)} />
      </Campo>
    </DialogoForm>
  );
}
