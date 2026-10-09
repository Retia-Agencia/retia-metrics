"use client";

import { useState } from "react";
import { toast } from "sonner";
import { anotarAccion } from "@/app/(app)/p/[programa]/deals/[id]/acciones";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { pendientesParaAnotar, type EtapaDeal, type PendienteDeal } from "@/lib/deals/etapas";
import { hoyEnBogota, instanteDeBogota } from "@/lib/format";
import type { OpcionesDeFicha } from "@/lib/queries/ficha-deal";
import { Campo, DialogoForm, claseInput, claseTextarea } from "./ficha/campos";
import { avisarCambioDeNotificaciones } from "@/lib/mi-espacio/aviso-notificaciones";

type Eleccion = "ninguno" | PendienteDeal;

export function DialogoAnotar({
  dealId,
  etapa,
  pendienteActual,
  nombreLead,
  opciones,
  onGuardado,
}: {
  dealId: string;
  etapa: EtapaDeal;
  pendienteActual: PendienteDeal | null;
  nombreLead: string;
  opciones: OpcionesDeFicha;
  onGuardado: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [comentario, setComentario] = useState("");
  const [eleccion, setEleccion] = useState<Eleccion>("ninguno");
  const [proximoContacto, setProximoContacto] = useState("");
  const [cohorteDestinoId, setCohorteDestinoId] = useState<string | null>(null);
  const [motivoId, setMotivoId] = useState<string | null>(null);
  const [fechaLlamada, setFechaLlamada] = useState("");
  const [horaLlamada, setHoraLlamada] = useState("09:00");
  const [guardando, setGuardando] = useState(false);
  const ofrecidos = pendientesParaAnotar(etapa, pendienteActual);
  const motivosReagenda = opciones.motivos.filter((m) => m.tipo === "reagenda");

  const invalido = ((eleccion === "ninguno" || eleccion === "seguimiento") && comentario.trim() === "")
    || (eleccion === "seguimiento" && !proximoContacto)
    || (eleccion === "proxima_cohorte" && !cohorteDestinoId)
    || (eleccion === "reagenda" && (!motivoId || (fechaLlamada !== "" && horaLlamada === "")));

  async function guardar() {
    const nuevaLlamada = fechaLlamada ? instanteDeBogota(fechaLlamada, horaLlamada) : null;
    if (fechaLlamada && !nuevaLlamada) {
      toast.error("La fecha de la nueva llamada no es válida.");
      return;
    }
    setGuardando(true);
    const resultado = await anotarAccion({
      dealId,
      comentario,
      ...(eleccion === "seguimiento" ? { proximoContacto } : {}),
      ...(eleccion === "proxima_cohorte" && cohorteDestinoId ? { proximaCohorte: { cohorteDestinoId } } : {}),
      ...(eleccion === "reagenda" && motivoId
        ? { reagenda: { motivoId, ...(nuevaLlamada ? { fechaLlamada: nuevaLlamada } : {}) } }
        : {}),
    });
    setGuardando(false);
    if (!resultado.ok) {
      toast.error(resultado.error, { duration: 6000 });
      return;
    }
    toast.success("Anotación guardada.");
    setAbierto(false);
    avisarCambioDeNotificaciones();
    onGuardado();
  }

  return (
    <>
      <Button type="button" className="w-full" variant="secondary" onClick={() => setAbierto(true)}>
        Anotar
      </Button>
      {abierto ? (
        <DialogoForm
          titulo="Anotar"
          descripcion={nombreLead}
          pendiente={guardando}
          deshabilitarConfirmar={invalido}
          onCerrar={() => setAbierto(false)}
          confirmar={{ texto: "Guardar anotación", enCurso: "Guardando…", onClick: guardar }}
        >
          <Campo etiqueta="Comentario">
            <textarea
              className={claseTextarea}
              value={comentario}
              maxLength={4000}
              onChange={(e) => setComentario(e.currentTarget.value)}
            />
          </Campo>

          <fieldset className="space-y-2">
            <legend className="text-xs font-medium text-muted-foreground">Próximo paso</legend>
            <Opcion valor="ninguno" eleccion={eleccion} onElegir={setEleccion}>Ninguno</Opcion>
            {ofrecidos.includes("seguimiento") ? (
              <Opcion valor="seguimiento" eleccion={eleccion} onElegir={setEleccion}>Próximo contacto</Opcion>
            ) : null}
            {ofrecidos.includes("proxima_cohorte") ? (
              <Opcion valor="proxima_cohorte" eleccion={eleccion} onElegir={setEleccion}>Quiere la próxima cohorte</Opcion>
            ) : null}
            {ofrecidos.includes("reagenda") ? (
              <Opcion valor="reagenda" eleccion={eleccion} onElegir={setEleccion}>La llamada no se hizo / se reagenda</Opcion>
            ) : null}
          </fieldset>

          {eleccion === "seguimiento" ? (
            <Campo etiqueta="Fecha del próximo contacto" ayuda="El comentario es la razón del seguimiento.">
              <input type="date" className={claseInput} min={hoyEnBogota()} value={proximoContacto} onChange={(e) => setProximoContacto(e.currentTarget.value)} />
            </Campo>
          ) : null}

          {eleccion === "proxima_cohorte" ? (
            <Campo etiqueta="Cohorte destino">
              <Select value={cohorteDestinoId} items={opciones.cohortesDestino.map((c) => ({ value: c.id, label: c.nombre }))} onValueChange={setCohorteDestinoId}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Elige la cohorte" /></SelectTrigger>
                <SelectContent>
                  {opciones.cohortesDestino.map((c) => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </Campo>
          ) : null}

          {eleccion === "reagenda" ? (
            <>
              <Campo etiqueta="Motivo">
                <Select value={motivoId} items={motivosReagenda.map((m) => ({ value: m.id, label: m.nombre }))} onValueChange={setMotivoId}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Elige un motivo" /></SelectTrigger>
                  <SelectContent>
                    {motivosReagenda.map((m) => <SelectItem key={m.id} value={m.id}>{m.nombre}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Campo>
              <div className="grid gap-3 sm:grid-cols-2">
                <Campo etiqueta="Nueva llamada (opcional)">
                  <input type="date" className={claseInput} min={hoyEnBogota()} value={fechaLlamada} onChange={(e) => setFechaLlamada(e.currentTarget.value)} />
                </Campo>
                {fechaLlamada ? (
                  <Campo etiqueta="Hora de Bogotá">
                    <input type="time" className={claseInput} value={horaLlamada} onChange={(e) => setHoraLlamada(e.currentTarget.value)} />
                  </Campo>
                ) : null}
              </div>
            </>
          ) : null}
        </DialogoForm>
      ) : null}
    </>
  );
}

function Opcion({
  valor,
  eleccion,
  onElegir,
  children,
}: {
  valor: Eleccion;
  eleccion: Eleccion;
  onElegir: (valor: Eleccion) => void;
  children: string;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="radio" name="pendiente-anotacion" checked={eleccion === valor} onChange={() => onElegir(valor)} />
      <span>{children}</span>
    </label>
  );
}
