"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  areaDeclaradaId?: string | null;
  fechaLimitePago?: string | null;
  cohorteDestinoId?: string | null;
  fechaSeguimiento?: string | null;
  motivoId?: string | null;
}

/** Lo que se ensaya y se confirma: el deal, a dónde va y con qué pendiente queda. */
export interface MovimientoDelDialogo {
  dealId: string;
  /** `retroceso`: el destino lo dice el historial (RETRO), no quien llama. */
  a: EtapaDeal | "retroceso";
  pendiente: PendienteDeal | null;
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
  areas: OpcionCatalogo[];
  cohortes: OpcionCatalogo[];
  /** Motivos activos con su tipo; el dialogo filtra por el tipo de la flecha. */
  motivos: { id: string; nombre: string; tipo: string }[];
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
  valor_vendido: "Descuento (USD)",
  area_declarada: "Área de origen (según el closer)",
  fecha_limite_pago: "Fecha límite de pago",
  cohorte_destino: "Cohorte a la que quiere entrar",
  fecha_seguimiento: "Fecha de seguimiento",
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
  areas,
  cohortes,
  motivos,
  fechaLimiteSugerida = null,
  enviando,
  onConfirmar,
}: DialogoMoverProps) {
  const campos = camposDeDialogo(flecha);
  // Lo unico que arranca lleno es la fecha limite, con el inicio de clases de la cohorte.
  const inicial = (): DatosDialogo => ({ descuentoUsd: 0, fechaLimitePago: fechaLimiteSugerida });
  const [datos, setDatos] = useState<DatosDialogo>(inicial);
  const [revision, setRevision] = useState<(Revision & { con: string }) | null>(null);
  const [errorDeRevision, setErrorDeRevision] = useState<string | null>(null);

  // El ensayo del motor se repite cuando cambian los datos, con una pausa corta para no
  // mandar uno por tecla. Una respuesta vieja que llega tarde se descarta.
  const { dealId, a, pendiente } = movimiento;
  useEffect(() => {
    if (!abierto) return;
    let vigente = true;
    const espera = setTimeout(async () => {
      const r = await revisarMovimientoAccion({
        dealId,
        a,
        pendiente,
        motivoId: datos.motivoId ?? null,
        datos: {
          descuentoUsd: datos.descuentoUsd,
          areaDeclaradaId: datos.areaDeclaradaId,
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
  }, [abierto, dealId, a, pendiente, datos]);

  const destino: EtapaDeal | null = a === "retroceso" ? (revision?.destinoRetro ?? null) : a;
  // Se confirma solo con la revision de los datos que hay AHORA: un campo recien cambiado
  // espera su ensayo. Un dato que el deal ya tiene (en verde) no se vuelve a pedir.
  const vigente = revision != null && revision.con === JSON.stringify(datos);
  const listo =
    vigente && revision.bloqueo == null && revision.requisitos.every((q) => q.cumple) && destino != null;

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
            {nombreLead}. Completa lo que pide este paso.
          </DialogDescription>
        </DialogHeader>

        <div className="min-w-0 space-y-3">
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

              {campo === "area_declarada" ? (
                <Select
                  value={datos.areaDeclaradaId ?? null}
                  items={areas.map((a) => ({ value: a.id, label: a.nombre }))}
                  onValueChange={(v: string | null) => setDatos((d) => ({ ...d, areaDeclaradaId: v }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Elige un área" />
                  </SelectTrigger>
                  <SelectContent>
                    {areas.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}

              {campo === "cohorte_destino" ? (
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
                  onChange={(e) => setDatos((d) => ({ ...d, fechaSeguimiento: e.target.value || null }))}
                />
              ) : null}
            </div>
          ))}

          {campos.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Este paso no pide datos.
            </p>
          ) : null}

          {a === "retroceso" && revision?.destinoRetro ? (
            <p className="text-sm">
              Vuelve a <strong>{nombreDeEtapa[revision.destinoRetro]}</strong>, la etapa en la que estaba antes del
              compromiso, con Seguimiento.
            </p>
          ) : null}
          <ListaDeRequisitos revision={revision} error={errorDeRevision} />
          {revision?.requisitos.some((q) => !q.cumple && DONDE[q.codigo]) ? (
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
function ListaDeRequisitos({ revision, error }: { revision: Revision | null; error: string | null }) {
  if (error) return <p className="text-sm text-tono-peligro">{error}</p>;
  if (!revision) return <p className="text-sm text-muted-foreground">Revisando lo que tiene el deal…</p>;
  if (revision.bloqueo) return <p className="rounded-lg bg-tono-peligro-suave p-3 text-sm text-tono-peligro">{revision.bloqueo}</p>;
  if (revision.requisitos.length === 0) return null;
  return (
    <ul className="space-y-1 border-t pt-3 text-sm">
      {revision.requisitos.map((q) => (
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
  dueno: "Tiene dueño",
  actividad: "Tiene una actividad comercial",
  contacto: "Tiene un contacto registrado",
  llamada_con_fecha: "Tiene una llamada con fecha",
  llamada_sucedio: "La llamada sucedió",
  llamada_fallida: "La llamada quedó en no-show o cancelada",
  valor_vendido: "Tiene valor vendido",
  area_declarada: "Tiene el área de origen",
  fecha_limite_pago: "Tiene fecha límite de pago",
  cohorte_destino: "Tiene la cohorte a la que quiere entrar",
  fecha_seguimiento: "Tiene fecha de seguimiento",
  abono: "Tiene un abono",
  saldo_pendiente: "Queda saldo por pagar",
  saldo_en_cero: "El saldo está en cero",
  sin_abonos: "No tiene abonos vigentes",
  motivo: "Tiene motivo",
};
