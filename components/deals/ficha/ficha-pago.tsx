"use client";

import { useState } from "react";
import { ID_DE_SECCION, useAccionPedida } from "./accion-pedida";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fecha, fechaHoraEnBogota, hoyEnBogota, monto, pct, saldoLegible, usd } from "@/lib/format";
import type { EtapaDeal } from "@/lib/deals/etapas";
import type { FichaDeAbono, FichaDeDeal, OpcionesDeFicha } from "@/lib/queries/ficha-deal";
import {
  anularAbonoAccion,
  cambiarCohorteAccion,
  desmarcarOnboardedAccion,
  editarAcuerdoAccion,
  marcarOnboardedAccion,
  pegarComprobanteAccion,
  registrarAbonoAccion,
  editarDealAccion,
} from "@/app/(app)/p/[programa]/deals/[id]/acciones";
import { Campo, claseInput, claseTextarea, DialogoForm, Vacio } from "./campos";
import { useAccion } from "./uso-accion";
import { cn } from "@/lib/utils";

/**
 * El dinero y el pago del deal (ticket 074): precio, abonado y saldo, el acuerdo de pago,
 * los abonos y, si el deal ya es estudiante, su onboarding y su cohorte.
 *
 * - **Abonado y saldo salen de `saldosDeDeals`** (ADR 0024); esta pantalla no suma abonos.
 *   Los abonos anulados se muestran tachados y no entran en ninguna cifra.
 * - El acuerdo de pago es TEXTO (ADR 0053): no hay cuotas pactadas que pintar.
 * - Registrar un abono mueve la etapa SOLO (Ganado Pago Parcial o Ganado Pagado Completo, por el saldo): el closer
 *   nunca mueve el deal a mano por dinero. El primer abono congela el ticket de la cohorte.
 */

type Dialogo =
  | { tipo: "abono" }
  | { tipo: "anular"; abono: FichaDeAbono }
  | { tipo: "comprobante"; abono: FichaDeAbono }
  | { tipo: "acuerdo" }
  | { tipo: "cohorte" }
  | { tipo: "descuento" };

