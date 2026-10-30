"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { SubirArchivo } from "@/components/archivos/subir-archivo";
import { Button } from "@/components/ui/button";
import { hoyEnBogota, monto as formatoMonto } from "@/lib/format";
import type { EnlaceDeLaPantalla } from "@/lib/queries/recursos";
import { crearEnlaceParaAbonoAccion, pedirSubidaParaAbonoAccion } from "@/app/(app)/p/[programa]/deals/[id]/acciones";
import { Campo, claseInput } from "./ficha/campos";

export interface DatosFormularioAbono {
  fecha: string;
  monto: string;
  moneda: "USD";
  enlacePagoId: string | null;
  comprobanteUrl: string;
  archivoId: string | null;
}

export function datosInicialesDeAbono(moneda: string = "USD"): DatosFormularioAbono {
  return { fecha: hoyEnBogota(), monto: "", moneda: moneda as "USD", enlacePagoId: null, comprobanteUrl: "", archivoId: null };
}

type Plataforma = { id: string; nombre: string };

export function FormularioAbono({ dealId, moneda, plataformas, enlacesDePago, datos, onChange }: {
  dealId: string;
  moneda: string;
  plataformas: Plataforma[];
  enlacesDePago: EnlaceDeLaPantalla[];
  datos: DatosFormularioAbono;
  onChange: (datos: DatosFormularioAbono) => void;
}) {
  const cambiar = (cambio: Partial<DatosFormularioAbono>) => onChange({ ...datos, ...cambio });
  const tieneLink = datos.enlacePagoId != null;
  return <>
    <div className="grid grid-cols-2 gap-3">
      <Campo etiqueta="Fecha del pago">
        <input type="date" className={claseInput} value={datos.fecha} onChange={(e) => cambiar({ fecha: e.target.value })} />
      </Campo>
      <Campo etiqueta={`Monto (${datos.moneda || moneda})`}>
        <input
          className={`${claseInput} cifra`}
          inputMode="decimal"
          value={datos.monto}
          readOnly={tieneLink}
          onChange={(e) => cambiar({ monto: e.target.value })}
          placeholder="750.00"
        />
      </Campo>
    </div>
    <Campo etiqueta="Link de pago (opcional)">
      <ControlEnlacePago
        dealId={dealId}
        plataformas={plataformas}
        enlaces={enlacesDePago}
        value={datos.enlacePagoId}
        monto={datos.monto}
        moneda={datos.moneda || moneda}
        onValueChange={(enlacePagoId, enlace) => cambiar({
          enlacePagoId,
          ...(enlace ? { monto: enlace.monto, moneda: enlace.moneda as "USD" } : {}),
        })}
      />
    </Campo>
    <Campo etiqueta="Comprobante (link o archivo)" ayuda="Si no lo tienes ahora, lo agregas después.">
      <div className="space-y-3">
        <input type="url" className={claseInput} value={datos.comprobanteUrl} onChange={(e) => cambiar({ comprobanteUrl: e.target.value })} placeholder="https://…" />
        {datos.archivoId ? <div className="flex items-center gap-2">
          <span className="text-sm">Archivo listo</span>
          <Button type="button" size="xs" variant="ghost" onClick={() => cambiar({ archivoId: null })}>Quitar</Button>
        </div> : <SubirArchivo pedirSubida={(meta) => pedirSubidaParaAbonoAccion({ dealId, ...meta })} alSubir={(archivoId) => cambiar({ archivoId })} />}
      </div>
    </Campo>
  </>;
}

