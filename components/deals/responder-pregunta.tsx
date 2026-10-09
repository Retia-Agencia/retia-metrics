"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { EtapaDeal, PendienteDeal } from "@/lib/deals/etapas";
import type { OpcionCatalogo } from "@/lib/queries/kanban";
import { DialogoMover, type DatosDialogo, type MovimientoDelDialogo } from "./dialogo-mover";
import { moverConHechoAccion, registrarActividadAccion } from "@/app/(app)/p/[programa]/deals/[id]/acciones";
import { accionDeFicha, enlaceDeAccion } from "./ficha/accion-pedida";
import { Campo, claseInput, claseTextarea, DialogoForm } from "./ficha/campos";
import { PREGUNTA_DE_ETAPA, type ClaveDestino, type Respuesta, type TipoDeActividad } from "./pregunta-de-etapa";
import type { CorreccionCliente, FlechaCliente, MapaTransiciones } from "./transiciones";
import { avisarCambioDeNotificaciones } from "@/lib/mi-espacio/aviso-notificaciones";

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
  saldo: number | null;
  moneda: string | null;
  llamada: { id: string; fecha: Date | string | null; closerNombre: string | null; notas: string | null } | null;
}

export interface OpcionesDeRespuesta {
  cohortes: OpcionCatalogo[];
  cohortesDestino: OpcionCatalogo[];
  motivos: { id: string; nombre: string; tipo: string; pideTexto?: boolean }[];
  plataformas: { id: string; nombre: string }[];
}

const TITULO_DE_ACTIVIDAD: Record<TipoDeActividad, string> = {
  contacto: "Registrar contacto",
  nota: "Nota",
};

const ETIQUETA_DE_ACTIVIDAD: Record<TipoDeActividad, string> = {
  contacto: "Contacto",
  nota: "Nota",
};

const EXITO_DE_ACTIVIDAD: Record<TipoDeActividad, string> = {
  contacto: "Contacto registrado.",
  nota: "Nota guardada.",
};

