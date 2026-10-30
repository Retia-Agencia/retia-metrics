"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { ID_DE_SECCION } from "./accion-pedida";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fecha, fechaHoraEnBogota, monto, pct, saldoLegible, usd } from "@/lib/format";
import type { EtapaDeal } from "@/lib/deals/etapas";
import type { FichaDeAbono, FichaDeDeal, OpcionesDeFicha } from "@/lib/queries/ficha-deal";
import {
  anularAbonoAccion,
  cambiarEnlaceDeAbonoAccion,
  desmarcarOnboardedAccion,
  editarAcuerdoAccion,
  marcarOnboardedAccion,
  pegarComprobanteAccion,
  registrarAbonoAdicionalAccion,
  pedirSubidaComprobanteAccion,
  confirmarComprobanteAccion,
  editarDealAccion,
} from "@/app/(app)/p/[programa]/deals/[id]/acciones";
import { Campo, claseInput, claseTextarea, DialogoForm, Vacio } from "./campos";
import { useAccion } from "./uso-accion";
import { cn } from "@/lib/utils";
import { ControlEnlacePago } from "../formulario-abono";
import { SubirArchivo } from "@/components/archivos/subir-archivo";

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
  | { tipo: "adicional" }
  | { tipo: "anular"; abono: FichaDeAbono }
  | { tipo: "enlace"; abono: FichaDeAbono }
  | { tipo: "comprobante"; abono: FichaDeAbono }
  | { tipo: "acuerdo" }
  | { tipo: "descuento" };

