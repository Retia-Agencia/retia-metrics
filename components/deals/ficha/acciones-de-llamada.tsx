"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { horaElegidaCompleta, SelectorDeHora, type HoraElegida } from "@/components/calendly/selector-de-hora";
import {
  corregirResultadoAccion,
  marcarFallidaAccion,
  marcarShowAccion,
  reagendarLlamadaAccion,
} from "@/app/(app)/p/[programa]/deals/[id]/acciones";
import type { OpcionesDeFicha } from "@/lib/queries/ficha-deal";
import { Campo, claseTextarea, DialogoForm } from "./campos";
import { CampoGrain } from "./campo-grain";
import { useAccion } from "./uso-accion";

type DialogoLlamada = "resultado" | "no_show" | "cancelada" | "reagendar" | "corregir" | null;
type ResultadoCorregible = "show" | "no_show" | "cancelada";

/**
 * Las acciones de una cita, iguales en la ficha, en Calls, en el Inbox y en el detalle
 * (ticket 176, decisión 3; pulido en el 177): el **Link de Grain** siempre visible y **un
 * solo botón "Resultado"** con Show, No show, Cancelada y Reagendada.
 *
 * - **Show** se marca en un clic (`marcarShowAccion`, ticket 177): el deal pasa a Atendido
 *   y el Grain queda opcional. Ya no abre un sub-flujo ni pone el foco en el campo de Grain.
 * - **No show** y **Cancelada** van a `marcarFallidaAccion` (deal a Re-agenda).
 * - **Reagendada** cierra la cita vieja (`reagendada`) y crea una nueva, en un solo acto
 *   (`reagendarLlamadaAccion`, ticket 177): la vieja deja de salir en "ya pasaron sin
 *   resultado" del Inbox.
 *
 * No conocemos la etapa del deal aquí, así que el motivo de re-agenda se ofrece siempre que
 * la lista tenga alguno; el servidor lo exige (desde Atendido) o lo ignora.
 *
 * Vuelve el 9-oct (A-137): el 219 lo había quitado porque Mover y Anotar ya lo cubren, pero
 * los closers resuelven citas a diario y lo quieren en la llamada misma. El botón solo sale
 * en una cita que sigue `agendada` (el servidor rechaza un resultado sobre una ya resuelta),
 * y el Grain solo en una llamada show o que ya lo tiene.
 *
 * Los motivos que piden texto ("Otro") no se ofrecen aquí, porque marcar la llamada no
 * escribe un comentario; ese caso entra por Anotar.
 */
export function AccionesDeLlamada({
  callId,
  dealId,
  linkGrain,
  resultado,
  motivosReagenda,
  puedeMarcarAtendida,
  mensajeNoPuedeMarcarAtendida,
  puedeReagendar = true,
  abrirInicial = null,
  onCambio,
}: {
  callId: string;
  /** El deal de la cita: Reagendada agrega una nueva cita sobre él. `null` cuelga esa opción. */
  dealId: string | null;
  linkGrain: string | null;
  resultado: string;
  motivosReagenda: OpcionesDeFicha["motivos"];
  puedeMarcarAtendida: boolean;
  mensajeNoPuedeMarcarAtendida: string | null;
  /** Crear la cita sucesora requiere que el deal siga abierto. */
  puedeReagendar?: boolean;
  abrirInicial?: "resultado" | null;
  /**
   * Se llama tras CADA resultado exitoso (Show, fallida, reagendada, Grain), ticket 229 (A-141):
   * el detalle de la llamada lo usa para volver a pedir sus datos, porque `router.refresh()` no
   * vuelve a correr el `useEffect` que los cargó. La ficha no lo pasa: ya se refresca sola.
   */
  onCambio?: () => void;
}) {
  const { pendiente, correr } = useAccion();
  const [dialogo, setDialogo] = useState<DialogoLlamada>(abrirInicial);

  function marcarShow() {
    setDialogo(null);
    correr(() => marcarShowAccion({ callId }), {
      exito: (r) =>
        r.movioAAtendido
          ? "Marcada como show: el deal pasó a Atendido."
          : "Marcada como show.",
      alExito: onCambio,
    });
  }

  return (
    <div className="space-y-2">
      {resultado === "show" || linkGrain ? (
        <CampoGrain
          callId={callId}
          valor={linkGrain}
          yaEsShow
          deshabilitado={!puedeMarcarAtendida}
          mensajeDeshabilitado={mensajeNoPuedeMarcarAtendida}
          onGuardado={onCambio}
        />
      ) : null}
      {resultado === "agendada" ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="xs" variant="outline" disabled={pendiente} onClick={() => setDialogo("resultado")}>Resultado</Button>
          <span className="text-xs text-muted-foreground">Show, no show, cancelada o reagendada.</span>
        </div>
      ) : null}
      {resultado === "show" || resultado === "no_show" || resultado === "cancelada" ? (
        <Button size="xs" variant="outline" disabled={pendiente} onClick={() => setDialogo("corregir")}>Corregir resultado</Button>
      ) : null}

      {dialogo === "resultado" ? (
        <DialogoResultado
          conReagenda={dealId != null && puedeReagendar}
          onCerrar={() => setDialogo(null)}
          onShow={marcarShow}
          puedeMarcarAtendida={puedeMarcarAtendida}
          mensajeNoPuedeMarcarAtendida={mensajeNoPuedeMarcarAtendida}
          onFallida={(resultado) => setDialogo(resultado)}
          onReagendada={() => setDialogo("reagendar")}
        />
      ) : null}
      {dialogo === "no_show" || dialogo === "cancelada" ? (
        <DialogoFallida callId={callId} resultado={dialogo} motivos={motivosReagenda} onCerrar={() => setDialogo(null)} onCambio={onCambio} />
      ) : null}
      {dialogo === "reagendar" ? (
        <DialogoReagendar callId={callId} dealId={dealId!} onCerrar={() => setDialogo(null)} onCambio={onCambio} />
      ) : null}
      {dialogo === "corregir" ? (
        <DialogoCorregir
          callId={callId}
          actual={resultado as ResultadoCorregible}
          motivos={motivosReagenda}
          onCerrar={() => setDialogo(null)}
          onCambio={onCambio}
        />
      ) : null}
    </div>
  );
}