/** La flecha del mapa que toma una respuesta, para saber qué datos pide. */
function flechaDe(mapa: MapaTransiciones, deal: DealQueResponde, r: Respuesta): FlechaCliente | null {
  const a = r.accion;
  if (a.tipo === "retroceder") return mapa.find((f) => f.tipo === "etapa" && f.id === "RETRO" && f.de === deal.etapa) ?? null;
  if (a.tipo === "abono") {
    return mapa.find((f) => f.tipo === "etapa" && f.de === deal.etapa && f.a === "ganado_parcial")
      ?? mapa.find((f) => f.tipo === "etapa" && f.de === deal.etapa && f.a === "ganado_completo")
      ?? null;
  }
  if (a.tipo === "llamada" && a.uso === "agendar") return mapa.find((f) => f.tipo === "etapa" && f.de === deal.etapa && f.a === "agendado") ?? null;
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
  registrarActividad: (deal: DealQueResponde, tipos: readonly TipoDeActividad[]) => void;
  abrirDestino: (deal: DealQueResponde, destino: ClaveDestino, respuestas: readonly Respuesta[]) => void;
  corregir: (deal: DealQueResponde, correccion: CorreccionCliente) => void;
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
  const [correccionAbierta, setCorreccionAbierta] = useState<{ deal: DealQueResponde; correccion: CorreccionCliente } | null>(null);
  // El pop-up de actividad guarda los tipos que se pueden elegir y el que esta elegido: con
  // un solo tipo no hay selector; con varios ("Registrar actividad"), se escoge dentro.
  const [actividadAbierta, setActividadAbierta] = useState<{
    deal: DealQueResponde;
    tipos: readonly TipoDeActividad[];
    tipo: TipoDeActividad;
  } | null>(null);
  const [canal, setCanal] = useState("");
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);

  function abrirActividad(deal: DealQueResponde, tipos: readonly TipoDeActividad[]) {
    if (tipos.length === 0) return;
    setCanal("");
    setNota("");
    setGuardando(false);
    setActividadAbierta({ deal, tipos, tipo: tipos[0] });
  }

  /** Un tipo fijo (cuando "Mover a" dispara un contacto que mueve la etapa). */
  function registrar(deal: DealQueResponde, tipo: TipoDeActividad) {
    abrirActividad(deal, [tipo]);
  }

  /** El unico boton "Registrar actividad": pide el tipo entre los que no mueven. */
  function registrarActividad(deal: DealQueResponde, tipos: readonly TipoDeActividad[]) {
    abrirActividad(deal, tipos);
  }

  function elegir(deal: DealQueResponde, r: Respuesta) {
    if (r.accion.tipo === "actividad") {
      registrar(deal, r.accion.actividad);
      return;
    }
    const esHechoDelMovimiento = r.accion.tipo === "abono" || (r.accion.tipo === "llamada" && r.accion.uso === "agendar");
    const formulario = esHechoDelMovimiento ? null : accionDeFicha(r.accion);
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

  function corregir(deal: DealQueResponde, correccion: CorreccionCliente) {
    setCorreccionAbierta({ deal, correccion });
  }

  async function confirmar(
    deal: DealQueResponde,
    datos: DatosDialogo,
    destino: EtapaDeal,
    pendiente: PendienteDeal | null,
    correccion = false,
    tipoDeHecho?: MovimientoDelDialogo["hecho"],
  ) {
    setEnviando(true);
    const hecho = tipoDeHecho === "atendido" && datos.llamada
      ? { tipo: "atendido" as const, callId: deal.llamada?.id, dia: datos.llamada.dia, hora: datos.llamada.hora, linkGrain: datos.llamada.linkGrain }
      : tipoDeHecho === "agendado" && datos.llamada
        ? { tipo: "agendado" as const, dia: datos.llamada.dia, hora: datos.llamada.hora }
        : tipoDeHecho === "abono" && datos.abono
          ? { tipo: "abono" as const, fecha: datos.abono.fecha, monto: datos.abono.monto.trim(), plataformaId: datos.abono.plataformaId ?? undefined, comprobanteUrl: datos.abono.comprobanteUrl }
          : undefined;
    const r = await moverConHechoAccion({
      dealId: deal.dealId,
      a: destino,
      pendiente,
      correccion,
      motivoId: datos.motivoId ?? null,
      comentarioMotivo: datos.comentarioMotivo,
      hecho,
      datos: {
        descuentoUsd: datos.descuentoUsd,
        fechaLimitePago: datos.fechaLimitePago,
        cohorteDestinoId: datos.cohorteDestinoId,
        fechaSeguimiento: datos.fechaSeguimiento,
      },
    });
    setEnviando(false);
    if (r.ok) {
      if (correccion) {
        toast.success("Corrección guardada.", { duration: Infinity, closeButton: true });
      } else {
        toast.success(r.resumen[0], {
          description: r.resumen.slice(1).join(" ") || undefined,
          duration: Infinity,
          closeButton: true,
        });
      }
      setAbierta(null);
      setCorreccionAbierta(null);
      avisarCambioDeNotificaciones();
      alTerminar();
    } else {
      // Se dice QUE falta, no un generico (ticket 044).
      toast.error(r.error, { duration: 6000 });
    }
  }

  const ayudaActividad = actividadAbierta
    ? actividadAbierta.tipo === "contacto" && ["potencial", "registrado", "en_gestion"].includes(actividadAbierta.deal.etapa)
      ? `El deal pasa a ${nombreDeEtapa.contactado}.`
      : "No cambia la etapa; cuenta para el aviso de estancado."
    : undefined;

  let dialogo: ReactNode = actividadAbierta ? (
    <DialogoForm
      titulo={actividadAbierta.tipos.length > 1 ? "Registrar actividad" : TITULO_DE_ACTIVIDAD[actividadAbierta.tipo]}
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
            avisarCambioDeNotificaciones();
            alTerminar();
          } else toast.error(r.error, { duration: 6000 });
        },
      }}
    >
      {actividadAbierta.tipos.length > 1 ? (
        <Campo etiqueta="Tipo">
          <Select
            value={actividadAbierta.tipo}
            items={actividadAbierta.tipos.map((t) => ({ value: t, label: ETIQUETA_DE_ACTIVIDAD[t] }))}
            onValueChange={(v: string | null) =>
              v && setActividadAbierta((a) => (a ? { ...a, tipo: v as TipoDeActividad } : a))
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {actividadAbierta.tipos.map((t) => (
                <SelectItem key={t} value={t}>
                  {ETIQUETA_DE_ACTIVIDAD[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Campo>
      ) : null}
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
  ) : destinoAbierto ? (
    <DialogoForm
      titulo={destinoAbierto.destino === "ganado" ? "Ganado · registrar pago" : nombreDeEtapa[destinoAbierto.destino]}
      descripcion={destinoAbierto.deal.nombreLead}
      pendiente={false}
      onCerrar={() => setDestinoAbierto(null)}
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
        : accion.tipo === "abono"
          ? { dealId: deal.dealId, a: "ganado_parcial", pendiente: null, hecho: "abono" }
          : accion.tipo === "llamada" && accion.uso === "agendar"
            ? { dealId: deal.dealId, a: "agendado", pendiente: null, hecho: "agendado" }
            : { dealId: deal.dealId, a: accion.tipo === "mover" ? accion.a : deal.etapa, pendiente: accion.tipo === "mover" ? accion.pendiente : null, hecho: abierta.flecha.requisitos.includes("llamada_sucedio") ? "atendido" : undefined };
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
        cohortes={opciones.cohortesDestino}
        motivos={opciones.motivos}
        plataformas={opciones.plataformas}
        saldo={deal.saldo}
        moneda={deal.moneda}
        llamada={deal.llamada}
        fechaLimiteSugerida={deal.fechaLimiteSugerida ?? null}
        enviando={enviando}
        onConfirmar={(datos, destino) => void confirmar(deal, datos, destino, movimiento.pendiente, false, movimiento.hecho)}
      />
    );
  }
  if (correccionAbierta) {
    const { deal, correccion } = correccionAbierta;
    const movimiento: MovimientoDelDialogo = {
      dealId: deal.dealId,
      a: correccion.a,
      pendiente: correccion.pendiente,
      correccion: true,
      de: deal.etapa,
    };
    dialogo = (
      <DialogoMover
        abierto
        onAbrir={(v) => !v && setCorreccionAbierta(null)}
        flecha={correccion.flecha}
        titulo="Corregir último movimiento"
        rutaDeLaFicha={deal.rutaDeLaFicha}
        nombreLead={deal.nombreLead}
        movimiento={movimiento}
        nombreDeEtapa={nombreDeEtapa}
        cohortes={opciones.cohortesDestino}
        motivos={opciones.motivos}
        plataformas={opciones.plataformas}
        saldo={deal.saldo}
        moneda={deal.moneda}
        llamada={deal.llamada}
        enviando={enviando}
        onConfirmar={(datos, destino) => void confirmar(deal, datos, destino, correccion.pendiente, true, movimiento.hecho)}
      />
    );
  }
  return { elegir, registrar, registrarActividad, abrirDestino, corregir, dialogo };
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