export function FichaPago({
  ficha,
  opciones,
  puedeTrabajar,
  puedeRegistrar,
  hoy,
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
  /** Día de negocio calculado por el servidor en Bogotá. */
  hoy: string;
  /** Calculado en el servidor: esta etapa admite una flecha de pago. */
  aceptaAbono: boolean;
}) {
  const { programa: programaSlug } = useParams<{ programa: string }>();
  const { pendiente, correr } = useAccion();
  const [dialogo, setDialogo] = useState<Dialogo | null>(null);
  const cerrar = () => setDialogo(null);

  const s = ficha.saldo;
  const moneda = s.moneda ?? "USD";
  const legible = saldoLegible(s.saldo, moneda, s.sinSaldoPorque);
  const anulado = ficha.anulado != null;
  const cerrado = ficha.etapa === "ganado_completo" || ficha.etapa === "cierre_perdido";
  const esEstudiante = ficha.etapa === "ganado_parcial" || ficha.etapa === "ganado_completo";

  return (
    <Card id={ID_DE_SECCION.pago} className="scroll-mt-24">
      <CardHeader>
        <CardTitle>Facturación</CardTitle>
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
            <dd className="flex flex-col items-start gap-1 text-sm">
              <span className="cifra">{ficha.descuento ? `${usd(ficha.descuento.usd)} · ${pct(ficha.descuento.porcentaje)}` : "—"}</span>
              {puedeTrabajar && !anulado ? (
                <>
                  <Button size="xs" variant="ghost" onClick={() => setDialogo({ tipo: "descuento" })}>Editar descuento</Button>
                  <span className="text-xs text-muted-foreground">Cambia el valor vendido.</span>
                </>
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
            <dd className={legible.esCifra ? "cifra text-sm" : "text-sm"}>{legible.valor}</dd>
          </div>
        </dl>
        {s.sinSaldoPorque === "moneda_distinta" ? (
          <p className="text-xs text-tono-alerta">Hay abonos en otra moneda que el valor vendido: el saldo no se calcula ni se convierte.</p>
        ) : null}
        {puedeRegistrar && !anulado ? (
          <Button variant="secondary" onClick={() => setDialogo({ tipo: "adicional" })}>
            Registrar abono adicional
          </Button>
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
                    {enlace.nombre} · {enlace.plataformaNombre ?? "Sin plataforma"} · <span className="cifra">{monto(Number(enlace.monto), enlace.moneda)}</span>
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
          {puedeTrabajar && !anulado && !cerrado ? (
            <p className="text-xs text-muted-foreground">Fija la fecha límite y la de pago; no cambia la etapa.</p>
          ) : null}
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
            </div>
            {!ficha.cohorte ? (
              <p className="text-xs text-muted-foreground">
                El programa no tenía una cohorte activa al pagar, así que el deal quedó sin cohorte. Asígnala con
                “Cambiar cohorte”, arriba a la derecha.
              </p>
            ) : null}
          </div>
        ) : null}
      </CardContent>

      {/* Los abonos: los anulados se ven tachados, con quien y por que (ADR 0026 punto 4). */}
      {ficha.abonos.length === 0 ? (
        <Vacio>Aún no hay abonos.</Vacio>
      ) : (
        <ul className="divide-y border-t">
          {ficha.abonos.map((a) => {
            const anulada = a.anuladoEn != null;
            return (
              <li key={a.id} className={anulada ? "space-y-1 px-4 py-3 text-sm opacity-60" : "space-y-1 px-4 py-3 text-sm"}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={anulada ? "cifra line-through" : "cifra font-medium"}>{monto(Number(a.monto), a.moneda)}</span>
                  {a.concepto === "adicional" ? <Badge variant="info">Adicional</Badge> : null}
                  <span className="text-xs text-muted-foreground">{fecha(a.fecha)}</span>
                  {a.enlacePagoNombre ? <span className="text-xs text-muted-foreground">· {a.enlacePagoNombre}</span> : a.plataformaNombre ? <span className="text-xs text-muted-foreground">· {a.plataformaNombre}</span> : null}
                  {!a.enlacePagoId ? <Badge variant="alerta">Sin link de pago</Badge> : null}
                  {a.comprobanteUrl ? (
                    <a className="text-xs text-marca-texto underline-offset-2 hover:underline" href={a.comprobanteUrl} target="_blank" rel="noreferrer">
                      Comprobante
                    </a>
                  ) : null}
                  {a.comprobanteArchivoId ? (
                    <a
                      className="text-xs text-marca-texto underline-offset-2 hover:underline"
                      href={`/p/${programaSlug}/archivos/${a.comprobanteArchivoId}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Ver comprobante
                    </a>
                  ) : null}
                  {!a.comprobanteUrl && !a.comprobanteArchivoId && !anulada && puedeTrabajar && !anulado ? (
                    <Button size="xs" variant="secondary" onClick={() => setDialogo({ tipo: "comprobante", abono: a })}>
                      Agregar comprobante
                    </Button>
                  ) : null}
                  {!anulada && puedeRegistrar && !anulado ? (
                    <Button size="xs" variant="secondary" onClick={() => setDialogo({ tipo: "enlace", abono: a })}>
                      {a.enlacePagoId ? "Cambiar enlace" : "Asociar link"}
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
                {a.concepto === "adicional" && a.nota ? <p className="whitespace-pre-wrap text-xs text-muted-foreground">{a.nota}</p> : null}
              </li>
            );
          })}
        </ul>
      )}

      {dialogo?.tipo === "anular" ? <DialogoAnularAbono abono={dialogo.abono} nombreDeEtapa={nombreDeEtapa} onCerrar={cerrar} /> : null}
      {dialogo?.tipo === "adicional" ? <DialogoAbonoAdicional ficha={ficha} opciones={opciones} hoy={hoy} onCerrar={cerrar} /> : null}
      {dialogo?.tipo === "enlace" ? <DialogoCambiarEnlace ficha={ficha} abono={dialogo.abono} opciones={opciones} onCerrar={cerrar} /> : null}
      {dialogo?.tipo === "comprobante" ? <DialogoComprobante abono={dialogo.abono} onCerrar={cerrar} /> : null}
      {dialogo?.tipo === "acuerdo" ? <DialogoAcuerdo ficha={ficha} onCerrar={cerrar} /> : null}
      {dialogo?.tipo === "descuento" ? <DialogoDescuento ficha={ficha} onCerrar={cerrar} /> : null}
    </Card>
  );
}

function DialogoAbonoAdicional({
  ficha,
  opciones,
  hoy,
  onCerrar,
}: {
  ficha: FichaDeDeal;
  opciones: OpcionesDeFicha;
  hoy: string;
  onCerrar: () => void;
}) {
  const { pendiente, correr } = useAccion();
  const [dia, setDia] = useState(hoy);
  const [valor, setValor] = useState("");
  const [enlacePagoId, setEnlacePagoId] = useState<string | null>(null);
  const [nota, setNota] = useState("");
  return (
    <DialogoForm
      titulo="Registrar abono adicional"
      descripcion="Registra dinero vendido aparte del programa. Cuenta en caja y no cambia el ticket, el saldo ni la etapa."
      pendiente={pendiente}
      onCerrar={onCerrar}
      deshabilitarConfirmar={dia === "" || valor === ""}
      confirmar={{
        texto: "Registrar abono adicional",
        enCurso: "Registrando…",
        onClick: () => correr(
          () => registrarAbonoAdicionalAccion({
            dealId: ficha.dealId,
            fecha: dia,
            monto: valor,
            moneda: "USD",
            enlacePagoId: enlacePagoId ?? undefined,
            nota,
          }),
          { exito: "Abono adicional registrado.", alExito: onCerrar },
        ),
      }}
    >
      <Campo etiqueta="Fecha">
        <Input type="date" value={dia} onChange={(e) => setDia(e.currentTarget.value)} />
      </Campo>
      <Campo etiqueta="Monto (USD)">
        <Input type="number" min="0.01" max="99999999.99" step="0.01" value={valor} readOnly={enlacePagoId != null} onChange={(e) => setValor(e.currentTarget.value)} />
      </Campo>
      <Campo etiqueta="Link de pago (opcional)">
        <ControlEnlacePago
          dealId={ficha.dealId}
          plataformas={opciones.plataformas}
          enlaces={opciones.enlacesDePago}
          value={enlacePagoId}
          monto={valor}
          moneda="USD"
          onValueChange={(id, enlace) => {
            setEnlacePagoId(id);
            if (enlace) setValor(enlace.monto);
          }}
        />
      </Campo>
      <Campo etiqueta="Nota (opcional)" ayuda="Qué se vendió, por ejemplo: mentoría 1:1">
        <textarea className={claseTextarea} value={nota} onChange={(e) => setNota(e.target.value)} maxLength={500} />
      </Campo>
    </DialogoForm>
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

function DialogoCambiarEnlace({
  ficha,
  abono,
  opciones,
  onCerrar,
}: {
  ficha: FichaDeDeal;
  abono: FichaDeAbono;
  opciones: OpcionesDeFicha;
  onCerrar: () => void;
}) {
  const { pendiente, correr } = useAccion();
  const [enlacePagoId, setEnlacePagoId] = useState<string | null>(abono.enlacePagoId);
  return (
    <DialogoForm
      titulo="Cambiar enlace"
      descripcion={`${monto(Number(abono.monto), abono.moneda)} del ${fecha(abono.fecha)}. El monto y la fecha no cambian.`}
      pendiente={pendiente}
      onCerrar={onCerrar}
      confirmar={{
        texto: "Guardar enlace",
        enCurso: "Guardando…",
        onClick: () => correr(
          () => cambiarEnlaceDeAbonoAccion({ abonoId: abono.id, enlacePagoId }),
          { exito: "Enlace actualizado.", alExito: onCerrar },
        ),
      }}
    >
      <Campo etiqueta="Link de pago (opcional)">
        <ControlEnlacePago
          dealId={ficha.dealId}
          plataformas={opciones.plataformas}
          enlaces={opciones.enlacesDePago}
          value={enlacePagoId}
          monto={abono.monto}
          moneda={abono.moneda}
          restringirAMonto
          onValueChange={setEnlacePagoId}
        />
      </Campo>
    </DialogoForm>
  );
}

function DialogoComprobante({ abono, onCerrar }: { abono: FichaDeAbono; onCerrar: () => void }) {
  const { pendiente, correr } = useAccion();
  const [url, setUrl] = useState("");
  const [modo, setModo] = useState<"elegir" | "subir" | "link">("elegir");

  if (modo === "elegir") {
    return (
      <DialogoForm
        titulo="Agregar comprobante"
        descripcion={`${monto(Number(abono.monto), abono.moneda)} del ${fecha(abono.fecha)}.`}
        pendiente={false}
        onCerrar={onCerrar}
      >
        <div className="grid gap-2 sm:grid-cols-2">
          <Button type="button" onClick={() => setModo("subir")}>Subir archivo</Button>
          <Button type="button" variant="secondary" onClick={() => setModo("link")}>Pegar link</Button>
        </div>
      </DialogoForm>
    );
  }

  if (modo === "subir") {
    return (
      <DialogoForm
        titulo="Subir comprobante"
        descripcion={`${monto(Number(abono.monto), abono.moneda)} del ${fecha(abono.fecha)}.`}
        pendiente={false}
        onCerrar={onCerrar}
      >
        <SubirArchivo
          pedirSubida={(meta) => pedirSubidaComprobanteAccion({ abonoId: abono.id, ...meta })}
          alSubir={async (archivoId) => {
            const resultado = await confirmarComprobanteAccion({ abonoId: abono.id, archivoId });
            if (!resultado.ok) throw new Error(resultado.error);
            onCerrar();
          }}
        />
      </DialogoForm>
    );
  }

  return (
    <DialogoForm
      titulo="Pegar link del comprobante"
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
      <Campo etiqueta="Link del comprobante">
        <input type="url" className={claseInput} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
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
