"use client";

import { useState, useTransition } from "react";
import { SubirArchivo } from "@/components/archivos/subir-archivo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { hoyEnBogota } from "@/lib/format";
import { crearPlataformaParaAbonoAccion, pedirSubidaParaAbonoAccion } from "@/app/(app)/p/[programa]/deals/[id]/acciones";
import { Campo, claseInput, claseTextarea } from "./ficha/campos";

export interface DatosFormularioAbono {
  concepto: "ticket" | "adicional" | null;
  nota: string;
  fecha: string;
  monto: string;
  moneda: "USD";
  plataformaId: string | null;
  comprobanteUrl: string;
  archivoId: string | null;
}

export function datosInicialesDeAbono(moneda: string = "USD"): DatosFormularioAbono {
  return { concepto: null, nota: "", fecha: hoyEnBogota(), monto: "", moneda: moneda as "USD", plataformaId: null, comprobanteUrl: "", archivoId: null };
}

type Plataforma = { id: string; nombre: string };

export function FormularioAbono({ dealId, moneda, plataformas, datos, onChange, ticketDeshabilitado = false, motivoTicketDeshabilitado = "El deal ya está cerrado." }: {
  dealId: string;
  moneda: string;
  plataformas: Plataforma[];
  datos: DatosFormularioAbono;
  onChange: (datos: DatosFormularioAbono) => void;
  ticketDeshabilitado?: boolean;
  motivoTicketDeshabilitado?: string;
}) {
  const cambiar = (cambio: Partial<DatosFormularioAbono>) => onChange({ ...datos, ...cambio });
  return <>
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">¿Qué está pagando?</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={`rounded-lg border p-4 ${ticketDeshabilitado ? "cursor-not-allowed opacity-60" : "cursor-pointer"} ${datos.concepto === "ticket" ? "border-ring bg-muted/50 ring-2 ring-ring/30" : "border-border"}`}>
          <span className="flex items-start gap-3">
            <input
              type="radio"
              name={`concepto-abono-${dealId}`}
              value="ticket"
              checked={datos.concepto === "ticket"}
              disabled={ticketDeshabilitado}
              required
              onChange={() => cambiar({ concepto: "ticket", nota: "" })}
              className="mt-1"
            />
            <span>
              <span className="block text-sm font-medium">Programa (ticket)</span>
              <span className="mt-1 block text-sm text-muted-foreground">Cuenta contra el saldo del programa y mueve la etapa del deal.</span>
              {ticketDeshabilitado ? <span className="mt-2 block text-xs text-tono-alerta">{motivoTicketDeshabilitado}</span> : null}
            </span>
          </span>
        </label>
        <label className={`cursor-pointer rounded-lg border p-4 ${datos.concepto === "adicional" ? "border-ring bg-muted/50 ring-2 ring-ring/30" : "border-border"}`}>
          <span className="flex items-start gap-3">
            <input
              type="radio"
              name={`concepto-abono-${dealId}`}
              value="adicional"
              checked={datos.concepto === "adicional"}
              required
              onChange={() => cambiar({ concepto: "adicional" })}
              className="mt-1"
            />
            <span>
              <span className="block text-sm font-medium">Servicio adicional</span>
              <span className="mt-1 block text-sm text-muted-foreground">Es aparte del programa (por ejemplo, un one-to-one). Cuenta en caja, no cambia el saldo ni la etapa.</span>
            </span>
          </span>
        </label>
      </div>
    </fieldset>
    {datos.concepto ? <>
    {datos.concepto === "adicional" ? (
      <Campo etiqueta="¿Qué se vendió?" ayuda="Obligatorio. Máximo 500 caracteres.">
        <textarea
          className={claseTextarea}
          value={datos.nota}
          required
          maxLength={500}
          rows={3}
          onChange={(e) => cambiar({ nota: e.target.value })}
          placeholder="Por ejemplo, mentoría one-to-one"
        />
      </Campo>
    ) : null}
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
    </> : null}
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
