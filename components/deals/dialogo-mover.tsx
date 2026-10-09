"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { EtapaDeal, PendienteDeal } from "@/lib/deals/etapas";
import type { CodigoRequisito } from "@/lib/deals/requisitos";
import type { RequisitoRevisado } from "@/lib/deals/mover-etapa";
import { revisarMovimientoAccion } from "@/app/(app)/p/[programa]/deals/acciones";
import type { FlechaCliente } from "./transiciones";
import { camposDeDialogo } from "./transiciones";
import type { OpcionCatalogo } from "@/lib/queries/kanban";
import { fechaDeInstanteEnBogota, fechaHoraEnBogota, hoyEnBogota, monto } from "@/lib/format";
import { proximoContactoSugerido } from "@/lib/deals/proximo-contacto";
import { Campo, claseTextarea } from "./ficha/campos";
import { FormularioAbono, datosInicialesDeAbono, type DatosFormularioAbono } from "./formulario-abono";

/**
 * El dialogo de una respuesta de la pregunta de la etapa (ADR 0072): recoge lo que la
 * flecha PIDE (descuento, fecha limite de pago, cohorte destino, fecha de seguimiento y/o
 * motivo) y muestra, en verde y en rojo, lo que el deal tiene y le falta para entrar. Lo
 * recogido se manda en `datos`/`motivoId` en la MISMA server action, asi que el motor lo
 * escribe en una sola transaccion (`moverEtapa`).
 *
 * La lista verde y roja NO la calcula esta pantalla: es un ensayo del motor
 * (`revisarMovimientoAccion`), que se repite cada vez que cambian los datos. Lo que falta
 * y no se llena aqui (un contacto, una llamada, un abono) dice donde se arregla, y
 * mientras falte no se puede confirmar.
 *
 * El motivo se filtra por el TIPO que la flecha pide (`tipoDeMotivo`): un motivo de
 * perdida no sirve para una re-agenda. La reja real la vuelve a aplicar el motor.
 */

export interface DatosDialogo {
  descuentoUsd?: number;
  fechaLimitePago?: string | null;
  cohorteDestinoId?: string | null;
  fechaSeguimiento?: string | null;
  motivoId?: string | null;
  comentarioMotivo?: string;
  /** Comentario de "Lo estoy trabajando" (ticket 228): se guarda como nota al mover por E1. */
  comentario?: string;
  llamada?: { dia: string; hora: string; linkGrain: string };
  abono?: DatosFormularioAbono;
}

/** Lo que se ensaya y se confirma: el deal, a dónde va y con qué pendiente queda. */
export interface MovimientoDelDialogo {
  dealId: string;
  /** `retroceso`: el destino lo dice el historial (RETRO), no quien llama. */
  a: EtapaDeal | "retroceso";
  pendiente: PendienteDeal | null;
  correccion?: boolean;
  /** Etapa que se deshace; solo se muestra en el modo corrección. */
  de?: EtapaDeal;
  hecho?: "atendido" | "agendado" | "abono";
}

export interface DialogoMoverProps {
  abierto: boolean;
  onAbrir: (abierto: boolean) => void;
  flecha: FlechaCliente;
  /** La respuesta elegida, como titulo ("Negocia", "Seguimiento"…). */
  titulo: string;
  nombreLead: string;
  movimiento: MovimientoDelDialogo;
  nombreDeEtapa: Record<EtapaDeal, string>;
  /** Para lo que falta y se arregla en la ficha (un contacto, una llamada, un abono). */
  rutaDeLaFicha: string;
  cohortes: OpcionCatalogo[];
  /** Motivos activos con su tipo; el dialogo filtra por el tipo de la flecha. */
  motivos: { id: string; nombre: string; tipo: string; pideTexto?: boolean }[];
  plataformas: { id: string; nombre: string }[];
  saldo: number | null;
  moneda: string | null;
  llamada: { id: string; fecha: Date | string | null; closerNombre: string | null; notas: string | null } | null;
  /**
   * El inicio de clases de la cohorte del deal (`fechaLimiteMaxima`, ticket 061): con el
   * se PRELLENA la fecha limite de pago de Compromiso Verbal, que ademas no puede pasarlo.
   * `null` si no hay cohorte de referencia: el campo queda vacio.
   */
  fechaLimiteSugerida?: string | null;
  enviando: boolean;
  /** `destino` es la etapa real: para el retroceso, la que dijo el ensayo. */
  onConfirmar: (datos: DatosDialogo, destino: EtapaDeal) => void;
}

