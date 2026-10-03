"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { EtapaDeal, PendienteDeal } from "@/lib/deals/etapas";
import type { OpcionCatalogo } from "@/lib/queries/kanban";
import { moverDeal } from "@/app/(app)/p/[programa]/deals/acciones";
import { DialogoMover, type DatosDialogo, type MovimientoDelDialogo } from "./dialogo-mover";
import { marcarLinkEnviadoAccion, registrarActividadAccion } from "@/app/(app)/p/[programa]/deals/[id]/acciones";
import { accionDeFicha, enlaceDeAccion } from "./ficha/accion-pedida";
import { Campo, claseInput, claseTextarea, DialogoForm } from "./ficha/campos";
import { PREGUNTA_DE_ETAPA, type ClaveDestino, type Respuesta } from "./pregunta-de-etapa";
import type { FlechaCliente, MapaTransiciones } from "./transiciones";

/**
 * Responder la pregunta de la etapa (ADR 0072 puntos 1 y 2). Lo usan la ficha, el Kanban
 * al soltar y la lista de llamadas del programa, así que una respuesta hace lo mismo
 * desde donde se tome:
 *
 * - una flecha (`mover`, `retroceder`) abre `DialogoMover`, que pide sus datos y muestra lo
 *   que el deal tiene y le falta, y confirma con `moverDeal`;
 * - una actividad abre su pop-up aquí;
 * - una llamada o un abono abren su formulario de siempre en la ficha (`?accion=…`).
 */
export interface DealQueResponde {
  dealId: string;
  etapa: EtapaDeal;
  pendiente: PendienteDeal | null;
  nombreLead: string;
  /** `/p/<programa>/deals/<id>`: donde viven los formularios. */
  rutaDeLaFicha: string;
  fechaLimiteSugerida?: string | null;
  linkAgenda?: string | null;
  tieneCitaVigente?: boolean;
}

export interface OpcionesDeRespuesta {
  areas: OpcionCatalogo[];
  cohortes: OpcionCatalogo[];
  motivos: { id: string; nombre: string; tipo: string }[];
}

type TipoDeActividad = "contacto" | "intento" | "nota";

const TITULO_DE_ACTIVIDAD: Record<TipoDeActividad, string> = {
  contacto: "Registrar contacto",
  intento: "Registrar intento",
  nota: "Nota",
};

const EXITO_DE_ACTIVIDAD: Record<TipoDeActividad, string> = {
  contacto: "Contacto registrado.",
  intento: "Intento registrado.",
  nota: "Nota guardada.",
};

/** La flecha del mapa que toma una respuesta, para saber qué datos pide. */
function flechaDe(mapa: MapaTransiciones, deal: DealQueResponde, r: Respuesta): FlechaCliente | null {
  const a = r.accion;
  if (a.tipo === "retroceder") return mapa.find((f) => f.tipo === "etapa" && f.id === "RETRO" && f.de === deal.etapa) ?? null;
  if (a.tipo !== "mover") return null;
  if (a.a !== deal.etapa) return mapa.find((f) => f.tipo === "etapa" && f.de === deal.etapa && f.a === a.a) ?? null;
  return mapa.find((f) => f.tipo === "pendiente" && f.de === deal.etapa && f.pendienteA === a.pendiente) ?? null;
}

/**
 * `elegir(deal, respuesta)` y el dialogo que hay que montar. El deal va en cada llamada
 * porque el Kanban usa una sola instancia para todas sus tarjetas. `alTerminar` corre
 * despues de un movimiento confirmado (refrescar, cerrar lo que haya abierto).
 */
