"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fecha } from "@/lib/format";
import type { FichaDeDeal, OpcionesDeFicha } from "@/lib/queries/ficha-deal";
import { anularDealAccion, cambiarCohorteAccion, editarDealAccion, marcarCortesiaAccion, type EntradaEditarDeal } from "@/app/(app)/p/[programa]/deals/[id]/acciones";
import { Campo, claseTextarea, DialogoForm } from "./campos";
import { useAccion } from "./uso-accion";

/**
 * Las acciones del encabezado de la ficha (ticket 074): editar, anular y **cambiar cohorte**
 * (ticket 227, antes dentro de Facturación; Mani, 9-oct: el cambio de cohorte tiene que ser
 * muy evidente, así que vive arriba, junto a Editar). La etapa se cambia desde la sección
 * Transición (`FichaTransicion`, ADR 0075), no aquí.
 *
 * - **Editar** solo ofrece lo que el servidor va a aceptar; la reja de verdad es de
 *   `editarDeal`. La etapa NO se edita aqui (solo `moverEtapa`).
 * - **Cambiar cohorte** mueve el deal YA a otra cohorte que vende hoy (o futura/activa si es
 *   estudiante), con el mismo `DialogoCohorte` y `cambiarCohorteAccion`. La reja de quién puede
 *   la pone `cambiarCohorte` en el servidor; el botón se muestra a quien el servidor acepta.
 *   Es OTRA cosa que Próxima cohorte (el deal espera una futura, sigue en Anotar).
 * - **Anular** deja la diferencia con Cierre Perdido escrita en el dialogo (decision 6):
 *   anular = "me equivoque al registrar" y deja de contar en todo; Cierre Perdido = "el lead
 *   dijo que no" y cuenta en el embudo. Nunca "anular" y "perder" a secas.
 */

export interface FichaAccionesProps {
  ficha: FichaDeDeal;
  opciones: OpcionesDeFicha;
  /** Puede editar y anular ESTE deal: su dueño o quien administra (proyeccion, la reja es el servidor). */
  puedeTrabajar: boolean;
  /** Puede reasignar el dueño: quien administra. */
  administra: boolean;
}

export function FichaAcciones({ ficha, opciones, puedeTrabajar, administra }: FichaAccionesProps) {
  const [editando, setEditando] = useState(false);
  const [anulando, setAnulando] = useState(false);
  const [marcandoCortesia, setMarcandoCortesia] = useState(false);
  const [cambiandoCohorte, setCambiandoCohorte] = useState(false);

  // Un deal anulado no se edita, ni se vuelve a anular.
  if (!puedeTrabajar || ficha.anulado) return null;
  const puedeEditarDatos = administra || ficha.etapa === "cierre_perdido";

  // Aviso de solapamiento (antes vivía en Facturación): si hoy venden dos o más cohortes, el
  // closer tiene que confirmar en cuál queda el deal, y lo hace con "Cambiar cohorte" de aquí.
  const esEstudiante = ficha.etapa === "ganado_parcial" || ficha.etapa === "ganado_completo";
  const cerrado = ficha.etapa === "ganado_completo" || ficha.etapa === "cierre_perdido";
  const codigosVendiendo = ficha.cohortesVendiendoHoy.map((cohorte) => cohorte.codigo);
  const listaCohortesVendiendo = codigosVendiendo.length === 2
    ? codigosVendiendo.join(" y ")
    : codigosVendiendo.length > 2
      ? `${codigosVendiendo.slice(0, -1).join(", ")} y ${codigosVendiendo.at(-1)}`
      : (codigosVendiendo[0] ?? "");
  const avisoSolapamiento = !esEstudiante && !cerrado && codigosVendiendo.length >= 2
    ? `Hoy venden ${codigosVendiendo.length === 2 ? "dos" : codigosVendiendo.length} cohortes (${listaCohortesVendiendo}): confirma en cuál queda este deal.`
    : null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {ficha.cortesia ? <Badge variant="info">Cortesía</Badge> : null}
      {puedeEditarDatos ? (
        <Button variant="outline" onClick={() => setEditando(true)}>
          Editar
        </Button>
      ) : null}
      <Button variant="outline" onClick={() => setCambiandoCohorte(true)}>
        Cambiar cohorte
      </Button>
      {avisoSolapamiento ? <Badge variant="alerta">{avisoSolapamiento}</Badge> : null}
      {administra && !ficha.cortesia && (["contactado", "calificado", "atendido", "compromiso_verbal"] as readonly string[]).includes(ficha.etapa) ? (
        <Button variant="outline" onClick={() => setMarcandoCortesia(true)}>
          Marcar como cortesía
        </Button>
      ) : null}
      <Button variant="destructive" onClick={() => setAnulando(true)}>
        Anular deal
      </Button>

      {editando && puedeEditarDatos ? (
        <DialogoEditar ficha={ficha} opciones={opciones} administra={administra} onCerrar={() => setEditando(false)} />
      ) : null}
      {cambiandoCohorte ? <DialogoCohorte ficha={ficha} opciones={opciones} onCerrar={() => setCambiandoCohorte(false)} /> : null}
      {anulando ? <DialogoAnular ficha={ficha} onCerrar={() => setAnulando(false)} /> : null}
      {marcandoCortesia ? <DialogoCortesia ficha={ficha} onCerrar={() => setMarcandoCortesia(false)} /> : null}
    </div>
  );
}

