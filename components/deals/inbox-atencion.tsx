"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fecha, hoyEnBogota, monto } from "@/lib/format";
import { enlaceConVuelta } from "@/lib/navegacion/volver";
import type { EtapaDeal } from "@/lib/deals/etapas";
import type { FilaAtencion, MotivoAtencion } from "@/lib/queries/inbox";
import type { OpcionesDeFicha } from "@/lib/queries/ficha-deal";
import {
  registrarAbonoAccion,
  registrarActividadAccion,
} from "@/app/(app)/p/[programa]/deals/[id]/acciones";
import { Campo, claseInput, claseTextarea, DialogoForm, Vacio } from "@/components/deals/ficha/campos";
import { useAccion } from "@/components/deals/ficha/uso-accion";
import type { TonoEtapa } from "@/components/deals/etapa-tono";

/**
 * Sección 4 del Inbox (ticket 071): "Lo mío que necesita atención". Cada deal aparece UNA
 * vez, en el primer bucket que casó (el read model ya lo decidió y lo ordenó). Cada fila
 * dice: quién es el lead, en qué etapa está (badge con su tono), POR QUÉ está aquí (una
 * línea), el enlace a la ficha, y dos acciones rápidas —Registrar contacto y Registrar
 * abono— que reusan las server actions de la ficha del deal.
 *
 * Mobile first: los closers la revisan en el teléfono. Las filas apilan su info y los
 * botones envuelven.
 */
