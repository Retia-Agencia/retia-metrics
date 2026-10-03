"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { hoyEnBogota } from "@/lib/format";
import {
  agregarLlamadaAccion,
  marcarFallidaAccion,
} from "@/app/(app)/p/[programa]/deals/[id]/acciones";
import type { OpcionesDeFicha } from "@/lib/queries/ficha-deal";
import { Campo, claseInput, claseTextarea, DialogoForm } from "./campos";
import { CampoGrain } from "./campo-grain";
import { useAccion } from "./uso-accion";

type DialogoLlamada = "resultado" | "no_show" | "cancelada" | "agregar" | null;

/**
 * Las acciones de una cita, iguales en la ficha, en Calls, en el Inbox y en el detalle
 * (ticket 176, decisión 3): el **Link de Grain** siempre visible y **un solo botón
 * "Resultado"** con Show, No show, Cancelada y Reagendada. Show no abre sub-flujo: pone el
 * foco en el campo de Grain. No show y Cancelada van a `marcarFallidaAccion` (deal a
 * Re-agenda); Reagendada agrega una nueva cita con `agregarLlamadaAccion`.
 *
 * No conocemos la etapa del deal aquí, así que el motivo de re-agenda se ofrece siempre que
 * la lista tenga alguno; el servidor lo exige (desde Atendido) o lo ignora.
 *
 * `abrirInicial` deja que la ficha abra "Resultado" al montar, desde la pregunta de la
 * etapa (ADR 0072: "Se movió", "No asistió"); se pasa remontando con `key` para no llamar
 * a `setState` dentro de un efecto.
 */
export function AccionesDeLlamada({
  callId,
  dealId,
  linkGrain,
  motivosReagenda,
  abrirInicial = null,
}: {
  callId: string;
  /** El deal de la cita: Reagendada agrega una nueva cita sobre él. `null` cuelga esa opción. */
  dealId: string | null;
  linkGrain: string | null;
  motivosReagenda: OpcionesDeFicha["motivos"];
  abrirInicial?: "resultado" | null;
}) {
  const grainRef = useRef<HTMLInputElement>(null);
  const [dialogo, setDialogo] = useState<DialogoLlamada>(abrirInicial);

  return (
    <div className="space-y-2">
      <CampoGrain ref={grainRef} callId={callId} valor={linkGrain} />
      <div className="flex flex-wrap items-center gap-2">
        <Button size="xs" variant="outline" onClick={() => setDialogo("resultado")}>Resultado</Button>
        <span className="text-xs text-muted-foreground">Show, no show, cancelada o reagendada.</span>
      </div>

      {dialogo === "resultado" ? (
        <DialogoResultado
          conReagenda={dealId != null}
          onCerrar={() => setDialogo(null)}
          onShow={() => {
            setDialogo(null);
            grainRef.current?.focus();
          }}
          onFallida={(resultado) => setDialogo(resultado)}
          onReagendada={() => setDialogo("agregar")}
        />
      ) : null}
      {dialogo === "no_show" || dialogo === "cancelada" ? (
        <DialogoFallida callId={callId} resultado={dialogo} motivos={motivosReagenda} onCerrar={() => setDialogo(null)} />
      ) : null}
      {dialogo === "agregar" && dealId ? (
        <DialogoAgregar dealId={dealId} onCerrar={() => setDialogo(null)} />
      ) : null}
    </div>
  );
}

/** Las cuatro salidas de una cita, cada una con su línea de lo que provoca. */
function DialogoResultado({
  conReagenda,
  onCerrar,
  onShow,
  onFallida,
  onReagendada,
}: {
  conReagenda: boolean;
  onCerrar: () => void;
  onShow: () => void;
  onFallida: (resultado: "no_show" | "cancelada") => void;
  onReagendada: () => void;
}) {
  const opciones: { etiqueta: string; linea: string; onClick: () => void }[] = [
    { etiqueta: "Show", linea: "Se marca al pegar el link de Grain; el deal pasa a Atendido.", onClick: onShow },
    { etiqueta: "No show", linea: "No apareció; el deal queda en Re-agenda.", onClick: () => onFallida("no_show") },
    { etiqueta: "Cancelada", linea: "Avisó y canceló; el deal queda en Re-agenda.", onClick: () => onFallida("cancelada") },
    ...(conReagenda
      ? [{ etiqueta: "Reagendada", linea: "Se agenda una nueva cita con su fecha.", onClick: onReagendada }]
      : []),
  ];
  return (
    <DialogoForm
      titulo="Resultado de la cita"
      descripcion="Elige qué pasó con esta cita."
      pendiente={false}
      onCerrar={onCerrar}
      deshabilitarConfirmar
      confirmar={{ texto: "Elige una opción", enCurso: "Elige una opción", onClick: () => undefined }}
    >
      <div className="space-y-3">
        {opciones.map((opcion) => (
          <div key={opcion.etiqueta} className="space-y-1">
            <Button type="button" size="sm" variant="secondary" onClick={opcion.onClick}>
              {opcion.etiqueta}
            </Button>
            <p className="text-xs text-muted-foreground">{opcion.linea}</p>
          </div>
        ))}
      </div>
    </DialogoForm>
  );
}

function DialogoFallida({
  callId,
  resultado: resultadoInicial,
  motivos,
  onCerrar,
}: {
  callId: string;
  resultado: "no_show" | "cancelada";
  motivos: OpcionesDeFicha["motivos"];
  onCerrar: () => void;
}) {
  const { pendiente, correr } = useAccion();
  const [resultado, setResultado] = useState<"no_show" | "cancelada">(resultadoInicial);
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
      {deReagenda.length > 0 ? (
        <Campo etiqueta="Motivo de la re-agenda (si aplica)">
          <Select value={motivoId} items={deReagenda.map((m) => ({ value: m.id, label: m.nombre }))} onValueChange={(v: string | null) => setMotivoId(v)}>
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
    </DialogoForm>
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
      titulo="Reagendar: nueva cita"
      descripcion="Una llamada nueva con su fecha. Si el deal está en una etapa previa, pasa a Agendado."
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
