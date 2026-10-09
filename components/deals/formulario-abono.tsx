"use client";

import { useState, useTransition } from "react";
import { crearPlataformaParaAbonoAccion } from "@/app/(app)/p/[programa]/deals/[id]/acciones";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { hoyEnBogota } from "@/lib/format";
import { Campo, claseInput } from "./ficha/campos";

export interface DatosFormularioAbono {
  fecha: string;
  monto: string;
  plataformaId: string | null;
  comprobanteUrl: string;
}

export function datosInicialesDeAbono(): DatosFormularioAbono {
  return { fecha: hoyEnBogota(), monto: "", plataformaId: null, comprobanteUrl: "" };
}

export function FormularioAbono({
  dealId,
  moneda,
  plataformas,
  datos,
  onChange,
}: {
  dealId: string;
  moneda: string;
  plataformas: { id: string; nombre: string }[];
  datos: DatosFormularioAbono;
  onChange: (datos: DatosFormularioAbono) => void;
}) {
  const cambiar = (cambio: Partial<DatosFormularioAbono>) => onChange({ ...datos, ...cambio });
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Fecha del pago">
          <input type="date" className={claseInput} value={datos.fecha} onChange={(e) => cambiar({ fecha: e.target.value })} />
        </Campo>
        <Campo etiqueta={`Monto (${moneda})`}>
          <input className={`${claseInput} cifra`} inputMode="decimal" value={datos.monto} onChange={(e) => cambiar({ monto: e.target.value })} placeholder="750.00" />
        </Campo>
      </div>
      <Campo etiqueta="Plataforma de pago (opcional)">
        <ControlPlataforma
          dealId={dealId}
          plataformasIniciales={plataformas}
          value={datos.plataformaId}
          onValueChange={(plataformaId) => cambiar({ plataformaId })}
        />
      </Campo>
      <Campo etiqueta="Comprobante (link)" ayuda="Si no lo tienes ahora, lo pegas después.">
        <input type="url" className={claseInput} value={datos.comprobanteUrl} onChange={(e) => cambiar({ comprobanteUrl: e.target.value })} placeholder="https://drive.google.com/…" />
      </Campo>
    </>
  );
}

export function ControlPlataforma({
  dealId,
  plataformasIniciales,
  value,
  onValueChange,
}: {
  dealId: string;
  plataformasIniciales: { id: string; nombre: string }[];
  value: string | null;
  onValueChange: (value: string | null) => void;
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

  function elegir(id: string | null) {
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
      <PopoverTrigger render={<Button type="button" variant="outline" className="w-full justify-between font-normal" />}>
        <span className={seleccionada ? "truncate" : "truncate text-muted-foreground"}>{seleccionada?.nombre ?? "Sin plataforma"}</span>
        <span aria-hidden>⌄</span>
      </PopoverTrigger>
      <PopoverContent className="w-(--anchor-width) p-2" aria-label="Elegir plataforma de pago">
        <div className="space-y-2">
          <Input autoFocus value={texto} onChange={(e) => { setTexto(e.target.value); setError(null); }} placeholder="Buscar o crear plataforma" aria-label="Nombre de la plataforma" />
          <div className="max-h-48 space-y-1 overflow-y-auto">
            <Button type="button" size="sm" variant={value == null ? "secondary" : "ghost"} className="w-full justify-start" onClick={() => elegir(null)}>Sin plataforma</Button>
            {filtradas.map((p) => <Button key={p.id} type="button" size="sm" variant={value === p.id ? "secondary" : "ghost"} className="w-full justify-start" onClick={() => elegir(p.id)}>{p.nombre}</Button>)}
            {buscado.length >= 2 && !coincidenciaExacta ? <Button type="button" size="sm" variant="ghost" className="w-full justify-start" disabled={creando} onClick={crear}>{creando ? "Creando…" : `Crear «${buscado}»`}</Button> : null}
          </div>
          {error ? <p className="text-xs text-tono-peligro">{error}</p> : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