export function InboxAtencion({
  filas,
  slug,
  nombreDeEtapa,
  tonoDeEtapa,
  plataformas,
  areas,
  puedeRegistrar,
  origen,
}: {
  filas: FilaAtencion[];
  slug: string;
  nombreDeEtapa: Record<EtapaDeal, string>;
  tonoDeEtapa: Record<EtapaDeal, TonoEtapa>;
  /** Plataformas de pago del programa, para el abono rápido. */
  plataformas: OpcionesDeFicha["plataformas"];
  areas: OpcionesDeFicha["areas"];
  /** Trabaja leads Y (dueño o administra). Proyección: la reja es el servidor. */
  puedeRegistrar: boolean;
  /** El origen de la pantalla, para que la ficha vuelva aqui (ticket 174). */
  origen: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Lo mío que necesita atención</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {filas.length === 0 ? (
          <Vacio>Nada pendiente por ahora. Cuando un deal tuyo se atrase o pida acción, aparece acá.</Vacio>
        ) : (
          <ul className="divide-y">
            {filas.map((fila) => (
              <FilaAtencionItem
                key={fila.dealId}
                fila={fila}
                slug={slug}
                nombreDeEtapa={nombreDeEtapa}
                tonoDeEtapa={tonoDeEtapa}
                plataformas={plataformas}
                areas={areas}
                puedeRegistrar={puedeRegistrar}
                origen={origen}
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/** La frase que explica POR QUÉ el deal está en la lista (una línea corta). */
function porQue(fila: FilaAtencion): string {
  const motivo: MotivoAtencion = fila.motivo;
  switch (motivo) {
    case "abono_sin_comprobante":
      return "Hay un abono sin comprobante: pega el soporte en Facturación.";
    case "reagenda_sin_fecha":
      return "En Re-agenda y sin una nueva cita: agéndale una llamada.";
    case "compromiso_vencido":
      return fila.fecha
        ? `Compromiso Verbal con fecha de pago vencida (${fecha(fila.fecha)}).`
        : "Compromiso Verbal con la fecha de pago vencida.";
    case "pago_vencido": {
      const cuanto = fila.saldo != null && fila.moneda ? monto(fila.saldo, fila.moneda) : "saldo pendiente";
      return fila.fecha
        ? `Fecha límite de pago vencida (${fecha(fila.fecha)}): ${cuanto} por cobrar.`
        : `Fecha límite de pago vencida: ${cuanto} por cobrar.`;
    }
    case "reenvio_sin_atender":
      return "Volvió a llenar el formulario después de tu última actividad: contáctalo.";
    case "intentos_agotados":
      return `Agotó intentos: ${fila.intentos ?? 3} sin respuesta en esta etapa. Decide: Cierre perdido con motivo o sigue intentando.`;
    case "link_sin_cita":
      return "Mandaste el link de agenda y el lead no ha agendado.";
    case "proximo_contacto_vencido":
      return "El próximo contacto se venció.";
    case "estancado":
      return `Sin actividad hace ${fila.diasSinActividad ?? "varios"} días hábiles.`;
  }
}

function FilaAtencionItem({
  fila,
  slug,
  nombreDeEtapa,
  tonoDeEtapa,
  plataformas,
  areas,
  puedeRegistrar,
  origen,
}: {
  fila: FilaAtencion;
  slug: string;
  nombreDeEtapa: Record<EtapaDeal, string>;
  tonoDeEtapa: Record<EtapaDeal, TonoEtapa>;
  plataformas: OpcionesDeFicha["plataformas"];
  areas: OpcionesDeFicha["areas"];
  puedeRegistrar: boolean;
  origen: string;
}) {
  const [dialogo, setDialogo] = useState<"contacto" | "abono" | null>(null);
  return (
    <li className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={enlaceConVuelta(`/p/${slug}/deals/${fila.dealId}`, origen)}
            className="truncate text-sm font-medium text-marca-texto underline-offset-2 hover:underline"
          >
            {fila.leadNombre ?? fila.leadEmail}
          </Link>
          <Badge variant={tonoDeEtapa[fila.etapa]}>{nombreDeEtapa[fila.etapa]}</Badge>
          {fila.ownerNombre ? <Badge variant="neutro">{fila.ownerNombre}</Badge> : null}
        </div>
        <p className="truncate text-xs text-muted-foreground">{fila.leadEmail}</p>
        <p className="text-xs text-muted-foreground">{porQue(fila)}</p>
      </div>

      {puedeRegistrar ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setDialogo("contacto")}>
            Registrar contacto
          </Button>
          {fila.aceptaAbono ? (
            <Button size="sm" variant="secondary" onClick={() => setDialogo("abono")}>
              Registrar abono
            </Button>
          ) : null}
        </div>
      ) : null}

      {dialogo === "contacto" ? <DialogoContacto dealId={fila.dealId} onCerrar={() => setDialogo(null)} /> : null}
      {dialogo === "abono" && fila.aceptaAbono ? (
        <DialogoAbono dealId={fila.dealId} areaDeclaradaIdActual={fila.areaDeclaradaId} areas={areas} plataformas={plataformas} onCerrar={() => setDialogo(null)} />
      ) : null}
    </li>
  );
}

/** Registrar un contacto: reusa `registrarActividadAccion` de la ficha (tipo contacto). */
function DialogoContacto({ dealId, onCerrar }: { dealId: string; onCerrar: () => void }) {
  const { pendiente, correr } = useAccion();
  const [canal, setCanal] = useState("");
  const [nota, setNota] = useState("");
  return (
    <DialogoForm
      titulo="Registrar contacto"
      descripcion="Deja constancia de que lo contactaste. No mueve la etapa; es tu registro de qué pasó."
      pendiente={pendiente}
      onCerrar={onCerrar}
      deshabilitarConfirmar={nota.trim() === ""}
      confirmar={{
        texto: "Registrar",
        enCurso: "Guardando…",
        onClick: () =>
          correr(() => registrarActividadAccion({ dealId, tipo: "contacto", canal, nota }), {
            exito: "Contacto registrado.",
            alExito: onCerrar,
          }),
      }}
    >
      <div className="min-w-0 space-y-3">
        <Campo etiqueta="Canal">
          <input
            className={claseInput}
            list="canales-de-contacto-inbox"
            value={canal}
            onChange={(e) => setCanal(e.target.value)}
            placeholder="WhatsApp, Llamada…"
            maxLength={60}
          />
          <datalist id="canales-de-contacto-inbox">
            <option value="WhatsApp" />
            <option value="Llamada" />
            <option value="Correo" />
          </datalist>
        </Campo>
        <Campo etiqueta="¿Qué pasó?">
          <textarea
            className={claseTextarea}
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            rows={2}
            placeholder="Le escribí, quedó de responder el jueves…"
          />
        </Campo>
      </div>
    </DialogoForm>
  );
}

/**
 * Registrar un abono: reusa `registrarAbonoAccion` de la ficha —🩸 el closer registra un
 * abono desde el teléfono a mitad de una llamada (ticket 071)—. La reja del sobrepago y el
 * movimiento de etapa los aplica el servidor; aquí solo se capturan fecha, monto y
 * plataforma.
 */
function DialogoAbono({
  dealId,
  areaDeclaradaIdActual,
  areas,
  plataformas,
  onCerrar,
}: {
  dealId: string;
  areaDeclaradaIdActual: string | null;
  areas: OpcionesDeFicha["areas"];
  plataformas: OpcionesDeFicha["plataformas"];
  onCerrar: () => void;
}) {
  const { pendiente, correr } = useAccion();
  const [dia, setDia] = useState(hoyEnBogota());
  const [montoStr, setMontoStr] = useState("");
  const [plataformaId, setPlataformaId] = useState<string | null>(null);
  const [areaDeclaradaId, setAreaDeclaradaId] = useState<string | null>(null);
  const [comprobante, setComprobante] = useState("");
  return (
    <DialogoForm
      titulo="Registrar abono"
      descripcion="Un pago recibido sobre este deal. El deal pasa a Ganado Pago Parcial (o Ganado Pagado Completo) según el saldo."
      pendiente={pendiente}
      onCerrar={onCerrar}
      deshabilitarConfirmar={!dia || montoStr.trim() === "" || (!areaDeclaradaIdActual && !areaDeclaradaId)}
      confirmar={{
        texto: "Registrar",
        enCurso: "Guardando…",
        onClick: () =>
          correr(
            () =>
              registrarAbonoAccion({
                dealId,
                fecha: dia,
                monto: montoStr,
                plataformaId: plataformaId ?? undefined,
                comprobanteUrl: comprobante,
                areaDeclaradaId: areaDeclaradaId ?? undefined,
              }),
            {
              exito: (r) => (r.movioElDeal ? "Abono registrado: el deal se movió." : "Abono registrado."),
              alExito: onCerrar,
            },
          ),
      }}
    >
      <div className="min-w-0 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Fecha del abono" ayuda="Hora de Bogotá.">
            <input type="date" className={claseInput} value={dia} onChange={(e) => setDia(e.target.value)} />
          </Campo>
          <Campo etiqueta="Monto (USD)">
            <input
              type="text"
              inputMode="decimal"
              className={claseInput}
              value={montoStr}
              onChange={(e) => setMontoStr(e.target.value)}
              placeholder="750.00"
            />
          </Campo>
        </div>
        {!areaDeclaradaIdActual ? (
          <Campo etiqueta="Área de origen (según el closer)">
            <Select
              value={areaDeclaradaId}
              items={areas.map((a) => ({ value: a.id, label: a.nombre }))}
              onValueChange={(v: string | null) => setAreaDeclaradaId(v)}
            >
              <SelectTrigger className="w-full"><SelectValue placeholder="Elige un área" /></SelectTrigger>
              <SelectContent>{areas.map((a) => <SelectItem key={a.id} value={a.id}>{a.nombre}</SelectItem>)}</SelectContent>
            </Select>
          </Campo>
        ) : null}
        <Campo etiqueta="Plataforma (opcional)">
          <Select
            value={plataformaId}
            items={plataformas.map((p) => ({ value: p.id, label: p.nombre }))}
            onValueChange={(v: string | null) => setPlataformaId(v)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="¿Por dónde entró?" />
            </SelectTrigger>
            <SelectContent>
              {plataformas.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Campo>
        <Campo etiqueta="Comprobante (opcional)">
          <input
            type="url"
            className={claseInput}
            value={comprobante}
            onChange={(e) => setComprobante(e.target.value)}
            placeholder="https://…"
          />
        </Campo>
      </div>
    </DialogoForm>
  );
}
