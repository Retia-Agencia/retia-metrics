"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { SubirArchivo } from "@/components/archivos/subir-archivo";
import { Enlace } from "@/components/enlace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { hoyEnBogota } from "@/lib/format";
import { asignarSkuAccion, crearPlataformaParaAbonoAccion, opcionesDeSkuDelDealAccion, pedirSubidaParaAbonoAccion } from "@/app/(app)/p/[programa]/deals/[id]/acciones";
import { Campo, claseInput } from "./ficha/campos";

export interface DatosFormularioAbono {
  lineaId: string | null;
  fecha: string;
  monto: string;
  moneda: "USD";
  plataformaId: string | null;
  comprobanteUrl: string;
  archivoId: string | null;
}

export function datosInicialesDeAbono(moneda: string = "USD"): DatosFormularioAbono {
  return { lineaId: null, fecha: hoyEnBogota(), monto: "", moneda: moneda as "USD", plataformaId: null, comprobanteUrl: "", archivoId: null };
}

type Plataforma = { id: string; nombre: string };
type OpcionesDeSku = Extract<Awaited<ReturnType<typeof opcionesDeSkuDelDealAccion>>, { ok: true }>;

export function FormularioAbono({ dealId, moneda, plataformas, datos: datosDelPadre, onChange, ticketDeshabilitado = false, motivoTicketDeshabilitado = "El deal ya está cerrado." }: {
  dealId: string;
  moneda: string;
  plataformas: Plataforma[];
  datos: DatosFormularioAbono;
  onChange: (datos: DatosFormularioAbono) => void;
  ticketDeshabilitado?: boolean;
  motivoTicketDeshabilitado?: string;
}) {
  const router = useRouter();
  const [opcionesSku, setOpcionesSku] = useState<OpcionesDeSku | null>(null);
  const [errorSku, setErrorSku] = useState<string | null>(null);
  const [cargandoSku, setCargandoSku] = useState(true);
  const [skuNuevo, setSkuNuevo] = useState("");
  const [asignando, iniciarAsignacion] = useTransition();
  // Sube para volver a pedir los SKUs (tras asignar uno); el efecto solo escribe estado tras la respuesta.
  const [versionSku, setVersionSku] = useState(0);
  useEffect(() => {
    let vigente = true;
    opcionesDeSkuDelDealAccion({ dealId }).then((resultado) => {
      if (!vigente) return;
      if (!resultado.ok) {
        setOpcionesSku(null);
        setErrorSku(resultado.error);
      } else {
        setErrorSku(null);
        setOpcionesSku(resultado);
        setSkuNuevo((actual) => resultado.skusActivos.some((sku) => sku.id === actual) ? actual : (resultado.skusActivos[0]?.id ?? ""));
      }
      setCargandoSku(false);
    }, () => {
      if (!vigente) return;
      setOpcionesSku(null);
      setErrorSku("No se pudieron cargar los SKUs.");
      setCargandoSku(false);
    });
    return () => { vigente = false; };
  }, [dealId, versionSku]);
  const lineas = opcionesSku?.lineas ?? [];
  const skusActivos = opcionesSku?.skusActivos ?? [];
  const vigentes = lineas.filter((linea) => linea.estado !== "anulada");
  // Con una sola línea vigente se preselecciona sin mutar lo que llega del padre.
  const datos = datosDelPadre.lineaId == null && vigentes.length === 1 ? { ...datosDelPadre, lineaId: vigentes[0].id } : datosDelPadre;
  // El padre decide con su propio estado: la preselección también se le informa.
  const lineaPreseleccionada = datosDelPadre.lineaId == null && vigentes.length === 1 ? vigentes[0].id : null;
  useEffect(() => {
    if (lineaPreseleccionada) onChange({ ...datosDelPadre, lineaId: lineaPreseleccionada });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineaPreseleccionada]);
  const cambiar = (cambio: Partial<DatosFormularioAbono>) => onChange({ ...datos, ...cambio });
  return <>
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">¿Qué SKU está pagando?</legend>
      {cargandoSku ? <p className="text-sm text-muted-foreground">Cargando SKUs…</p> : null}
      {!cargandoSku && errorSku ? <p className="text-sm text-tono-peligro">{errorSku}</p> : null}
      {!cargandoSku && !errorSku && vigentes.length > 0 ? <select
        className={claseInput}
        value={datos.lineaId ?? ""}
        disabled={ticketDeshabilitado}
        required
        onChange={(e) => cambiar({ lineaId: e.target.value })}
      >
        <option value="">Elige un SKU</option>
        {vigentes.map((linea) => <option key={linea.id} value={linea.id}>{linea.skuNombre} · {linea.skuCodigo} · {linea.cohorte}</option>)}
      </select> : null}
      {!cargandoSku && !errorSku && vigentes.length === 0 && skusActivos.length > 0 ? <p className="text-sm">Este deal no tiene SKU. Asígnale el que está pagando.</p> : null}
      {!cargandoSku && !errorSku && skusActivos.length === 0 ? <p className="text-sm text-tono-alerta">Este programa no tiene SKUs activos.</p> : null}
      {ticketDeshabilitado ? <p className="text-xs text-tono-alerta">{motivoTicketDeshabilitado}</p> : null}
      {!cargandoSku && !errorSku && skusActivos.length > 0 ? <div className="flex gap-2">
        <select className={claseInput} value={skuNuevo} onChange={(e) => setSkuNuevo(e.target.value)}>{skusActivos.map((sku) => <option key={sku.id} value={sku.id}>{sku.nombre} · {sku.codigo}</option>)}</select>
        <Button type="button" size="sm" disabled={!skuNuevo || asignando} onClick={() => iniciarAsignacion(async () => {
          const resultado = await asignarSkuAccion({ dealId, skuId: skuNuevo });
          if (!resultado.ok) { toast.error(resultado.error); return; }
          toast.success("SKU asignado");
          router.refresh();
          setVersionSku((v) => v + 1);
        })}>{vigentes.length > 0 ? "Asignar otro SKU" : "Asignar SKU"}</Button>
      </div> : null}
      {!cargandoSku && !errorSku && opcionesSku ? (opcionesSku.rutaCatalogoSkus
        ? <Enlace precarga="nunca" href={opcionesSku.rutaCatalogoSkus} className="inline-block text-xs text-marca-texto underline-offset-2 hover:underline">¿Falta el SKU? Créalo en el catálogo</Enlace>
        : <p className="text-xs text-muted-foreground">¿Falta el SKU? Pídele a gerencia que lo cree.</p>) : null}
    </fieldset>
    <div className="grid grid-cols-2 gap-3">
      <Campo etiqueta="Fecha del pago">
        <input type="date" className={claseInput} value={datos.fecha} onChange={(e) => cambiar({ fecha: e.target.value })} />
      </Campo>
      <Campo etiqueta={`Monto (${datos.moneda || moneda})`}>
        <input
          className={`${claseInput} cifra`}
          inputMode="decimal"
          value={datos.monto}
          onChange={(e) => cambiar({ monto: e.target.value })}
          placeholder="750.00"
        />
      </Campo>
    </div>
    <Campo etiqueta="Plataforma de pago">
      <ControlPlataforma
        dealId={dealId}
        plataformas={plataformas}
        value={datos.plataformaId}
        onValueChange={(plataformaId) => cambiar({ plataformaId })}
      />
    </Campo>
    <Campo etiqueta="Comprobante (link o archivo)" ayuda="Obligatorio. Pega un link o sube el archivo.">
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

export function ControlPlataforma({ dealId, plataformas: plataformasIniciales, value, onValueChange }: {
  dealId: string;
  plataformas: Plataforma[];
  value: string | null;
  onValueChange: (value: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [plataformas, setPlataformas] = useState(plataformasIniciales);
  const [error, setError] = useState<string | null>(null);
  const [creando, iniciarCreacion] = useTransition();
  const buscado = texto.trim();
  const clave = buscado.toLocaleLowerCase("es");
  const filtradas = plataformas.filter((p) => p.nombre.toLocaleLowerCase("es").includes(clave));
  const coincidenciaExacta = plataformas.some((p) => p.nombre.trim().toLocaleLowerCase("es") === clave);
  const seleccionada = plataformas.find((p) => p.id === value);

  function elegir(id: string) {
    onValueChange(id);
    setError(null);
    setTexto("");
    setAbierto(false);
  }

  function crear() {
    if (buscado.length < 2 || coincidenciaExacta) return;
    setError(null);
    iniciarCreacion(async () => {
      const resultado = await crearPlataformaParaAbonoAccion({ dealId, nombre: buscado });
      if (!resultado.ok) return setError(resultado.error);
      setPlataformas((actuales) => actuales.some((p) => p.id === resultado.plataforma.id)
        ? actuales
        : [...actuales, resultado.plataforma].sort((a, b) => a.nombre.localeCompare(b.nombre, "es")));
      elegir(resultado.plataforma.id);
    });
  }

  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <PopoverTrigger render={<Button type="button" variant="outline" className="w-full justify-between font-normal" aria-required="true" />}>
        <span className={seleccionada ? "truncate" : "truncate text-muted-foreground"}>{seleccionada?.nombre ?? "Elige una plataforma"}</span>
        <span aria-hidden>⌄</span>
      </PopoverTrigger>
      <PopoverContent className="w-(--anchor-width) p-2" aria-label="Elegir plataforma de pago">
        <div className="space-y-2">
          <Input autoFocus value={texto} onChange={(e) => { setTexto(e.target.value); setError(null); }} placeholder="Buscar o crear plataforma" aria-label="Nombre de la plataforma" />
          <div className="max-h-48 space-y-1 overflow-y-auto">
            {filtradas.map((p) => <Button key={p.id} type="button" size="sm" variant={value === p.id ? "secondary" : "ghost"} className="w-full justify-start" onClick={() => elegir(p.id)}>{p.nombre}</Button>)}
            {buscado.length >= 2 && !coincidenciaExacta ? <Button type="button" size="sm" variant="ghost" className="w-full justify-start" disabled={creando} onClick={crear}>{creando ? "Creando…" : `Crear «${buscado}»`}</Button> : null}
          </div>
          {error ? <p className="text-xs text-tono-peligro">{error}</p> : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