function DialogoCorregir({
  callId,
  actual,
  motivos,
  onCerrar,
  onCambio,
}: {
  callId: string;
  actual: ResultadoCorregible;
  motivos: OpcionesDeFicha["motivos"];
  onCerrar: () => void;
  onCambio?: () => void;
}) {
  const opciones = ([
    { value: "show", label: "Show" },
    { value: "no_show", label: "No apareció (no show)" },
    { value: "cancelada", label: "Avisó y canceló" },
  ] as const).filter((opcion) => opcion.value !== actual);
  const [resultado, setResultado] = useState<ResultadoCorregible>(opciones[0].value);
  const [motivo, setMotivo] = useState("");
  const [motivoReagendaId, setMotivoReagendaId] = useState<string | null>(null);
  const { pendiente, correr } = useAccion();
  const deReagenda = motivos.filter((m) => m.tipo === "reagenda" && !m.pideTexto);
  const pideReagenda = actual === "show" && resultado !== "show";

  return (
    <DialogoForm
      titulo="Corregir resultado"
      descripcion="El cambio quedará en el historial y en una nota del deal."
      pendiente={pendiente}
      onCerrar={onCerrar}
      deshabilitarConfirmar={motivo.trim().length < 3 || (pideReagenda && deReagenda.length > 0 && !motivoReagendaId)}
      confirmar={{
        texto: "Corregir",
        enCurso: "Corrigiendo…",
        onClick: () => correr(() => corregirResultadoAccion({
          callId,
          resultado,
          motivo,
          ...(pideReagenda && motivoReagendaId ? { motivoReagendaId } : {}),
        }), {
          exito: "Resultado corregido.",
          alExito: () => { onCambio?.(); onCerrar(); },
        }),
      }}
    >
      <Campo etiqueta="Resultado correcto">
        <Select value={resultado} items={opciones} onValueChange={(v: string | null) => v && setResultado(v as ResultadoCorregible)}>
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            {opciones.map((opcion) => <SelectItem key={opcion.value} value={opcion.value}>{opcion.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </Campo>
      <Campo etiqueta="Motivo de la corrección">
        <textarea required minLength={3} maxLength={500} className={claseTextarea} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      </Campo>
      {pideReagenda && deReagenda.length > 0 ? (
        <Campo etiqueta="Motivo de la re-agenda">
          <Select value={motivoReagendaId} items={deReagenda.map((m) => ({ value: m.id, label: m.nombre }))} onValueChange={setMotivoReagendaId}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Elige un motivo" /></SelectTrigger>
            <SelectContent>
              {deReagenda.map((m) => <SelectItem key={m.id} value={m.id}>{m.nombre}</SelectItem>)}
            </SelectContent>
          </Select>
        </Campo>
      ) : null}
    </DialogoForm>
  );
}

/** Las cuatro salidas de una cita, cada una un botón con la línea de lo que provoca. */
function DialogoResultado({
  conReagenda,
  onCerrar,
  onShow,
  puedeMarcarAtendida,
  mensajeNoPuedeMarcarAtendida,
  onFallida,
  onReagendada,
}: {
  conReagenda: boolean;
  onCerrar: () => void;
  onShow: () => void;
  puedeMarcarAtendida: boolean;
  mensajeNoPuedeMarcarAtendida: string | null;
  onFallida: (resultado: "no_show" | "cancelada") => void;
  onReagendada: () => void;
}) {
  const opciones: { etiqueta: string; linea: string; onClick: () => void; disabled?: boolean }[] = [
    {
      etiqueta: "Show",
      linea: mensajeNoPuedeMarcarAtendida ?? "Se marca en un clic; el deal pasa a Atendido. El link de Grain es opcional.",
      onClick: onShow,
      disabled: !puedeMarcarAtendida,
    },
    { etiqueta: "No show", linea: "No apareció; el deal queda en Re-agenda.", onClick: () => onFallida("no_show") },
    { etiqueta: "Cancelada", linea: "Avisó y canceló; el deal queda en Re-agenda.", onClick: () => onFallida("cancelada") },
    ...(conReagenda
      ? [{ etiqueta: "Reagendada", linea: "Cierra esta cita y agenda una nueva con su fecha.", onClick: onReagendada }]
      : []),
  ];
  return (
    <DialogoForm
      titulo="Resultado de la cita"
      descripcion="Elige qué pasó con esta cita."
      pendiente={false}
      onCerrar={onCerrar}
    >
      <div className="space-y-3">
        {opciones.map((opcion) => (
          <div key={opcion.etiqueta} className="space-y-1">
            <Button type="button" size="sm" variant="secondary" disabled={opcion.disabled} onClick={opcion.onClick}>
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
  onCambio,
}: {
  callId: string;
  resultado: "no_show" | "cancelada";
  motivos: OpcionesDeFicha["motivos"];
  onCerrar: () => void;
  onCambio?: () => void;
}) {
  const { pendiente, correr } = useAccion();
  const [resultado, setResultado] = useState<"no_show" | "cancelada">(resultadoInicial);
  const [motivoId, setMotivoId] = useState<string | null>(null);
  const deReagenda = motivos.filter((m) => m.tipo === "reagenda" && !m.pideTexto);
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
            exito: (r) => r.cancelacionPendiente
              ? "Marcada en el CRM. La cancelación en Calendly quedó pendiente."
              : "Marcada: el deal quedó con Re-agenda pendiente.",
            alExito: () => { onCambio?.(); onCerrar(); },
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

function DialogoReagendar({ callId, dealId, onCerrar, onCambio }: { callId: string; dealId: string; onCerrar: () => void; onCambio?: () => void }) {
  const { pendiente, correr } = useAccion();
  const [fecha, setFecha] = useState<HoraElegida | null>(null);
  const [notas, setNotas] = useState("");
  return (
    <DialogoForm
      titulo="Reagendar: nueva cita"
      descripcion="Esta cita queda como reagendada y se crea una nueva con su fecha. Si el deal está en una etapa previa, pasa a Agendado."
      pendiente={pendiente}
      onCerrar={onCerrar}
      deshabilitarConfirmar={!horaElegidaCompleta(fecha)}
      confirmar={{
        texto: "Reagendar",
        enCurso: "Reagendando…",
        onClick: () =>
          correr(() => {
            if (!horaElegidaCompleta(fecha)) throw new Error("Elige una hora.");
            return reagendarLlamadaAccion({ callId, horaElegida: fecha, notas });
          }, {
            exito: (r) => r.cancelacionPendiente
              ? "La nueva cita quedó agendada; falta cancelar la anterior en Calendly."
              : r.movioAAgendado ? "Reagendada: el deal pasó a Agendado." : "Reagendada: la nueva cita quedó agendada.",
            alExito: () => { onCambio?.(); onCerrar(); },
          }),
      }}
    >
      <SelectorDeHora dealId={dealId} valor={fecha} onChange={setFecha} />
      <Campo etiqueta="Notas (opcional)">
        <textarea className={claseTextarea} value={notas} onChange={(e) => setNotas(e.target.value)} />
      </Campo>
    </DialogoForm>
  );
}