/** Donde se arregla lo que falta y no se llena en este dialogo. */
const DONDE: Partial<Record<CodigoRequisito, string>> = {
  dueno: "Reclama el deal desde el Inbox.",
  actividad: "Regístrala en Actividades.",
  contacto: "Regístralo en Actividades.",
  llamada_con_fecha: "Agrégala en Llamadas.",
  llamada_sucedio: "Pega el Grain o confírmala en Llamadas.",
  llamada_fallida: "Márcala en Llamadas.",
  abono: "Regístralo en Facturación.",
};

interface Revision {
  requisitos: RequisitoRevisado[];
  bloqueo: string | null;
  destinoRetro: EtapaDeal | null;
}

const ETIQUETA: Record<CodigoRequisito, string> = {
  cohorte: "Cohorte",
  valor_vendido: "Descuento (USD)",
  fecha_limite_pago: "Fecha límite de pago",
  cohorte_destino: "Cohorte a la que quiere entrar",
  fecha_seguimiento: "Próximo contacto",
  motivo: "Motivo",
  actividad: "Actividad comercial",
  transicion_no_permitida: "",
  dueno: "",
  contacto: "",
  llamada_con_fecha: "",
  llamada_sucedio: "",
  llamada_fallida: "",
  abono: "",
  saldo_pendiente: "",
  saldo_en_cero: "",
  sin_abonos: "",
};

