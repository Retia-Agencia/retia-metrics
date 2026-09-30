"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fecha, fechaHoraEnBogota, hoyEnBogota, monto, saldoLegible } from "@/lib/format";
import type { FichaDeAbono, FichaDeDeal, OpcionesDeFicha } from "@/lib/queries/ficha-deal";
import {
  anularAbonoAccion,
  cambiarCohorteAccion,
  desmarcarOnboardedAccion,
  editarAcuerdoAccion,
  marcarOnboardedAccion,
  registrarAbonoAccion,
} from "@/app/(app)/p/[programa]/deals/[id]/acciones";
import { Campo, claseInput, claseTextarea, DialogoForm, Vacio } from "./campos";
import { useAccion } from "./uso-accion";

/**
 * El dinero y el pago del deal (ticket 074): precio, abonado y saldo, el acuerdo de pago,
 * los abonos y, si el deal ya es estudiante, su onboarding y su cohorte.
 *
 * - **Abonado y saldo salen de `saldosDeDeals`** (ADR 0024); esta pantalla no suma abonos.
 *   Los abonos anulados se muestran tachados y no entran en ninguna cifra.
 * - El acuerdo de pago es TEXTO (ADR 0053): no hay cuotas pactadas que pintar.
 * - Registrar un abono mueve la etapa SOLO (Abonado o Completo, por el saldo): el closer
 *   nunca mueve el deal a mano por dinero. Si el programa no tiene cohorte activa, el deal
 *   queda sin cohorte y la pantalla lo dice.
 */

type Dialogo =
  | { tipo: "abono" }
  | { tipo: "anular"; abono: FichaDeAbono }
  | { tipo: "acuerdo" }
  | { tipo: "cohorte" };

export function FichaPago({
  ficha,
  opciones,
  puedeTrabajar,
  puedeRegistrar,
}: {
  ficha: FichaDeDeal;
  opciones: OpcionesDeFicha;
  /** Su dueño o quien administra, sobre un deal que cuenta. */
  puedeTrabajar: boolean;
  /** Ademas trabaja leads (un gerente administra pero no registra plata, ADR 0003). */
  puedeRegistrar: boolean;
}) {
  const { pendiente, correr } = useAccion();
  const [dialogo, setDialogo] = useState<Dialogo | null>(null);
  const cerrar = () => setDialogo(null);

  const s = ficha.saldo;
  const moneda = s.moneda ?? "USD";
  const legible = saldoLegible(s.saldo, moneda);
  const anulado = ficha.anulado != null;
  const cerrado = ficha.etapa === "completo" || ficha.etapa === "cierre_perdido";
  const esEstudiante = ficha.etapa === "abonado" || ficha.etapa === "completo";
  const abonosActivos = puedeRegistrar && !anulado && !cerrado;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pago</CardTitle>
        {abonosActivos ? (
          <CardAction>
            <Button size="sm" variant="outline" onClick={() => setDialogo({ tipo: "abono" })} disabled={!ficha.producto}>
              Registrar abono
            </Button>
          </CardAction>
        ) : null}
      </CardHeader>

      <CardContent className="space-y-4">
        <dl className="grid grid-cols-3 gap-3">
          <div>
            <dt className="text-xs text-muted-foreground">Precio</dt>
            <dd className="cifra text-sm">{s.precio != null ? monto(s.precio, moneda) : "Sin producto"}</dd>
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
          <p className="text-xs text-tono-alerta">Hay abonos en otra moneda que el producto: el saldo no se calcula ni se convierte.</p>
        ) : null}
        {abonosActivos && !ficha.producto ? (
          <p className="text-xs text-muted-foreground">Elige un producto (Editar) antes de registrar un abono: sin producto no hay precio.</p>
        ) : null}

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
        <Vacio>Aún no hay abonos.{abonosActivos && ficha.producto ? " Registra el primero arriba." : ""}</Vacio>
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

      {dialogo?.tipo === "abono" ? <DialogoAbono ficha={ficha} opciones={opciones} onCerrar={cerrar} /> : null}
      {dialogo?.tipo === "anular" ? <DialogoAnularAbono abono={dialogo.abono} onCerrar={cerrar} /> : null}
      {dialogo?.tipo === "acuerdo" ? <DialogoAcuerdo ficha={ficha} onCerrar={cerrar} /> : null}
      {dialogo?.tipo === "cohorte" ? <DialogoCohorte ficha={ficha} opciones={opciones} onCerrar={cerrar} /> : null}
    </Card>
  );
}

function DialogoAbono({ ficha, opciones, onCerrar }: { ficha: FichaDeDeal; opciones: OpcionesDeFicha; onCerrar: () => void }) {
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
                return `Abono registrado. ${r.movioElDeal ? `El deal pasó a ${r.etapa === "completo" ? "Completo" : "Abonado"}.` : ""}${sinCohorte}`.trim();
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
      </Campo>
      <Campo etiqueta="Comprobante (link)" ayuda="Sin comprobante el deal no pasa a Abonado.">
        <input type="url" className={claseInput} value={comprobante} onChange={(e) => setComprobante(e.target.value)} placeholder="https://drive.google.com/…" />
      </Campo>
    </DialogoForm>
  );
}

function DialogoAnularAbono({ abono, onCerrar }: { abono: FichaDeAbono; onCerrar: () => void }) {
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
            exito: (r) => (r.movioElDeal ? `Abono anulado. El deal volvió a ${r.etapa}.` : "Abono anulado."),
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