export function ControlEnlacePago({ dealId, plataformas, enlaces: enlacesIniciales, value, monto, moneda, restringirAMonto = false, onValueChange }: {
  dealId: string;
  plataformas: Plataforma[];
  enlaces: EnlaceDeLaPantalla[];
  value: string | null;
  monto: string;
  moneda: string;
  restringirAMonto?: boolean;
  onValueChange: (value: string | null, enlace?: EnlaceDeLaPantalla) => void;
}) {
  const [enlacesCreados, setEnlacesCreados] = useState<EnlaceDeLaPantalla[]>([]);
  const enlaces = useMemo(() => [...enlacesIniciales, ...enlacesCreados], [enlacesCreados, enlacesIniciales]);
  const elegido = enlaces.find((e) => e.id === value);
  const [plataformaId, setPlataformaId] = useState<string | null>(
    elegido?.plataformaId ?? (plataformas.length === 1 ? plataformas[0].id : null),
  );
  const autoSeleccionada = useRef<string | null>(value ? elegido?.plataformaId ?? null : null);
  const [creando, setCreando] = useState(false);
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [montoNuevo, setMontoNuevo] = useState(monto);
  const [monedaNueva, setMonedaNueva] = useState(moneda);
  const [urlNueva, setUrlNueva] = useState("");

  const enlacesDePlataforma = useMemo(
    () => enlaces.filter((e) =>
      e.plataformaId === plataformaId &&
      (!restringirAMonto || (Number(e.monto) === Number(monto) && e.moneda === moneda))),
    [enlaces, moneda, monto, plataformaId, restringirAMonto],
  );

  useEffect(() => {
    if (plataformaId && autoSeleccionada.current !== plataformaId && value == null && enlacesDePlataforma.length === 1) {
      autoSeleccionada.current = plataformaId;
      onValueChange(enlacesDePlataforma[0].id, enlacesDePlataforma[0]);
    }
  }, [enlacesDePlataforma, onValueChange, plataformaId, value]);

  const hayLinkParaMonto = plataformaId == null || monto.trim() === "" || enlaces.some(
    (e) => e.plataformaId === plataformaId && Number(e.monto) === Number(monto) && e.moneda === moneda,
  );

  function elegirPlataforma(id: string) {
    setPlataformaId(id);
    autoSeleccionada.current = id;
    setCreando(false);
    setError(null);
    const disponibles = enlaces.filter((e) => e.plataformaId === id && (!restringirAMonto || (Number(e.monto) === Number(monto) && e.moneda === moneda)));
    if (disponibles.length === 1) onValueChange(disponibles[0].id, disponibles[0]);
    else if (elegido?.plataformaId !== id) onValueChange(null);
  }

  async function copiar() {
    if (!elegido) return;
    try {
      await navigator.clipboard.writeText(elegido.url);
      toast.success("Link copiado");
    } catch {
      toast.error("No se pudo copiar el link");
    }
  }

  function crear() {
    if (!plataformaId) return;
    iniciar(async () => {
      setError(null);
      const resultado = await crearEnlaceParaAbonoAccion({
        dealId,
        plataformaId,
        nombre: nombreNuevo,
        monto: montoNuevo,
        moneda: monedaNueva as "USD",
        url: urlNueva,
      });
      if (!resultado.ok) return setError(resultado.error);
      setEnlacesCreados((actuales) => [...actuales, resultado.enlace]);
      onValueChange(resultado.enlace.id, resultado.enlace);
      setCreando(false);
      setNombreNuevo("");
      setUrlNueva("");
    });
  }

  return <div className="space-y-3">
    <div className="flex flex-wrap gap-2" aria-label="Plataforma de pago">
      {plataformas.map((plataforma) => (
        <Button
          key={plataforma.id}
          type="button"
          size="sm"
          variant={plataformaId === plataforma.id ? "secondary" : "outline"}
          onClick={() => elegirPlataforma(plataforma.id)}
        >
          {plataforma.nombre}
        </Button>
      ))}
    </div>
    {plataformaId ? <div className="space-y-2">
      <Button type="button" size="sm" variant={value == null ? "secondary" : "ghost"} className="w-full justify-start" onClick={() => {
        autoSeleccionada.current = plataformaId;
        onValueChange(null);
      }}>
        Sin link de pago
      </Button>
      {enlacesDePlataforma.map((enlace) => (
        <div key={enlace.id} className="flex min-w-0 items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={value === enlace.id ? "secondary" : "ghost"}
            className="min-w-0 flex-1 justify-between gap-3"
            onClick={() => onValueChange(enlace.id, enlace)}
          >
            <span className="truncate">{enlace.nombre}</span>
            <span className="cifra shrink-0">{formatoMonto(Number(enlace.monto), enlace.moneda)}</span>
          </Button>
          {value === enlace.id ? <Button type="button" size="sm" variant="outline" onClick={copiar}>Copiar</Button> : null}
        </div>
      ))}
      {!hayLinkParaMonto && value == null ? <p className="text-sm text-muted-foreground">
        No hay link de pago para este monto. Puedes guardar el abono sin link y asociarlo después.
      </p> : null}
      {!creando ? <Button type="button" size="sm" variant="outline" onClick={() => {
        setMontoNuevo(monto);
        setMonedaNueva(moneda);
        setCreando(true);
      }}>Crear link nuevo</Button> : <div className="space-y-2 rounded-lg bg-muted/50 p-3">
        <input className={claseInput} value={nombreNuevo} onChange={(e) => setNombreNuevo(e.target.value)} maxLength={80} placeholder="Nombre del link" aria-label="Nombre del link" />
        <div className="grid grid-cols-2 gap-2">
          <input className={`${claseInput} cifra`} value={montoNuevo} readOnly={restringirAMonto} onChange={(e) => setMontoNuevo(e.target.value)} inputMode="decimal" placeholder="Valor" aria-label="Valor del link" />
          <input className={claseInput} value={monedaNueva} readOnly aria-label="Moneda del link" />
        </div>
        <input className={claseInput} value={urlNueva} onChange={(e) => setUrlNueva(e.target.value)} type="url" placeholder="https://…" aria-label="URL del link" />
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" disabled={pendiente || !nombreNuevo.trim() || !montoNuevo.trim() || !urlNueva.trim()} onClick={crear}>
            {pendiente ? "Creando…" : "Crear y elegir"}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setCreando(false)}>Cancelar</Button>
        </div>
        {error ? <p className="text-sm text-tono-peligro">{error}</p> : null}
      </div>}
    </div> : <p className="text-sm text-muted-foreground">Elige una plataforma para ver sus links.</p>}
  </div>;
}