export function useResponder(
  mapa: MapaTransiciones,
  opciones: OpcionesDeRespuesta,
  nombreDeEtapa: Record<EtapaDeal, string>,
  alTerminar: () => void,
): {
  elegir: (deal: DealQueResponde, r: Respuesta) => void;
  registrar: (deal: DealQueResponde, tipo: TipoDeActividad) => void;
  abrirDestino: (deal: DealQueResponde, destino: ClaveDestino, respuestas: readonly Respuesta[]) => void;
  dialogo: ReactNode;
} {
  const router = useRouter();
  const [abierta, setAbierta] = useState<{ deal: DealQueResponde; respuesta: Respuesta; flecha: FlechaCliente } | null>(null);
  const [destinoAbierto, setDestinoAbierto] = useState<{
    deal: DealQueResponde;
    destino: ClaveDestino;
    respuestas: readonly Respuesta[];
  } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [agendaAbierta, setAgendaAbierta] = useState<DealQueResponde | null>(null);
  const [marcandoLink, setMarcandoLink] = useState(false);
  const [actividadAbierta, setActividadAbierta] = useState<{ deal: DealQueResponde; tipo: TipoDeActividad } | null>(null);
  const [canal, setCanal] = useState("");
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);

  function registrar(deal: DealQueResponde, tipo: TipoDeActividad) {
    setCanal("");
    setNota("");
    setGuardando(false);
    setActividadAbierta({ deal, tipo });
  }

  function elegir(deal: DealQueResponde, r: Respuesta) {
    if (r.accion.tipo === "actividad") {
      registrar(deal, r.accion.actividad);
      return;
    }
    if (r.accion.tipo === "llamada" && r.accion.uso === "agendar" && !deal.tieneCitaVigente) {
      setAgendaAbierta(deal);
      return;
    }
    const formulario = accionDeFicha(r.accion);
    if (formulario) {
      router.push(enlaceDeAccion(deal.rutaDeLaFicha, formulario));
      return;
    }
    const flecha = flechaDe(mapa, deal, r);
    if (!flecha) {
      toast.error(`Desde ${nombreDeEtapa[deal.etapa]} no se puede: ${r.etiqueta}.`);
      return;
    }
    setAbierta({ deal, respuesta: r, flecha });
  }

  function abrirDestino(deal: DealQueResponde, destino: ClaveDestino, respuestas: readonly Respuesta[]) {
    if (respuestas.length === 1) elegir(deal, respuestas[0]);
    else if (respuestas.length > 1) setDestinoAbierto({ deal, destino, respuestas });
  }

  async function confirmar(deal: DealQueResponde, datos: DatosDialogo, destino: EtapaDeal, pendiente: PendienteDeal | null) {
    setEnviando(true);
    const r = await moverDeal({
      dealId: deal.dealId,
      a: destino,
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
    setEnviando(false);
    if (r.ok) {
      toast.success(destino === deal.etapa ? "Guardado." : `Movido a ${nombreDeEtapa[destino]}.`);
      setAbierta(null);
      alTerminar();
    } else {
      // Se dice QUE falta, no un generico (ticket 044).
      toast.error(r.faltantes.length > 0 ? r.faltantes.map((f) => f.mensaje).join(" ") : r.error, { duration: 6000 });
    }
  }

  const ayudaActividad = actividadAbierta
    ? actividadAbierta.tipo === "contacto" && ["potencial", "registrado", "en_gestion"].includes(actividadAbierta.deal.etapa)
      ? `El deal pasa a ${nombreDeEtapa.contactado}.`
      : actividadAbierta.tipo === "intento" && ["potencial", "registrado"].includes(actividadAbierta.deal.etapa)
        ? `El deal pasa a ${nombreDeEtapa.en_gestion}.`
        : undefined
    : undefined;

  let dialogo: ReactNode = actividadAbierta ? (
    <DialogoForm
      titulo={TITULO_DE_ACTIVIDAD[actividadAbierta.tipo]}
      descripcion={actividadAbierta.deal.nombreLead}
      pendiente={guardando}
      onCerrar={() => setActividadAbierta(null)}
      deshabilitarConfirmar={nota.trim() === ""}
      confirmar={{
        texto: "Registrar",
        enCurso: "Guardando…",
        onClick: async () => {
          setGuardando(true);
          const r = await registrarActividadAccion({
            dealId: actividadAbierta.deal.dealId,
            tipo: actividadAbierta.tipo,
            canal,
            nota,
          });
          setGuardando(false);
          if (r.ok) {
            toast.success(EXITO_DE_ACTIVIDAD[actividadAbierta.tipo]);
            setActividadAbierta(null);
            alTerminar();
          } else toast.error(r.error, { duration: 6000 });
        },
      }}
    >
      <Campo etiqueta="Canal">
        <input
          className={claseInput}
          list="canales-de-contacto"
          value={canal}
          onChange={(e) => setCanal(e.target.value)}
          placeholder="WhatsApp, Llamada…"
          maxLength={60}
        />
        <datalist id="canales-de-contacto">
          <option value="WhatsApp" />
          <option value="Llamada" />
          <option value="Correo" />
        </datalist>
      </Campo>
      <Campo etiqueta="¿Qué pasó?" ayuda={ayudaActividad}>
        <textarea
          className={claseTextarea}
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          rows={3}
          placeholder="Le escribí, quedó de responder el jueves…"
        />
      </Campo>
    </DialogoForm>
  ) : agendaAbierta ? (
    <DialogoForm
      titulo="Agendar llamada"
      descripcion={agendaAbierta.nombreLead}
      pendiente={marcandoLink}
      onCerrar={() => setAgendaAbierta(null)}
      confirmar={{
        texto: "Agregar la cita a mano",
        enCurso: "Abriendo…",
        onClick: () => {
          router.push(enlaceDeAccion(agendaAbierta.rutaDeLaFicha, "agendar"));
          setAgendaAbierta(null);
        },
      }}
    >
      <div className="space-y-3">
        {agendaAbierta.linkAgenda ? (
          <section className="space-y-2">
            <h3 className="text-sm font-medium">Link de agenda</h3>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input className={claseInput} readOnly value={agendaAbierta.linkAgenda} aria-label="Link de agenda" />
              <Button type="button" variant="outline" onClick={() => void navigator.clipboard.writeText(agendaAbierta.linkAgenda!)}>
                Copiar
              </Button>
            </div>
            <Button
              type="button"
              disabled={marcandoLink}
              onClick={async () => {
                setMarcandoLink(true);
                const r = await marcarLinkEnviadoAccion({ dealId: agendaAbierta.dealId });
                setMarcandoLink(false);
                if (r.ok) {
                  toast.success("Link marcado como enviado.");
                  setAgendaAbierta(null);
                  alTerminar();
                } else toast.error(r.error, { duration: 6000 });
              }}
            >
              {marcandoLink ? "Guardando…" : "Ya se lo mandé"}
            </Button>
          </section>
        ) : (
          <p className="text-sm text-muted-foreground">El programa no tiene link de Calendly.</p>
        )}
        <div className="border-t border-border pt-3">
          <p className="text-sm font-medium">Agregar la cita a mano</p>
          <p className="text-xs text-muted-foreground">Usa el formulario si la cita no llegó por Calendly.</p>
        </div>
      </div>
    </DialogoForm>
  ) : destinoAbierto ? (
    <DialogoForm
      titulo={destinoAbierto.destino === "ganado" ? "Ganado · registrar pago" : nombreDeEtapa[destinoAbierto.destino]}
      descripcion={destinoAbierto.deal.nombreLead}
      pendiente={false}
      onCerrar={() => setDestinoAbierto(null)}
      deshabilitarConfirmar
      confirmar={{ texto: "Elige una opción", enCurso: "Elige una opción", onClick: () => undefined }}
    >
      <BotonesDeRespuesta
        respuestas={destinoAbierto.respuestas}
        onElegir={(respuesta) => {
          const { deal } = destinoAbierto;
          setDestinoAbierto(null);
          elegir(deal, respuesta);
        }}
      />
    </DialogoForm>
  ) : null;
  if (abierta) {
    const { deal } = abierta;
    const accion = abierta.respuesta.accion;
    const movimiento: MovimientoDelDialogo =
      accion.tipo === "retroceder"
        ? { dealId: deal.dealId, a: "retroceso", pendiente: null }
        : { dealId: deal.dealId, a: accion.tipo === "mover" ? accion.a : deal.etapa, pendiente: accion.tipo === "mover" ? accion.pendiente : null };
    dialogo = (
      <DialogoMover
        abierto
        onAbrir={(v) => !v && setAbierta(null)}
        flecha={abierta.flecha}
        // Fuera de la ficha ("Sí" a secas no dice nada en el Kanban) va con su pregunta.
        titulo={[PREGUNTA_DE_ETAPA[deal.etapa].pregunta, abierta.respuesta.etiqueta].filter(Boolean).join(" · ")}
        rutaDeLaFicha={deal.rutaDeLaFicha}
        nombreLead={deal.nombreLead}
        movimiento={movimiento}
        nombreDeEtapa={nombreDeEtapa}
        areas={opciones.areas}
        cohortes={opciones.cohortes}
        motivos={opciones.motivos}
        fechaLimiteSugerida={deal.fechaLimiteSugerida ?? null}
        enviando={enviando}
        onConfirmar={(datos, destino) => void confirmar(deal, datos, destino, movimiento.pendiente)}
      />
    );
  }
  return { elegir, registrar, abrirDestino, dialogo };
}

/** Los botones de las respuestas, en el orden de la tabla. */
export function BotonesDeRespuesta({
  respuestas,
  onElegir,
  deshabilitado = false,
}: {
  respuestas: readonly Respuesta[];
  onElegir: (r: Respuesta) => void;
  deshabilitado?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {respuestas.map((r) => (
        <Button
          key={r.id}
          type="button"
          size="sm"
          variant={r.id === "descartar" ? "outline" : "secondary"}
          disabled={deshabilitado}
          onClick={() => onElegir(r)}
        >
          {r.etiqueta}
        </Button>
      ))}
    </div>
  );
}