function DialogoCortesia({ ficha, onCerrar }: { ficha: FichaDeDeal; onCerrar: () => void }) {
  const { pendiente, correr } = useAccion();
  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Marcar como cortesía</DialogTitle>
          <DialogDescription>
            El deal pasa a Ganado Pagado Completo con valor vendido 0. Cuenta como Student, pero no como venta, ni en la
            tasa de cierre, ni en la comisión.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onCerrar} disabled={pendiente}>Cancelar</Button>
          <Button
            type="button"
            disabled={pendiente}
            onClick={() => correr(() => marcarCortesiaAccion({ dealId: ficha.dealId }), { exito: "Cortesía marcada.", alExito: onCerrar })}
          >
            {pendiente ? "Marcando…" : "Marcar cortesía"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ───────────────────────────────────────────── cambiar cohorte

/**
 * Cambiar cohorte (ticket 227, movido desde Facturación): mueve el deal YA a otra cohorte.
 * Para un deal normal, solo cohortes que venden hoy; para un estudiante, futuras o activas.
 * `cambiarCohorte` del servidor es la reja real y escribe el motivo en el historial.
 */
function DialogoCohorte({ ficha, opciones, onCerrar }: { ficha: FichaDeDeal; opciones: OpcionesDeFicha; onCerrar: () => void }) {
  const { pendiente, correr } = useAccion();
  const [cohortId, setCohortId] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const destinos = opciones.cohortes.filter((c) => c.id !== ficha.cohorte?.id);
  const esEstudiante = ficha.etapa === "ganado_parcial" || ficha.etapa === "ganado_completo";
  // Sin otra cohorte a la que mover, no hay selector que mostrar (ticket 229, A-139): un
  // mensaje dice por qué y no se ofrece Cambiar. El texto depende de qué cohortes cuentan:
  // para un estudiante, futuras o activas; para un deal normal, las que venden hoy.
  if (destinos.length === 0) {
    return (
      <Dialog open onOpenChange={(v) => !v && onCerrar()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cambiar de cohorte</DialogTitle>
            <DialogDescription>La venta cuenta donde el estudiante asiste.</DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {esEstudiante ? "No hay otra cohorte activa o futura." : "No hay otra cohorte vendiendo hoy."}
          </p>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onCerrar}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
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
      <Campo etiqueta="Cohorte nueva" ayuda={esEstudiante ? "Solo futuras o activas." : "Solo cohortes que están vendiendo hoy."}>
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

// ───────────────────────────────────────────── editar

function DialogoEditar({
  ficha,
  opciones,
  administra,
  onCerrar,
}: {
  ficha: FichaDeDeal;
  opciones: OpcionesDeFicha;
  administra: boolean;
  onCerrar: () => void;
}) {
  const { pendiente, correr } = useAccion();
  const [ownerId, setOwnerId] = useState<string | null>(ficha.owner?.id ?? null);
  const [motivoId, setMotivoId] = useState<string | null>(ficha.motivo?.id ?? null);

  const muestraMotivo = ficha.etapa === "cierre_perdido";
  const motivosDePerdida = opciones.motivos.filter((m) => m.tipo === "perdida");

  // Solo viaja lo que cambio: el servidor escribe un renglon de bitacora por campo tocado.
  const entrada: EntradaEditarDeal = { dealId: ficha.dealId };
  if (administra && ownerId && ownerId !== ficha.owner?.id) entrada.ownerUserId = ownerId;
  if (muestraMotivo && motivoId && motivoId !== ficha.motivo?.id) entrada.motivoId = motivoId;
  const hayCambios = Object.keys(entrada).length > 1;

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar deal</DialogTitle>
          <DialogDescription>
            Corrige el dueño o el motivo de pérdida; cada cambio queda en el historial.
          </DialogDescription>
        </DialogHeader>

        <div className="min-w-0 space-y-3">
          {administra ? (
            <Campo etiqueta="Dueño del deal" ayuda="Reasignar el trabajo de otro es de quien administra.">
              <Select
                value={ownerId}
                items={opciones.owners.map((o) => ({ value: o.id, label: o.nombre }))}
                onValueChange={(v: string | null) => setOwnerId(v)}
              >
                <SelectTrigger className="w-full min-w-0">
                  <SelectValue className="min-w-0 truncate" placeholder="Elige un closer" />
                </SelectTrigger>
                <SelectContent>
                  {opciones.owners.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>
          ) : null}

          {muestraMotivo ? (
            <Campo etiqueta="Motivo del Cierre Perdido">
              <Select
                value={motivoId}
                items={motivosDePerdida.map((m) => ({ value: m.id, label: m.nombre }))}
                onValueChange={(v: string | null) => setMotivoId(v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Elige un motivo" />
                </SelectTrigger>
                <SelectContent>
                  {motivosDePerdida.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>
          ) : null}

        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onCerrar} disabled={pendiente}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={pendiente || !hayCambios}
            onClick={() => correr(() => editarDealAccion(entrada), { exito: "Deal actualizado.", alExito: onCerrar })}
          >
            {pendiente ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ───────────────────────────────────────────── anular

function DialogoAnular({ ficha, onCerrar }: { ficha: FichaDeDeal; onCerrar: () => void }) {
  const { pendiente, correr } = useAccion();
  const [motivo, setMotivo] = useState("");
  const abonos = ficha.saldo.abonosVigentes;
  const bloqueado = abonos > 0;

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Anular este deal</DialogTitle>
          <DialogDescription>
            Anular es para cuando <strong>te equivocaste al registrar este deal</strong>: deja de contar en todas las
            métricas.
          </DialogDescription>
        </DialogHeader>

        <div className="min-w-0 space-y-3">
          <p className="rounded-lg bg-tono-info-suave p-3 text-sm text-tono-info">
            ¿El lead dijo que no? No lo anules: muévelo a <strong>Cierre Perdido</strong>. Ese sí cuenta en el embudo.
          </p>

          {bloqueado ? (
            <p className="rounded-lg bg-tono-alerta-suave p-3 text-sm text-tono-alerta">
              Este deal tiene {abonos} {abonos === 1 ? "abono vigente" : "abonos vigentes"}. Anula primero los abonos
              (el dinero no desaparece en silencio) y luego el deal.
            </p>
          ) : (
            <Campo etiqueta="¿Por qué se anula?" ayuda="Obligatorio. Queda escrito con tu nombre.">
              <textarea
                className={claseTextarea}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ej.: lo registré sobre el lead equivocado"
              />
            </Campo>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onCerrar} disabled={pendiente}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={pendiente || bloqueado || motivo.trim().length < 5}
            onClick={() =>
              correr(() => anularDealAccion({ dealId: ficha.dealId, motivo }), {
                exito: "Deal anulado: ya no cuenta en ninguna métrica.",
                alExito: onCerrar,
              })
            }
          >
            {pendiente ? "Anulando…" : "Anular deal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