export function FichaPago({
  ficha,
  opciones,
  puedeTrabajar,
  puedeRegistrar,
  aceptaAbono,
  nombreDeEtapa,
}: {
  ficha: FichaDeDeal;
  opciones: OpcionesDeFicha;
  /** Del servidor: `lib/deals/etapas.ts` no entra al bundle del cliente. */
  nombreDeEtapa: Record<EtapaDeal, string>;
  /** Su dueño o quien administra, sobre un deal que cuenta. */
  puedeTrabajar: boolean;
  /** Ademas trabaja leads (un gerente administra pero no registra plata, ADR 0003). */
  puedeRegistrar: boolean;
  /** Calculado en el servidor: esta etapa admite una flecha de pago. */
  aceptaAbono: boolean;
}) {
  const { pendiente, correr } = useAccion();
  const [dialogo, setDialogo] = useState<Dialogo | null>(null);
  const cerrar = () => setDialogo(null);
  // "Pagó" en la pregunta de la etapa abre el abono: a ganado solo se entra con plata (ADR 0037).
  useAccionPedida(["abono"], () => setDialogo({ tipo: "abono" }));

  const s = ficha.saldo;
  const moneda = s.moneda ?? "USD";
  const legible = saldoLegible(s.saldo, moneda);
  const anulado = ficha.anulado != null;
  const cerrado = ficha.etapa === "ganado_completo" || ficha.etapa === "cierre_perdido";
  const esEstudiante = ficha.etapa === "ganado_parcial" || ficha.etapa === "ganado_completo";
  const abonosActivos = puedeRegistrar && aceptaAbono && !anulado && !cerrado;

  return (
    <Card id={ID_DE_SECCION.pago} className="scroll-mt-24">
      <CardHeader>
        <CardTitle>Facturación</CardTitle>
        {abonosActivos || (puedeTrabajar && !anulado) ? (
          <CardAction className="flex gap-2">
            {puedeTrabajar && !anulado ? (
              <Button size="sm" variant="ghost" onClick={() => setDialogo({ tipo: "cohorte" })}>
                Cambiar cohorte
              </Button>
            ) : null}
            {abonosActivos ? (
              <Button size="sm" variant="outline" onClick={() => setDialogo({ tipo: "abono" })}>
                Registrar abono
              </Button>
            ) : null}
          </CardAction>
        ) : null}
      </CardHeader>

      <CardContent className="space-y-4">
        <dl className="grid grid-cols-2 gap-3 xl:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground">Ticket</dt>
            <dd className="cifra text-sm">
              {ficha.ticket
                ? `${ficha.ticket.codigo}${ficha.ticket.esActivaSugerida ? " (cohorte activa)" : ""} · ${usd(ficha.ticket.precioUsd)}`
                : "Sin cohorte"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Descuento</dt>
            <dd className="flex items-center gap-2 text-sm">
              <span className="cifra">{ficha.descuento ? `${usd(ficha.descuento.usd)} · ${pct(ficha.descuento.porcentaje)}` : "—"}</span>
              {puedeTrabajar && !anulado ? (
                <Button size="xs" variant="ghost" onClick={() => setDialogo({ tipo: "descuento" })}>Editar descuento</Button>
              ) : null}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Total a pagar</dt>
            <dd className="cifra text-sm">{s.precio != null ? monto(s.precio, moneda) : "Sin total"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Abonado</dt>
            <dd className="cifra text-sm">{monto(s.abonado, moneda)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{legible.etiqueta}</dt>
            <dd className="cifra text-sm">{legible.valor}</dd>
          </div>
        </dl>
        {s.sinSaldoPorque === "moneda_distinta" ? (
          <p className="text-xs text-tono-alerta">Hay abonos en otra moneda que el valor vendido: el saldo no se calcula ni se convierte.</p>
        ) : null}

        <section className="space-y-2">
          <h3 className="text-sm font-medium">Link de pago</h3>
          {ficha.enlacesDePago.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay links de pago vigentes para este programa.</p>
          ) : (
            <ul className="divide-y">
              {ficha.enlacesDePago.map((enlace) => (
                <li key={enlace.id} className="flex min-w-0 flex-wrap items-center gap-2 py-2">
                  <span className="min-w-0 flex-1 break-words text-sm">
                    {enlace.plataformaNombre ?? "Sin plataforma"} · <span className="cifra">{monto(Number(enlace.monto), enlace.moneda)}</span>
                  </span>
                  <AccionesEnlacePago url={enlace.url} />
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* El acuerdo de pago: texto y fecha limite (ADR 0053), no cuotas. */}
        <div className="space-y-1 rounded-lg bg-muted/50 p-3 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">Acuerdo de pago</span>
            {puedeTrabajar && !anulado && !cerrado ? (
              <Button size="xs" variant="ghost" onClick={() => setDialogo({ tipo: "acuerdo" })}>
                Editar
              </Button>
            ) : null}
          </div>
          <p className="whitespace-pre-wrap">{ficha.acuerdoPago ?? "Sin acuerdo escrito."}</p>
          <p className="text-xs text-muted-foreground">
            Fecha límite: {ficha.fechaLimitePago ? fecha(ficha.fechaLimitePago) : "sin fecha"}
            {ficha.fechaLimiteSugerida ? ` · inicio de clases ${fecha(ficha.fechaLimiteSugerida)}` : ""}
          </p>
        </div>

        {/* Estudiante: onboarding y cohorte (ticket 063). */}
        {esEstudiante ? (
          <div className="space-y-2 rounded-lg bg-muted/50 p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>
                <span className="text-xs font-medium text-muted-foreground">Onboarding: </span>
                {ficha.onboardedAt ? (
                  <Badge variant="exito">Hecho · {fechaHoraEnBogota(ficha.onboardedAt)}</Badge>
                ) : (
                  <Badge variant="alerta">Pendiente</Badge>
                )}
              </span>
              {puedeTrabajar && !anulado ? (
                ficha.onboardedAt ? (
                  <Button
                    size="xs"
                    variant="ghost"
                    disabled={pendiente}
                    onClick={() => correr(() => desmarcarOnboardedAccion({ dealId: ficha.dealId }), { exito: "Onboarding desmarcado." })}
                  >
                    Desmarcar
                  </Button>
                ) : (
                  <Button
                    size="xs"
                    variant="secondary"
                    disabled={pendiente}
                    onClick={() => correr(() => marcarOnboardedAccion({ dealId: ficha.dealId }), { exito: "Onboarding marcado." })}
                  >
                    Marcar onboarded
                  </Button>
                )
              ) : null}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>
                <span className="text-xs font-medium text-muted-foreground">Cohorte: </span>
                {ficha.cohorte ? ficha.cohorte.codigo : <Badge variant="alerta">Sin cohorte</Badge>}
              </span>
              {puedeTrabajar && !anulado ? (
                <Button size="xs" variant="ghost" onClick={() => setDialogo({ tipo: "cohorte" })}>
                  Cambiar cohorte
                </Button>
              ) : null}
            </div>
            {!ficha.cohorte ? (
              <p className="text-xs text-muted-foreground">
                El programa no tenía una cohorte activa al pagar, así que el deal quedó sin cohorte. Asígnala con “Cambiar cohorte”.
              </p>
            ) : null}
          </div>
        ) : null}
      </CardContent>

      {/* Los abonos: los anulados se ven tachados, con quien y por que (ADR 0026 punto 4). */}
      {ficha.abonos.length === 0 ? (
        <Vacio>Aún no hay abonos.{abonosActivos ? " Registra el primero arriba." : ""}</Vacio>
      ) : (
        <ul className="divide-y border-t">
          {ficha.abonos.map((a) => {
            const anulada = a.anuladoEn != null;
            return (
              <li key={a.id} className={anulada ? "space-y-1 px-4 py-3 text-sm opacity-60" : "space-y-1 px-4 py-3 text-sm"}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={anulada ? "cifra line-through" : "cifra font-medium"}>{monto(Number(a.monto), a.moneda)}</span>
                  <span className="text-xs text-muted-foreground">{fecha(a.fecha)}</span>
                  {a.plataformaNombre ? <span className="text-xs text-muted-foreground">· {a.plataformaNombre}</span> : null}
                  {a.comprobanteUrl ? (
                    <a className="text-xs text-marca-texto underline-offset-2 hover:underline" href={a.comprobanteUrl} target="_blank" rel="noreferrer">
                      Comprobante
                    </a>
                  ) : !anulada && puedeTrabajar && !anulado ? (
                    <Button size="xs" variant="secondary" onClick={() => setDialogo({ tipo: "comprobante", abono: a })}>
                      Pegar comprobante
                    </Button>
                  ) : null}
                  {!anulada && puedeRegistrar && !anulado ? (
                    <Button size="xs" variant="ghost" className="ml-auto" onClick={() => setDialogo({ tipo: "anular", abono: a })}>
                      Anular abono
                    </Button>
                  ) : null}
                </div>
                {anulada ? (
                  <p className="text-xs text-muted-foreground">
                    <Badge variant="neutro">Anulado</Badge> {a.anuladoPorNombre ?? ""} · {a.motivoAnulacion}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {dialogo?.tipo === "abono" ? <DialogoAbono ficha={ficha} opciones={opciones} nombreDeEtapa={nombreDeEtapa} onCerrar={cerrar} /> : null}
      {dialogo?.tipo === "anular" ? <DialogoAnularAbono abono={dialogo.abono} nombreDeEtapa={nombreDeEtapa} onCerrar={cerrar} /> : null}
      {dialogo?.tipo === "comprobante" ? <DialogoComprobante abono={dialogo.abono} onCerrar={cerrar} /> : null}
      {dialogo?.tipo === "acuerdo" ? <DialogoAcuerdo ficha={ficha} onCerrar={cerrar} /> : null}
      {dialogo?.tipo === "cohorte" ? <DialogoCohorte ficha={ficha} opciones={opciones} onCerrar={cerrar} /> : null}
      {dialogo?.tipo === "descuento" ? <DialogoDescuento ficha={ficha} onCerrar={cerrar} /> : null}
    </Card>
  );
}

function DialogoDescuento({ ficha, onCerrar }: { ficha: FichaDeDeal; onCerrar: () => void }) {
  const { pendiente, correr } = useAccion();
  const actual = ficha.descuento?.usd ?? 0;
  const [valor, setValor] = useState(String(actual));
  const [motivo, setMotivo] = useState("");
  const descuento = Number(valor);
  const cambioValido = Number.isFinite(descuento) && descuento >= 0 && descuento !== actual;
  return (
    <DialogoForm
      titulo="Editar descuento"
      descripcion="Cambia el descuento de esta venta. El total a pagar se recalcula y el cambio queda en el historial."
      pendiente={pendiente}
      onCerrar={onCerrar}
      deshabilitarConfirmar={!cambioValido || (ficha.vendido && motivo.trim() === "")}
      confirmar={{
        texto: "Guardar",
        enCurso: "Guardando…",
        onClick: () => correr(
          () => editarDealAccion({
            dealId: ficha.dealId,
            descuentoUsd: descuento,
            ...(ficha.vendido ? { motivoCambioVenta: motivo } : {}),
          }),
          { exito: "Descuento actualizado.", alExito: onCerrar },
        ),
      }}
    >
      <Campo etiqueta="Descuento (USD)">
        <Input type="number" min="0" max="99999999.99" step="0.01" value={valor} onChange={(e) => setValor(e.currentTarget.value)} />
      </Campo>
      {ficha.vendido ? (
        <Campo etiqueta="Motivo del cambio" ayuda="Obligatorio porque el deal ya es una venta.">
          <textarea className={claseTextarea} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </Campo>
      ) : null}
    </DialogoForm>
  );
}

function AccionesEnlacePago({ url }: { url: string }) {
  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado");
    } catch {
      toast.error("No se pudo copiar el link");
    }
  }

  return (
    <span className="flex shrink-0 items-center gap-1">
      <Button size="xs" variant="ghost" onClick={copiar} aria-label="Copiar link de pago">
        Copiar
      </Button>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(buttonVariants({ variant: "ghost", size: "xs" }))}
        aria-label="Abrir link de pago"
      >
        Abrir
      </a>
    </span>
  );
}

function DialogoAbono({
  ficha,
  opciones,
  nombreDeEtapa,
  onCerrar,
}: {
  ficha: FichaDeDeal;
  opciones: OpcionesDeFicha;
  nombreDeEtapa: Record<EtapaDeal, string>;
  onCerrar: () => void;
}) {
  const { pendiente, correr } = useAccion();
  const [dia, setDia] = useState(hoyEnBogota());
  const [valor, setValor] = useState("");
  const [plataformaId, setPlataformaId] = useState<string | null>(null);
  const [areaDeclaradaId, setAreaDeclaradaId] = useState<string | null>(null);
  const [comprobante, setComprobante] = useState("");
  const moneda = ficha.saldo.moneda ?? "USD";

  return (
    <DialogoForm
      titulo="Registrar abono"
      descripcion={
        ficha.saldo.saldo != null
          ? `Lo que pagó el cliente, en ${moneda}. Saldo actual: ${monto(ficha.saldo.saldo, moneda)}. La etapa se mueve sola.`
          : "Lo que pagó el cliente. La etapa se mueve sola."
      }
      pendiente={pendiente}
      onCerrar={onCerrar}
      deshabilitarConfirmar={!dia || valor.trim() === "" || (!ficha.areaDeclarada && !areaDeclaradaId)}
      confirmar={{
        texto: "Registrar",
        enCurso: "Registrando…",
        onClick: () =>
          correr(
            () => registrarAbonoAccion({ dealId: ficha.dealId, fecha: dia, monto: valor.trim(), plataformaId: plataformaId ?? undefined, comprobanteUrl: comprobante, areaDeclaradaId: areaDeclaradaId ?? undefined }),
            {
              exito: (r) => {
                const sinCohorte =
                  !ficha.cohorte && r.cohorteAsignada == null
                    ? " El programa no tiene cohorte activa: el deal queda sin cohorte."
                    : "";
                return `Abono registrado. ${r.movioElDeal ? `El deal pasó a ${nombreDeEtapa[r.etapa as EtapaDeal]}.` : ""}${sinCohorte}`.trim();
              },
              alExito: onCerrar,
            },
          ),
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Fecha del pago">
          <input type="date" className={claseInput} value={dia} onChange={(e) => setDia(e.target.value)} />
        </Campo>
        <Campo etiqueta={`Monto (${moneda})`}>
          <input className={`${claseInput} cifra`} inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="750.00" />
        </Campo>
      </div>
      {!ficha.areaDeclarada ? (
        <Campo etiqueta="Área de origen (según el closer)">
          <Select
            value={areaDeclaradaId}
            items={opciones.areas.map((a) => ({ value: a.id, label: a.nombre }))}
            onValueChange={(v: string | null) => setAreaDeclaradaId(v)}
          >
            <SelectTrigger className="w-full"><SelectValue placeholder="Elige un área" /></SelectTrigger>
            <SelectContent>
              {opciones.areas.map((a) => <SelectItem key={a.id} value={a.id}>{a.nombre}</SelectItem>)}
            </SelectContent>
          </Select>
        </Campo>
      ) : null}
      <Campo etiqueta="Plataforma de pago (opcional)">
        {opciones.plataformas.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Este programa no tiene plataformas de pago; agrégalas en la pestaña Programa.
          </p>
        ) : (
          <Select
            value={plataformaId}
            items={opciones.plataformas.map((p) => ({ value: p.id, label: p.nombre }))}
            onValueChange={(v: string | null) => setPlataformaId(v)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Sin plataforma" />
            </SelectTrigger>
            <SelectContent>
              {opciones.plataformas.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </Campo>
      <Campo etiqueta="Comprobante (link)" ayuda="Si no lo tienes ahora, lo pegas después.">
        <input type="url" className={claseInput} value={comprobante} onChange={(e) => setComprobante(e.target.value)} placeholder="https://drive.google.com/…" />
      </Campo>
    </DialogoForm>
  );
}

function DialogoComprobante({ abono, onCerrar }: { abono: FichaDeAbono; onCerrar: () => void }) {
  const { pendiente, correr } = useAccion();
  const [url, setUrl] = useState("");
  return (
    <DialogoForm
      titulo="Pegar comprobante"
      descripcion={`${monto(Number(abono.monto), abono.moneda)} del ${fecha(abono.fecha)}.`}
      pendiente={pendiente}
      onCerrar={onCerrar}
      deshabilitarConfirmar={url.trim() === ""}
      confirmar={{
        texto: "Guardar comprobante",
        enCurso: "Guardando…",
        onClick: () => correr(() => pegarComprobanteAccion({ abonoId: abono.id, comprobanteUrl: url.trim() }), {
          exito: "Comprobante guardado.",
          alExito: onCerrar,
        }),
      }}
    >
      <Campo etiqueta="Comprobante (link)">
        <input type="url" className={claseInput} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://drive.google.com/…" />
      </Campo>
    </DialogoForm>
  );
}

function DialogoAnularAbono({
  abono,
  nombreDeEtapa,
  onCerrar,
}: {
  abono: FichaDeAbono;
  nombreDeEtapa: Record<EtapaDeal, string>;
  onCerrar: () => void;
}) {
  const { pendiente, correr } = useAccion();
  const [motivo, setMotivo] = useState("");
  return (
    <DialogoForm
      titulo="Anular abono"
      descripcion={`${monto(Number(abono.monto), abono.moneda)} del ${fecha(abono.fecha)}. Deja de contar en la caja y el deal se recalcula solo. No se borra: queda tachado con tu nombre.`}
      pendiente={pendiente}
      peligro
      onCerrar={onCerrar}
      deshabilitarConfirmar={motivo.trim() === ""}
      confirmar={{
        texto: "Anular abono",
        enCurso: "Anulando…",
        onClick: () =>
          correr(() => anularAbonoAccion({ abonoId: abono.id, motivo }), {
            exito: (r) => (r.movioElDeal ? `Abono anulado. El deal volvió a ${nombreDeEtapa[r.etapa as EtapaDeal]}.` : "Abono anulado."),
            alExito: onCerrar,
          }),
      }}
    >
      <Campo etiqueta="¿Por qué se anula?" ayuda="Obligatorio.">
        <textarea className={claseTextarea} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      </Campo>
    </DialogoForm>
  );
}

function DialogoAcuerdo({ ficha, onCerrar }: { ficha: FichaDeDeal; onCerrar: () => void }) {
  const { pendiente, correr } = useAccion();
  const [acuerdo, setAcuerdo] = useState(ficha.acuerdoPago ?? "");
  const [limite, setLimite] = useState(ficha.fechaLimitePago ?? "");
  return (
    <DialogoForm
      titulo="Acuerdo de pago"
      descripcion="Lo que conversaron con el lead, en texto: “el otro 30% el 15 de octubre”."
      pendiente={pendiente}
      onCerrar={onCerrar}
      confirmar={{
        texto: "Guardar",
        enCurso: "Guardando…",
        onClick: () =>
          correr(() => editarAcuerdoAccion({ dealId: ficha.dealId, acuerdoPago: acuerdo, fechaLimitePago: limite || null }), {
            exito: "Acuerdo guardado.",
            alExito: onCerrar,
          }),
      }}
    >
      <Campo etiqueta="Acuerdo">
        <textarea className={claseTextarea} value={acuerdo} onChange={(e) => setAcuerdo(e.target.value)} maxLength={500} />
      </Campo>
      <Campo
        etiqueta="Fecha límite de pago"
        ayuda={ficha.fechaLimiteSugerida ? `No puede pasar del inicio de clases (${fecha(ficha.fechaLimiteSugerida)}).` : undefined}
      >
        <input type="date" className={claseInput} value={limite} max={ficha.fechaLimiteSugerida ?? undefined} onChange={(e) => setLimite(e.target.value)} />
      </Campo>
    </DialogoForm>
  );
}

function DialogoCohorte({ ficha, opciones, onCerrar }: { ficha: FichaDeDeal; opciones: OpcionesDeFicha; onCerrar: () => void }) {
  const { pendiente, correr } = useAccion();
  const [cohortId, setCohortId] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const destinos = opciones.cohortes.filter((c) => c.id !== ficha.cohorte?.id);
  return (
    <DialogoForm
      titulo="Cambiar de cohorte"
      descripcion="La venta cuenta donde el estudiante asiste. Queda escrito quién lo cambió y por qué."
      pendiente={pendiente}
      onCerrar={onCerrar}
      deshabilitarConfirmar={!cohortId || motivo.trim() === ""}
      confirmar={{
        texto: "Cambiar",
        enCurso: "Guardando…",
        onClick: () =>
          correr(() => cambiarCohorteAccion({ dealId: ficha.dealId, cohortId: cohortId!, motivo }), {
            exito: (r) =>
              r.fechaLimiteAjustada
                ? `Cohorte cambiada. La fecha límite de pago bajó al inicio de clases (${fecha(r.fechaLimiteAjustada)}).`
                : "Cohorte cambiada.",
            alExito: onCerrar,
          }),
      }}
    >
      <Campo etiqueta="Cohorte nueva" ayuda="Solo futuras o activas.">
        <Select value={cohortId} items={destinos.map((c) => ({ value: c.id, label: c.nombre }))} onValueChange={(v: string | null) => setCohortId(v)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Elige la cohorte" />
          </SelectTrigger>
          <SelectContent>
            {destinos.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Campo>
      <Campo etiqueta="Motivo" ayuda="Obligatorio.">
        <textarea className={claseTextarea} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      </Campo>
    </DialogoForm>
  );
}