const claseInput =
  "h-8 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function DialogoMover({
  abierto,
  onAbrir,
  flecha,
  titulo,
  nombreLead,
  movimiento,
  nombreDeEtapa,
  rutaDeLaFicha,
  cohortes,
  motivos,
  plataformas,
  saldo,
  moneda,
  llamada,
  fechaLimiteSugerida = null,
  enviando,
  onConfirmar,
}: DialogoMoverProps) {
  const campos = camposDeDialogo(flecha);
  const hoy = hoyEnBogota();
  const manana = fechaDeInstanteEnBogota(new Date(new Date(`${hoy}T12:00:00-05:00`).getTime() + 86_400_000));
  // Solo arranca lleno lo que esta flecha pide: un dato que no se pide no viaja, porque
  // `moverEtapa` escribe todo lo que llega y pisaria el descuento o la fecha que ya tenia.
  const inicial = (): DatosDialogo => ({
    ...(campos.includes("valor_vendido") ? { descuentoUsd: 0 } : {}),
    ...(campos.includes("fecha_limite_pago") ? { fechaLimitePago: fechaLimiteSugerida } : {}),
    ...(campos.includes("fecha_seguimiento") ? { fechaSeguimiento: proximoContactoSugerido(hoy) } : {}),
    ...(movimiento.hecho === "atendido" || movimiento.hecho === "agendado"
      ? { llamada: { dia: hoy, hora: "", linkGrain: "" } }
      : {}),
    ...(movimiento.hecho === "abono" ? { abono: datosInicialesDeAbono() } : {}),
  });
  const [datos, setDatos] = useState<DatosDialogo>(inicial);
  const [revision, setRevision] = useState<(Revision & { con: string }) | null>(null);
  const [errorDeRevision, setErrorDeRevision] = useState<string | null>(null);

  // El ensayo del motor se repite cuando cambian los datos, con una pausa corta para no
  // mandar uno por tecla. Una respuesta vieja que llega tarde se descarta.
  const { dealId, a, pendiente } = movimiento;
  const montoAbono = Number(datos.abono?.monto);
  const destinoDelAbono: EtapaDeal = saldo != null && Number.isFinite(montoAbono) && montoAbono === saldo
    ? "ganado_completo"
    : "ganado_parcial";
  const destinoSolicitado = movimiento.hecho === "abono" ? destinoDelAbono : a;
  useEffect(() => {
    if (!abierto) return;
    let vigente = true;
    const espera = setTimeout(async () => {
      const r = await revisarMovimientoAccion({
        dealId,
        a: destinoSolicitado,
        pendiente,
        correccion: movimiento.correccion,
        motivoId: datos.motivoId ?? null,
        datos: {
          descuentoUsd: datos.descuentoUsd,
          fechaLimitePago: datos.fechaLimitePago,
          cohorteDestinoId: datos.cohorteDestinoId,
          fechaSeguimiento: datos.fechaSeguimiento,
        },
      });
      if (!vigente) return;
      if (r.ok) {
        setRevision({ requisitos: r.requisitos, bloqueo: r.bloqueo, destinoRetro: r.destinoRetro, con: JSON.stringify(datos) });
        setErrorDeRevision(null);
      } else {
        setErrorDeRevision(r.error);
      }
    }, 250);
    return () => {
      vigente = false;
      clearTimeout(espera);
    };
  }, [abierto, dealId, destinoSolicitado, pendiente, movimiento.correccion, datos]);

  const destino: EtapaDeal | null = destinoSolicitado === "retroceso" ? (revision?.destinoRetro ?? null) : destinoSolicitado;
  // Se confirma solo con la revision de los datos que hay AHORA: un campo recien cambiado
  // espera su ensayo. Un dato que el deal ya tiene (en verde) no se vuelve a pedir.
  const vigente = revision != null && revision.con === JSON.stringify(datos);
  // "Lo estoy trabajando" (E1, ticket 228): la flecha exige una actividad, y la escribe la nota
  // que el closer teclea aquí. Un comentario obligatorio, y "actividad" la cuenta este diálogo.
  const pideComentario = flecha.requisitos.includes("actividad");
  const requisitosQueEscribeElHecho = new Set<CodigoRequisito>(
    movimiento.hecho === "atendido"
      ? ["llamada_sucedio"]
      : movimiento.hecho === "agendado"
        ? ["llamada_con_fecha"]
        : movimiento.hecho === "abono"
          ? ["abono", "saldo_pendiente", "saldo_en_cero"]
          : [],
  );
  // El servidor reclama el deal sin dueño al mover por E1 (como Anotar y registrar contacto),
  // así que "dueno" tampoco bloquea el botón aquí.
  if (pideComentario) {
    requisitosQueEscribeElHecho.add("actividad");
    requisitosQueEscribeElHecho.add("dueno");
  }
  const comentarioCompleto = !pideComentario || Boolean(datos.comentario?.trim());
  // Con el comentario escrito, la actividad que pide E1 ya está (ticket 229): se pinta en verde,
  // no como "Regístrala en Actividades", porque la escribe este mismo diálogo al confirmar.
  const cubiertos = new Set<CodigoRequisito>(pideComentario && datos.comentario?.trim() ? ["actividad"] : []);
  const llamadaCompleta = movimiento.hecho === "atendido" && llamada
    ? true
    : movimiento.hecho === "atendido" || movimiento.hecho === "agendado"
      ? Boolean(datos.llamada?.dia && datos.llamada.hora)
      : true;
  const abonoCompleto = movimiento.hecho !== "abono" || Boolean(datos.abono?.fecha && datos.abono.monto.trim());
  const motivoElegido = motivos.find((m) => m.id === datos.motivoId);
  const comentarioMotivoCompleto = flecha.tipoDeMotivo !== "reagenda" || !motivoElegido?.pideTexto || Boolean(datos.comentarioMotivo?.trim());
  const bloqueoVigente = movimiento.hecho ? null : revision?.bloqueo;
  const listo = vigente && bloqueoVigente == null
    && revision.requisitos.every((q) => q.cumple || requisitosQueEscribeElHecho.has(q.codigo))
    && destino != null && llamadaCompleta && abonoCompleto && comentarioMotivoCompleto && comentarioCompleto;

  const motivosDeLaFlecha = flecha.tipoDeMotivo
    ? motivos.filter((m) => m.tipo === flecha.tipoDeMotivo)
    : motivos;


  return (
    <Dialog
      open={abierto}
      onOpenChange={(v) => {
        onAbrir(v);
        if (!v) setDatos(inicial());
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>
            {nombreLead}. {movimiento.correccion ? "Elige el motivo de la corrección." : "Completa lo que pide este paso."}
          </DialogDescription>
        </DialogHeader>

        <div className="min-w-0 space-y-3">
          {movimiento.hecho === "atendido" ? (
            <section className="space-y-3">
              {llamada ? (
                <details className="rounded-lg bg-muted/50 p-3">
                  <summary className="cursor-pointer text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <span className="font-medium">Llamada</span>{" "}
                    <span className="cifra">{llamada.fecha ? fechaHoraEnBogota(new Date(llamada.fecha)) : "sin fecha"}</span>{" "}
                    <span className="text-muted-foreground">· {llamada.closerNombre ?? "Sin closer"}</span>
                  </summary>
                  <div className="pt-2 text-sm text-muted-foreground">
                    {llamada.notas ? <p className="whitespace-pre-wrap">{llamada.notas}</p> : <p>Sin notas.</p>}
                  </div>
                </details>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <Campo etiqueta="Día de la llamada" ayuda="Hora de Bogotá.">
                    <input type="date" className={claseInput} value={datos.llamada?.dia ?? ""} onChange={(e) => setDatos((d) => ({ ...d, llamada: { ...d.llamada!, dia: e.target.value } }))} />
                  </Campo>
                  <Campo etiqueta="Hora">
                    <input type="time" className={claseInput} value={datos.llamada?.hora ?? ""} onChange={(e) => setDatos((d) => ({ ...d, llamada: { ...d.llamada!, hora: e.target.value } }))} />
                  </Campo>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm"><Badge variant="exito">Show</Badge><span>La llamada se marcará como atendida.</span></div>
              <Campo etiqueta="Link de Grain (opcional)">
                <input type="url" className={claseInput} value={datos.llamada?.linkGrain ?? ""} onChange={(e) => setDatos((d) => ({ ...d, llamada: { ...d.llamada!, linkGrain: e.target.value } }))} placeholder="https://grain.com/share/…" />
              </Campo>
            </section>
          ) : null}

          {movimiento.hecho === "agendado" ? (
            <section className="grid grid-cols-2 gap-3">
              <Campo etiqueta="Día de la cita" ayuda="Hora de Bogotá.">
                <input type="date" className={claseInput} value={datos.llamada?.dia ?? ""} onChange={(e) => setDatos((d) => ({ ...d, llamada: { ...d.llamada!, dia: e.target.value } }))} />
              </Campo>
              <Campo etiqueta="Hora">
                <input type="time" className={claseInput} value={datos.llamada?.hora ?? ""} onChange={(e) => setDatos((d) => ({ ...d, llamada: { ...d.llamada!, hora: e.target.value } }))} />
              </Campo>
            </section>
          ) : null}

          {movimiento.hecho === "abono" && datos.abono ? (
            <section className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {saldo != null ? `Saldo actual: ${monto(saldo, moneda ?? "USD")}. ` : ""}La etapa la decide lo que quede por pagar.
              </p>
              <FormularioAbono dealId={dealId} moneda={moneda ?? "USD"} plataformas={plataformas} datos={datos.abono} onChange={(abono) => setDatos((d) => ({ ...d, abono }))} />
            </section>
          ) : null}

          {pideComentario ? (
            <Campo etiqueta="¿Qué hiciste?" ayuda="Obligatorio. Queda como nota del deal y cuenta como su primera actividad.">
              <textarea
                className={claseTextarea}
                value={datos.comentario ?? ""}
                maxLength={4000}
                rows={3}
                onChange={(e) => setDatos((d) => ({ ...d, comentario: e.target.value }))}
                placeholder="Le escribí por WhatsApp, quedó de responder…"
              />
            </Campo>
          ) : null}

          {campos.map((campo) => (
            <div key={campo} className="space-y-1">
              <label className="block text-xs font-medium text-muted-foreground">{ETIQUETA[campo]}</label>


              {campo === "valor_vendido" ? (
                <Input
                  type="number"
                  min="0"
                  max="99999999.99"
                  step="0.01"
                  value={datos.descuentoUsd ?? 0}
                  onChange={(e) => {
                    const valor = e.currentTarget.valueAsNumber;
                    setDatos((d) => ({ ...d, descuentoUsd: Number.isFinite(valor) && valor >= 0 ? valor : undefined }));
                  }}
                />
              ) : null}

              {campo === "cohorte_destino" ? (
                cohortes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No hay próxima cohorte creada. Pídele a quien administra que la cree en la pestaña Programa.
                  </p>
                ) : (
                  <Select
                    value={datos.cohorteDestinoId ?? null}
                    items={cohortes.map((c) => ({ value: c.id, label: c.nombre }))}
                    onValueChange={(v: string | null) => setDatos((d) => ({ ...d, cohorteDestinoId: v }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Elige la cohorte" />
                    </SelectTrigger>
                    <SelectContent>
                      {cohortes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )
              ) : null}

              {campo === "motivo" ? (
                <Select
                  value={datos.motivoId ?? null}
                  items={motivosDeLaFlecha.map((m) => ({ value: m.id, label: m.nombre }))}
                  onValueChange={(v: string | null) => setDatos((d) => ({ ...d, motivoId: v }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Elige un motivo" />
                  </SelectTrigger>
                  <SelectContent>
                    {motivosDeLaFlecha.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}

              {campo === "motivo" && flecha.tipoDeMotivo === "reagenda" ? (
                <Campo etiqueta="Comentario" ayuda={motivoElegido?.pideTexto ? "Obligatorio para este motivo." : "Opcional."}>
                  <textarea className={claseTextarea} value={datos.comentarioMotivo ?? ""} onChange={(e) => setDatos((d) => ({ ...d, comentarioMotivo: e.target.value }))} rows={3} placeholder="¿Qué pasó?" />
                </Campo>
              ) : null}

              {campo === "fecha_limite_pago" && fechaLimiteSugerida ? (
                <p className="text-xs text-muted-foreground">
                  Sugerida: el inicio de clases de la cohorte. No puede pasarlo.
                </p>
              ) : null}

              {campo === "fecha_limite_pago" ? (
                <input
                  type="date"
                  className={claseInput}
                  value={datos.fechaLimitePago ?? ""}
                  max={fechaLimiteSugerida ?? undefined}
                  onChange={(e) => setDatos((d) => ({ ...d, fechaLimitePago: e.target.value || null }))}
                />
              ) : null}

              {campo === "fecha_seguimiento" ? (
                <input
                  type="date"
                  className={claseInput}
                  value={datos.fechaSeguimiento ?? ""}
                  min={manana}
                  onChange={(e) => setDatos((d) => ({ ...d, fechaSeguimiento: e.target.value || null }))}
                />
              ) : null}
            </div>
          ))}

          {campos.length === 0 && !movimiento.hecho && !pideComentario ? (
            <p className="text-sm text-muted-foreground">
              Este paso no pide datos.
            </p>
          ) : null}

          {a === "retroceso" && revision?.destinoRetro ? (
            <p className="text-sm">
              Vuelve a <strong>{nombreDeEtapa[revision.destinoRetro]}</strong>, la etapa en la que estaba antes del
              compromiso, con próximo contacto.
            </p>
          ) : null}
          {movimiento.correccion && movimiento.de ? (
            <p className="text-sm">
              Destino: <strong>{nombreDeEtapa[a as EtapaDeal]}</strong>. Se deshace el movimiento de
              {" "}<strong>{nombreDeEtapa[movimiento.de]}</strong> a <strong>{nombreDeEtapa[a as EtapaDeal]}</strong>.
            </p>
          ) : null}
          {!movimiento.hecho ? <ListaDeRequisitos revision={revision} error={errorDeRevision} cubiertos={cubiertos} /> : null}
          {!movimiento.hecho && revision?.requisitos.some((q) => !q.cumple && !cubiertos.has(q.codigo) && DONDE[q.codigo]) ? (
            <Link href={rutaDeLaFicha} className="inline-block text-sm text-marca-texto underline-offset-2 hover:underline">
              Abrir la ficha del deal
            </Link>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onAbrir(false)} disabled={enviando}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => destino && onConfirmar(datos, destino)}
            disabled={enviando || !listo}
          >
            {enviando ? "Guardando…" : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Lo que el deal tiene (verde) y le falta (rojo), segun el ensayo del motor. */
function ListaDeRequisitos({
  revision,
  error,
  cubiertos,
}: {
  revision: Revision | null;
  error: string | null;
  /** Lo que este mismo diálogo escribe al confirmar (el comentario de "Lo estoy trabajando"): sale en verde. */
  cubiertos: ReadonlySet<CodigoRequisito>;
}) {
  if (error) return <p className="text-sm text-tono-peligro">{error}</p>;
  if (!revision) return <p className="text-sm text-muted-foreground">Revisando lo que tiene el deal…</p>;
  if (revision.bloqueo) return <p className="rounded-lg bg-tono-peligro-suave p-3 text-sm text-tono-peligro">{revision.bloqueo}</p>;
  if (revision.requisitos.length === 0) return null;
  return (
    <ul className="space-y-1 border-t pt-3 text-sm">
      {revision.requisitos.map((q) => ({ ...q, cumple: q.cumple || cubiertos.has(q.codigo) })).map((q) => (
        <li key={q.codigo} className={q.cumple ? "flex gap-2 text-tono-exito" : "flex gap-2 text-tono-peligro"}>
          {q.cumple ? <Check className="mt-0.5 size-4 shrink-0" aria-hidden /> : <X className="mt-0.5 size-4 shrink-0" aria-hidden />}
          <span>
            {q.cumple ? (NOMBRE_DE_REQUISITO[q.codigo] || q.codigo) : q.mensaje}
            {!q.cumple && DONDE[q.codigo] ? ` ${DONDE[q.codigo]}` : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Como se nombra un requisito que el deal ya cumple. */
const NOMBRE_DE_REQUISITO: Record<CodigoRequisito, string> = {
  transicion_no_permitida: "",
  cohorte: "Tiene cohorte",
  dueno: "Tiene dueño",
  actividad: "Tiene una actividad comercial",
  contacto: "Tiene un contacto registrado",
  llamada_con_fecha: "Tiene una llamada con fecha",
  llamada_sucedio: "La llamada sucedió",
  llamada_fallida: "La llamada quedó en no-show o cancelada",
  valor_vendido: "Tiene valor vendido",
  fecha_limite_pago: "Tiene fecha límite de pago",
  cohorte_destino: "Tiene la cohorte a la que quiere entrar",
  fecha_seguimiento: "Tiene próximo contacto",
  abono: "Tiene un abono",
  saldo_pendiente: "Queda saldo por pagar",
  saldo_en_cero: "El saldo está en cero",
  sin_abonos: "No tiene abonos vigentes",
  motivo: "Tiene motivo",
};
